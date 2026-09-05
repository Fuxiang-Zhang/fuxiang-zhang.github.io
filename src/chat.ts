import { isRecord, type ChatRequest, type ChatReply } from './types.js';

/** Shared by the local server and the static GitHub Pages demo. */
export function mockReply(): ChatReply {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const id = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  const text = `Your message came through.\n\nThis is a simulated reply. An AI model and web search are not connected yet.\n\nRandom response: ${id}`;
  return { id, text, mode: 'mock' };
}

export async function requestReply(
  { signal, ...request }: ChatRequest & { signal?: AbortSignal },
  endpoint: string | null = null,
): Promise<ChatReply> {
  signal?.throwIfAborted();
  if (!endpoint) return mockReply();
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request), signal,
  });
  if (!response.ok) throw new Error(`Chat request failed (${response.status}).`);
  const data: unknown = await response.json();
  if (!isRecord(data) || typeof data.text !== 'string' || !data.text.trim()
    || data.text.length > 20000 || typeof data.id !== 'string' || data.mode !== 'mock') {
    throw new Error('Invalid chat response.');
  }
  return { id: data.id, text: data.text, mode: data.mode };
}
