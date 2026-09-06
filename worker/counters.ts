import { addCounters, parseCounters, type CounterStore, type KVStore } from '../chat/limits.js';

// Structural interfaces keep Worker-only runtime types out of the browser/Node build.
interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  transaction<T>(callback: (storage: Storage) => Promise<T>): Promise<T>;
  setAlarm(time: number): Promise<void>;
  deleteAll(): Promise<void>;
}
interface Context {
  storage: Storage;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}
export interface CounterNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

/** One Durable Object per ledger key, shared by all Worker instances. */
export class ChatCounters {
  constructor(private ctx: Context, private env: { CHAT_KV?: KVStore }) {}

  async fetch(request: Request): Promise<Response> {
    const key = decodeURIComponent(new URL(request.url).pathname.slice(1));
    // Import each old KV record once. The gate also excludes concurrent initializations.
    await this.ctx.blockConcurrencyWhile(async () => {
      if (await this.ctx.storage.get('value') !== undefined) return;
      const value = parseCounters(await this.env.CHAT_KV?.get(key) ?? null);
      await this.ctx.storage.put('value', value);
      await this.ctx.storage.setAlarm(Date.now() + (key.startsWith('usage:') ? 90 * 86400_000 : 3600_000));
    });
    if (request.method === 'GET') return Response.json(await this.ctx.storage.get('value'));
    const { delta, expirationTtl } = await request.json() as { delta: Record<string, number>; expirationTtl: number };
    const value = await this.ctx.storage.transaction(async storage => {
      const next = addCounters(await storage.get<Record<string, number>>('value') ?? {}, delta);
      await storage.put('value', next);
      await storage.setAlarm(Date.now() + expirationTtl * 1000);
      return next;
    });
    return Response.json(value);
  }

  async alarm(): Promise<void> { await this.ctx.storage.deleteAll(); }
}

export class DurableCounterStore implements CounterStore {
  constructor(private namespace: CounterNamespace) {}
  private async request(key: string, body?: unknown): Promise<Response> {
    const response = await this.namespace.get(this.namespace.idFromName(key)).fetch(new Request(
      `https://counter/${encodeURIComponent(key)}`,
      body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) },
    ));
    if (!response.ok) throw new Error(`Counter store returned ${response.status}.`);
    return response;
  }
  async get(key: string): Promise<string> { return (await this.request(key)).text(); }
  async add(key: string, delta: Record<string, number>, expirationTtl: number): Promise<Record<string, number>> {
    return (await this.request(key, { delta, expirationTtl })).json() as Promise<Record<string, number>>;
  }
}
