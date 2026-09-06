import test from 'node:test';
import assert from 'node:assert/strict';
import { isOfftopicReply, MAX_PAPER_CARDS, OFFTOPIC_MARKER, stripPaperMarkers } from '../src/chat.js';
import { copy } from '../src/content.js';
import { compactAuthors as shortenAuthors, createRenderer, inline } from '../src/render.js';
import { makeThread, showContent } from '../src/state.js';
import { cardsOf, commandOf, emptySite, sectionId, walk, type Content, type SectionId } from '../src/types.js';
import { parseSiteMarkdown } from '../src/markdown.js';
import { assertLink, assertText, site, textContent } from './helpers.js';

const papers = site.publications;
const compactAuthors = (authors: string) => shortenAuthors(authors, site.profile.name);
test('long author lists preserve order, owner credit and equal-contribution marks', () => {
  assert.equal(compactAuthors('A, B, Fuxiang Zhang*, D, E, and F'), 'A, B, Fuxiang Zhang*, D, E, and F');
  assert.equal(compactAuthors('Fuxiang Zhang*, B, C, D, E, F, G'), 'Fuxiang Zhang*, B, C, D, E, F, et al.');
  assert.equal(compactAuthors('A, B, C, D, Fuxiang Zhang*, F, G'), 'A, B, C, D, Fuxiang Zhang*, F, et al.');
  assert.equal(compactAuthors('A, B, C, D, E, F, and Fuxiang Zhang'), 'A, B, C, D, E, …, Fuxiang Zhang, et al.');
  assert.equal(compactAuthors('A, B, C, D, E, F, G, Fuxiang Zhang*, H'), 'A, B, C, D, E, …, Fuxiang Zhang*, et al.');
  assert.equal(compactAuthors('A, B, C, D, E, F, G'), 'A, B, C, D, E, F, et al.');
});

test('workshop cards name their parent conference and show the year separately', () => {
  const view = createRenderer({ site, loadFailed: false });
  for (const [id, label] of [['derl-swe', 'ICML DL4C Workshop'], ['dr-mas', 'ICLR MALGAI Workshop']]) {
    const html = view.message({ id: 'test', role: 'assistant', text: `[[paper:${id}]]`,
      prompt: 'q', paperId: null, state: 'done', mode: 'live' });
    assert.ok(html.includes(`<span class="paper-venue-tag">${label}</span><span class="paper-year">2026</span>`));
  }
});
test('inline bold composes with links while preserving URLs and escaping HTML', () => {
  assert.equal(inline('A **bold** and **second** word.'), 'A <strong>bold</strong> and <strong>second</strong> word.');
  const link = '<a href="https://example.org/**path**?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"><strong>Paper</strong></a>';
  assert.equal(inline('[**Paper**](https://example.org/**path**?a=1&b=2)'), link);
  assert.equal(inline('**[Paper](https://example.org)**'), '<strong><a href="https://example.org" target="_blank" rel="noopener noreferrer">Paper</a></strong>');
  assert.equal(inline('**<script>alert(1)</script>**'), '<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong>');
  assert.equal(inline('Unclosed **bold and *plain*'), 'Unclosed **bold and <em>plain</em>');
});
/** The sessions the file declares, in file order. */
const topics: SectionId[] = site.sections.filter(commandOf).map(sectionId);
/** The session whose section prints the publication cards. */
const papersPage = site.sections.filter(section => commandOf(section) && cardsOf(section)).map(sectionId)[0];
const renderer = createRenderer({ site, loadFailed: false });
type View = ReturnType<typeof createRenderer>;
const contentHTML = (view: View, content: Content) => view.message({ id: 'content', role: 'content', content });
const presetHTML = (view: View, topic: string) => contentHTML(view, { kind: 'preset', topic });
const detailHTML = (view: View, id: string) => contentHTML(view, { kind: 'paper', paperId: id });
const cardsHTML = (view: View, ids: string[]) => view.message({
  id: 'reply', role: 'assistant', text: ids.map(id => `[[paper:${id}]]`).join('\n'),
  prompt: 'q', paperId: null, state: 'done', mode: 'live',
});
const messagesHTML = (view: View, thread: ReturnType<typeof makeThread>) => thread.messages.map(view.message).join('');
const reply = (content: Content) => {
  const thread = makeThread();
  showContent(thread, content);
  return messagesHTML(renderer, thread);
};

test('authored lists use bold names and preserve fields, nesting, cards and adjacent headings', () => {
  const parsed = parseSiteMarkdown(`${site.source}\n\n## List example\nCommand: /list-example

- **First project**
  Role: Researcher
  Period: 2026
  Links: [Notes](https://example.org/notes)

  Project description.

  [[paper:${papers[0].id}]]

  - **Nested contribution**
    Role: Contributor

- **Second project**
  Period: 2025

### Another group

- **Third project**
  Location: Singapore
`);
  const html = presetHTML(createRenderer({ site: parsed, loadFailed: false }), 'list-example');
  for (const name of ['First project', 'Nested contribution', 'Second project', 'Third project']) {
    assert.ok(html.includes(`<strong>${name}</strong>`));
    assert.ok(!new RegExp(`<h[1-6][^>]*>${name}</h[1-6]>`).test(html));
  }
  assert.match(html, /<h3>Another group<\/h3>/);
  assert.equal([...html.matchAll(/<li\b/g)].length, 4);
  assert.equal([...html.matchAll(/<ul\b/g)].length, 3);
  assert.equal([...html.matchAll(/<\/ul>/g)].length, 3);
  for (const value of ['Researcher', 'Contributor', '2026', '2025', 'Singapore', 'Project description.']) assertText(html, value);
  assertLink(html, 'https://example.org/notes');
  assert.deepEqual(cardIds(html), [papers[0].id]);
});

test('every authored visible heading, record and paragraph reaches its section', () => {
  for (const section of site.sections.filter(commandOf)) {
    const html = presetHTML(renderer, sectionId(section));
    for (const block of walk([section])) {
      if (block.title) assertText(html, block.title);
      if (block.kind === 'markdown') assertText(html, block.text!);
      for (const key of ['role', 'location', 'period']) if (block.fields[key]) assertText(html, block.fields[key]);
    }
  }
});

test('publication listings and details preserve titles, authors, years and source links', () => {
  for (const paper of papers) {
    for (const html of [cardsHTML(renderer, [paper.id]), reply({ kind: 'preset', topic: papersPage }), presetHTML(renderer, papersPage),
      detailHTML(renderer, paper.id), reply({ kind: 'paper', paperId: paper.id })]) {
      for (const value of [paper.title, String(paper.year)]) assertText(html, value);
      assertLink(html, paper.links.paper);
      if (paper.links.code) assertLink(html, paper.links.code);
    }
    // Summaries may abbreviate authors; the full record must remain accurate.
    for (const html of [detailHTML(renderer, paper.id), reply({ kind: 'paper', paperId: paper.id })]) {
      assertText(html, paper.authors);
      assertText(html, paper.venue);
    }
    assertText(renderer.paperContext(paper), paper.title);
    for (const other of papers.filter(other => other.id !== paper.id)) {
      assert.ok(!textContent(reply({ kind: 'paper', paperId: paper.id })).includes(other.title), `Wrong paper shown for ${paper.id}`);
    }
  }
});

/** The publications rendered as cards, in the order they appear. */
const cardIds = (html: string) => [...html.matchAll(/data-ask="([a-z0-9-]+)"/g)].map(match => match[1]);

test('work contributions embed complete, actionable paper cards without the chat limit', () => {
  const html = presetHTML(renderer, 'work');
  const ids = ['skyreels-v4', 'derl-swe', 'skywork-or1', 'skywork-reward-v2', 'llm-background-knowledge'];
  assert.deepEqual(cardIds(html), ids);
  assert.doesNotMatch(html, /\[\[paper:|cv-paper-link/);
  for (const id of ids) {
    const paper = papers.find(paper => paper.id === id)!;
    assertText(html, paper.title);
    assertText(html, compactAuthors(paper.authors));
    assertText(html, paper.venueShort);
    assertLink(html, paper.links.paper);
    if (paper.links.code) assertLink(html, paper.links.code);
    assert.ok(html.includes(`data-paper="${id}"`));
  }
  assertText(html, 'Website & slide-generation agents');
});

test('unavailable data does not render missing values or unrelated publication facts', () => {
  const empty = createRenderer({ site: emptySite(), loadFailed: true });
  const thread = makeThread();
  for (const content of [{ kind: 'preset', topic: papersPage }, { kind: 'paper', paperId: 'missing' }] as const) showContent(thread, content);
  for (const html of [...topics.map(topic => presetHTML(empty, topic)), messagesHTML(empty, thread), reply({ kind: 'paper', paperId: 'missing' })]) {
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
  const thread = makeThread();
  thread.messages.push({ id: 'message', role: 'user', text: unsafe });
  showContent(thread, { kind: 'paper', paperId: paper.id });
  showContent(thread, { kind: 'preset', topic: papersPage });
  for (const html of [cardsHTML(renderer, [paper.id]), presetHTML(renderer, papersPage), detailHTML(renderer, paper.id), renderer.paperContext(paper), messagesHTML(renderer, thread)]) {
    assert.ok(html.includes('&lt;img'));
    assert.ok(!html.includes(unsafe));
    assert.doesNotMatch(html, /href="javascript:/);
  }
});

test('an off-topic refusal shows the page’s own notice and never the marker', () => {
  const answer = (text: string) => {
    const thread = makeThread();
    thread.messages.push({ id: 'reply', role: 'assistant', text, prompt: 'q', paperId: null, state: 'done', mode: 'live' });
    return messagesHTML(renderer, thread);
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
    const thread = makeThread();
    thread.messages.push({ id: 'reply', role: 'assistant', text, prompt: 'q', paperId: null, state: 'done', mode: 'live' });
    return messagesHTML(renderer, thread);
  };
  const cards = (html: string) => [...html.matchAll(/class="paper-title"/g)].length;
  const [first, second, third, fourth] = papers;

  // The card's ask action reads as the command it stands in for, and still carries the paper.
  const card = cardsHTML(renderer, [first.id]);
  assertText(card, `[${copy.openPaper}]`);
  assert.ok(card.includes(`>${copy.askCommand}<`), 'the ask action shows the Ask AI label');
  assert.ok(card.includes(`data-ask="${first.id}"`) && card.includes(`aria-label="${copy.askPaper}"`));

  const named = answer(`A good starting point. [[paper:${first.id}]] It came out of the work at Skywork AI.`);
  assertText(named, 'A good starting point.');
  assertText(named, 'It came out of the work at Skywork AI.');
  for (const value of [first.title, compactAuthors(first.authors)]) assertText(named, value);
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
  assertText(detailHTML(view, withAbstract.id), withAbstract.abstract);
  assertText(detailHTML(view, withAbstract.id), copy.abstract);
  // Listings stay compact: the abstract belongs to the detail, not to every card.
  assert.ok(!textContent(cardsHTML(view, [withAbstract.id])).includes(withAbstract.abstract));
  // A paper without one renders no empty Abstract label.
  const { abstract, ...bare } = withAbstract;
  assert.ok(!textContent(detailHTML(createRenderer({ site: { ...site, publications: [bare] }, loadFailed: false }), bare.id)).includes(copy.abstract));
});

test('a section named chat uses the same preset template and abstracts render embedded cards', () => {
  const parsed = parseSiteMarkdown(`${site.source}\n## Conversation research\nCommand: /chat\n\nWritten in the file.`);
  const view = createRenderer({ site: parsed, loadFailed: false });
  assertText(presetHTML(view, 'chat'), 'Written in the file.');
  const first = { ...papers[0], abstract: `First paragraph.\n\n[[paper:${papers[1].id}]]\n\nLast paragraph.` };
  const detail = detailHTML(createRenderer({ site: { ...site, publications: [first, papers[1]] }, loadFailed: false }), first.id);
  assertText(detail, 'First paragraph.');
  assertText(detail, 'Last paragraph.');
  assert.deepEqual(cardIds(detail).slice(0, 1), [papers[1].id]);
  assert.doesNotMatch(detail, /\[\[paper:/);
});

test('renaming commands does not change component layout or field preservation', () => {
  const source = `${site.source}\n## Component example
Command: /components

<details>
<summary><h3>Details</h3></summary>
Role: Researcher
Location: Singapore
Period: 2026
Links: [Notes](https://example.org/notes)

Introduction.

:::paper{ref="${papers[0].id}"}
Explicit **description**.
:::

Closing paragraph.
</details>
`;
  const showSource = (source: string, topic: string) => presetHTML(createRenderer({ site: parseSiteMarkdown(source), loadFailed: false }), topic);
  const html = showSource(source, 'components');
  assert.equal(html.replace('›</span> /components', '›</span> /renamed'), showSource(source.replace('Command: /components', 'Command: /renamed'), 'renamed'));
  for (const value of ['Researcher', 'Singapore', '2026', 'Introduction.', 'Closing paragraph.']) assertText(html, value);
  assertLink(html, 'https://example.org/notes');
  assert.match(html, /<details class="content-collapse">/);
  assert.match(html, /<div class="paper-description"><p>Explicit <strong>description<\/strong>\.<\/p>/);
});

test('ordinary headings and adjacent prose never implicitly become components', () => {
  const source = `${site.source}\n## Ordinary
Command: /ordinary

### Group

#### Topic

This stays outside the paper.

[[paper:${papers[0].id}]]
`;
  const html = presetHTML(createRenderer({ site: parseSiteMarkdown(source), loadFailed: false }), 'ordinary');
  assert.doesNotMatch(html, /<details|paper-description/);
  assert.match(html, /<h4>Topic<\/h4>/);
  assert.ok(html.indexOf('This stays outside') < html.indexOf('<article'));
});

test('reordering publication definitions changes listing order without year sorting', () => {
  const definitions = [...site.source.matchAll(/:::publication\n[\s\S]*?\n:::(?=\n|$)/g)].map(m => m[0]);
  const reversed = [...definitions].reverse();
  let index = 0;
  const source = site.source.replace(/:::publication\n[\s\S]*?\n:::(?=\n|$)/g, () => reversed[index++]);
  const parsed = parseSiteMarkdown(source);
  assert.deepEqual(cardIds(presetHTML(createRenderer({ site: parsed, loadFailed: false }), papersPage)), [...papers].reverse().map(p => p.id));
});

test('standard blocks preserve ordering, nesting and safe inline formatting', () => {
  const source = `${site.source}\n## Markdown
Command: /markdown

Before.

- ordinary *emphasis*
- **Record**
  Role: Author

  - nested item

  After nested list.

After list.

> Quoted **text**.

3. third
4. fourth

\`\`\`html
<script>alert(1)</script>
\`\`\`

| A | B |
| --- | --- |
| 1 | 2 |
`;
  const html = presetHTML(createRenderer({ site: parseSiteMarkdown(source), loadFailed: false }), 'markdown');
  assert.match(html, /<em>emphasis<\/em>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<ol class="cv-list" start="3">/);
  assert.match(html, /<table>/);
  assert.match(html, /<code class="language-html">&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  const positions = ['Before.', 'ordinary', 'nested item', 'After nested list.', 'After list.', '<blockquote>', '<ol', '<pre', '<table'].map(s => html.indexOf(s));
  assert.ok(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])));
});

test('education and work records are list items and miscellaneous groups are h3 headings', () => {
  for (const topic of ['education', 'work']) {
    const html = presetHTML(renderer, topic);
    assert.doesNotMatch(html, /<h[3-6]/);
    assert.match(html, /<li class="cv-row"><div class="cv-heading"><strong>/);
  }
  const html = presetHTML(renderer, 'misc');
  assert.match(html, /<h3>Service<\/h3>/);
  assert.match(html, /<h3>Awards<\/h3>/);
});

test('owner credit comes from the profile', () => {
  const authors = 'A, B, C, D, E, F, Ada Lovelace';
  assert.equal(shortenAuthors(authors, 'Ada Lovelace'), 'A, B, C, D, E, …, Ada Lovelace, et al.');
  const changed = { ...site, profile: { ...site.profile, name: 'Ada Lovelace' }, publications: [{ ...papers[0], authors }] };
  assert.match(cardsHTML(createRenderer({ site: changed, loadFailed: false }), [papers[0].id]), /<strong> Ada Lovelace<\/strong>/);
});


test('reference links survive block parsing and metadata-like code remains literal', () => {
  const source = `${site.source}\n## Syntax examples
Command: /syntax

A [reference][notes].

[notes]: https://example.org/notes "Notes"

\`\`\`text
Role: literal code, not metadata
:::collapse
\`\`\`

    const example = 1;
`;
  const html = presetHTML(createRenderer({ site: parseSiteMarkdown(source), loadFailed: false }), 'syntax');
  assertLink(html, 'https://example.org/notes');
  assert.match(html, /<code class="language-text">Role: literal code, not metadata/);
  assert.match(html, /<pre><code>const example = 1;/);
});

test('native details markup preserves open state and does not invent a heading for plain summaries', () => {
  const source = `${site.source}\n## Native details
Command: /native

<details open>
<summary>Plain title</summary>

Body with **bold**, a [link](https://example.org), and a card.

[[paper:${papers[0].id}]]

</details>
`;
  const html = presetHTML(createRenderer({ site: parseSiteMarkdown(source), loadFailed: false }), 'native');
  assert.match(html, /<details class="content-collapse" open><summary><span class="collapse-heading">/);
  assert.doesNotMatch(html, /<h[3-6]/);
  assert.match(html, /<strong>bold<\/strong>/);
  assertLink(html, 'https://example.org');
  assert.deepEqual(cardIds(html), [papers[0].id]);
});

test('summary content does not enable arbitrary HTML execution', () => {
  const source = `${site.source}\n## Safe summary
Command: /safe-summary

<details>
<summary><img src=x onerror=alert(1)></summary>

Body.

</details>`;
  const html = presetHTML(createRenderer({ site: parseSiteMarkdown(source), loadFailed: false }), 'safe-summary');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});
