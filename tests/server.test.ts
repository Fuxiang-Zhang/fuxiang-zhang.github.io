import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer } from '../server.js';
import { requestReply } from '../src/chat.js';
import { siteFile } from '../src/markdown.js';
import { readLocal } from './helpers.js';

// These checks cover delivered content, not server architecture or response-id formatting.
test('served data and social preview image match the source files', async t => {
  const server = createServer().listen(0, '127.0.0.1');
  t.after(() => { server.closeAllConnections(); server.close(); });
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const response = await fetch(`${origin}/${siteFile}`);
  assert.equal(response.status, 200, siteFile);
  assert.equal(await response.text(), await readLocal(siteFile));
  const photo = await fetch(`${origin}/assets/Photo.JPG`);
  assert.equal(photo.status, 200);
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), await readFile(new URL(`../../assets/Photo.JPG`, import.meta.url)));

  const result = await requestReply({ message: 'What does Fuxiang research?', topic: 'bio' }, `${origin}/api/chat`);
  assert.equal(result.mode, 'mock');
  assert.match(result.text, /simulat(?:ed|ion)|mock|demo/i);
});
