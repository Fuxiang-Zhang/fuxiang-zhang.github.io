/*
 * Owner-only question log viewer, served by the same backend as the chat.
 *   GET /admin           the viewer page (asks for the admin token)
 *   GET /admin.js        its script
 *   GET /api/chat/logs   one page of log entries; needs `Authorization: Bearer <ADMIN_TOKEN>`
 * Without an admin token configured, all three answer 404.
 */
import { isOutcome, LOG_OUTCOMES, LOG_RETENTION_DAYS, type LogStore } from './log.js';

export interface AdminEnv {
  logs?: LogStore;
  /** Shared secret for the viewer; unset disables it. */
  adminToken?: string;
}
export const ADMIN_PATHS = ['/admin', '/admin.js', '/api/chat/logs'];
const PAGE_LIMIT = 50;

const headers = (type: string): Record<string, string> => ({
  'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
});
const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: headers('application/json; charset=utf-8') });

/** Compares digests in constant time, so response timing does not reveal the token. */
async function tokenMatches(given: string, expected: string): Promise<boolean> {
  const digest = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export async function handleAdmin(request: Request, env: AdminEnv): Promise<Response> {
  const url = new URL(request.url);
  if (!env.adminToken || !env.logs) return json(404, { error: 'Not found.' });
  if (request.method !== 'GET') return json(405, { error: 'Use GET.' });
  if (url.pathname === '/admin') return new Response(PAGE, { headers: headers('text/html; charset=utf-8') });
  if (url.pathname === '/admin.js') return new Response(SCRIPT, { headers: headers('text/javascript; charset=utf-8') });

  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1] ?? '';
  if (!await tokenMatches(token, env.adminToken)) return json(401, { error: 'Wrong admin token.' });
  const outcome = url.searchParams.get('outcome') || undefined;
  if (outcome !== undefined && !isOutcome(outcome)) return json(400, { error: 'Unknown outcome.' });
  const before = url.searchParams.get('before');
  const cursor = before === null ? undefined : Number(before);
  if (cursor !== undefined && !Number.isSafeInteger(cursor)) return json(400, { error: 'Invalid cursor.' });
  return json(200, await env.logs.list({ outcome, before: cursor, limit: PAGE_LIMIT }));
}

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Chat Log</title>
<style>
:root { color-scheme: light dark; --bg: #fafafa; --fg: #1d1f21; --muted: #6a6f75; --line: #d9dcdf; --ok: #2f7d4f; --bad: #b3261e; --warn: #9a6700; }
@media (prefers-color-scheme: dark) { :root { --bg: #17191b; --fg: #e4e6e8; --muted: #9aa0a6; --line: #33373b; --ok: #6fcf97; --bad: #f28b82; --warn: #f2c94c; } }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
main { max-width: 980px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 18px; margin: 0 0 4px; }
p.note { color: var(--muted); margin: 0 0 20px; }
form, .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; }
input, select, button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 6px; padding: 6px 10px; }
button { cursor: pointer; }
.summary { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 16px; color: var(--muted); }
.entry { border-top: 1px solid var(--line); padding: 14px 0; }
.meta { display: flex; flex-wrap: wrap; gap: 4px 14px; color: var(--muted); font-size: 12px; }
.outcome { font-weight: 600; }
.outcome.answered, .outcome.mock { color: var(--ok); }
.outcome.error, .outcome.timeout, .outcome.invalid { color: var(--bad); }
.outcome.cancelled, .outcome.rate_limited, .outcome.budget { color: var(--warn); }
.question { margin: 6px 0; white-space: pre-wrap; overflow-wrap: anywhere; font-weight: 600; }
.error { color: var(--bad); white-space: pre-wrap; overflow-wrap: anywhere; }
details { margin-top: 4px; } summary { cursor: pointer; color: var(--muted); }
.answer { white-space: pre-wrap; overflow-wrap: anywhere; margin: 6px 0 0; }
#status { color: var(--muted); }
</style></head>
<body><main>
<h1>Chat question log</h1>
<p class="note">Every question sent to the homepage assistant, newest first. Records are deleted after ${LOG_RETENTION_DAYS} days.</p>
<form id="login"><input id="token" type="password" placeholder="Admin token" autocomplete="current-password" required><button>Open log</button></form>
<div id="viewer" hidden>
  <div class="bar"><label>Outcome <select id="outcome"><option value="">all</option></select></label><button id="refresh" type="button">Refresh</button><button id="logout" type="button">Lock</button></div>
  <div class="summary" id="summary"></div>
  <div id="entries"></div>
  <div class="bar"><button id="more" type="button" hidden>Load older</button></div>
</div>
<p id="status" role="status"></p>
</main><script src="/admin.js"></script></body></html>`;

const SCRIPT = `const OUTCOMES = ${JSON.stringify(LOG_OUTCOMES)};
const $ = id => document.getElementById(id);
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
let token = '';
try { token = sessionStorage.getItem('chat-log-token') || ''; } catch {}
let next = null;
for (const outcome of OUTCOMES) $('outcome').append(new Option(outcome, outcome));

async function load(append) {
  $('status').textContent = 'Loading…';
  const params = new URLSearchParams();
  if ($('outcome').value) params.set('outcome', $('outcome').value);
  if (append && next !== null) params.set('before', String(next));
  const response = await fetch('/api/chat/logs?' + params, { headers: { Authorization: 'Bearer ' + token } });
  if (response.status === 401) { lock('Wrong admin token.'); return; }
  if (!response.ok) { $('status').textContent = 'Could not load the log (' + response.status + ').'; return; }
  const page = await response.json();
  $('login').hidden = true; $('viewer').hidden = false; $('status').textContent = '';
  try { sessionStorage.setItem('chat-log-token', token); } catch {}
  const summary = $('summary'); summary.replaceChildren(el('span', '', 'Last 24 h:'));
  const counts = Object.entries(page.lastDay);
  if (!counts.length) summary.append(el('span', '', 'no questions'));
  for (const [outcome, count] of counts) summary.append(el('span', 'outcome ' + outcome, outcome + ' ' + count));
  if (!append) $('entries').replaceChildren();
  for (const entry of page.entries) $('entries').append(render(entry));
  if (!append && !page.entries.length) $('entries').append(el('p', 'note', 'No records.'));
  next = page.next; $('more').hidden = next === null;
}
function render(entry) {
  const box = el('article', 'entry');
  const meta = el('div', 'meta');
  meta.append(el('span', 'outcome ' + entry.outcome, entry.outcome), el('span', '', new Date(entry.time).toLocaleString()));
  meta.append(el('span', '', (entry.durationMs / 1000).toFixed(1) + ' s'));
  if (entry.tokens) meta.append(el('span', '', entry.tokens.toLocaleString() + ' tokens'));
  if (entry.model) meta.append(el('span', '', entry.model));
  if (entry.paperId) meta.append(el('span', '', 'paper: ' + entry.paperId));
  if (entry.historyTurns) meta.append(el('span', '', entry.historyTurns + ' earlier turns'));
  meta.append(el('span', '', 'visitor ' + entry.client));
  box.append(meta, el('p', 'question', entry.question || '(no question)'));
  if (entry.error) box.append(el('p', 'error', entry.error));
  if (entry.answer) {
    const details = el('details'); details.append(el('summary', '', entry.outcome === 'answered' || entry.outcome === 'mock' ? 'Answer' : 'Partial answer'), el('p', 'answer', entry.answer));
    box.append(details);
  }
  return box;
}
function lock(message) {
  token = ''; try { sessionStorage.removeItem('chat-log-token'); } catch {}
  $('viewer').hidden = true; $('login').hidden = false; $('status').textContent = message || '';
}
$('login').addEventListener('submit', event => { event.preventDefault(); token = $('token').value; $('token').value = ''; load(false); });
$('outcome').addEventListener('change', () => load(false));
$('refresh').addEventListener('click', () => load(false));
$('more').addEventListener('click', () => load(true));
$('logout').addEventListener('click', () => lock());
if (token) load(false);
`;
