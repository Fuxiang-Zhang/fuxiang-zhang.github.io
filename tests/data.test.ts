import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSiteData, parseBlocks, parseSiteMarkdown } from '../src/markdown.js';
import { walk } from '../src/types.js';
import { site } from './helpers.js';

export const sample = `# Ada Lovelace
Home: bio
Description: Analytical engines and programming.
Position: Researcher
Email: ada@example.org
Links: [Site](https://ada.example)

## Bio
Command: /bio

:::profile
:::

First paragraph.

## Papers
Command: /papers
Cards: publications

## Publications
Id: publications

:::publication
Title: On Analytical Engines
Id: analytical-engines
Authors: Ada Lovelace, Charles Babbage
Venue: Journal of Computing
Venue short: JoC
Year: 1843
Topic: Computing
Paper: https://example.org/notes
Code: https://github.com/ada/notes

The engine can weave algebraic patterns.
:::
`;

test('profile metadata and explicit publication definitions retain all authored facts', () => {
  const parsed = parseSiteMarkdown(sample);
  assert.equal(parsed.source, sample);
  assert.equal(parsed.profile.home, 'bio');
  assert.equal(parsed.profile.name, 'Ada Lovelace');
  assert.equal(parsed.profile.title, 'Ada Lovelace - Homepage');
  assert.deepEqual(parsed.publications, [{
    id: 'analytical-engines', title: 'On Analytical Engines', authors: 'Ada Lovelace, Charles Babbage',
    venue: 'Journal of Computing', venueShort: 'JoC', year: 1843, topic: 'Computing',
    links: { paper: 'https://example.org/notes', code: 'https://github.com/ada/notes' },
    abstract: 'The engine can weave algebraic patterns.',
  }]);
});

test('paragraphs and nested lists retain their exact block order', () => {
  const [section] = parseBlocks(`### Group

Before.

- **Employer**
  Role: Researcher
  Period: 1843

  First.

  - ordinary nested item

  After the nested list.

After the list.

> A quote.

1. one
2. two
`);
  assert.deepEqual(section.body.map(n => n.kind), ['markdown', 'list', 'markdown', 'markdown', 'list']);
  const item = section.body[1].body[0];
  assert.equal(item.title, 'Employer');
  assert.deepEqual(item.fields, { role: 'Researcher', period: '1843' });
  assert.deepEqual(item.body.map(n => n.kind), ['markdown', 'list', 'markdown']);
  assert.equal(item.body[2].text, 'After the nested list.');
});

test('published education and work use records while service and awards remain headings', () => {
  for (const command of ['/education', '/work']) {
    const section = site.sections.find(s => s.fields.command === command)!;
    assert.equal([...walk(section.body)].filter(n => n.kind === 'heading').length, 0);
    assert.ok(section.body.some(n => n.kind === 'list'));
  }
  const misc = site.sections.find(s => s.fields.command === '/misc')!;
  assert.deepEqual(misc.body.map(n => [n.kind, n.level, n.title]), [['heading', 3, 'Service'], ['heading', 3, 'Awards']]);
  assert.equal([...walk(site.sections)].filter(n => n.kind === 'collapse').length, 5);
  assert.equal([...walk(site.sections)].filter(n => n.kind === 'publication').length, site.publications.length);
});

test('malformed metadata, component boundaries and references fail with source locations', () => {
  const invalid = [
    sample.replace('Home: bio', 'Home: missing'),
    sample.replace('Command: /bio', 'Command: /help'),
    sample.replace('Command: /papers', 'Command: /bio'),
    sample.replace('Cards: publications', 'Cards: nowhere'),
    sample.replace('Year: 1843', 'Year: eighteen'),
    sample.replace('Id: analytical-engines', 'Id: Not a slug'),
    sample.replace('Authors: Ada Lovelace, Charles Babbage\n', ''),
    sample.replace('Position: Researcher', 'Positoin: Researcher'),
    sample.replace('First paragraph.', 'First paragraph.\n\nRole: Late field'),
    sample.replace('First paragraph.', '[[paper:missing]]'),
    sample.replace('First paragraph.', 'See [[paper:analytical-engines]].'),
    sample.replace('First paragraph.', ':::unknown\nBody.\n:::'),
    sample.replace('First paragraph.', '<details>\nNo summary.\n</details>'),
    sample.replace('First paragraph.', ':::profile\nHidden prose.\n:::'),
    sample.replace('First paragraph.', ':::paper{ref="analytical-engines"}\n:::profile\n:::\n:::'),
    sample.replace('First paragraph.', ':::publication\nTitle: Hidden\n:::'),
    sample.replace('First paragraph.', '<details>\n<summary>Heading</summary>\n\nMissing close.'),
  ];
  for (const source of invalid) assert.throws(() => parseSiteMarkdown(source), /Line \d+:/, source);
  assert.throws(() => parseSiteMarkdown(sample.replace('Paper: https://example.org/notes', 'Paper: javascript:alert(1)')), /HTTP/);
});

test('component-looking text in code blocks is literal', () => {
  const parsed = parseSiteMarkdown(sample.replace('First paragraph.', '```markdown\n:::collapse\n[[paper:missing]]\n```'));
  assert.ok(parsed.sections[0].body.some(n => n.text?.includes('[[paper:missing]]')));
});

test('multiple views reuse a source without duplicating publication definitions', () => {
  const parsed = parseSiteMarkdown(`${sample}\n## More papers\nCommand: /more\nCards: publications`);
  assert.equal(parsed.publications.length, 1);
});

test('unreadable and empty documents fail instead of producing an empty homepage', async () => {
  await assert.rejects(loadSiteData(async () => { throw new Error('Unavailable'); }), /Unavailable/);
  assert.throws(() => parseSiteMarkdown(''), /# Name/);
});

test('GitHub details supports plain and multiline summaries, open, nesting and lists', () => {
  const blocks = parseBlocks(`<details open>
<summary>
Outer title
</summary>

Before.

<details>
<summary><h4>Inner title</h4></summary>

Inner body.

</details>

After.

</details>

- **Record**

  <details>
  <summary>List details</summary>

  List body.

  </details>
`);
  assert.equal(blocks[0].kind, 'collapse');
  assert.equal(blocks[0].title, 'Outer title');
  assert.equal(blocks[0].open, true);
  assert.equal(blocks[0].level, undefined);
  assert.deepEqual(blocks[0].body.map(n => n.kind), ['markdown', 'collapse', 'markdown']);
  const inner = blocks[0].body[1];
  assert.equal(inner.title, 'Inner title');
  assert.equal(inner.level, 4);
  assert.equal(inner.open, false);
  assert.equal(blocks[1].body[0].body[0].kind, 'collapse');
});

test('literal details in fenced code cannot close or create a component', () => {
  const [block] = parseBlocks(`<details>
<summary>Code example</summary>

\`\`\`html
</details>
<details>
<summary>Literal</summary>
\`\`\`

Still inside.

</details>`);
  assert.deepEqual(block.body.map(n => n.kind), ['markdown', 'markdown']);
  assert.equal(block.body[1].text, 'Still inside.');
});

test('malformed details and unsupported HTML attributes are reported with a line', () => {
  for (const text of [
    '<details>\n<summary>Title</summary>\n\nUnclosed.',
    '<details>\nBody without summary.\n</details>',
    '<details onclick="alert(1)">\n<summary>Title</summary>\n</details>',
    '<details>\n<summary>Bad</summary><script>alert(1)</script>\n</details>',
    '</details>',
    ':::collapse\n### Old syntax\n:::',
  ]) assert.throws(() => parseBlocks(text), /Line \d+:/);
});
