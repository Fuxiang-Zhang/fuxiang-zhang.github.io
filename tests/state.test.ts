import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createState, emptyFilters, filterPublications, makeThread, navigate, prepareReply, isKeptChat, pruneEmptyChats, showContent, startConversation } from '../src/state.js';
import { authorMarkup, createRenderer, inline, renderReading } from '../src/render.js';
import { categories, emptySite, loadSiteData, topics, type Content } from '../src/types.js';
import { tokenize, tokensPerTick } from '../src/stream.js';
import { copy } from '../src/content.js';

const site = await loadSiteData(async path => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')));
const papers = site.publications;

test('retry preserves the next draft and uses the original paper context', () => {
  for (const status of ['error', 'stopped'] as const) {
    const thread = makeThread('conversation', 'chat');
    thread.draft = '  Original question  ';
    thread.paperId = 'paper-1';
    const reply = prepareReply(thread);
    assert.ok(reply);
    assert.equal(thread.draft, '');
    assert.equal(thread.messages.length, 2);
    reply.state = status;
    thread.draft = 'New question, not yet sent';
    thread.paperId = 'paper-2';
    assert.equal(prepareReply(thread, reply.id), reply);
    assert.equal(thread.draft, 'New question, not yet sent');
    assert.equal(reply.prompt, 'Original question');
    assert.equal(reply.paperId, 'paper-1');
    assert.equal(reply.state, 'pending');
    assert.equal(thread.messages.length, 2);
    assert.equal(prepareReply(thread, reply.id), undefined, 'cannot retry a pending reply');
    assert.equal(prepareReply(thread, 'missing'), undefined);
    assert.equal(thread.draft, 'New question, not yet sent');
  }
});

test('questions typed in a session move to their own conversation when sent, keeping any paper context', () => {
  const state = createState();
  state.site = site;
  navigate(state, '#bio');
  state.current.draft = 'What do you work on?';
  const plain = startConversation(state, state.current, 'plain-chat');
  assert.equal(plain.intro, undefined, 'no greeting for conversations started from a session');
  assert.equal(plain.paperId, null);
  assert.equal(plain.title, undefined);
  assert.equal(prepareReply(plain)?.prompt, 'What do you work on?');
  assert.equal(plain.title, 'What do you work on?');
  assert.equal(state.current.draft, '');
  assert.equal(state.current.messages.length, 0);
  navigate(state, '#publications');
  const session = state.current;
  session.paperId = papers[0].id;
  session.draft = 'Tell me about this paper: ' + papers[0].title;
  const chat = startConversation(state, session, 'paper-chat', papers[0]);
  assert.equal(session.paperId, null);
  assert.equal(session.draft, '');
  assert.equal(chat.topic, 'chat');
  assert.equal(chat.paperId, papers[0].id);
  assert.equal(chat.title, papers[0].title);
  assert.match(chat.draft, /Tell me about this paper/);
  assert.deepEqual(state.chatOrder, ['plain-chat', 'paper-chat']);
  assert.equal(navigate(state, '#chat/paper-chat'), '#chat/paper-chat');
  assert.equal(state.current, chat);
  const reply = prepareReply(chat);
  assert.equal(reply?.paperId, papers[0].id);
  assert.equal(session.messages.length, 0);
});

test('conversations opened but never used disappear once the visitor moves on', () => {
  const state = createState();
  state.site = site;
  const empty = makeThread('empty', 'chat');
  const drafted = makeThread('drafted', 'chat');
  drafted.draft = 'unsent question';
  const used = makeThread('used', 'chat');
  used.draft = 'hello';
  prepareReply(used);
  for (const thread of [empty, drafted, used]) {
    state.threads.set(thread.id, thread);
    state.chatOrder.push(thread.id);
  }
  assert.deepEqual([empty, drafted, used].map(isKeptChat), [false, true, true]);
  navigate(state, '#chat/empty');
  pruneEmptyChats(state, state.current);
  assert.deepEqual(state.chatOrder, ['empty', 'drafted', 'used'], 'the conversation being viewed survives');
  navigate(state, '#bio');
  pruneEmptyChats(state, state.current);
  assert.deepEqual(state.chatOrder, ['drafted', 'used']);
  assert.equal(state.threads.has('empty'), false);
  navigate(state, '#chat/empty');
  assert.equal(state.current.topic, 'bio', 'a pruned conversation is no longer routable');
});

test('blank and oversized drafts do not create messages or consume input', () => {
  const thread = makeThread('experiences', 'experiences');
  for (const draft of ['  ', 'a'.repeat(2001)]) {
    thread.draft = draft;
    assert.equal(prepareReply(thread), undefined);
    assert.equal(thread.draft, draft);
    assert.equal(thread.messages.length, 0);
  }
});

test('paper navigation retains the origin, draft, scroll and filters through close and history traversal', () => {
  const state = createState();
  state.site = site;
  const chat = makeThread('conversation', 'chat');
  state.threads.set(chat.id, chat);
  for (const origin of ['#bio', '#experiences', '#publications', '#chat/conversation']) {
    navigate(state, origin);
    const original = state.current;
    original.draft = 'Unsent draft';
    original.scroll = 320;
    state.filters = { ...emptyFilters(), query: 'reward', topic: 'llm' };
    navigate(state, '#paper/paper-1', origin);
    assert.equal(state.current, original);
    assert.deepEqual(state.paper, { id: 'paper-1', returnHash: origin });
    navigate(state, state.paper.returnHash);
    assert.equal(state.paper, null);
    assert.equal(state.current, original);
    navigate(state, '#paper/paper-1', origin); // Browser Forward restores history.state.paperOrigin.
    assert.equal(state.current, original);
    assert.equal(state.current.draft, 'Unsent draft');
    assert.equal(state.current.scroll, 320);
    assert.equal(state.filters.query, 'reward');
  }
});

test('direct paper links, aliases and unavailable chat routes have stable fallbacks', () => {
  const state = createState();
  state.site = site;
  for (const origin of [undefined, '#chat/expired', '#paper/paper-2', 'https://example.com']) {
    navigate(state, '#paper/paper-1', origin);
    assert.equal(state.current.topic, 'publications');
    assert.equal(state.paper?.returnHash, '#publications');
  }
  for (const legacy of ['#journey', '#work']) {
    assert.equal(navigate(state, legacy), '#experiences');
    assert.equal(state.current.topic, 'experiences');
  }
  assert.equal(navigate(state, '#publication'), '#publications');
  assert.equal(navigate(state, '#overview'), '#bio');
  assert.equal(state.current.topic, 'bio');
  assert.equal(navigate(state, '#research'), '#research');
  assert.equal(state.current.topic, 'research');
  navigate(state, '#paper/missing');
  assert.equal(state.paper, null);
  assert.equal(state.current.topic, 'publications');
  for (const route of ['#chat/expired', '#chat/experiences', '#unknown']) {
    navigate(state, route);
    assert.equal(state.current.topic, 'bio');
  }
});

test('publication search combines filters without mutating the source order', () => {
  const original = papers.map(paper => paper.id);
  const target = papers[0];
  const result = filterPublications(papers, {
    query: `  ${target.title.toUpperCase()}  `, year: String(target.year), topic: target.topic, category: target.category,
  });
  assert.deepEqual(result.map(paper => paper.id), [target.id]);
  assert.deepEqual(papers.map(paper => paper.id), original);
  assert.equal(filterPublications(papers, { ...emptyFilters(), query: 'no such publication' }).length, 0);
});

test('every session, content reply and the reading view render every category of site data', () => {
  const renderer = createRenderer({ site, loadFailed: false });
  for (const page of [...topics, 'chat'] as const) {
    assert.match(renderer.page(page), /id="messages"/);
    assert.match(renderer.page(page), /class="message bot-message opening"/);
    assert.doesNotMatch(renderer.page(page), /undefined/);
  }
  assert.doesNotMatch(renderer.page('chat', false), /opening|data-suggest/, 'conversations started from a session have no greeting');
  assert.match(renderer.page('chat', false), /id="messages"/);
  const navigation = renderer.navigation(makeThread('experiences', 'experiences'), []);
  assert.deepEqual([...navigation.main.matchAll(/href="#([^"]+)"/g)].map(match => match[1]), [...topics]);
  const reply = (content: Content) => {
    const thread = makeThread('bio', 'bio');
    const message = showContent(thread, content);
    const html = renderer.messages(thread);
    assert.match(html, new RegExp(`id="message-${message.id}"`));
    assert.doesNotMatch(html, /undefined/);
    return html;
  };
  assert.match(renderer.page('experiences'), /id="journey-experience"/);
  assert.match(renderer.page('experiences'), /id="journey-education"/);
  assert.doesNotMatch(renderer.page('miscellaneous'), /id="journey-(experience|education)"/);
  assert.match(renderer.page('miscellaneous'), /id="journey-service"/);
  assert.equal((reply({ kind: 'publications' }).match(/class="paper"/g) ?? []).length, papers.length);
  for (const category of categories) {
    const expected = papers.filter(paper => paper.category === category);
    assert.equal((reply({ kind: 'publications', category }).match(/class="paper"/g) ?? []).length, expected.length);
  }
  assert.equal((reply({ kind: 'publications', topic: 'marl' }).match(/class="paper"/g) ?? []).length, papers.filter(paper => paper.topic === 'marl').length);
  for (const paper of papers) {
    assert.ok(renderer.paperDetail(paper).includes(paper.links.paper.replaceAll('&', '&amp;')));
    assert.ok(reply({ kind: 'paper', paperId: paper.id }).includes(paper.links.paper.replaceAll('&', '&amp;')));
  }
  assert.match(reply({ kind: 'paper', paperId: 'missing' }), /empty-results/);
  const thread = makeThread('bio', 'bio');
  const first = showContent(thread, { kind: 'publications', category: 'journal' });
  assert.equal(showContent(thread, { kind: 'publications', category: 'journal' }), first, 'repeated clicks reuse the last reply');
  assert.notEqual(showContent(thread, { kind: 'publications', category: 'conference' }), first);
  assert.equal(thread.messages.length, 2);
  const bio = renderer.page('bio');
  const research = renderer.page('research');
  for (const paragraph of site.profile.bio) assert.ok(bio.includes(inline(paragraph)));
  assert.match(bio, /data-show="research"/);
  assert.match(bio, /data-show="publications"/);
  for (const interest of site.interests) assert.ok(reply({ kind: 'research' }).includes(interest.title));
  for (const interest of site.interests) {
    assert.ok(research.includes(interest.title) && research.includes(inline(interest.description)));
    assert.ok(!bio.includes(interest.title), 'research has its own session');
  }
  for (const point of site.interests.flatMap(interest => interest.points ?? [])) {
    assert.ok(research.includes(point.title) && research.includes(inline(point.description)));
    if (point.topic) assert.ok(research.includes(`data-show="publications" data-topic="${point.topic}"`));
  }
  assert.ok(!bio.includes(site.profile.email), 'quick links live in the sidebar');
  const pubs = renderer.page('publications');
  for (const paper of site.publications) {
    assert.ok(pubs.includes(authorMarkup(paper.authors)), `full author list for ${paper.id}`);
    assert.ok(pubs.includes(`data-paper="${paper.id}"`) && pubs.includes(`data-ask="${paper.id}"`), paper.id);
  }
  assert.doesNotMatch(pubs, /…/, 'nothing is abbreviated');
  assert.equal(pubs.match(/class="paper"/g)?.length, site.publications.length);
  const card = renderer.profileCard();
  for (const text of [site.profile.email, site.profile.photo, ...site.profile.links.map(link => link.url)]) assert.ok(card.includes(text), text);
  for (const link of site.profile.links) assert.ok(card.includes(`aria-label="${link.label}"`) && card.includes('<svg'), link.label);
  assert.doesNotMatch(createRenderer({ site: emptySite(), loadFailed: true }).profileCard(), /undefined|mailto/);
  assert.doesNotMatch(bio, /assistant/i);
  const publications = renderer.page('publications');
  for (const category of categories) {
    const group = papers.filter(paper => paper.category === category);
    assert.equal(publications.includes(`${copy[category]} <span class="content-count">${group.length}</span>`), group.length > 0, category);
  }
  assert.equal((publications.match(/data-paper=/g) ?? []).length, papers.length, 'the opening lists every publication');
  const nav = renderer.navigation(makeThread('bio', 'bio'), [makeThread('c1', 'chat')]);
  assert.match(nav.history, /#chat\/c1/);
  assert.equal(navigation.history, '');
  const reading = renderReading(site);
  for (const paper of papers) assert.ok(reading.includes(`id="${paper.id}"`));
  const sessions = renderer.page('experiences') + renderer.page('miscellaneous');
  for (const entry of [...site.education.map(e => e.institution), ...site.experience.map(e => e.organization), ...site.service.map(e => e.venue), ...site.awards.map(e => e.title)]) {
    assert.ok(reading.includes(entry), entry);
    assert.ok(sessions.includes(entry), entry);
  }
  assert.ok(!renderer.page('miscellaneous').includes(site.profile.email), 'contact lives in the sidebar');
  assert.doesNotMatch(reading, /<script/);
  const empty = createRenderer({ site: emptySite(), loadFailed: true });
  for (const page of [...topics, 'chat'] as const) assert.doesNotMatch(empty.page(page), /undefined/);
  const failed = makeThread('bio', 'bio');
  for (const content of [{ kind: 'research' }, { kind: 'publications' }, { kind: 'paper', paperId: 'x' }] as const) showContent(failed, content);
  assert.doesNotMatch(empty.messages(failed), /undefined/);
});

test('reply streaming splits text into whitespace-preserving tokens and paces long replies', () => {
  assert.deepEqual(tokenize('Hi,  I’m Fuxiang.\nNext'), ['Hi,  ', 'I’m ', 'Fuxiang.\n', 'Next']);
  assert.equal(tokenize('  ').join(''), '  ');
  assert.deepEqual(tokenize(''), []);
  assert.equal(tokensPerTick(20, 1600, 24), 1, 'short replies stream one token at a time');
  assert.ok(tokensPerTick(3000, 1600, 24) * (1600 / 24) >= 3000, 'long replies still finish near the target');
});

test('inline site text keeps only safe links and escapes everything else', () => {
  assert.equal(inline('See [NTU](https://www.ntu.edu.sg/) & <b>more</b>'),
    'See <a href="https://www.ntu.edu.sg/" target="_blank" rel="noopener noreferrer">NTU</a> &amp; &lt;b&gt;more&lt;/b&gt;');
  assert.equal(inline('[bad](javascript:alert(1))'), '[bad](javascript:alert(1))');
});

test('dynamic paper and message text is escaped in every rendering surface', () => {
  const unsafe = '<img src=x onerror=alert(1)>';
  const paper = { ...papers[0], title: unsafe, authors: unsafe, links: { paper: 'javascript:alert(1)' } };
  const renderer = createRenderer({ site: { ...site, publications: [paper] }, loadFailed: false });
  const thread = makeThread('test', 'chat');
  thread.messages.push({ id: 'message', role: 'user', text: unsafe });
  showContent(thread, { kind: 'paper', paperId: paper.id });
  showContent(thread, { kind: 'publications' });
  for (const html of [renderer.papers([paper]), renderer.page('publications'), renderer.paperDetail(paper), renderer.paperContext(paper), renderer.messages(thread), renderReading({ ...site, publications: [paper] })]) {
    assert.ok(html.includes('&lt;img'));
    assert.ok(!html.includes(unsafe));
    assert.doesNotMatch(html, /href="javascript:/);
  }
});
