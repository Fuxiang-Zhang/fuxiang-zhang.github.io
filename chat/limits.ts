import type { BudgetStatus } from '../src/types.js';

/** Read-only access to the old Workers KV ledger during migration. */
export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/** Implementations must add all fields atomically, across concurrent requests. */
export interface CounterStore {
  get(key: string): Promise<string | null>;
  add(key: string, delta: Record<string, number>, expirationTtl: number): Promise<Record<string, number>>;
}

export function numericSetting(value: string | undefined, fallback: number): number {
  if (value === undefined || !value.trim()) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
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
export async function checkClientLimit(store: CounterStore, ip: string, perHour: number, now = Date.now()): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  const hour = Math.floor(now / HOUR);
  const secondsLeft = Math.ceil(((hour + 1) * HOUR - now) / 1000);
  const key = `client:${await clientKey(ip)}:${hour}`;
  const { count: used } = await store.add(key, { count: 1 }, Math.max(60, secondsLeft));
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
  /** Reasoning tokens (already included in `output`), which the model spends before writing the visible answer. */
  reasoning: number;
  /** Input plus output, the number the daily budget is measured against. */
  total: number;
  /** Model calls that failed, including failures with charged tokens. */
  errors: number;
}
export const emptyUsage = (): Usage => ({ requests: 0, input: 0, cached: 0, output: 0, reasoning: 0, total: 0, errors: 0 });
export const usageKey = (now = Date.now()): string => `usage:${new Date(now).toISOString().slice(0, 10)}`;

export async function readUsage(store: CounterStore, now = Date.now()): Promise<Usage> {
  const stored = await store.get(usageKey(now));
  return { ...emptyUsage(), ...parseCounters(stored) };
}

/** Reject corrupt counters rather than silently resetting a live budget. */
export function parseCounters(value: string | null): Record<string, number> {
  if (value === null) return {};
  const stored: unknown = JSON.parse(value);
  // Legacy hourly counters were bare numbers in KV.
  if (typeof stored === 'number' && Number.isFinite(stored) && stored >= 0) return { count: stored };
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)
    || !Object.values(stored).every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
    throw new Error('Invalid counter record.');
  }
  return stored as Record<string, number>;
}

export function addCounters(current: Record<string, number>, delta: Record<string, number>): Record<string, number> {
  for (const [field, value] of Object.entries(delta)) {
    if (!Number.isFinite(value) || value < 0) throw new Error('Invalid counter increment.');
    current[field] = (current[field] ?? 0) + value;
  }
  return current;
}

/** Adds one request's numbers to today's record and returns the new totals. */
export async function recordUsage(store: CounterStore, delta: Partial<Usage>, now = Date.now()): Promise<Usage> {
  return { ...emptyUsage(), ...await store.add(usageKey(now), delta, USAGE_TTL) };
}

export const budgetStatus = (usage: Usage, limit: number, now = Date.now()): BudgetStatus =>
  ({ used: usage.total, limit, exhausted: limit > 0 && usage.total >= limit, resetsAt: resetTime(now) });

/** In-memory store for the local server and tests. */
export class MemoryStore implements CounterStore {
  private entries = new Map<string, { value: string; expires: number }>();
  constructor(private clock: () => number = Date.now) {}
  private read(key: string): string | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expires <= this.clock()) { this.entries.delete(key); return null; }
    return entry.value;
  }
  async get(key: string): Promise<string | null> { return this.read(key); }
  async add(key: string, delta: Record<string, number>, expirationTtl: number): Promise<Record<string, number>> {
    // No await between read and write: one event-loop turn is atomic locally.
    const value = addCounters(parseCounters(this.read(key)), delta);
    this.entries.set(key, { value: JSON.stringify(value), expires: this.clock() + expirationTtl * 1000 });
    return value;
  }
  async put(key: string, value: string, options: { expirationTtl?: number } = {}): Promise<void> {
    this.entries.set(key, { value, expires: this.clock() + (options.expirationTtl ?? 3600) * 1000 });
  }
}
