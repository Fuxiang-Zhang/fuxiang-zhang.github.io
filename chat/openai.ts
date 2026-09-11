/*
 * Model access through the OpenAI Responses API. The reply is the model's plain
 * text: the homepage shows prose, so there is nothing to enforce a schema over.
 */
import OpenAI from 'openai';
import type { Response as ModelResponse, ResponseInput } from 'openai/resources/responses/responses';
import type { SiteData } from '../src/types.js';
import { paperTool, executePaperTool } from './papers.js';
import { CHAT_TIMEOUT_MS, MAX_REPLY, type ChatTurn } from '../src/types.js';

export const DEFAULT_MODEL = 'gpt-5.6-terra';

/** `reasoning` tokens are part of `output`; they are billed but never shown. */
export interface ModelUsage { input: number; cached: number; output: number; reasoning: number; total: number; cacheWrite?: number; modelCalls?: number; incompleteUsage?: number }
export interface ModelReply { id: string; answer: string; usage: ModelUsage }

/** Provider usage must survive validation failures so charged tokens are recorded. */
export class ModelReplyError extends Error {
  constructor(message: string, readonly usage: ModelUsage) { super(message); }
}

/** An empty reply is a server error, never shown to a visitor as an answer. */
export function parseModelReply(id: string, output: string, usage: ModelUsage = { input: 0, cached: 0, output: 0, reasoning: 0, total: 0 }): ModelReply {
  const answer = typeof output === 'string' ? output.trim() : '';
  if (!answer) throw new ModelReplyError('Model reply is missing an answer.', usage);
  if (answer.length > MAX_REPLY) throw new ModelReplyError('Model reply is too long.', usage);
  return { id, answer, usage };
}

export interface ModelOptions {
  apiKey: string;
  model?: string;
  instructions: string;
  /** Groups requests by stable instructions; provider routing and cache hits are not guaranteed. */
  cacheKey?: string;
  turns: ChatTurn[];
  dynamic?: string;
  paperSite?: SiteData;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

/** Unknown/custom model names use automatic caching without model-specific fields. */
export function supportsExplicitCache(model: string): boolean {
  return /^gpt-(?:5\.(?:[6-9]|[1-9]\d)|[6-9]|[1-9]\d)(?:[.-]|$)/.test(model);
}

export async function askModel({ apiKey, model = DEFAULT_MODEL, instructions, dynamic, paperSite, cacheKey, turns, signal, onDelta }: ModelOptions): Promise<ModelReply> {
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: CHAT_TIMEOUT_MS });
  const explicit = supportsExplicitCache(model);
  const input: ResponseInput = [{ role: 'developer', content: [{ type: 'input_text', text: instructions,
    ...(explicit ? { prompt_cache_breakpoint: { mode: 'explicit' as const } } : {}),
  }] }, ...(dynamic ? [{ role: 'developer' as const, content: dynamic }] : []),
  ...turns.map(turn => ({ role: turn.role, content: turn.text }))];
  const usage: ModelUsage = { input: 0, cached: 0, output: 0, reasoning: 0, total: 0, cacheWrite: 0, modelCalls: 0, incompleteUsage: 0 };
  const started = Date.now();
  let firstTextMs: number | null = null;
  let awaitingUsage = false;
  let answer = '';
  let emittedLength = 0;
  let responseId: string | undefined;
  const emit = (text: string) => {
    emittedLength += text.length;
    if (emittedLength > MAX_REPLY) throw new Error('Model reply is too long.');
    if (firstTextMs === null && text.trim()) firstTextMs = Date.now() - started;
    onDelta(text);
  };
  try {
    for (let round = 0; round < (paperSite ? 3 : 1); round++) {
      signal?.throwIfAborted();
      usage.modelCalls!++;
      awaitingUsage = true;
      const stream = await client.responses.create({
        model, input,
        ...(cacheKey ? { prompt_cache_key: cacheKey } : {}),
        ...(explicit ? { prompt_cache_options: { mode: 'explicit' as const, ttl: '30m' as const } } : {}),
        ...(paperSite ? { tools: [paperTool], tool_choice: round < 2 ? 'auto' as const : 'none' as const,
          include: ['reasoning.encrypted_content' as const] } : {}),
        text: { verbosity: 'low' }, reasoning: { effort: 'low' },
        max_output_tokens: 4096, stream: true, store: false,
      }, { signal });
      let terminal: ModelResponse | undefined;
      let streamed = false;
      let separated = false;
      try {
        for await (const event of stream) {
          if (event.type === 'response.output_text.delta') {
            if (!separated && answer) { emit('\n\n'); separated = true; }
            streamed = true;
            emit(event.delta);
          }
          if (event.type === 'response.completed' || event.type === 'response.incomplete' || event.type === 'response.failed') {
            terminal = event.response;
            break;
          }
          if (event.type === 'error') throw new Error(`Model stream error: ${event.code ?? 'unknown'}`);
        }
      } finally { stream.controller.abort(); }
      if (!terminal) {
        signal?.throwIfAborted();
        throw new Error('Model stream ended without a final response.');
      }
      responseId = terminal.id;
      awaitingUsage = false;
      if (!terminal.usage) usage.incompleteUsage!++;
      usage.input += terminal.usage?.input_tokens ?? 0;
      usage.cached += terminal.usage?.input_tokens_details?.cached_tokens ?? 0;
      usage.cacheWrite! += terminal.usage?.input_tokens_details?.cache_write_tokens ?? 0;
      usage.output += terminal.usage?.output_tokens ?? 0;
      usage.reasoning += terminal.usage?.output_tokens_details?.reasoning_tokens ?? 0;
      usage.total += terminal.usage?.total_tokens ?? 0;
      if (terminal.status !== 'completed') throw new Error(`Model reply ${terminal.status}: ${terminal.incomplete_details?.reason ?? terminal.error?.code ?? 'unknown reason'}.`);
      const content = terminal.output.flatMap(item => item.type === 'message' ? item.content : []);
      if (content.some(part => part.type === 'refusal')) throw new Error('Model refused.');
      const text = content.flatMap(part => part.type === 'output_text' ? [part.text] : []).join('');
      if (text) {
        if (!streamed) emit((answer ? '\n\n' : '') + text);
        answer += (answer ? '\n\n' : '') + text;
      }
      if (answer.length > MAX_REPLY) throw new Error('Model reply is too long.');
      const calls = terminal.output.filter(item => item.type === 'function_call');
      if (!calls.length) {
        if (!text.trim()) throw new Error('Model reply is missing a final answer.');
        return parseModelReply(terminal.id, answer, usage);
      }
      if (!paperSite || round >= 2) throw new Error('Model exceeded the paper lookup limit.');
      // Preserve every output item, including encrypted reasoning, when store is false.
      for (const item of terminal.output) {
        if (item.type !== 'message' && item.type !== 'function_call' && item.type !== 'reasoning') throw new Error(`Unsupported continuation item: ${item.type}`);
        input.push(item);
      }
      for (const call of calls) input.push({ type: 'function_call_output', call_id: call.call_id,
        output: executePaperTool(paperSite, call.name, call.arguments) });
      if (round === 1) input.push({ role: 'developer', content: 'Paper lookup is now finished. Answer from the supplied evidence; state any missing information briefly. Do not request more tools.' });
    }
    throw new Error('Model did not finish an answer.');
  } catch (error) {
    if (awaitingUsage) usage.incompleteUsage!++;
    throw new ModelReplyError(error instanceof Error ? error.message : String(error), usage);
  } finally {
    console.info('chat: model usage', { model, responseId, contextMode: paperSite ? 'selective' : 'full',
      ...usage, firstTextMs, durationMs: Date.now() - started });
  }
}
