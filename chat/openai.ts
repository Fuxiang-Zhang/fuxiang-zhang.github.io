/*
 * Model access through the OpenAI Responses API. The reply is the model's plain
 * text: the homepage shows prose, so there is nothing to enforce a schema over.
 */
import OpenAI from 'openai';
import type { ChatTurn } from '../src/types.js';

export const DEFAULT_MODEL = 'gpt-5.4-mini';

export interface ModelUsage { input: number; cached: number; output: number; total: number }
export interface ModelReply { id: string; answer: string; usage: ModelUsage }

/** An empty reply is a server error, never shown to a visitor as an answer. */
export function parseModelReply(id: string, output: string, usage: ModelUsage = { input: 0, cached: 0, output: 0, total: 0 }): ModelReply {
  const answer = output.trim();
  if (!answer) throw new Error('Model reply is missing an answer.');
  return { id, answer, usage };
}

export interface ModelOptions {
  apiKey: string;
  model?: string;
  instructions: string;
  turns: ChatTurn[];
  signal?: AbortSignal;
}

export async function askModel({ apiKey, model = DEFAULT_MODEL, instructions, turns, signal }: ModelOptions): Promise<ModelReply> {
  const client = new OpenAI({ apiKey, maxRetries: 1, timeout: 45_000 });
  const response = await client.responses.create({
    model,
    instructions,
    input: turns.map(turn => ({ role: turn.role, content: turn.text })),
    text: { verbosity: 'low' },
    reasoning: { effort: 'low' },
    max_output_tokens: 1200,
    store: false,
  }, { signal });
  if (response.status === 'incomplete') {
    throw new Error(`Model reply incomplete: ${response.incomplete_details?.reason ?? 'unknown reason'}.`);
  }
  const refusal = response.output.flatMap(item => item.type === 'message' ? item.content : []).find(part => part.type === 'refusal');
  if (refusal) throw new Error(`Model refused: ${refusal.refusal}`);
  const usage = response.usage;
  return parseModelReply(response.id, response.output_text, {
    input: usage?.input_tokens ?? 0, cached: usage?.input_tokens_details?.cached_tokens ?? 0,
    output: usage?.output_tokens ?? 0, total: usage?.total_tokens ?? 0,
  });
}
