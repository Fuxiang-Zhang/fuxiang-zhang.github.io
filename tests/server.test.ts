import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { parsePublications } from '../src/types.js';
import { once } from 'node:events';
import { createServer } from '../server.js';
import { requestReply } from '../src/chat.js';

test('homepage and mock chat work together without external services', async t => {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (body: string, type='application/json') => fetch(`${origin}/api/chat`, { method:'POST', headers:{'Content-Type':type}, body });

  await t.test('serves the page, styles, app, photo and full publication data', async () => {
    for (const path of ['/', '/styles.css', '/app.js', '/chat.js', '/config.js', '/content.js', '/render.js', '/types.js', '/assets/Photo.JPG', '/reading.html']) {
      const response = await fetch(origin + path);
      assert.equal(response.status, 200, path);
      assert.ok((await response.arrayBuffer()).byteLength > 0);
    }
    const papers = parsePublications(await fetch(`${origin}/data/publications.json`).then(r=>r.json()));
    const source = JSON.parse(await readFile(new URL('../../data/publications.json', import.meta.url), 'utf8'));
    assert.deepEqual(papers, source);
    const reading = await fetch(`${origin}/reading.html`).then(r=>r.text());
    for(const paper of papers) assert.ok(reading.includes(paper.id), paper.title);
  });
  await t.test('returns distinct random strings through the real frontend transport', async () => {
    const first = await requestReply({message:'What does Fuxiang research?',language:'en',topic:'overview'},`${origin}/api/chat`);
    const second = await requestReply({message:'介绍一下这篇论文',language:'zh',topic:'chat',paperId:'paper-6'},`${origin}/api/chat`);
    assert.equal(first.mode, 'mock');
    assert.match(first.text, /simulated reply/);
    assert.match(second.text, /模拟回复/);
    assert.notEqual(first.id, second.id);
    assert.match(first.id, /^[a-f0-9]{24}$/);
    assert.ok(first.text.includes(first.id));
  });
  await t.test('rejects empty, invalid, oversized and wrong-method requests', async () => {
    for (const input of [null, {}, {message:''}, {message:'   '}, {message:[]}, {message:'a'.repeat(2001)}]) {
      assert.equal((await post(JSON.stringify(input))).status, 400);
    }
    assert.equal((await post('{broken')).status, 400);
    assert.equal((await post(JSON.stringify({message:'a'.repeat(13000)}))).status, 413);
    assert.equal((await post('hi','text/plain')).status, 415);
    assert.equal((await fetch(`${origin}/api/chat`)).status, 405);
  });
  await t.test('does not expose repository internals or backend source', async () => {
    for (const path of ['/server.ts','/src/app.ts','/tsconfig.json','/package-lock.json','/server.mjs','/.git/config','/.env','/package.json','/data/../server.mjs','/data/%2e%2e%2fserver.mjs']) {
      assert.equal((await fetch(origin+path)).status, 404, path);
    }
  });
  await t.test('propagates unavailable-service errors for retry UI', async () => {
    await assert.rejects(requestReply({message:'hello',language:'en'},`${origin}/missing`), /404|405/);
  });
});

test('static preview explicitly returns mock text and honors cancellation', async () => {
  const result = await requestReply({message:'hello',language:'en'}, null);
  assert.equal(result.mode, 'mock');
  assert.match(result.text, /simulated reply/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(requestReply({message:'hello',signal:controller.signal},null), {name:'AbortError'});
});

test('static export contains executable modules and no TypeScript or server source', async () => {
  const root = new URL('../../dist/', import.meta.url);
  const html = await readFile(new URL('index.html', root), 'utf8');
  const { access, readdir } = await import('node:fs/promises');
  for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    assert.ok(match[1].endsWith('.js'));
    await access(new URL(match[1], root));
  }
  for (const name of await readdir(root)) {
    assert.ok(!name.endsWith('.ts') && name !== 'server.js');
    if (!name.endsWith('.js')) continue;
    const code = await readFile(new URL(name, root), 'utf8');
    for (const match of code.matchAll(/from\s+['"](\.\/?[^'"]+)['"]/g)) await access(new URL(match[1], root));
  }
});

test('shared content keeps Work separate and validates publication inputs', async () => {
  const { renderJourney } = await import('../src/render.js');
  for (const language of ['en', 'zh'] as const) {
    const work = renderJourney(language, false, ['experience']);
    const misc = renderJourney(language, false, ['education', 'service', 'awards']);
    assert.ok(work.includes('Skywork AI') && work.includes('DeRL-SWE-32B'));
    assert.ok(!misc.includes('id="journey-experience"'));
    assert.ok(misc.includes('id="journey-education"'));
  }
  for (const invalid of [null, {}, [{ id:'incomplete' }]]) assert.throws(() => parsePublications(invalid));
});
