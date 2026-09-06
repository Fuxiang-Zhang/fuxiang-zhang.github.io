import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationHistory, makeThread, prepareReply, showContent } from '../src/state.js';
import { tokenize } from '../src/stream.js';
import { site } from './helpers.js';

test('retry preserves the next draft and uses the original paper context', () => {
  for (const status of ['error', 'stopped'] as const) {
    const thread = makeThread();
    thread.draft = '  Original question  ';
    thread.paperId = 'derl-swe';
    const reply = prepareReply(thread);
    assert.ok(reply);
    assert.equal(thread.draft, '');
    assert.equal(thread.messages.length, 2);
    reply.state = status;
    thread.draft = 'New question, not yet sent';
    thread.paperId = 'q-adapter';
    const retried = prepareReply(thread, reply.id);
    assert.equal(thread.draft, 'New question, not yet sent');
    assert.equal(retried?.prompt, 'Original question');
    assert.equal(retried?.paperId, 'derl-swe');
  }
});

test('progressive text output preserves every character, regardless of animation timing', () => {
  for (const text of ['', '  ', 'Hi,  I’m Fuxiang.\nNext', '中文 & <text> 🧪\t61.8%', 'a'.repeat(3000)]) {
    assert.equal(tokenize(text).join(''), text);
  }
});

test('conversation history sends only completed turns before the pending reply, newest last', () => {
  const thread = makeThread();
  thread.draft = 'first';
  const first = prepareReply(thread)!;
  first.text = 'reply one'; first.state = 'done';
  thread.draft = 'second';
  const second = prepareReply(thread)!;
  second.state = 'error';
  showContent(thread, { kind: 'help' });
  thread.draft = 'third';
  const third = prepareReply(thread)!;
  assert.deepEqual(conversationHistory(thread, third.id), [
    { role: 'user', text: 'first' }, { role: 'assistant', text: 'reply one' }, { role: 'user', text: 'second' },
  ]);
  assert.deepEqual(conversationHistory(thread, third.id, 1), [{ role: 'user', text: 'second' }]);
  // The first question of a conversation has no history at all.
  assert.deepEqual(conversationHistory(makeThread(), 'none'), []);
  const single = makeThread();
  single.draft = 'only';
  assert.deepEqual(conversationHistory(single, prepareReply(single)!.id), []);
});

test('terminal presets append in order without losing questions, drafts, or paper context', () => {
  const thread = makeThread();
  thread.paperId = site.publications[0].id;
  thread.draft = 'Question about this paper';
  prepareReply(thread);
  thread.draft = 'My next question';
  const originalMessages = [...thread.messages];
  const first = showContent(thread, { kind: 'preset', topic: 'bio' });
  const second = showContent(thread, { kind: 'preset', topic: 'bio' });
  showContent(thread, { kind: 'preset', topic: 'publications' });
  assert.notEqual(first.id, second.id);
  assert.deepEqual(thread.messages.slice(0, 2), originalMessages);
  assert.equal(thread.messages.length, 5);
  assert.equal(thread.draft, 'My next question');
  assert.equal(thread.paperId, site.publications[0].id);
});

test('history generated after long replies fits the backend contract and keeps recent pairs', async () => {
  const { parseChatRequest } = await import('../chat/handler.js');
  const thread = makeThread();
  for (let i = 0; i < 8; i++) {
    thread.draft = `question ${i}`;
    const reply = prepareReply(thread)!;
    reply.state = 'done';
    reply.text = 'x'.repeat(20_000);
  }
  thread.draft = 'follow-up';
  const pending = prepareReply(thread)!;
  const history = conversationHistory(thread, pending.id);
  assert.equal(history.length, 2);
  assert.equal(history[0].text, 'question 7');
  assert.notEqual(typeof parseChatRequest({ message: pending.prompt, history }), 'string');
});
