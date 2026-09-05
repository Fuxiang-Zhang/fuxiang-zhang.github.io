import test from 'node:test';
import assert from 'node:assert/strict';
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
