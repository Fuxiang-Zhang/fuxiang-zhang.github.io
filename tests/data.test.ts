import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSiteData, parseSiteMarkdown, siteFile } from '../src/markdown.js';
import { parseSiteData, walk, type Node as SiteNode, type SiteData } from '../src/types.js';
import { readLocal, site } from './helpers.js';

/*
 * A complete miniature document: parsing it must produce exactly the object
 * below, so the format stays pinned down field by field. The real content lives
 * in data/site.md and is checked for structure further down.
 */
const sample = `# Ada Lovelace

Position: Researcher · Somewhere
Email: ada@example.org
Links: [GitHub](https://github.com/ada), [Site](https://ada.example)

## Bio
Command: /bio
Summary: Print biography and contact links

First paragraph with a [link](https://ada.example) in it, wrapped
across two source lines.

Second paragraph.

## Research
Command: /research
Summary: Print research interests and directions

What I work on.

### Learning from interaction

Why interaction matters:

#### Offline data

Learning without a simulator.

## Papers
Command: /papers
Summary: Print publications, code, and paper details
Cards: publications

Everything I have written.

## Publications
Id: publications

### On Analytical Engines
Id: analytical-engines
Authors: Ada Lovelace, Charles Babbage
Venue: Journal of Computing
Venue short: JoC
Year: 1843
Topic: Reinforcement Learning
Paper: https://example.org/notes
Code: https://github.com/ada/notes

The engine can be made to weave algebraic patterns, wrapped
across two source lines.

## Work
Command: /work
Summary: Print research and industry experience

Where I have worked.

### Analytical Society
Role: Researcher
Location: London
Period: 1842 – 1843
Links: [Society](https://example.org)

Studied engines.

- **Note G**

  Wrote the first program.

  [[paper:analytical-engines]]

## Education
Command: /education
Summary: Print degrees and institutions

Where I studied.

### University of London
Role: Mathematics
Period: 1840 – 1842

Studied mathematics.

## Miscellaneous
Command: /misc
Summary: Print academic service and honors

Service and honors.

### Service

- **Journal of Computing**
  Role: Reviewer
  Period: 1843

### Awards

- **Gold Medal**
  Role: Analytical Society
  Period: 1843
`;

test('the Markdown format maps onto every field the homepage renders', () => {
  const parsed = parseSiteMarkdown(sample);
  assert.equal(parsed.source, sample);
  const { source, ...content } = parsed;
  const node = (title: string, fields: Record<string, string>, prose: string[], children: unknown[] = []) =>
    ({ title, fields, prose, children });
  const item = (...args: Parameters<typeof node>) => ({ ...node(...args), kind: 'item' });
  assert.deepEqual(content, {
    profile: {
      name: 'Ada Lovelace',
      position: 'Researcher · Somewhere',
      email: 'ada@example.org',
      links: [{ label: 'GitHub', url: 'https://github.com/ada' }, { label: 'Site', url: 'https://ada.example' }],
    },
    // The sections are the document's own tree: heading, fields, paragraphs, nesting.
    sections: [
      node('Bio', { command: '/bio', summary: 'Print biography and contact links' }, [
        'First paragraph with a [link](https://ada.example) in it, wrapped across two source lines.',
        'Second paragraph.',
      ], []),
      node('Research', { command: '/research', summary: 'Print research interests and directions' }, ['What I work on.'], [
        node('Learning from interaction', {}, ['Why interaction matters:'], [
          node('Offline data', {}, ['Learning without a simulator.']),
        ]),
      ]),
      node('Papers', { command: '/papers', summary: 'Print publications, code, and paper details', cards: 'publications' },
        ['Everything I have written.'], []),
      node('Publications', { id: 'publications' }, [], [
        node('On Analytical Engines', {
          id: 'analytical-engines', authors: 'Ada Lovelace, Charles Babbage', venue: 'Journal of Computing', 'venue short': 'JoC',
          year: '1843', topic: 'Reinforcement Learning',
          paper: 'https://example.org/notes', code: 'https://github.com/ada/notes',
        }, ['The engine can be made to weave algebraic patterns, wrapped across two source lines.']),
      ]),
      node('Work', { command: '/work', summary: 'Print research and industry experience' }, ['Where I have worked.'], [
        node('Analytical Society', {
          role: 'Researcher', location: 'London', period: '1842 – 1843', links: '[Society](https://example.org)',
        }, ['Studied engines.'], [
          item('Note G', {}, ['Wrote the first program.', '[[paper:analytical-engines]]']),
        ]),
      ]),
      node('Education', { command: '/education', summary: 'Print degrees and institutions' }, ['Where I studied.'], [
        node('University of London', { role: 'Mathematics', period: '1840 – 1842' }, ['Studied mathematics.']),
      ]),
      node('Miscellaneous', { command: '/misc', summary: 'Print academic service and honors' }, ['Service and honors.'], [
        node('Service', {}, [], [item('Journal of Computing', { role: 'Reviewer', period: '1843' }, [])]),
        node('Awards', {}, [], [item('Gold Medal', { role: 'Analytical Society', period: '1843' }, [])]),
      ]),
    ],
    // Publications are the records of the section the `Cards` field names.
    publications: [{
      id: 'analytical-engines', title: 'On Analytical Engines',
      authors: 'Ada Lovelace, Charles Babbage', venue: 'Journal of Computing', venueShort: 'JoC',
      year: 1843, topic: 'Reinforcement Learning',
      links: { paper: 'https://example.org/notes', code: 'https://github.com/ada/notes' },
      abstract: 'The engine can be made to weave algebraic patterns, wrapped across two source lines.',
    }],
  });
});

test('the published content preserves every heading and list item', async () => {
  const source = await readLocal(siteFile);
  // Every `##` in the file becomes a section, in that order, under the heading it writes.
  const written = [...source.matchAll(/^## (.+)$/gm)].map(match => match[1]);
  assert.deepEqual(site.sections.map(section => section.title), written);
  // Every heading and list item below a section becomes a record, at its written depth.
  const counted = (nodes: readonly SiteNode[]): number => nodes.reduce((total, node) => total + 1 + counted(node.children), 0);
  const headingsUnder = (section: string) => {
    const body = source.split(/^## /m).find(part => part.startsWith(`${section}\n`)) ?? '';
    return body.split('\n').filter(line => /^(?:#{3,6} | *- \*\*)/.test(line)).length;
  };
  for (const section of site.sections) {
    assert.equal(counted(section.children), headingsUnder(section.title), section.title);
  }
  // Every publication is reachable by its own slug, and nothing is left unnamed.
  assert.equal(new Set(site.publications.map(paper => paper.id)).size, site.publications.length);
  for (const paper of site.publications) assert.match(paper.id, /^[a-z0-9][a-z0-9-]*$/);
  assert.ok(site.publications.length > 0, 'the Cards field finds the section that holds the papers');
});

test('a malformed document is reported instead of silently losing content', () => {
  const cases: [string, RegExp][] = [
    [sample.replace('Cards: publications', 'Cards: nowhere'), /names no section/],
    [sample.replace('## Work\nCommand: /work\n', '## Work\n'), /needs a Command/],
    [sample.replace('Command: /education', 'Command: /work'), /Repeated Command/],
    [sample.replace('Venue short: JoC\n', ''), /Missing "venue short"/],
    [sample.replace('Id: analytical-engines\n', ''), /Missing "id"/],
    [sample.replace('Id: analytical-engines', 'Id: Not A Slug'), /Invalid Id/],
    [sample.replace('[[paper:analytical-engines]]', '[[paper:no-such-paper]]'), /Unknown publication/],
    [sample.replace('- **Note G**', '- **Note G**\n  Paper: analytical-engines'), /Unknown field \"paper\"/],
    [sample.replace('Paper: https://example.org/notes', 'Paper: analytical-engines'), /must be an HTTP/],
    [sample.replace('[[paper:analytical-engines]]', 'See [[paper:analytical-engines]].'), /separate paragraph/],
    [sample.replace('Year: 1843', 'Year: eighteen'), /Invalid Year/],
    [sample.replace('Topic: Reinforcement Learning\nPaper: https://example.org/notes', 'Paper: https://example.org/notes'), /Missing "topic"/],
    [sample.replace('### Learning from interaction', '### Learning from interaction\nTopic: Robotics'), /Unknown field "topic"/],
    [sample.replace('Role: Researcher\nLocation: London', 'Role: Researcher\nNickname: London'), /Unknown field "Nickname"/],
    [sample.replace('Studied engines.', 'Studied engines.\n\nPeriod: 1900'), /Move "Period: 1900" directly under/],
    [sample.replace('#### Offline data', '##### Offline data'), /skips a level/],
    [sample.replace('  Wrote the first program.', 'Wrote the first program.'), /Indent content under "Note G"/],
    [sample.replace('- **Note G**', '  - **Note G**'), /Invalid list indentation/],
    [sample.replace('- **Note G**', '- Note G'), /Write list items as/],
    [sample.replace('- **Note G**', '- ** **'), /no title/],
    [sample.replace('- **Note G**', '- **Note G**\n  Nickname: notes'), /Unknown field "Nickname"/],
    [sample.replace('- **Note G**', '- **Note G**\n  Role: Author\n  Role: Reviewer'), /Repeated "role"/],
    [sample.replace('  Wrote the first program.', '  #### Wrote the first program.'), /Use a nested list item/],
    [sample.replace('Links: [GitHub](https://github.com/ada), [Site](https://ada.example)', 'Links: GitHub'), /must contain only \[label\]\(url\) links/],
    [sample.replace('Command: /bio', 'Command: bio'), /Invalid Command/],
    [sample.replace('Command: /bio', 'Command: /help'), /cannot be \/help/],
    [`A note before the title.\n\n${sample}`, /Content above the "# Name" heading/],
  ];
  for (const [broken, message] of cases) assert.throws(() => parseSiteMarkdown(broken), message, message.source);
});

test('list indentation preserves sibling and nested records, fields, paragraphs and card markers', () => {
  const source = sample.replace('- **Note G**\n\n  Wrote the first program.\n\n  [[paper:analytical-engines]]', `- **Note G**
  Role: Author

  Wrote the first program,
  with a [reference](https://example.org/notes).

  [[paper:analytical-engines]]

  - **Implementation: notes**
    Period: 1843

    Nested description.

- **Another project**
  Location: London`);
  const parsed = parseSiteMarkdown(source);
  const work = parsed.sections.find(section => section.fields.command === '/work')!;
  const [first, second] = work.children[0].children;
  assert.equal(first.kind, 'item');
  assert.equal(first.title, 'Note G');
  assert.deepEqual(first.fields, { role: 'Author' });
  assert.deepEqual(first.prose, [
    'Wrote the first program, with a [reference](https://example.org/notes).',
    '[[paper:analytical-engines]]',
  ]);
  assert.deepEqual(first.children, [{
    title: 'Implementation: notes', kind: 'item', fields: { period: '1843' },
    prose: ['Nested description.'], children: [],
  }]);
  assert.equal(second.title, 'Another project');
  assert.deepEqual(second.fields, { location: 'London' });
  assert.deepEqual(second.prose, []);
  assert.deepEqual(second.children, []);
  assert.equal(parsed.sections.find(section => section.fields.command === '/education')!.children[0].title, 'University of London');
  assert.throws(() => parseSiteMarkdown(source.replace('  - **Implementation: notes**', '   - **Implementation: notes**')), /Invalid list indentation/);
});

test('invalid records, duplicate paper ids and broken references are rejected', () => {
  const broken = (patch: (copy: SiteData) => void) => {
    const copy = structuredClone(site);
    patch(copy);
    return copy;
  };
  /** The first node anywhere in the tree that carries the given field. */
  const find = (site: SiteData, key: string) => [...walk(site.sections)].find(node => node.fields[key])!;
  for (const invalid of [null, {}, { ...site, publications: [{ id: 'incomplete' }] },
    // Legacy Paper slugs, dangling card markers, and topics no publication uses.
    broken(s => { (find(s, 'paper').fields as Record<string, string>).paper = 'missing'; }),
    broken(s => { s.sections[0].prose.push('[[paper:missing]]'); }),
    broken(s => { (find(s, 'topic').fields as Record<string, string>).topic = 'Nothing'; }),
    broken(s => { s.publications.push({ ...s.publications[0] }); }),
    broken(s => { s.publications[0].year = 2025.5; }),
    { ...site, sections: [{ title: 'Invalid', fields: { command: 1 }, prose: [], children: [] }] },
    { ...site, sections: [{ title: 'Invalid', fields: {}, prose: 'not a list', children: [] }] },
  ]) assert.throws(() => parseSiteData(invalid));
});

test('an unreadable source file is reported rather than treated as empty content', async () => {
  await assert.rejects(loadSiteData(async () => { throw new Error('Unavailable site data'); }), /Unavailable site data/);
  await assert.rejects(loadSiteData(async () => ''), /"# Name" heading/);
});

test('unused fields and invisible records fail validation at their authored location', () => {
  for (const source of [
    sample.replace('## Bio', 'Unpublished profile prose.\n\n## Bio'),
    sample.replace('## Work', '#### Hidden publication child\n\nHidden text.\n\n## Work'),
    sample.replace('## Work', '- **Hidden publication list item**\n\n## Work'),
    sample.replace('## Publications', '### Hidden Cards child\n\n## Publications'),
    sample.replace('Links: [Society](https://example.org)', 'Links: not-a-link'),
    sample.replace('Links: [Society](https://example.org)', 'Links: [Society](https://example.org), broken'),
    sample.replace('### University of London', '### University of London\nSummary: Invisible'),
    sample.replace('Command: /bio', 'Command: /main'),
    sample.replace('Command: /bio', 'Command: /paper'),
    sample.replace('Command: /bio', 'Command: /bio\nId: help'),
    `${sample}\n## Orphan\nId: orphan\n\nNever printed.`,
  ]) assert.throws(() => parseSiteMarkdown(source));
});

test('multiple commands may print the same publication source without duplicating records', () => {
  const parsed = parseSiteMarkdown(`${sample}\n## More papers\nCommand: /more-papers\nCards: publications`);
  assert.equal(parsed.publications.length, 1);
  assert.equal(parsed.sections.filter(section => section.fields.cards === 'publications').length, 2);
});
