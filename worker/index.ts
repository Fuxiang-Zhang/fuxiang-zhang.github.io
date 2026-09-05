/*
 * Cloudflare Worker entry point. The site data is bundled at deploy time, so
 * the worker answers from the same content as the published homepage.
 * Configuration: wrangler.toml ([vars], KV binding) and the OPENAI_API_KEY secret.
 */
import siteMarkdown from '../data/site.md';
import { handleChat, DEFAULT_PER_HOUR, DEFAULT_TOKEN_BUDGET } from '../chat/handler.js';
import type { KVStore } from '../chat/limits.js';
import { parseSiteMarkdown } from '../src/markdown.js';

interface WorkerEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  /** Comma-separated list of origins allowed to call the API. */
  ALLOWED_ORIGINS?: string;
  RATE_PER_HOUR?: string;
  TOKEN_BUDGET_PER_DAY?: string;
  CHAT_KV?: KVStore;
}

const site = parseSiteMarkdown(siteMarkdown);

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname !== '/api/chat') {
      return new Response(JSON.stringify({ error: 'Not found.' }), { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    return handleChat(request, {
      site,
      openaiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      allowedOrigins: (env.ALLOWED_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean),
      store: env.CHAT_KV,
      perHour: Number(env.RATE_PER_HOUR) || DEFAULT_PER_HOUR,
      tokenBudget: env.TOKEN_BUDGET_PER_DAY === undefined ? DEFAULT_TOKEN_BUDGET : Number(env.TOKEN_BUDGET_PER_DAY) || 0,
    });
  },
};
