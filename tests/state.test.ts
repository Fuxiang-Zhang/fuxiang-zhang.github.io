import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyFilters, filterPublications, makeThread, prepareReply, startConversation, createState } from '../src/state.js';
import { categories, researchTopics } from '../src/types.js';
import { tokenize } from '../src/stream.js';
import { site } from './helpers.js';

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
    const retried = prepareReply(thread, reply.id);
    assert.equal(thread.draft, 'New question, not yet sent');
    assert.equal(retried?.prompt, 'Original question');
    assert.equal(retried?.paperId, 'paper-1');
  }
});

test('sending a question preserves its text and selected publication context', () => {
  const state = createState();
  for (const paper of [undefined, site.publications[0]]) {
    const source = makeThread('source', 'bio');
    source.draft = 'What does this result mean?';
    const chat = startConversation(state, source, 'conversation', paper);
    const reply = prepareReply(chat);
    assert.equal(reply?.prompt, 'What does this result mean?');
    assert.equal(reply?.paperId, paper?.id ?? null);
  }
});

test('publication filters return exactly the matching records without changing source data', () => {
  const papers = site.publications;
  const original = structuredClone(papers);
  const check = (patch: Partial<ReturnType<typeof emptyFilters>>, expected: typeof papers) => {
    const result = filterPublications(papers, { ...emptyFilters(), ...patch });
    assert.deepEqual([...result].sort((a, b) => a.id.localeCompare(b.id)),
      [...expected].sort((a, b) => a.id.localeCompare(b.id)));
  };
  check({}, papers);
  for (const category of categories) check({ category }, papers.filter(p => p.category === category));
  for (const topic of researchTopics) check({ topic }, papers.filter(p => p.topic === topic));
  for (const year of new Set(papers.map(p => p.year))) check({ year: String(year) }, papers.filter(p => p.year === year));
  for (const field of ['title', 'authors', 'venue'] as const) {
    const query = papers[0][field];
    check({ query: `  ${query.toUpperCase()}  ` }, papers.filter(p =>
      `${p.title} ${p.authors} ${p.venue}`.toLowerCase().includes(query.toLowerCase())));
  }
  const target = papers[0];
  check({ query: target.title, year: String(target.year), topic: target.topic, category: target.category }, [target]);
  check({ query: 'no such publication' }, []);
  assert.deepEqual(papers, original);
});

test('progressive text output preserves every character, regardless of animation timing', () => {
  for (const text of ['', '  ', 'Hi,  I’m Fuxiang.\nNext', '中文 & <text> 🧪\t61.8%', 'a'.repeat(3000)]) {
    assert.equal(tokenize(text).join(''), text);
  }
});
