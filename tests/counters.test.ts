import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { checkClientLimit, readUsage, recordUsage, usageKey, type KVStore } from '../chat/limits.js';
import { DurableCounterStore } from '../worker/counters.js';

test('Durable Object storage atomically migrates and increments counters across clients', async t => {
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: await Promise.all(['../worker/counters.js', '../chat/limits.js'].map(async relative => {
      const path = fileURLToPath(new URL(relative, import.meta.url));
      return { type: 'ESModule' as const, path, contents: await readFile(path, 'utf8') };
    })),
    compatibilityDate: '2026-06-01',
    durableObjects: { CHAT_COUNTERS: { className: 'ChatCounters', useSQLite: true } },
    kvNamespaces: ['CHAT_KV'],
  }));
  t.after(() => runtime.dispose());
  const legacy = await runtime.getKVNamespace('CHAT_KV') as unknown as KVStore;
  await legacy.put(usageKey(), JSON.stringify({ requests: 3, total: 300 }));
  const namespace = await runtime.getDurableObjectNamespace('CHAT_COUNTERS') as unknown as {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(url: string, init: RequestInit): Promise<Response> };
  };
  // Distinct adapter instances exercise the shared storage, not a process-local lock.
  const stores = Array.from({ length: 20 }, () => new DurableCounterStore({
    idFromName: name => namespace.idFromName(name),
    get: id => ({ fetch: async request => {
      const response = await namespace.get(id).fetch(request.url, {
        method: request.method, body: request.method === 'GET' ? undefined : await request.text(),
      });
      return new Response(await response.text(), { status: response.status });
    } }),
  }));
  await Promise.all(stores.map(store => recordUsage(store, { requests: 1, total: 100 })));
  assert.equal((await readUsage(stores[0])).requests, 23);
  assert.equal((await readUsage(stores[1])).total, 2300);
  await legacy.put(usageKey(), JSON.stringify({ total: 999999 }));
  assert.equal((await readUsage(stores[2])).total, 2300, 'legacy KV is imported only once');
  const results = await Promise.all(stores.map(store => checkClientLimit(store, 'same-client', 5)));
  assert.equal(results.filter(result => result.allowed).length, 5);
});
