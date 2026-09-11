import test from 'node:test';
import assert from 'node:assert/strict';
import { compactContext } from '../chat/context.js';
import { getPapers, preloadPaperIds, executePaperTool } from '../chat/papers.js';
import { stableInstructions, dynamicInstructions } from '../chat/prompt.js';
import { supportsExplicitCache } from '../chat/openai.js';
import { handleChat } from '../chat/handler.js';
import { readChatStream } from '../src/chat.js';
import { MemoryStore, readUsage, usageKey } from '../chat/limits.js';
import { site } from './helpers.js';

const question = (message = 'Compare coordination methods.', paperId?: string) => new Request('https://site.test/api/chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, paperId }),
});
const usage = { input_tokens: 100, input_tokens_details: { cached_tokens: 20, cache_write_tokens: 30 }, output_tokens: 10, output_tokens_details: { reasoning_tokens: 2 }, total_tokens: 110 };
const call = (id = 'coordination-skills', callId = 'call_1') => ({ type: 'function_call', name: 'get_papers', arguments: JSON.stringify({ ids: [id] }), call_id: callId, id: `fc_${callId}`, status: 'completed' });
const message = (text = 'The methods differ.\n[[paper:coordination-skills]]') => ({ type: 'message', role: 'assistant', id: 'msg_1', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] });
function provider(output: unknown[], status = 'completed') {
  return new Response(`data: ${JSON.stringify({ type: `response.${status}`, response: { id: 'resp_1', status, output, usage } })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
}

test('compact context retains complete discovery and personal facts without full abstracts', () => {
  const context = compactContext(site);
  for (const paper of site.publications) {
    assert.ok(context.includes(paper.id));
    assert.ok(context.includes(paper.title));
    assert.ok(context.includes(paper.venue));
    if (paper.abstract) assert.ok(!context.includes(paper.abstract));
  }
  assert.ok(context.includes(site.profile.email));
  assert.match(context, /61\.8%/);
  assert.match(context, /role: Researcher/);
  assert.match(context, /ODIS/);
  assert.ok(stableInstructions(site, 'selective').length < stableInstructions(site, 'full').length / 2);
  assert.doesNotMatch(context, /:::publication|:::paper|<details>|Command:/);
  const p = site.publications[0];
  const extended = { ...site, sections: [...site.sections, { kind: 'paper' as const, title: 'Additional role', fields: { ref: p.id }, body: [{ kind: 'markdown' as const, title: '', fields: {}, body: [], line: 1, text: 'Authored evaluation code.' }], line: 1 }] };
  assert.match(compactContext(extended), /Additional role: Authored evaluation code/);
});

test('preloading respects explicit references, aliases and title boundaries over stale focus', () => {
  assert.deepEqual(preloadPaperIds(site, '解释 ODIS', 'rear'), ['coordination-skills']);
  assert.deepEqual(preloadPaperIds(site, 'Compare ODIS and MAIC'), ['coordination-skills', 'incentive-communication']);
  assert.deepEqual(preloadPaperIds(site, site.publications[0].title), [site.publications[0].id]);
  assert.deepEqual(preloadPaperIds(site, '这篇论文的方法呢？', 'rear'), ['rear']);
  assert.deepEqual(preloadPaperIds(site, 'rearrange my text'), []);
  assert.deepEqual(preloadPaperIds(site, 'hello', 'invalid'), []);
});

test('paper tool deduplicates, permits more than three papers and rejects malformed IDs safely', () => {
  const ids = site.publications.slice(0, 5).map(p => p.id);
  assert.equal(getPapers(site, [...ids, ids[0]]).length, 5);
  assert.equal(getPapers(site, [ids[0]])[0], site.publications[0]);
  assert.match(executePaperTool(site, 'get_papers', '{'), /Expected ids/);
  assert.match(executePaperTool(site, 'get_papers', '{"ids":[42]}'), /Expected ids/);
  assert.match(executePaperTool(site, 'get_papers', '{"ids":["unknown"]}'), /Unknown publication/);
  assert.match(executePaperTool(site, 'other', '{}'), /Unknown tool/);
});

test('cache capability and stable content are independent of focus and date', () => {
  assert.equal(supportsExplicitCache('gpt-5.6-terra'), true);
  assert.equal(supportsExplicitCache('gpt-5.5'), false);
  assert.equal(supportsExplicitCache('custom-deployment'), false);
  assert.notEqual(dynamicInstructions(site, 'rear', 0), dynamicInstructions(site, 'dr-mas', 86400000));
});

test('tool continuation preserves reasoning and call IDs, then accounts all responses once', async t => {
  const bodies: any[] = [];
  const reasoning = { type: 'reasoning', id: 'rs_1', summary: [], encrypted_content: 'opaque-reasoning' };
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return bodies.length === 1 ? provider([reasoning, call(), call('incentive-communication', 'call_2')]) : provider([message()]);
  });
  const store = new MemoryStore();
  const deltas: string[] = [];
  const reply = await readChatStream(await handleChat(question(), { site, store, openaiKey: 'test', allowedOrigins: [] }), text => deltas.push(text));
  assert.equal(bodies.length, 2);
  assert.equal(reply.text, deltas.join(''));
  assert.deepEqual(bodies[1].input.find((item: any) => item.type === 'reasoning'), reasoning);
  assert.deepEqual(bodies[1].input.filter((item: any) => item.type === 'function_call_output').map((item: any) => item.call_id), ['call_1', 'call_2']);
  assert.match(bodies[1].input.find((item: any) => item.type === 'function_call_output').output, /abstract/);
  assert.ok(bodies[0].include.includes('reasoning.encrypted_content'));
  const day = await readUsage(store);
  assert.equal(day.requests, 1);
  assert.equal(day.modelCalls, 2);
  assert.equal(day.total, 220);
  assert.equal(day.cacheWrite, 60);
  assert.equal(day.incompleteUsage, 0);
});

test('known single paper is preloaded, and full rollback disables tools', async t => {
  const bodies: any[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return provider([message()]);
  });
  await readChatStream(await handleChat(question('Explain ODIS', 'rear'), { site, openaiKey: 'test', allowedOrigins: [] }));
  assert.match(bodies[0].input[1].content, /"id":"coordination-skills"/);
  assert.doesNotMatch(bodies[0].input[1].content, /"id":"rear"/);
  await readChatStream(await handleChat(question(), { site, openaiKey: 'test', allowedOrigins: [], contextMode: 'full', model: 'gpt-5.5' }));
  assert.equal(bodies[1].tools, undefined);
  assert.equal(bodies[1].prompt_cache_options, undefined);
  assert.equal(bodies[1].input[0].content[0].prompt_cache_breakpoint, undefined);
  assert.ok(bodies[1].input[0].content[0].text.includes(site.source));
});

test('third response disables tools without changing definitions', async t => {
  const bodies: any[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return bodies.length < 3 ? provider([call()]) : provider([message()]);
  });
  await readChatStream(await handleChat(question(), { site, openaiKey: 'test', allowedOrigins: [] }));
  assert.equal(bodies.length, 3);
  assert.equal(bodies[2].tool_choice, 'none');
  assert.deepEqual(bodies[0].tools, bodies[2].tools);
});

test('later transport failure retains earlier charged usage and marks missing usage', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (++requests === 1) return provider([call()]);
    throw new Error('connection lost');
  });
  t.mock.method(console, 'error', () => {});
  const store = new MemoryStore();
  await assert.rejects(readChatStream(await handleChat(question(), { site, store, openaiKey: 'test', allowedOrigins: [] })));
  const day = await readUsage(store);
  assert.equal(day.total, 110);
  assert.equal(day.cacheWrite, 30);
  assert.equal(day.modelCalls, 2);
  assert.equal(day.incompleteUsage, 1);
  assert.equal(day.errors, 1);
});

test('old daily ledger records gain zero defaults for new counters', async () => {
  const store = new MemoryStore();
  await store.put(usageKey(), JSON.stringify({ input: 40, total: 45 }));
  const day = await readUsage(store);
  assert.equal(day.total, 45);
  assert.equal(day.cacheWrite, 0);
  assert.equal(day.modelCalls, 0);
});

test('terminal failure in a later round includes both rounds of measured usage', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => ++requests === 1 ? provider([call()]) : provider([], 'incomplete'));
  t.mock.method(console, 'error', () => {});
  const store = new MemoryStore();
  await assert.rejects(readChatStream(await handleChat(question(), { site, store, openaiKey: 'test', allowedOrigins: [] })));
  const day = await readUsage(store);
  assert.equal(day.total, 220);
  assert.equal(day.modelCalls, 2);
  assert.equal(day.incompleteUsage, 0);
});

test('a tool-round preamble cannot disguise an empty final answer', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => ++requests === 1 ? provider([message('Let me check.'), call()]) : provider([]));
  t.mock.method(console, 'error', () => {});
  await assert.rejects(readChatStream(await handleChat(question(), { site, openaiKey: 'test', allowedOrigins: [] })));
  assert.equal(requests, 2);
});
