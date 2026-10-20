import { contextMode } from '../chat/context.js';
/*
 * Cloudflare Worker entry point. The site data is bundled at deploy time, so
 * the worker answers from the same content as the published homepage.
 * Configuration: wrangler.toml ([vars], Durable Object bindings) and the OPENAI_API_KEY
 * and ADMIN_TOKEN secrets. ADMIN_TOKEN unlocks the question log at /admin.
 */
import siteMarkdown from '../data/site.md';
import { handleChat, DEFAULT_PER_HOUR, DEFAULT_TOKEN_BUDGET } from '../chat/handler.js';
import { numericSetting, type KVStore } from '../chat/limits.js';
import { parseSiteMarkdown } from '../src/markdown.js';

import { ADMIN_PATHS, handleAdmin } from '../chat/admin.js';
import { DurableCounterStore, type CounterNamespace } from './counters.js';
import { DurableLogStore, type LogNamespace } from './log.js';
export { ChatCounters } from './counters.js';
export { ChatLog } from './log.js';

interface WorkerEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  CHAT_CONTEXT_MODE?: string;
  /** Comma-separated list of origins allowed to call the API. */
  ALLOWED_ORIGINS?: string;
  RATE_PER_HOUR?: string;
  TOKEN_BUDGET_PER_DAY?: string;
  CHAT_KV?: KVStore;
  CHAT_COUNTERS: CounterNamespace;
  CHAT_LOG?: LogNamespace;
  /** Unlocks the question log viewer; also keys the visitor hashes in the log. */
  ADMIN_TOKEN?: string;
}

const site = parseSiteMarkdown(siteMarkdown);

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: { waitUntil(task: Promise<void>): void }): Promise<Response> {
    const { pathname } = new URL(request.url);
    const logs = env.CHAT_LOG ? new DurableLogStore(env.CHAT_LOG) : undefined;
    if (ADMIN_PATHS.includes(pathname)) return handleAdmin(request, { logs, adminToken: env.ADMIN_TOKEN });
    if (pathname !== '/api/chat') {
      return new Response(JSON.stringify({ error: 'Not found.' }), { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    return handleChat(request, {
      site,
      waitUntil: task => ctx.waitUntil(task),
      openaiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      contextMode: contextMode(env.CHAT_CONTEXT_MODE),
      allowedOrigins: (env.ALLOWED_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean),
      store: new DurableCounterStore(env.CHAT_COUNTERS),
      perHour: numericSetting(env.RATE_PER_HOUR, DEFAULT_PER_HOUR),
      tokenBudget: numericSetting(env.TOKEN_BUDGET_PER_DAY, DEFAULT_TOKEN_BUDGET),
      logs,
      logSecret: env.ADMIN_TOKEN,
    });
  },
};
