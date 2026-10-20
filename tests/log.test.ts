import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { handleChat, type ChatEnv } from '../chat/handler.js';
import { handleAdmin } from '../chat/admin.js';
import { MemoryStore, recordUsage } from '../chat/limits.js';
import { MemoryLogStore, LOG_RETENTION_DAYS, type LogEntry } from '../chat/log.js';
import { DurableLogStore, type LogNamespace } from '../worker/log.js';
import { readChatStream } from '../src/chat.js';
import type { ChatStatus } from '../src/types.js';
import { site } from './helpers.js';

const IP = '203.0.113.7';
const post = (body: unknown) => new Request('https://chat.example/api/chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': IP }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const provider = (text: string) => new Response(`data: ${JSON.stringify({ type: 'response.completed', response: {
  id: 'resp_log', status: 'completed', usage: { input_tokens: 90, output_tokens: 10, total_tokens: 100 },
  output: [{ type: 'message', role: 'assistant', id: 'msg_1', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }],
} })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
const env = (overrides: Partial<ChatEnv> = {}): ChatEnv => ({ site, allowedOrigins: [], logs: new MemoryLogStore(), logSecret: 'secret', ...overrides });
const entries = async (chat: ChatEnv) => (await chat.logs!.list({ limit: 50 })).entries;

test('every question is logged with its outcome, answered or not, without the raw address', async t => {
  t.mock.method(console, 'error', () => {});
  const mock = env();
  await handleChat(post({ message: 'Mock question?' }), mock);
  await handleChat(post({ message: 'x'.repeat(5000) }), mock);
  await handleChat(post('{not json'), mock);
  const [invalidJson, tooLong, mocked] = await entries(mock);
  assert.equal(mocked.outcome, 'mock');
  assert.equal(mocked.question, 'Mock question?');
  assert.match(mocked.answer ?? '', /simulated reply/i);
  assert.equal(tooLong.outcome, 'invalid');
  assert.equal(tooLong.question.length, 2000, 'oversized questions are truncated');
  assert.match(tooLong.error ?? '', /Message must contain/);
  assert.equal(invalidJson.outcome, 'invalid');
  assert.equal(invalidJson.error, 'Invalid JSON.');
  assert.match(mocked.client, /^[0-9a-f]{16}$/);
  assert.ok(!JSON.stringify(await entries(mock)).includes(IP), 'the raw IP is never stored');

  const limited = env({ store: new MemoryStore(), perHour: 1 });
  await handleChat(post({ message: 'first' }), limited);
  await handleChat(post({ message: 'second' }), limited);
  assert.deepEqual((await entries(limited)).map(entry => [entry.question, entry.outcome]), [['second', 'rate_limited'], ['first', 'mock']]);

  const store = new MemoryStore();
  await recordUsage(store, { total: 10 });
  const exhausted = env({ store, openaiKey: 'test', tokenBudget: 5 });
  await handleChat(post({ message: 'Over budget?' }), exhausted);
  assert.equal((await entries(exhausted))[0].outcome, 'budget');

  t.mock.method(globalThis, 'fetch', async () => provider('NOPO is our NeurIPS paper.'));
  const live = env({ openaiKey: 'test', model: 'gpt-6-luna' });
  await readChatStream(await handleChat(post({ message: 'What is NOPO?', paperId: 'negative-only-policy-optimization' }), live));
  const [answered] = await entries(live);
  assert.equal(answered.outcome, 'answered');
  assert.equal(answered.answer, 'NOPO is our NeurIPS paper.');
  assert.equal(answered.tokens, 100);
  assert.equal(answered.model, 'gpt-6-luna');
  assert.equal(answered.paperId, 'negative-only-policy-optimization');
  assert.equal(answered.responseId, 'resp_log');

  t.mock.method(globalThis, 'fetch', async () => Response.json(
    { error: { message: 'You have no credits remaining.', type: 'insufficient_quota', code: 'insufficient_quota' } }, { status: 429 }));
  await assert.rejects(readChatStream(await handleChat(post({ message: 'Still there?' }), live)));
  const [failed] = await entries(live);
  assert.equal(failed.outcome, 'error');
  assert.match(failed.error ?? '', /no credits/);
});

test('a failing log never changes the visitor response', async t => {
  t.mock.method(console, 'error', () => {});
  const response = await handleChat(post({ message: 'hello' }), env({ logs: { write: async () => { throw new Error('down'); }, list: async () => { throw new Error('down'); } } }));
  assert.equal(response.status, 200);
});

test('the status names the live model only', async () => {
  const status = (await (await handleChat(new Request('https://chat.example/api/chat'), env({ openaiKey: 'test', model: 'gpt-6-luna' }))).json()) as ChatStatus;
  assert.equal(status.model, 'gpt-6-luna');
  const mock = (await (await handleChat(new Request('https://chat.example/api/chat'), env())).json()) as ChatStatus;
  assert.equal(mock.model, undefined);
});

test('the log viewer needs the admin token and filters by outcome', async () => {
  const logs = new MemoryLogStore();
  const base: LogEntry = { time: Date.now(), outcome: 'answered', question: '<img src=x onerror=alert(1)>', answer: 'a', error: null, paperId: null, model: null, historyTurns: 0, durationMs: 5, tokens: 1, client: 'c', responseId: null };
  await logs.write(base);
  await logs.write({ ...base, outcome: 'error', question: 'failed one' });
  const get = (path: string, token?: string) => handleAdmin(new Request(`https://chat.example${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }), { logs, adminToken: 'correct horse' });

  assert.equal((await handleAdmin(new Request('https://chat.example/admin'), { logs })).status, 404, 'disabled without a token');
  const page = await get('/admin');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('Content-Security-Policy') ?? '', /script-src 'self'/);
  assert.match(await (await get('/admin.js')).text(), /textContent/);
  assert.equal((await get('/api/chat/logs')).status, 401);
  assert.equal((await get('/api/chat/logs', 'wrong')).status, 401);
  const all = await (await get('/api/chat/logs', 'correct horse')).json() as { entries: LogEntry[]; lastDay: Record<string, number> };
  assert.deepEqual(all.entries.map(entry => entry.outcome), ['error', 'answered']);
  assert.deepEqual(all.lastDay, { answered: 1, error: 1 });
  const errors = await (await get('/api/chat/logs?outcome=error', 'correct horse')).json() as { entries: LogEntry[] };
  assert.deepEqual(errors.entries.map(entry => entry.question), ['failed one']);
  assert.equal((await get('/api/chat/logs?outcome=bogus', 'correct horse')).status, 400);
});

test('the Durable Object log pages newest first and hides expired rows', async t => {
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: await Promise.all(['../worker/log.js', '../chat/log.js', '../src/types.js'].map(async relative => {
      const path = fileURLToPath(new URL(relative, import.meta.url));
      return { type: 'ESModule' as const, path, contents: await readFile(path, 'utf8') };
    })),
    compatibilityDate: '2026-06-01',
    durableObjects: { CHAT_LOG: { className: 'ChatLog', useSQLite: true } },
  }));
  t.after(() => runtime.dispose());
  const namespace = await runtime.getDurableObjectNamespace('CHAT_LOG') as unknown as {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(url: string, init: RequestInit): Promise<Response> };
  };
  const adapter: LogNamespace = {
    idFromName: name => namespace.idFromName(name),
    get: id => ({ fetch: async request => {
      const response = await namespace.get(id).fetch(request.url, { method: request.method, body: request.method === 'GET' ? undefined : await request.text() });
      return new Response(response.status === 204 ? null : await response.text(), { status: response.status });
    } }),
  };
  const logs = new DurableLogStore(adapter);
  const now = Date.now();
  const base: LogEntry = { time: now, outcome: 'answered', question: '', answer: null, error: null, paperId: null, model: 'gpt-6-luna', historyTurns: 0, durationMs: 1, tokens: 1, client: 'c', responseId: null };
  await logs.write({ ...base, time: now - (LOG_RETENTION_DAYS + 1) * 86_400_000, question: 'expired' });
  for (let i = 1; i <= 3; i++) await logs.write({ ...base, question: `q${i}`, outcome: i === 2 ? 'error' : 'answered' });
  const first = await logs.list({ limit: 2 }, now);
  assert.deepEqual(first.entries.map(entry => entry.question), ['q3', 'q2']);
  assert.equal(first.entries[0].model, 'gpt-6-luna');
  assert.deepEqual(first.lastDay, { answered: 2, error: 1 });
  const second = await logs.list({ limit: 2, before: first.next! }, now);
  assert.deepEqual(second.entries.map(entry => entry.question), ['q1']);
  assert.equal(second.next, null);
  assert.deepEqual((await logs.list({ limit: 5, outcome: 'error' }, now)).entries.map(entry => entry.question), ['q2']);
});
