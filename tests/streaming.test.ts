import test from 'node:test';
import assert from 'node:assert/strict';
import { handleChat } from '../chat/handler.js';
import { MemoryStore, readUsage } from '../chat/limits.js';
import { ChatError, readChatStream, requestReply, streamingReplyText } from '../src/chat.js';
import { chatDeadline } from '../src/chat-deadline.js';
import { CHAT_TIMEOUT_MS } from '../src/types.js';
import { createRenderer } from '../src/render.js';
import { site } from './helpers.js';

const encoder = new TextEncoder();
const post = () => new Request('https://site.test/api/chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Research?' }),
});
const completed = {
  type: 'response.completed', response: {
    id: 'resp_stream', status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: '你好 world.' }] }],
    usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 40 }, output_tokens: 5, total_tokens: 105 },
  },
};
function providerStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = false;
  const response = new Response(new ReadableStream<Uint8Array>({
    start(value) { controller = value; }, cancel() { cancelled = true; },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
  return { response, send: (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)),
    close: () => controller.close(), cancelled: () => cancelled };
}

test('live deltas reach the client before provider completion and usage is committed once', async t => {
  const provider = providerStream();
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.stream, true);
    assert.equal(body.max_output_tokens, 4096);
    return provider.response;
  });
  const store = new MemoryStore();
  const response = await handleChat(post(), { site, allowedOrigins: [], openaiKey: 'test', store });
  assert.match(response.headers.get('Content-Type')!, /ndjson/);
  let resolveDelta!: () => void;
  const firstDelta = new Promise<void>(resolve => { resolveDelta = resolve; });
  const deltas: string[] = [];
  let done = false;
  const reply = readChatStream(response, text => { deltas.push(text); resolveDelta(); }).then(reply => { done = true; return reply; });
  provider.send({ type: 'response.output_text.delta', delta: '你好 ' });
  await firstDelta;
  assert.equal(done, false, 'first text must not wait for the terminal event');
  assert.equal((await readUsage(store)).requests, 0);
  provider.send({ type: 'response.output_text.delta', delta: 'world.' });
  provider.send(completed);
  provider.close();
  assert.equal((await reply).text, '你好 world.');
  assert.deepEqual(deltas, ['你好 ', 'world.']);
  assert.equal((await readUsage(store)).total, 105);
  assert.equal((await readUsage(store)).requests, 1);
});

test('accounting failure preserves the answer, logs reconciliation details and does not retry increments', async t => {
  const provider = providerStream();
  t.mock.method(globalThis, 'fetch', async () => provider.response);
  const logs: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => { logs.push(args); });
  const store = new MemoryStore();
  const add = store.add.bind(store);
  let ledgerWrites = 0;
  t.mock.method(store, 'add', async (key: string, delta: Record<string, number>, ttl: number) => {
    if (key.startsWith('usage:')) { ledgerWrites++; throw new Error('ledger offline'); }
    return add(key, delta, ttl);
  });
  const response = await handleChat(post(), { site, allowedOrigins: [], openaiKey: 'test', store });
  const reply = readChatStream(response);
  provider.send(completed);
  provider.close();
  assert.equal((await reply).text, '你好 world.');
  assert.equal((await reply).budget, undefined, 'never publish an invented ledger total');
  assert.equal(ledgerWrites, 1);
  assert.match(JSON.stringify(logs), /usage accounting failed/);
  assert.match(JSON.stringify(logs), /resp_stream/);
  assert.match(JSON.stringify(logs), /105/);
});

test('cancelling the response body aborts the provider and still records the failed request', async t => {
  const provider = providerStream();
  let upstreamSignal: AbortSignal | undefined;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    upstreamSignal = init?.signal ?? undefined;
    upstreamSignal?.addEventListener('abort', () => provider.close(), { once: true });
    return provider.response;
  });
  t.mock.method(console, 'error', () => {});
  let task!: Promise<void>;
  const store = new MemoryStore();
  const response = await handleChat(post(), { site, allowedOrigins: [], openaiKey: 'test', store, waitUntil: value => { task = value; } });
  const reader = response.body!.getReader();
  provider.send({ type: 'response.output_text.delta', delta: 'partial' });
  await reader.read();
  await reader.cancel();
  await task;
  assert.equal(upstreamSignal?.aborted, true);
  assert.equal((await readUsage(store)).errors, 1);
});

test('NDJSON decoding handles UTF-8 split at every byte and rejects premature EOF', async () => {
  const events = [{ type: 'delta', text: '你好' }, { type: 'done', reply: { id: 'x', mode: 'live', text: '你好' } }];
  const bytes = encoder.encode(events.map(event => JSON.stringify(event) + '\n').join(''));
  const response = new Response(new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } }));
  let text = '';
  assert.equal((await readChatStream(response, delta => { text += delta; })).text, '你好');
  assert.equal(text, '你好');
  await assert.rejects(readChatStream(new Response(JSON.stringify(events[0]) + '\n')), /before.*complete/);
  await assert.rejects(readChatStream(new Response('{bad}\n')), SyntaxError);
  await assert.rejects(readChatStream(new Response(JSON.stringify({ type: 'error', error: 'Failed', status: 502 }) + '\n')), ChatError);
});

test('a shared deadline covers streamed reads and is disposed after completion', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const deadline = chatDeadline();
  t.mock.timers.tick(CHAT_TIMEOUT_MS - 1);
  assert.equal(deadline.signal.aborted, false);
  t.mock.timers.tick(1);
  assert.equal(deadline.signal.reason.name, 'TimeoutError');
  deadline.dispose();
  const disposed = chatDeadline();
  disposed.dispose();
  t.mock.timers.tick(CHAT_TIMEOUT_MS);
  assert.equal(disposed.signal.aborted, false);
  const parent = new AbortController();
  const cancelled = chatDeadline(parent.signal);
  parent.abort();
  assert.equal(cancelled.signal.aborted, true);
  cancelled.dispose();
});

test('requestReply streams deltas without adding callbacks to the request and accepts mock JSON', async t => {
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    assert.deepEqual(JSON.parse(String(init?.body)), { message: 'hi' });
    return new Response(JSON.stringify({ type: 'delta', text: 'Hi' }) + '\n' + JSON.stringify({ type: 'done', reply: { id: 'x', text: 'Hi', mode: 'live' } }) + '\n', { headers: { 'Content-Type': 'application/x-ndjson' } });
  });
  const deltas: string[] = [];
  assert.equal((await requestReply({ message: 'hi', onDelta: text => deltas.push(text) }, 'https://site.test')).text, 'Hi');
  assert.deepEqual(deltas, ['Hi']);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'mock', text: 'Mock', mode: 'mock' }));
  assert.equal((await requestReply({ message: 'hi' }, 'https://site.test')).mode, 'mock');
});

test('streaming rendering hides split markers and retains partial text after failure or stop', () => {
  const prefix = 'Read this.\n';
  const marker = '[[paper:rear]]';
  for (let i = 1; i < marker.length; i++) assert.equal(streamingReplyText(prefix + marker.slice(0, i)), prefix);
  assert.equal(streamingReplyText(prefix + marker), prefix + marker);
  const view = createRenderer({ site, loadFailed: false });
  for (const state of ['pending', 'error', 'stopped'] as const) {
    const html = view.message({ id: 'x', role: 'assistant', prompt: 'q', paperId: null, state, mode: 'live', text: prefix + '[[paper:re' });
    assert.match(html, /Read this\./);
    assert.ok(!html.includes('[[paper'));
    if (state === 'pending') assert.match(html, /stream-cursor/);
    else assert.match(html, /data-retry/);
  }
});

test('client deadline interrupts a stalled body and reports timeout rather than a user stop', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let resolveReading!: () => void;
  const reading = new Promise<void>(resolve => { resolveReading = resolve; });
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => new Response(new ReadableStream({
    start(controller) {
      init?.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
    },
    pull() { resolveReading(); },
  }), { headers: { 'Content-Type': 'application/x-ndjson' } }));
  const result = requestReply({ message: 'hi' }, 'https://site.test');
  const rejected = assert.rejects(result, error => error instanceof ChatError && error.status === 502 && /timed out/.test(error.message));
  await reading;
  t.mock.timers.tick(CHAT_TIMEOUT_MS);
  await rejected;
});
