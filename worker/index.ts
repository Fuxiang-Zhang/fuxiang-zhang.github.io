/*
 * Cloudflare Worker entry point. The site data is bundled at deploy time, so
 * the worker answers from the same content as the published homepage.
 * Configuration: wrangler.toml ([vars], Durable Object binding) and the OPENAI_API_KEY secret.
 */
import siteMarkdown from '../data/site.md';
import { handleChat, DEFAULT_PER_HOUR, DEFAULT_TOKEN_BUDGET } from '../chat/handler.js';
import { numericSetting, type KVStore } from '../chat/limits.js';
import { parseSiteMarkdown } from '../src/markdown.js';

import { DurableCounterStore, type CounterNamespace } from './counters.js';
export { ChatCounters } from './counters.js';

interface WorkerEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  /** Comma-separated list of origins allowed to call the API. */
  ALLOWED_ORIGINS?: string;
  RATE_PER_HOUR?: string;
  TOKEN_BUDGET_PER_DAY?: string;
  CHAT_KV?: KVStore;
  CHAT_COUNTERS: CounterNamespace;
}

const site = parseSiteMarkdown(siteMarkdown);

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: { waitUntil(task: Promise<void>): void }): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname !== '/api/chat') {
      return new Response(JSON.stringify({ error: 'Not found.' }), { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    return handleChat(request, {
      site,
      waitUntil: task => ctx.waitUntil(task),
      openaiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      allowedOrigins: (env.ALLOWED_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean),
      store: new DurableCounterStore(env.CHAT_COUNTERS),
      perHour: numericSetting(env.RATE_PER_HOUR, DEFAULT_PER_HOUR),
      tokenBudget: numericSetting(env.TOKEN_BUDGET_PER_DAY, DEFAULT_TOKEN_BUDGET),
    });
  },
};
