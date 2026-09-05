import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer } from '../server.js';
import { requestReply } from '../src/chat.js';
import { createRenderer } from '../src/render.js';
import { makeThread } from '../src/state.js';
import { loadSiteData, siteFiles } from '../src/types.js';
import { assertLink, assertText, readLocal, site } from './helpers.js';

// These checks cover delivered content, not server architecture or response-id formatting.
test('served data and profile image match the source files', async t => {
  const server = createServer().listen(0, '127.0.0.1');
  t.after(() => { server.closeAllConnections(); server.close(); });
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const path of Object.values(siteFiles)) {
    const response = await fetch(`${origin}/${path}`);
    assert.equal(response.status, 200, path);
    assert.deepEqual(await response.json(), await readLocal(path));
  }
  assert.deepEqual(await loadSiteData(path => fetch(`${origin}/${path}`).then(r => r.json())), site);
  const photo = await fetch(`${origin}/${site.profile.photo}`);
  assert.equal(photo.status, 200);
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), await readFile(new URL(`../../${site.profile.photo}`, import.meta.url)));

  const result = await requestReply({ message: 'What does Fuxiang research?', topic: 'bio' }, `${origin}/api/chat`);
  assert.equal(result.mode, 'mock');
  assert.match(result.text, /simulat(?:ed|ion)|mock|demo/i);
});

test('exported reading view preserves publication metadata and links', async () => {
  const html = await readFile(new URL('../../dist/reading.html', import.meta.url), 'utf8');
  assertText(html, site.profile.name);
  for (const paper of site.publications) {
    for (const value of [paper.title, paper.authors, paper.venue, String(paper.year)]) assertText(html, value);
    assertLink(html, paper.links.paper);
    if (paper.links.code) assertLink(html, paper.links.code);
  }
});

test('simulated replies remain identified as simulated in the displayed conversation', async () => {
  const result = await requestReply({ message: 'hello' }, null);
  assert.equal(result.mode, 'mock');
  assert.match(result.text, /simulat(?:ed|ion)|mock|demo/i);
  const thread = makeThread('conversation', 'chat');
  thread.messages.push({ id: result.id, role: 'assistant', text: result.text, prompt: 'hello', paperId: null, state: 'done' });
  const html = createRenderer({ site, loadFailed: false }).messages(thread);
  assertText(html, result.text);
  assert.match(html, /simulat(?:ed|ion)|mock|demo/i);
});
