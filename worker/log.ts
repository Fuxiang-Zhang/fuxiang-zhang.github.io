import { boundEntry, isOutcome, retentionCutoff, type LogEntry, type LogOutcome, type LogPage, type LogQuery, type LogStore, type StoredLogEntry } from '../chat/log.js';

// Structural interfaces keep Worker-only runtime types out of the browser/Node build.
interface SqlStorage {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
}
interface Context {
  storage: {
    sql: SqlStorage;
    getAlarm(): Promise<number | null>;
    setAlarm(time: number): Promise<void>;
  };
}
export interface LogNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

const DAY = 86_400_000;
const COLUMNS = 'id, time, outcome, question, answer, error, paper_id, model, history_turns, duration_ms, tokens, client, response_id';

function toEntry(row: Record<string, unknown>): StoredLogEntry {
  return {
    id: Number(row.id), time: Number(row.time), outcome: row.outcome as LogOutcome,
    question: String(row.question), answer: row.answer as string | null, error: row.error as string | null,
    paperId: row.paper_id as string | null, model: row.model as string | null,
    historyTurns: Number(row.history_turns), durationMs: Number(row.duration_ms), tokens: Number(row.tokens),
    client: String(row.client), responseId: row.response_id as string | null,
  };
}

/** One SQLite Durable Object holds the whole question log; old rows are pruned daily. */
export class ChatLog {
  private sql: SqlStorage;
  constructor(private ctx: Context) {
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, time INTEGER NOT NULL, outcome TEXT NOT NULL,
      question TEXT NOT NULL, answer TEXT, error TEXT, paper_id TEXT, model TEXT,
      history_turns INTEGER NOT NULL, duration_ms INTEGER NOT NULL, tokens INTEGER NOT NULL,
      client TEXT NOT NULL, response_id TEXT)`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS log_time ON log (time)');
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST') {
      const entry = boundEntry(await request.json() as LogEntry);
      if (!isOutcome(entry.outcome)) return new Response('Invalid outcome.', { status: 400 });
      this.sql.exec(`INSERT INTO log (${COLUMNS.slice(4)}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        entry.time, entry.outcome, entry.question, entry.answer, entry.error, entry.paperId, entry.model,
        entry.historyTurns, entry.durationMs, entry.tokens, entry.client, entry.responseId);
      if (await this.ctx.storage.getAlarm() === null) await this.ctx.storage.setAlarm(Date.now() + DAY);
      return new Response(null, { status: 204 });
    }
    const outcome = url.searchParams.get('outcome');
    const before = url.searchParams.get('before');
    const limit = Number(url.searchParams.get('limit'));
    const now = Number(url.searchParams.get('now')) || Date.now();
    const rows = this.sql.exec(
      `SELECT ${COLUMNS} FROM log WHERE time >= ? AND (? IS NULL OR outcome = ?) AND (? IS NULL OR id < ?) ORDER BY id DESC LIMIT ?`,
      retentionCutoff(now), outcome, outcome, before === null ? null : Number(before), before === null ? null : Number(before), limit + 1,
    ).toArray().map(toEntry);
    const lastDay: Partial<Record<LogOutcome, number>> = {};
    for (const row of this.sql.exec('SELECT outcome, COUNT(*) AS count FROM log WHERE time >= ? GROUP BY outcome', now - DAY).toArray()) {
      lastDay[row.outcome as LogOutcome] = Number(row.count);
    }
    const entries = rows.slice(0, limit);
    const page: LogPage = { entries, next: rows.length > limit ? entries[entries.length - 1].id : null, lastDay };
    return Response.json(page);
  }

  async alarm(): Promise<void> {
    this.sql.exec('DELETE FROM log WHERE time < ?', retentionCutoff());
    await this.ctx.storage.setAlarm(Date.now() + DAY);
  }
}

export class DurableLogStore implements LogStore {
  constructor(private namespace: LogNamespace) {}
  private stub() { return this.namespace.get(this.namespace.idFromName('log')); }
  async write(entry: LogEntry): Promise<void> {
    const response = await this.stub().fetch(new Request('https://log/', { method: 'POST', body: JSON.stringify(entry) }));
    if (!response.ok) throw new Error(`Question log returned ${response.status}.`);
  }
  async list({ outcome, before, limit }: LogQuery, now = Date.now()): Promise<LogPage> {
    const params = new URLSearchParams({ limit: String(limit), now: String(now) });
    if (outcome) params.set('outcome', outcome);
    if (before !== undefined) params.set('before', String(before));
    const response = await this.stub().fetch(new Request(`https://log/?${params}`));
    if (!response.ok) throw new Error(`Question log returned ${response.status}.`);
    return response.json() as Promise<LogPage>;
  }
}
