/*
 * Abuse protection and the daily token ledger for the chat backend.
 * State lives in a small key-value store: Workers KV in production, an
 * in-memory map for the local server and tests. Writes are read-modify-write,
 * so concurrent requests can slip past a limit by a request or two; that is
 * acceptable for protecting a personal API budget.
 */
import type { BudgetStatus } from '../src/types.js';

export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

const HOUR = 3600_000;
const DAY = 86_400_000;
/** Daily usage records stay readable for three months. */
const USAGE_TTL = 90 * 24 * 3600;

/** Hashes a client address so raw IPs are never stored. */
export async function clientKey(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest).slice(0, 12), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Seconds until the next UTC midnight, when the daily budget resets. */
export const secondsUntilReset = (now = Date.now()): number => Math.ceil(((Math.floor(now / DAY) + 1) * DAY - now) / 1000);
export const resetTime = (now = Date.now()): string => new Date((Math.floor(now / DAY) + 1) * DAY).toISOString();

/** Counts one question for the client and reports whether it exceeds the hourly allowance. */
export async function checkClientLimit(store: KVStore, ip: string, perHour: number, now = Date.now()): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  const hour = Math.floor(now / HOUR);
  const secondsLeft = Math.ceil(((hour + 1) * HOUR - now) / 1000);
  const key = `client:${await clientKey(ip)}:${hour}`;
  const used = (Number(await store.get(key)) || 0) + 1;
  await store.put(key, String(used), { expirationTtl: Math.max(60, secondsLeft) });
  return used > perHour ? { allowed: false, retryAfter: secondsLeft } : { allowed: true };
}

/* Daily token ledger: one JSON record per UTC day, which doubles as the usage report. */
export interface Usage {
  /** Successful model calls. */
  requests: number;
  input: number;
  /** Input tokens served from the provider's prompt cache (already included in `input`). */
  cached: number;
  output: number;
  /** Input plus output, the number the daily budget is measured against. */
  total: number;
  /** Model calls that failed; they consume no tokens. */
  errors: number;
}
export const emptyUsage = (): Usage => ({ requests: 0, input: 0, cached: 0, output: 0, total: 0, errors: 0 });
export const usageKey = (now = Date.now()): string => `usage:${new Date(now).toISOString().slice(0, 10)}`;

export async function readUsage(store: KVStore, now = Date.now()): Promise<Usage> {
  const usage = emptyUsage();
  try {
    const stored: unknown = JSON.parse((await store.get(usageKey(now))) ?? '{}');
    if (stored && typeof stored === 'object') {
      for (const field of Object.keys(usage) as (keyof Usage)[]) {
        const value = (stored as Record<string, unknown>)[field];
        if (typeof value === 'number' && Number.isFinite(value)) usage[field] = value;
      }
    }
  } catch { /* A corrupt record counts as an empty day rather than blocking the assistant. */ }
  return usage;
}

/** Adds one request's numbers to today's record and returns the new totals. */
export async function recordUsage(store: KVStore, delta: Partial<Usage>, now = Date.now()): Promise<Usage> {
  const usage = await readUsage(store, now);
  for (const field of Object.keys(usage) as (keyof Usage)[]) usage[field] += delta[field] ?? 0;
  await store.put(usageKey(now), JSON.stringify(usage), { expirationTtl: USAGE_TTL });
  return usage;
}

export const budgetStatus = (usage: Usage, limit: number, now = Date.now()): BudgetStatus =>
  ({ used: usage.total, limit, exhausted: limit > 0 && usage.total >= limit, resetsAt: resetTime(now) });

/** In-memory store for the local server and tests. */
export class MemoryStore implements KVStore {
  private entries = new Map<string, { value: string; expires: number }>();
  constructor(private clock: () => number = Date.now) {}
  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expires <= this.clock()) { this.entries.delete(key); return null; }
    return entry.value;
  }
  async put(key: string, value: string, options: { expirationTtl?: number } = {}): Promise<void> {
    this.entries.set(key, { value, expires: this.clock() + (options.expirationTtl ?? 3600) * 1000 });
  }
}
