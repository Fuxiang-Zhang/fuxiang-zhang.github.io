/*
 * Model access through the OpenAI Responses API. The reply is the model's plain
 * text: the homepage shows prose, so there is nothing to enforce a schema over.
 */
import OpenAI from 'openai';
import { CHAT_TIMEOUT_MS, MAX_REPLY, type ChatTurn } from '../src/types.js';

export const DEFAULT_MODEL = 'gpt-5.6-terra';

/** `reasoning` tokens are part of `output`; they are billed but never shown. */
export interface ModelUsage { input: number; cached: number; output: number; reasoning: number; total: number }
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
  /** Routes every request with the same stable instructions to the same provider cache. */
  cacheKey?: string;
  turns: ChatTurn[];
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

export async function askModel({ apiKey, model = DEFAULT_MODEL, instructions, cacheKey, turns, signal, onDelta }: ModelOptions): Promise<ModelReply> {
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: CHAT_TIMEOUT_MS });
  const stream = await client.responses.create({
    model,
    instructions,
    ...(cacheKey ? { prompt_cache_key: cacheKey, prompt_cache_retention: '24h' as const } : {}),
    input: turns.map(turn => ({ role: turn.role, content: turn.text })),
    text: { verbosity: 'low' },
    reasoning: { effort: 'low' },
    max_output_tokens: 4096,
    stream: true,
    store: false,
  }, { signal });
  try {
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') onDelta(event.delta);
      if (event.type === 'response.completed' || event.type === 'response.incomplete' || event.type === 'response.failed') {
        const response = event.response;
        const usage: ModelUsage = {
          input: response.usage?.input_tokens ?? 0,
          cached: response.usage?.input_tokens_details?.cached_tokens ?? 0,
          output: response.usage?.output_tokens ?? 0,
          reasoning: response.usage?.output_tokens_details?.reasoning_tokens ?? 0,
          total: response.usage?.total_tokens ?? 0,
        };
        if (response.status !== 'completed') {
          throw new ModelReplyError(`Model reply ${response.status}: ${response.incomplete_details?.reason ?? response.error?.code ?? 'unknown reason'}.`, usage);
        }
        const content = response.output.flatMap(item => item.type === 'message' ? item.content : []);
        if (content.some(part => part.type === 'refusal')) throw new ModelReplyError('Model refused.', usage);
        return parseModelReply(response.id, content.flatMap(part => part.type === 'output_text' ? [part.text] : []).join(''), usage);
      }
      if (event.type === 'error') throw new Error(`Model stream error: ${event.code ?? 'unknown'}`);
    }
    signal?.throwIfAborted();
    throw new Error('Model stream ended without a final response.');
  } finally {
    stream.controller.abort();
  }
}
