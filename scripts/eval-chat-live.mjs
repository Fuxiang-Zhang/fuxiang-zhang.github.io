// Paid API evaluation; never invoked by npm test.
// npm run build && node --env-file=.env scripts/eval-chat-live.mjs --live
import { readFile, writeFile } from 'node:fs/promises';
import { handleChat } from '../.build/chat/handler.js';
import { parseSiteMarkdown } from '../.build/src/markdown.js';
import { readChatStream, PAPER_MARKER } from '../.build/src/chat.js';
import { MemoryStore, readUsage } from '../.build/chat/limits.js';
import { DEFAULT_MODEL } from '../.build/chat/openai.js';
if (!process.argv.includes('--live')) throw new Error('Pass --live to authorize paid API calls.');
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required.');
const site = parseSiteMarkdown(await readFile(new URL('../data/site.md', import.meta.url), 'utf8'));
const cases = JSON.parse(await readFile(new URL('../tests/chat-eval.json', import.meta.url), 'utf8'));
const indices = (process.env.EVAL_CASES ?? '0,6,10,11,12,14,15,18,19,20,22,25,28,29,30').split(',').map(Number);
if (indices.some(i => !Number.isInteger(i) || !cases[i])) throw new Error('Invalid EVAL_CASES');
const mode = process.env.EVAL_MODE ?? 'selective';
if (!['selective', 'full'].includes(mode)) throw new Error('Invalid EVAL_MODE');
const output = process.env.EVAL_OUTPUT ?? '/tmp/homepage-live-eval.json';
const report = { startedAt: new Date().toISOString(), model: process.env.OPENAI_MODEL || DEFAULT_MODEL, mode, results: [] };
let telemetry;
const log = console.info.bind(console);
console.info = (label, data) => { if (label === 'chat: model usage') telemetry = data; else log(label, data); };
for (const index of indices) {
  const { check, requireLookup, ...body } = cases[index];
  const store = new MemoryStore();
  telemetry = undefined;
  const result = { index, question: body.message, expected: check };
  let streamed = '';
  try {
    const response = await handleChat(new Request('https://live-eval.local/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }), { site, store, openaiKey: process.env.OPENAI_API_KEY, model: report.model, allowedOrigins: [], contextMode: mode });
    const reply = await readChatStream(response, delta => { streamed += delta; });
    const ids = [...reply.text.matchAll(PAPER_MARKER)].map(match => match[1]);
    result.answer = reply.text;
    result.checks = { live: reply.mode === 'live', streamMatches: streamed.trim() === reply.text,
      validPaperIds: ids.every(id => site.publications.some(p => p.id === id)), atMostThreeCards: ids.length <= 3,
      uniqueCards: ids.length === new Set(ids).size };
    if (index === 0) result.checks.correctEmail = reply.text.includes(site.profile.email);
    if (index === 15) result.checks.completeList = site.publications.every(p => reply.text.includes(p.title));
    if (index === 25) result.checks.offtopic = reply.text.trim() === '[[offtopic]]';
    result.passed = Object.values(result.checks).every(Boolean);
  } catch (error) { result.error = error.message; result.passed = false; }
  result.usage = await readUsage(store);
  if (requireLookup && result.checks) {
    if (mode === 'selective') result.checks.paperLookupExecuted = result.usage.modelCalls > 1;
    const expected = site.publications.filter(p => p.year === 2026);
    result.checks.exactPaperUrls = expected.every(p => result.answer.includes(p.links.paper));
    result.checks.completeAuthors = expected.every(p => p.authors.split(/,|\band\b/).map(author => author.replace(/\*/g, '').trim()).filter(Boolean).every(author => result.answer.includes(author)));
    result.passed = Object.values(result.checks).every(Boolean);
  }
  result.telemetry = telemetry;
  report.results.push(result);
  await writeFile(output, JSON.stringify(report, null, 2));
  log(JSON.stringify({ index, passed: result.passed, error: result.error, total: result.usage.total,
    calls: result.usage.modelCalls, cached: result.usage.cached, durationMs: telemetry?.durationMs }));
  if (!result.passed) process.exitCode = 1;
  if (result.error) break;
}
log(`Report: ${output}`);
