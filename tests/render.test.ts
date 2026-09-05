import test from 'node:test';
import assert from 'node:assert/strict';
import { isOfftopicReply, MAX_PAPER_CARDS, OFFTOPIC_MARKER, stripPaperMarkers } from '../src/chat.js';
import { copy } from '../src/content.js';
import { createRenderer, inline, renderReading } from '../src/render.js';
import { makeThread, showContent } from '../src/state.js';
import { categories, emptySite, researchTopics, topics, type Content } from '../src/types.js';
import { assertLink, assertText, site, textContent } from './helpers.js';

const papers = site.publications;
const renderer = createRenderer({ site, loadFailed: false });
const reply = (content: Content) => {
  const thread = makeThread('content', 'chat');
  showContent(thread, content);
  return renderer.messages(thread);
};

test('both homepage views preserve profile, research and CV facts and links', () => {
  // Check the complete homepage without assigning facts to a particular section.
  const interactive = renderer.profileCard() + topics.map(topic => renderer.page(topic)).join('');
  for (const html of [interactive, renderReading(site)]) {
    for (const value of [site.profile.name, site.profile.position, ...site.profile.bio]) assertText(html, value);
    assertLink(html, `mailto:${site.profile.email}`);
    for (const link of site.profile.links) assertLink(html, link.url);
    assert.ok([...html.matchAll(/\bsrc=["']([^"']+)["']/g)].some(match => match[1] === site.profile.photo));
    for (const interest of site.interests) {
      assertText(html, interest.title);
      assertText(html, interest.description);
      for (const point of interest.points ?? []) {
        assertText(html, point.title);
        assertText(html, point.description);
      }
    }
    for (const entry of [...site.experience, ...site.education, ...site.service, ...site.awards]) {
      for (const value of Object.values(entry)) if (typeof value === 'string') assertText(html, value);
      if ('links' in entry) for (const link of entry.links ?? []) assertLink(html, link.url);
      if ('contributions' in entry) for (const contribution of entry.contributions ?? []) {
        assertText(html, contribution.title);
        assertText(html, contribution.description);
      }
    }
  }
  for (const interest of site.interests) {
    assertText(reply({ kind: 'research' }), interest.title);
    assertText(reply({ kind: 'research' }), interest.description);
  }
});

test('publication listings and details preserve titles, authors, years and source links', () => {
  const reading = renderReading(site);
  for (const paper of papers) {
    for (const html of [renderer.papers([paper]), reply({ kind: 'publications' }), renderer.page('publications'), reading,
      renderer.paperDetail(paper), reply({ kind: 'paper', paperId: paper.id })]) {
      for (const value of [paper.title, String(paper.year)]) assertText(html, value);
      assertLink(html, paper.links.paper);
      if (paper.links.code) assertLink(html, paper.links.code);
    }
    // Summaries may abbreviate authors; the full record must remain accurate.
    for (const html of [renderer.paperDetail(paper), reply({ kind: 'paper', paperId: paper.id }), reading]) {
      assertText(html, paper.authors);
      assertText(html, paper.venue);
    }
    assertText(renderer.paperContext(paper), paper.title);
    for (const other of papers.filter(other => other.id !== paper.id)) {
      assert.ok(!textContent(reply({ kind: 'paper', paperId: paper.id })).includes(other.title), `Wrong paper shown for ${paper.id}`);
    }
  }
});

test('filtered publication content includes matching papers and excludes unrelated papers', () => {
  for (const filter of [...categories.map(category => ({ category })), ...researchTopics.map(topic => ({ topic }))]) {
    const html = reply({ kind: 'publications', ...filter });
    for (const paper of papers) {
      const matches = 'category' in filter ? paper.category === filter.category : paper.topic === filter.topic;
      if (matches) assertText(html, paper.title);
      else assert.ok(!textContent(html).includes(paper.title), `Unrelated publication: ${paper.id}`);
    }
  }
});

test('terminal presets print complete section data in the shared output', () => {
  const thread = makeThread('terminal', 'chat');
  for (const topic of topics) showContent(thread, { kind: 'preset', topic }, true);
  const html = renderer.messages(thread);
  for (const paragraph of site.profile.bio) assertText(html, paragraph);
  for (const paper of papers) { assertText(html, paper.title); assertLink(html, paper.links.paper); }
  for (const entry of site.experience) assertText(html, entry.organization);
  for (const entry of site.education) assertText(html, entry.institution);
  for (const entry of site.service) assertText(html, entry.venue);
  for (const entry of site.awards) assertText(html, entry.title);
});

test('unavailable data does not render missing values or unrelated publication facts', () => {
  const empty = createRenderer({ site: emptySite(), loadFailed: true });
  const thread = makeThread('content', 'chat');
  for (const content of [{ kind: 'research' }, { kind: 'publications' }, { kind: 'paper', paperId: 'missing' }] as const) showContent(thread, content);
  for (const html of [...topics.map(topic => empty.page(topic)), empty.profileCard(), empty.messages(thread), reply({ kind: 'paper', paperId: 'missing' })]) {
    assert.doesNotMatch(textContent(html), /\b(undefined|null|NaN)\b/);
    for (const paper of papers) assert.ok(!textContent(html).includes(paper.title));
  }
});

test('inline formatting preserves text and link destinations without executing data as markup', () => {
  const html = inline('See [NTU](https://www.ntu.edu.sg/?a=1&b=2) & <b>more</b>');
  assertText(html, 'See NTU & <b>more</b>');
  assertLink(html, 'https://www.ntu.edu.sg/?a=1&b=2');
  assert.doesNotMatch(html, /<b>/);
  assert.doesNotMatch(inline('[bad](javascript:alert(1))'), /href\s*=\s*["']javascript:/i);
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

test('an off-topic refusal shows the page’s own notice and never the marker', () => {
  const answer = (text: string) => {
    const thread = makeThread('reply', 'chat');
    thread.messages.push({ id: 'reply', role: 'assistant', text, prompt: 'q', paperId: null, state: 'done', mode: 'live' });
    return renderer.messages(thread);
  };
  // The model writes only the marker; the visitor reads wording that comes from the site.
  for (const refusal of [OFFTOPIC_MARKER, ` ${OFFTOPIC_MARKER}\n`, '[[ OffTopic ]]']) {
    assert.ok(isOfftopicReply(refusal), refusal);
    const html = answer(refusal);
    assertText(html, copy.offtopic);
    assert.ok(!html.includes('[[') && !html.toLowerCase().includes('offtopic<'), 'the marker itself must not reach the page');
  }
  // The marker alongside prose is not a refusal: the prose is the reply and the marker is dropped.
  const mixed = answer(`I mostly work on reinforcement learning. ${OFFTOPIC_MARKER}`);
  assert.ok(!isOfftopicReply(`I mostly work on reinforcement learning. ${OFFTOPIC_MARKER}`));
  assertText(mixed, 'I mostly work on reinforcement learning.');
  assert.ok(!mixed.includes(copy.offtopic) && !mixed.includes('[['));
  // An ordinary answer is untouched by the check.
  assert.ok(!isOfftopicReply('I am a Ph.D. student at NTU.'));
  assert.ok(!answer('I am a Ph.D. student at NTU.').includes(copy.offtopic));
});

test('publications the assistant names are rendered from site data, not from its own words', () => {
  const answer = (text: string) => {
    const thread = makeThread('reply', 'chat');
    thread.messages.push({ id: 'reply', role: 'assistant', text, prompt: 'q', paperId: null, state: 'done', mode: 'live' });
    return renderer.messages(thread);
  };
  const cards = (html: string) => [...html.matchAll(/class="paper-title"/g)].length;
  const [first, second, third, fourth] = papers;

  // The card's ask action reads as the command it stands in for, and still carries the paper.
  const card = renderer.papers([first]);
  assertText(card, `[${copy.openPaper}]`);
  assert.ok(card.includes(`>${copy.askCommand}<`), 'the ask action shows the /ask token');
  assert.ok(card.includes(`data-ask="${first.id}"`) && card.includes(`aria-label="${copy.askPaper}"`));

  const named = answer(`A good starting point. [[paper:${first.id}]] It came out of the work at Skywork AI.`);
  assertText(named, 'A good starting point.');
  assertText(named, 'It came out of the work at Skywork AI.');
  for (const value of [first.title, first.authors]) assertText(named, value);
  assertLink(named, first.links.paper);
  assert.ok(!named.includes('[[paper:'), 'the marker itself must not reach the page');
  assert.equal(cards(named), 1);

  // An id the data does not have, a repeat, and anything past the limit are dropped silently.
  const unknown = answer('Read the publication list. [[paper:no-such-paper]] It has everything.');
  assertText(unknown, 'Read the publication list. It has everything.');
  assert.equal(cards(unknown), 0);
  assert.ok(!unknown.includes('[[paper:') && !unknown.includes('no-such-paper'));
  assert.equal(cards(answer(`One. [[paper:${first.id}]] Again. [[paper:${first.id}]]`)), 1);
  assert.equal(cards(answer([first, second, third, fourth].map(paper => `[[paper:${paper.id}]]`).join(' '))), MAX_PAPER_CARDS);
  for (const paper of [first, second, third]) assertText(answer([first, second, third, fourth].map(p => `[[paper:${p.id}]]`).join(' ')), paper.title);

  // Model output reflects visitor input, so each text run is escaped on its own.
  const unsafe = answer(`<img src=x onerror=alert(1)> [[paper:${first.id}]] <b>after</b>`);
  assert.ok(unsafe.includes('&lt;img') && !unsafe.includes('<img src=x'));
  assert.ok(!unsafe.includes('<b>after</b>'));

  // The rules ask for a marker on its own line; the surrounding text stays whole.
  const runs = (html: string) => [...html.matchAll(/<div class="message-text ">([^<]*)<\/div>/g)].map(match => match[1]);
  assert.deepEqual(runs(answer(`A good first read is REAR.\n[[paper:${first.id}]]\nFor reasoning, try the other one.`)),
    ['A good first read is REAR.', 'For reasoning, try the other one.']);

  // Models often write the marker in front of the full stop; the punctuation must not
  // end up stranded under the card, nor left behind as a run of its own.
  assert.deepEqual(runs(answer(`A good read is REAR [[paper:${first.id}]]. It is recent.`)),
    ['A good read is REAR.', 'It is recent.']);
  assert.deepEqual(runs(answer(`Two of them [[paper:${first.id}]], [[paper:${second.id}]].`)), ['Two of them,.']);
  assert.deepEqual(runs(answer(`一共两篇 [[paper:${first.id}]]。另外还有一篇。`)), ['一共两篇。', '另外还有一篇。']);

  // A marker written mid-sentence must not cut the sentence in two: the card waits
  // for the end of the line instead.
  assert.deepEqual(runs(answer(`The REAR [[paper:${first.id}]] paper realigns preferences. Read it first.`)),
    ['The REAR paper realigns preferences. Read it first.']);
  assert.deepEqual(runs(answer(`REAR [[paper:${first.id}]] 是一篇关于测试时对齐的工作，值得先读。`)),
    ['REAR 是一篇关于测试时对齐的工作，值得先读。']);
  assert.equal(cards(answer(`The REAR [[paper:${first.id}]] paper realigns preferences.`)), 1);

  // A reply with no markers is untouched, paragraph breaks included.
  const plain = 'Your message came through.\n\nThis is a simulated reply.\n\nRandom response: abc';
  assert.deepEqual(runs(answer(plain)), [plain]);

  // A marker written with odd spacing or case still resolves; anything else in double
  // brackets is a marker the model got wrong and is removed rather than shown.
  assert.equal(cards(answer(`Read this.\n[[ paper : ${first.id.toUpperCase()} ]]`)), 1);
  const broken = answer('Read this. [[paper]] [[rear]] [[not a marker]] Done.');
  assert.equal(cards(broken), 0);
  assert.ok(!broken.includes('[['), 'a malformed marker must never reach the visitor');
  assertText(broken, 'Read this. Done.');

  // Copying a reply gives its prose, with no leftover markers or stray spacing.
  assert.equal(stripPaperMarkers(`A good starting point. [[paper:${first.id}]] It is recent.`), 'A good starting point. It is recent.');
  assert.equal(stripPaperMarkers(`A good read is REAR [[paper:${first.id}]]. It is recent.`), 'A good read is REAR. It is recent.');
  assert.equal(stripPaperMarkers(`A good read is REAR.\n[[paper:${first.id}]]\nIt is recent.`), 'A good read is REAR.\n\nIt is recent.');
});

test('a publication abstract is shown on its detail and reaches the assistant verbatim', () => {
  const withAbstract = { ...papers[0], abstract: 'We study how engines weave algebraic patterns.' };
  const view = createRenderer({ site: { ...site, publications: [withAbstract] }, loadFailed: false });
  assertText(view.paperDetail(withAbstract), withAbstract.abstract);
  assertText(view.paperDetail(withAbstract), copy.abstract);
  // Listings stay compact: the abstract belongs to the detail, not to every card.
  assert.ok(!textContent(view.papers([withAbstract])).includes(withAbstract.abstract));
  // A paper without one renders no empty Abstract label.
  const { abstract, ...bare } = withAbstract;
  assert.ok(!textContent(view.paperDetail(bare)).includes(copy.abstract));
});
