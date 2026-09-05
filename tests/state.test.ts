import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createState, emptyFilters, filterPublications, makeThread, navigate, prepareReply } from '../src/state.js';
import { createRenderer, renderReading } from '../src/render.js';
import { parsePublications, topics } from '../src/types.js';

const papers = parsePublications(JSON.parse(await readFile(new URL('../../data/publications.json', import.meta.url), 'utf8')));

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

test('blank and oversized drafts do not create messages or consume input', () => {
  const thread = makeThread('work', 'work');
  for (const draft of ['  ', 'a'.repeat(2001)]) {
    thread.draft = draft;
    assert.equal(prepareReply(thread), undefined);
    assert.equal(thread.draft, draft);
    assert.equal(thread.messages.length, 0);
  }
});

test('paper navigation retains the origin, draft, scroll and filters through close and history traversal', () => {
  const state = createState();
  state.publications = papers;
  const chat = makeThread('conversation', 'chat');
  state.threads.set(chat.id, chat);
  for (const origin of ['#overview', '#work', '#publications', '#chat/conversation']) {
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
  state.publications = papers;
  for (const origin of [undefined, '#chat/expired', '#paper/paper-2', 'https://example.com']) {
    navigate(state, '#paper/paper-1', origin);
    assert.equal(state.current.topic, 'publications');
    assert.equal(state.paper?.returnHash, '#publications');
  }
  assert.equal(navigate(state, '#journey'), '#miscellaneous');
  assert.equal(state.current.topic, 'miscellaneous');
  assert.equal(navigate(state, '#publication'), '#publications');
  navigate(state, '#paper/missing');
  assert.equal(state.paper, null);
  assert.equal(state.current.topic, 'publications');
  for (const route of ['#chat/expired', '#chat/work', '#unknown']) {
    navigate(state, route);
    assert.equal(state.current.topic, 'overview');
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

test('both languages render every tab and reading mode shares full paper details', () => {
  for (const language of ['en', 'zh'] as const) {
    const renderer = createRenderer({ language, publications: papers, filters: emptyFilters(), loadFailed: false });
    for (const page of [...topics, 'chat'] as const) {
      assert.match(renderer.page(page), /id="messages"/);
      assert.doesNotMatch(renderer.page(page), /undefined/);
    }
    const navigation = renderer.navigation(makeThread('work', 'work'), []);
    assert.deepEqual([...navigation.main.matchAll(/href="#([^"]+)"/g)].map(match => match[1]), [...topics]);
    assert.match(renderer.page('work'), /id="journey-experience"/);
    assert.doesNotMatch(renderer.page('miscellaneous'), /id="journey-experience"/);
    for (const paper of papers) {
      assert.ok(renderer.paperDetail(paper).includes(paper.links.paper.replaceAll('&', '&amp;')));
    }
  }
  const reading = renderReading(papers);
  for (const paper of papers) assert.ok(reading.includes(`id="${paper.id}"`));
  assert.doesNotMatch(reading, /<script/);
});

test('dynamic paper and message text is escaped in every rendering surface', () => {
  const unsafe = '<img src=x onerror=alert(1)>';
  const paper = { ...papers[0], title: unsafe, authors: unsafe, links: { paper: 'javascript:alert(1)' } };
  const renderer = createRenderer({ language: 'en', publications: [paper], filters: emptyFilters(), loadFailed: false });
  const thread = makeThread('test', 'chat');
  thread.messages.push({ id: 'message', role: 'user', text: unsafe });
  for (const html of [renderer.papers([paper]), renderer.paperDetail(paper), renderer.paperContext(paper), renderer.messages(thread), renderReading([paper])]) {
    assert.ok(html.includes('&lt;img'));
    assert.ok(!html.includes(unsafe));
    assert.doesNotMatch(html, /href="javascript:/);
  }
});
