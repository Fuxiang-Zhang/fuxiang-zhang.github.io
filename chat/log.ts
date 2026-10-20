/*
 * Question log: one record per chat question, answered or not, so the owner can
 * review what visitors ask and why requests fail. Records hold no raw IP address,
 * only a keyed hash, and are deleted after LOG_RETENTION_DAYS.
 */
import { MAX_MESSAGE, MAX_REPLY } from '../src/types.js';

/** What happened to a question. */
export type LogOutcome =
  | 'answered'      // the model replied
  | 'mock'          // no API key: the canned placeholder replied
  | 'error'         // the model request failed
  | 'timeout'       // the reply exceeded the request deadline
  | 'cancelled'     // the visitor stopped or left before the reply finished
  | 'rate_limited'  // the visitor exceeded the hourly allowance
  | 'budget'        // the daily token budget was used up
  | 'invalid';      // the request was malformed (e.g. message too long)

export const LOG_OUTCOMES: readonly LogOutcome[] = ['answered', 'mock', 'error', 'timeout', 'cancelled', 'rate_limited', 'budget', 'invalid'];
export const LOG_RETENTION_DAYS = 90;
const DAY = 86_400_000;

export interface LogEntry {
  time: number;
  outcome: LogOutcome;
  question: string;
  /** The full reply, or the partial text streamed before a failure. */
  answer: string | null;
  /** Server-side failure detail; never shown to visitors. */
  error: string | null;
  paperId: string | null;
  model: string | null;
  /** Earlier turns sent with the question. */
  historyTurns: number;
  durationMs: number;
  tokens: number;
  /** Keyed hash of the visitor's address: groups one visitor's questions without storing the IP. */
  client: string;
  responseId: string | null;
}
export interface StoredLogEntry extends LogEntry { id: number }

export interface LogQuery {
  outcome?: LogOutcome;
  /** Return entries with ids below this cursor (the previous page's `next`). */
  before?: number;
  limit: number;
}
export interface LogPage {
  entries: StoredLogEntry[];
  /** Cursor for the next (older) page; null on the last page. */
  next: number | null;
  /** Count of each outcome over the last 24 hours. */
  lastDay: Partial<Record<LogOutcome, number>>;
}

export interface LogStore {
  write(entry: LogEntry): Promise<void>;
  list(query: LogQuery, now?: number): Promise<LogPage>;
}

export const isOutcome = (value: unknown): value is LogOutcome => LOG_OUTCOMES.includes(value as LogOutcome);
export const retentionCutoff = (now = Date.now()): number => now - LOG_RETENTION_DAYS * DAY;

/** Truncates oversized fields so one record stays small. */
export function boundEntry(entry: LogEntry): LogEntry {
  return {
    ...entry,
    question: entry.question.slice(0, MAX_MESSAGE),
    answer: entry.answer?.slice(0, MAX_REPLY) ?? null,
    error: entry.error?.slice(0, 1000) ?? null,
    paperId: entry.paperId?.slice(0, 200) ?? null,
  };
}

/** HMAC of the client address under a server secret, so hashes cannot be reversed by enumerating IPs. */
export async function clientHash(ip: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret || 'chat-log'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(ip));
  return Array.from(new Uint8Array(digest).slice(0, 8), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** In-memory log for the local server and tests. */
export class MemoryLogStore implements LogStore {
  private entries: StoredLogEntry[] = [];
  private nextId = 1;
  async write(entry: LogEntry): Promise<void> {
    this.entries.push({ id: this.nextId++, ...boundEntry(entry) });
  }
  async list({ outcome, before, limit }: LogQuery, now = Date.now()): Promise<LogPage> {
    const cutoff = retentionCutoff(now);
    this.entries = this.entries.filter(entry => entry.time >= cutoff);
    const matching = this.entries
      .filter(entry => (!outcome || entry.outcome === outcome) && (before === undefined || entry.id < before))
      .reverse();
    const entries = matching.slice(0, limit);
    const lastDay: Partial<Record<LogOutcome, number>> = {};
    for (const entry of this.entries) if (entry.time >= now - DAY) lastDay[entry.outcome] = (lastDay[entry.outcome] ?? 0) + 1;
    return { entries, next: matching.length > limit ? entries[entries.length - 1].id : null, lastDay };
  }
}
