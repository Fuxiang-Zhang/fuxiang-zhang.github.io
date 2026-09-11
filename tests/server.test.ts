import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer } from '../server.js';
import { requestReply } from '../src/chat.js';
import { siteFile } from '../src/markdown.js';
import { readLocal, site } from './helpers.js';

// These checks cover delivered content, not server architecture or response-id formatting.
test('served data and social preview image match the source files', async t => {
  const server = createServer().listen(0, '127.0.0.1');
  t.after(() => { server.closeAllConnections(); server.close(); });
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const home = await (await fetch(origin)).text();
  assert.ok(home.includes(`<title>${site.profile.title}</title>`));
  assert.ok(home.includes(`href="#${site.profile.home}"`));
  assert.ok(!home.includes('{{'), 'all build-time metadata placeholders are resolved');
  const script = await (await fetch(`${origin}/app.js`)).text();
  assert.ok(!/^import\s.*from ['"]markdown-it/m.test(script), 'browser dependencies are bundled');
  const response = await fetch(`${origin}/${siteFile}`);
  assert.equal(response.status, 200, siteFile);
  assert.equal(await response.text(), await readLocal(siteFile));
  const photo = await fetch(`${origin}/assets/Photo.JPG`);
  assert.equal(photo.status, 200);
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), await readFile(new URL(`../../assets/Photo.JPG`, import.meta.url)));

  const result = await requestReply({ message: 'What does Fuxiang research?' }, `${origin}/api/chat`);
  assert.equal(result.mode, 'mock');
  assert.match(result.text, /simulat(?:ed|ion)|mock|demo/i);
});

test('Node forwards the first provider delta immediately and cancels upstream on disconnect', async t => {
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'fake-stream-test';
  t.after(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });
  t.mock.method(console, 'error', () => {});
  const originalFetch = globalThis.fetch;
  let upstream!: ReadableStreamDefaultController<Uint8Array>;
  let upstreamSignal: AbortSignal | undefined;
  let resolveStarted!: () => void;
  const started = new Promise<void>(resolve => { resolveStarted = resolve; });
  let resolveAborted!: () => void;
  const aborted = new Promise<void>(resolve => { resolveAborted = resolve; });
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    if (!String(url).startsWith('https://api.openai.com/')) return originalFetch(url, init);
    upstreamSignal = init?.signal ?? undefined;
    upstreamSignal?.addEventListener('abort', () => { upstream.close(); resolveAborted(); }, { once: true });
    const body = new ReadableStream<Uint8Array>({ start(controller) { upstream = controller; } });
    resolveStarted();
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const server = createServer().listen(0, '127.0.0.1');
  t.after(() => { server.closeAllConnections(); server.close(); });
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const responsePromise = fetch(`${origin}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'hi' }),
  });
  await started;
  upstream.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":"First text"}\n\n'));
  const response = await responsePromise;
  const reader = response.body!.getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /First text/);
  assert.equal(upstreamSignal?.aborted, false, 'upstream is still generating when text reaches the browser');
  await reader.cancel();
  await aborted;
  assert.equal(upstreamSignal?.aborted, true);
});
