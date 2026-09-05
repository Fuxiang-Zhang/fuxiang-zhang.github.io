/*
 * The chat backend as one Web-standard request handler. It runs unchanged on
 * Cloudflare Workers (worker/index.ts) and in the local Node server (server.ts).
 *   POST /api/chat  answers a question (mock reply without an API key).
 *   GET  /api/chat  reports the reply mode and today's token budget, so the
 *                   homepage can warn visitors before they ask.
 */
import { mockReply } from '../src/chat.js';
import { isRecord, isTopic, type ChatReply, type ChatRequest, type ChatStatus, type ChatTurn, type SiteData } from '../src/types.js';
import { budgetStatus, checkClientLimit, emptyUsage, readUsage, recordUsage, secondsUntilReset, type KVStore } from './limits.js';
import { askModel } from './openai.js';
import { buildInstructions } from './prompt.js';

export interface ChatEnv {
  site: SiteData;
  /** OpenAI API key; when absent every reply is the mock. */
  openaiKey?: string;
  model?: string;
  /** Exact origins allowed to call the endpoint from a browser. */
  allowedOrigins: string[];
  /** Counter store for limits and the usage ledger; omit to disable both (local development). */
  store?: KVStore;
  /** Questions per client per hour. */
  perHour?: number;
  /** Total tokens (input + output) per UTC day across all visitors; 0 disables the budget. */
  tokenBudget?: number;
}

export const MAX_MESSAGE = 2000;
export const MAX_HISTORY = 12;
export const MAX_BODY = 32_000;
export const DEFAULT_PER_HOUR = 20;
export const DEFAULT_TOKEN_BUDGET = 9_500_000;

function corsHeaders(origin: string | null, env: ChatEnv): Record<string, string> | null {
  if (!origin) return {};
  if (!env.allowedOrigins.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin',
  };
}

function json(status: number, value: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}

const isTurn = (value: unknown): value is ChatTurn => isRecord(value)
  && (value.role === 'user' || value.role === 'assistant') && typeof value.text === 'string' && value.text.length <= MAX_MESSAGE;

/** Accepts only the documented request shape; anything else yields the reason for a 400. */
export function parseChatRequest(value: unknown): ChatRequest | string {
  if (!isRecord(value)) return 'Expected a JSON object.';
  if (typeof value.message !== 'string' || !value.message.trim() || value.message.length > MAX_MESSAGE) return `Message must contain 1–${MAX_MESSAGE} characters.`;
  if (value.topic !== undefined && value.topic !== 'chat' && !isTopic(value.topic)) return 'Unknown topic.';
  if (value.paperId !== undefined && value.paperId !== null && typeof value.paperId !== 'string') return 'Invalid paper id.';
  if (value.history !== undefined && (!Array.isArray(value.history) || value.history.length > MAX_HISTORY || !value.history.every(isTurn))) return 'Invalid history.';
  const history = (value.history as ChatTurn[] | undefined)?.filter(turn => turn.text.trim());
  return { message: value.message.trim(), topic: value.topic as ChatRequest['topic'], paperId: (value.paperId as string | null | undefined) ?? null, history };
}

export const clientAddress = (request: Request): string =>
  request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ?? 'unknown';

export const BUDGET_MESSAGE = 'Today’s token budget for the assistant is used up. It is available again after midnight UTC.';

/** Today's budget as seen by visitors; null when no ledger or no budget is configured. */
async function currentBudget(env: ChatEnv, now: number) {
  const limit = env.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  if (!env.store || !env.openaiKey || limit <= 0) return null;
  return budgetStatus(await readUsage(env.store, now), limit, now);
}

export async function handleChat(request: Request, env: ChatEnv): Promise<Response> {
  const cors = corsHeaders(request.headers.get('Origin'), env);
  if (!cors) return json(403, { error: 'Origin not allowed.' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const now = Date.now();
  if (request.method === 'GET' || request.method === 'HEAD') {
    const status: ChatStatus = { mode: env.openaiKey ? 'live' : 'mock', budget: await currentBudget(env, now) };
    return json(200, status, cors);
  }
  if (request.method !== 'POST') return json(405, { error: 'Use POST.' }, { ...cors, Allow: 'GET, POST, OPTIONS' });
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json(415, { error: 'Expected JSON.' }, cors);

  const body = await request.text();
  if (body.length > MAX_BODY) return json(413, { error: 'Request too large.' }, cors);
  let input: unknown;
  try { input = JSON.parse(body); } catch { return json(400, { error: 'Invalid JSON.' }, cors); }
  const parsed = parseChatRequest(input);
  if (typeof parsed === 'string') return json(400, { error: parsed }, cors);

  if (env.store) {
    const client = await checkClientLimit(env.store, clientAddress(request), env.perHour ?? DEFAULT_PER_HOUR, now);
    if (!client.allowed) {
      return json(429, { error: 'Too many questions from this connection. Please try again later.' }, { ...cors, 'Retry-After': String(client.retryAfter) });
    }
  }
  if (!env.openaiKey) return json(200, mockReply(), cors);
  const budget = await currentBudget(env, now);
  if (budget?.exhausted) return json(429, { error: BUDGET_MESSAGE, budget }, { ...cors, 'Retry-After': String(secondsUntilReset(now)) });

  const paper = parsed.paperId && env.site.publications.some(paper => paper.id === parsed.paperId) ? parsed.paperId : null;
  const turns: ChatTurn[] = [...(parsed.history ?? []), { role: 'user', text: parsed.message }];
  try {
    const reply = await askModel({ apiKey: env.openaiKey, model: env.model, instructions: buildInstructions(env.site, paper), turns, signal: request.signal });
    const usage = env.store ? await recordUsage(env.store, { requests: 1, ...reply.usage }, now) : emptyUsage();
    const response: ChatReply = {
      id: reply.id, text: reply.answer, mode: 'live',
      ...(budget ? { budget: budgetStatus(usage, budget.limit, now) } : {}),
    };
    return json(200, response, cors);
  } catch (error) {
    console.error('chat: model request failed:', error instanceof Error ? error.message : error);
    if (env.store) await recordUsage(env.store, { errors: 1 }, now);
    return json(502, { error: 'The assistant is unavailable right now. Please try again in a moment.' }, cors);
  }
}
