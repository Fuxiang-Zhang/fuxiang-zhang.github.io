import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSiteData, parseSiteMarkdown, siteFile } from '../src/markdown.js';
import { parseSiteData, type SiteData } from '../src/types.js';
import { readLocal, site } from './helpers.js';

/*
 * A complete miniature document: parsing it must produce exactly the object
 * below, so the format stays pinned down field by field. The real content lives
 * in data/site.md and is checked for structure further down.
 */
const sample = `# Ada Lovelace

Position: Researcher · Somewhere
Email: ada@example.org
Photo: assets/Photo.JPG
Links: [GitHub](https://github.com/ada), [Site](https://ada.example)

## Bio

First paragraph with a [link](https://ada.example) in it, wrapped
across two source lines.

Second paragraph.

## Research topics

### Large Language Models {#llm}
Short name: LLMs

Language model work.

### Reinforcement Learning {#rl}
Short name: RL

Reinforcement learning work.

### Multi-Agent Reinforcement Learning {#marl}
Short name: Multi-Agent RL

Multi-agent work.

## Research interests

### Learning from interaction
Topic: rl

Why interaction matters:

#### Offline data
Topic: rl

Learning without a simulator.

## Publications

### On Analytical Engines {#analytical-engines}
Authors: Ada Lovelace, Charles Babbage
Venue: Journal of Computing
Venue short: JoC
Year: 1843
Category: journal
Topic: rl
Paper: https://example.org/notes
Code: https://github.com/ada/notes

The engine can be made to weave algebraic patterns, wrapped
across two source lines.

## Experience

### Analytical Society
Role: Researcher
Location: London
Period: 1842 – 1843
Links: [Society](https://example.org)

Studied engines.

#### Note G
Paper: analytical-engines

Wrote the first program.

## Education

### University of London
Degree: Mathematics
Period: 1840 – 1842

Studied mathematics.

## Service

### Journal of Computing
Role: Reviewer
Period: 1843

## Awards

### Gold Medal
Issuer: Analytical Society
Period: 1843
`;

test('the Markdown format maps onto every field the homepage renders', () => {
  const parsed = parseSiteMarkdown(sample);
  assert.equal(parsed.source, sample);
  const { source, ...content } = parsed;
  assert.deepEqual(content, {
    profile: {
      name: 'Ada Lovelace',
      position: 'Researcher · Somewhere',
      photo: 'assets/Photo.JPG',
      email: 'ada@example.org',
      links: [{ label: 'GitHub', url: 'https://github.com/ada' }, { label: 'Site', url: 'https://ada.example' }],
      bio: [
        'First paragraph with a [link](https://ada.example) in it, wrapped across two source lines.',
        'Second paragraph.',
      ],
    },
    research: [
      { id: 'llm', name: 'Large Language Models', shortName: 'LLMs', description: 'Language model work.' },
      { id: 'rl', name: 'Reinforcement Learning', shortName: 'RL', description: 'Reinforcement learning work.' },
      { id: 'marl', name: 'Multi-Agent Reinforcement Learning', shortName: 'Multi-Agent RL', description: 'Multi-agent work.' },
    ],
    interests: [{
      title: 'Learning from interaction', description: 'Why interaction matters:', topic: 'rl',
      points: [{ title: 'Offline data', description: 'Learning without a simulator.', topic: 'rl' }],
    }],
    publications: [{
      id: 'analytical-engines', title: 'On Analytical Engines',
      authors: 'Ada Lovelace, Charles Babbage', venue: 'Journal of Computing', venueShort: 'JoC',
      year: 1843, category: 'journal', topic: 'rl',
      links: { paper: 'https://example.org/notes', code: 'https://github.com/ada/notes' },
      abstract: 'The engine can be made to weave algebraic patterns, wrapped across two source lines.',
    }],
    experience: [{
      organization: 'Analytical Society', role: 'Researcher', location: 'London', period: '1842 – 1843',
      description: 'Studied engines.', links: [{ label: 'Society', url: 'https://example.org' }],
      contributions: [{ title: 'Note G', paperId: 'analytical-engines', description: 'Wrote the first program.' }],
    }],
    education: [{
      institution: 'University of London', degree: 'Mathematics', period: '1840 – 1842', description: 'Studied mathematics.',
    }],
    service: [{ venue: 'Journal of Computing', role: 'Reviewer', period: '1843' }],
    awards: [{ title: 'Gold Medal', issuer: 'Analytical Society', period: '1843' }],
  });
});

test('the published content parses and every heading becomes a record', async () => {
  const source = await readLocal(siteFile);
  const headings = (marker: string, section: string) => {
    const body = source.split(`\n## `).find(part => part.startsWith(`${section}\n`)) ?? '';
    return body.split('\n').filter(line => line.startsWith(`${marker} `)).length;
  };
  assert.equal(headings('###', 'Publications'), site.publications.length);
  assert.equal(headings('###', 'Experience'), site.experience.length);
  assert.equal(headings('###', 'Education'), site.education.length);
  assert.equal(headings('###', 'Service'), site.service.length);
  assert.equal(headings('###', 'Awards'), site.awards.length);
  assert.equal(headings('###', 'Research topics'), site.research.length);
  assert.equal(headings('###', 'Research interests'), site.interests.length);
  assert.equal(headings('####', 'Research interests'), site.interests.flatMap(interest => interest.points ?? []).length);
  // Every publication is reachable by its own slug, and nothing is left unnamed.
  assert.equal(new Set(site.publications.map(paper => paper.id)).size, site.publications.length);
  for (const paper of site.publications) assert.match(paper.id, /^[a-z0-9][a-z0-9-]*$/);
});

test('a malformed document is reported instead of silently losing content', () => {
  const cases: [string, RegExp][] = [
    [sample.replace('## Awards', '## Prizes'), /Unknown section/],
    [sample.replace('Short name: LLMs', 'Nickname: LLMs'), /Missing "short name"/],
    [sample.replace('Venue short: JoC\n', ''), /Missing "venue short"/],
    [sample.replace('{#analytical-engines}', ''), /Missing the \{#id\} marker/],
    [sample.replace('Paper: analytical-engines', 'Paper: no-such-paper'), /Unknown publication/],
    [sample.replace('Year: 1843', 'Year: eighteen'), /Invalid Year/],
    [sample.replace('Category: journal', 'Category: preprint'), /Invalid publication/],
    [sample.replace('### Multi-Agent Reinforcement Learning {#marl}', '### Other {#other}'), /Invalid research data/],
    [sample.replace('### Multi-Agent Reinforcement Learning {#marl}\nShort name: Multi-Agent RL\n\nMulti-agent work.\n', ''), /Missing research interest: marl/],
    [sample.replace('Role: Researcher\nLocation: London', 'Role: Researcher\nDegree: London'), /Unknown field "degree"/],
    [sample.replace('Studied engines.', 'Studied engines.\n\nPeriod: 1900'), /Move "Period: 1900" directly under/],
    [sample.replace('#### Note G', '##### Note G'), /skips a level/],
    [sample.replace('Links: [GitHub](https://github.com/ada), [Site](https://ada.example)', 'Links: GitHub'), /no \[label\]\(url\) links/],
    [sample.replace('## Bio\n', ''), /Missing section "## bio"/],
    [`A note before the title.\n\n${sample}`, /Content above the "# Name" heading/],
  ];
  for (const [broken, message] of cases) assert.throws(() => parseSiteMarkdown(broken), message, message.source);
});

test('invalid records, duplicate paper ids and broken references are rejected', () => {
  const broken = (patch: (copy: SiteData) => void) => {
    const copy = structuredClone(site);
    patch(copy);
    return copy;
  };
  for (const invalid of [null, {}, { ...site, publications: [{ id: 'incomplete' }] },
    broken(s => { s.experience[0].contributions![0].paperId = 'missing'; }),
    broken(s => { s.publications.push({ ...s.publications[0] }); }),
    broken(s => { s.publications[0].year = 2025.5; }),
    { ...site, awards: [{ ...site.awards[0], period: 2020 }] },
    { ...site, interests: [{ title: 'Invalid', description: 1 }] },
    { ...site, publications: [{ ...site.publications[0], topic: 'unknown' }] },
  ]) assert.throws(() => parseSiteData(invalid));
});

test('an unreadable source file is reported rather than treated as empty content', async () => {
  await assert.rejects(loadSiteData(async () => { throw new Error('Unavailable site data'); }), /Unavailable site data/);
  await assert.rejects(loadSiteData(async () => ''), /"# Name" heading/);
});
