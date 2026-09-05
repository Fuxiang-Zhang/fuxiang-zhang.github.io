import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { loadSiteData, parseSiteData, siteFiles } from '../src/types.js';
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
    const readLocal = async (path: string) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
    const site = await loadSiteData(path => fetch(`${origin}/${path}`).then(r=>r.json()));
    assert.deepEqual(site, await loadSiteData(readLocal));
    for (const path of Object.values(siteFiles)) assert.deepEqual(await fetch(`${origin}/${path}`).then(r=>r.json()), await readLocal(path));
    const reading = await fetch(`${origin}/reading.html`).then(r=>r.text());
    for(const paper of site.publications) assert.ok(reading.includes(paper.id), paper.title);
  });
  await t.test('returns distinct random strings through the real frontend transport', async () => {
    const first = await requestReply({message:'What does Fuxiang research?',topic:'bio'},`${origin}/api/chat`);
    const second = await requestReply({message:'Tell me about this paper',topic:'chat',paperId:'paper-6'},`${origin}/api/chat`);
    assert.equal(first.mode, 'mock');
    assert.match(first.text, /simulated reply/);
    assert.match(second.text, /simulated reply/);
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
    await assert.rejects(requestReply({message:'hello'},`${origin}/missing`), /404|405/);
  });
});

test('static preview explicitly returns mock text and honors cancellation', async () => {
  const result = await requestReply({message:'hello'}, null);
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

test('shared CV sections render independently and site data is validated', async () => {
  const { renderJourney } = await import('../src/render.js');
  const site = await loadSiteData(async path => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')));
  const experiences = renderJourney(site, ['experience', 'education']);
  const misc = renderJourney(site, ['service', 'awards']);
  assert.ok(experiences.includes('Skywork AI') && experiences.includes('DeRL-SWE-32B') && experiences.includes('id="journey-education"'));
  assert.ok(!misc.includes('id="journey-experience"') && !misc.includes('id="journey-education"'));
  assert.ok(misc.includes('id="journey-service"'));
  const broken = (patch: (copy: any) => void) => { const copy = structuredClone(site); patch(copy); return copy; };
  for (const invalid of [null, {}, { ...site, publications: [{ id:'incomplete' }] },
    broken(s => { s.experience[0].contributions[0].paperId = 'missing'; }),
    broken(s => { s.publications.push({ ...s.publications[0] }); }),
    broken(s => { s.research.pop(); }),
    broken(s => { s.interests[0].topic = 'unknown'; }),
    broken(s => { s.interests[1].points[0].description = 1; }),
    broken(s => { s.awards[0].period = 2020; })]) assert.throws(() => parseSiteData(invalid));
  await assert.rejects(loadSiteData(async path => path.endsWith('cv.json') ? [] : JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'))));
});

test('static service discovers new assets and confines paths and symlinks to its public root', async t => {
  const { mkdtemp, mkdir, writeFile, symlink, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const fixture = await mkdtemp(join(tmpdir(), 'fuxiang-static-'));
  const publicRoot = join(fixture, 'public');
  await mkdir(join(publicRoot, 'assets'), { recursive: true });
  await mkdir(join(publicRoot, 'guide'));
  await mkdir(join(publicRoot, 'escape'));
  await writeFile(join(publicRoot, 'assets/new file.pdf'), 'New PDF');
  await writeFile(join(publicRoot, 'guide/index.html'), '<h1>Guide</h1>');
  await writeFile(join(fixture, 'private.txt'), 'private');
  await symlink(join(fixture, 'private.txt'), join(publicRoot, 'leak.txt'));
  await symlink(fixture, join(publicRoot, 'outside'), 'dir');
  await symlink(join(fixture, 'private.txt'), join(publicRoot, 'escape/index.html'));
  const server = createServer(publicRoot).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(fixture, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const pdf = await fetch(`${origin}/assets/new%20file.pdf`);
  assert.equal(pdf.headers.get('Content-Type'), 'application/pdf');
  assert.equal(await pdf.text(), 'New PDF');
  const head = await fetch(`${origin}/assets/new%20file.pdf`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Content-Length'), '7');
  assert.equal(await head.text(), '');
  const redirect = await fetch(`${origin}/guide?view=all`, { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('Location'), '/guide/?view=all');
  assert.equal(await fetch(`${origin}/guide/`).then(response => response.text()), '<h1>Guide</h1>');
  for (const path of ['/..%2fprivate.txt', '/%2e%2e%2fprivate.txt', '/leak.txt', '/outside/private.txt', '/escape/', '/%00', '/..%5cprivate.txt']) {
    assert.equal((await fetch(origin + path)).status, 404, path);
  }
  assert.equal((await fetch(`${origin}/%E0%A4%A`)).status, 400);
});
