import { isRecord, type BudgetStatus, type ChatRequest, type ChatReply, type ChatStatus } from './types.js';

/*
 * Publications the assistant names in a reply. The model writes the marker
 * [[paper:<id>]] using a publication's {#id} from data/site.md, and the
 * homepage replaces it with that paper's card, rendered from site data. The
 * title, venue, authors and links therefore always come from the file rather
 * than from the model. The prefix keeps the marker from colliding with
 * ordinary text and leaves room for other kinds later.
 */
export const PAPER_MARKER = /\[\[\s*paper\s*:\s*([A-Za-z0-9][A-Za-z0-9-]*)\s*\]\]/g;
/*
 * The model's refusal for a question this homepage has no bearing on. It replies
 * with this marker alone; the page shows its own notice in place of the reply,
 * so the wording is the site's and not the model's. A marker written alongside
 * prose is not a refusal — it falls through to BROKEN_MARKER and is removed,
 * leaving the prose as the reply.
 */
export const OFFTOPIC_MARKER = '[[offtopic]]';
const OFFTOPIC_ONLY = /^\s*\[\[\s*offtopic\s*\]\]\s*$/i;
export const isOfftopicReply = (text: string): boolean => OFFTOPIC_ONLY.test(text);
/** Anything else in double brackets is a marker the model got wrong; it is removed, never shown. */
const BROKEN_MARKER = /\[\[[^\][\n]{0,64}\]\]/g;
/** Sentence and closing punctuation a marker may have been written in front of. */
const ORPHAN_PUNCTUATION = /^\s*[.,;:!?…)\]}"'’”」』》〉。，、；：！？）】]+/;
/** Text that closes a sentence, so a card may follow it without cutting one in half. */
const SENTENCE_END = /[.!?…。！？][)\]}"'’”」』》〉]*\s*$/;
/** At most this many cards per reply, so a list of papers cannot fill the screen. */
export const MAX_PAPER_CARDS = 3;
export type ReplyPart = { text: string } | { paperId: string };
const clean = (text: string) => text.replace(BROKEN_MARKER, '').replace(/[^\S\n]{2,}/g, ' ');

/*
 * Splits a reply into its text runs and the papers it names, in order.
 *
 * A line is the smallest unit: the rules ask for the marker on its own line, but
 * a model that writes one mid-sentence must not have its sentence cut in half by
 * a card. So a card is placed at the marker only when the text before it closes a
 * sentence; otherwise it waits for the end of the line. Punctuation written after
 * a marker is pulled back in front of it, so a full stop is never stranded below
 * the card, and consecutive text runs are rejoined so paragraph breaks survive.
 */
export function splitPaperMarkers(text: string): ReplyPart[] {
  const found: ReplyPart[] = [];
  for (const line of text.split('\n')) {
    const held: string[] = [];
    let buffer = '';
    let index = 0;
    for (const match of line.matchAll(PAPER_MARKER)) {
      buffer += line.slice(index, match.index);
      index = match.index + match[0].length;
      const orphan = ORPHAN_PUNCTUATION.exec(line.slice(index));
      if (orphan) {
        buffer = buffer.replace(/[^\S\n]+$/, '') + orphan[0].trimStart();
        index += orphan[0].length;
      }
      const id = match[1].toLowerCase();
      // Once one card is held back the rest follow it, so the cards keep their order.
      if (!held.length && (!buffer.trim() || SENTENCE_END.test(buffer))) {
        found.push({ text: buffer }, { paperId: id });
        buffer = '';
      } else held.push(id);
    }
    found.push({ text: buffer + line.slice(index) });
    for (const id of held) found.push({ paperId: id });
  }
  const parts: ReplyPart[] = [];
  for (const part of found) {
    const last = parts.at(-1);
    if ('text' in part && last && 'text' in last) last.text += `\n${part.text}`;
    else parts.push('text' in part ? { ...part } : part);
  }
  return parts.flatMap((part): ReplyPart[] => {
    if (!('text' in part)) return [part];
    const body = clean(part.text).trim();
    return body ? [{ text: body }] : [];
  });
}

/** The reply as plain prose, for copying and for anything that cannot show cards. */
export const stripPaperMarkers = (text: string): string =>
  clean(text.replace(PAPER_MARKER, ''))
    .replace(/[^\S\n]+([.,;:!?…)\]}。，、；：！？）】])/g, '$1')
    .replace(/[^\S\n]+$/gm, '').trim();

/** Shared by the local server, the worker without a key, and the static GitHub Pages demo. */
export function mockReply(): ChatReply {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const id = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  const text = `Your message came through.\n\nThis is a simulated reply. An AI model is not connected yet.\n\nRandom response: ${id}`;
  return { id, text, mode: 'mock' };
}

/** A failed request whose message is safe to show, e.g. a rate limit explanation from the server. */
export class ChatError extends Error {
  constructor(message: string, readonly status: number, readonly budget: BudgetStatus | null = null) {
    super(message);
    this.name = 'ChatError';
  }
}

export function parseBudget(value: unknown): BudgetStatus | null {
  if (!isRecord(value) || typeof value.used !== 'number' || typeof value.limit !== 'number'
    || typeof value.exhausted !== 'boolean' || typeof value.resetsAt !== 'string' || Number.isNaN(Date.parse(value.resetsAt))) return null;
  return { used: value.used, limit: value.limit, exhausted: value.exhausted, resetsAt: value.resetsAt };
}

export function parseChatReply(data: unknown): ChatReply {
  if (!isRecord(data) || typeof data.text !== 'string' || !data.text.trim() || data.text.length > 20000
    || typeof data.id !== 'string' || (data.mode !== 'mock' && data.mode !== 'live')) {
    throw new Error('Invalid chat response.');
  }
  const budget = parseBudget(data.budget);
  return { id: data.id, text: data.text, mode: data.mode, ...(budget ? { budget } : {}) };
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
  if (!response.ok) {
    let detail = '';
    let budget: BudgetStatus | null = null;
    try {
      const data: unknown = await response.json();
      if (isRecord(data) && typeof data.error === 'string') detail = data.error.slice(0, 300);
      if (isRecord(data)) budget = parseBudget(data.budget);
    } catch { /* Non-JSON error bodies fall back to the status text. */ }
    throw new ChatError(detail || `Chat request failed (${response.status}).`, response.status, budget);
  }
  return parseChatReply(await response.json());
}

/** Asks the backend what to expect before the first question: reply mode and today's budget. */
export async function requestStatus(endpoint: string | null, signal?: AbortSignal): Promise<ChatStatus> {
  if (!endpoint) return { mode: 'mock', budget: null };
  const response = await fetch(endpoint, { signal });
  if (!response.ok) throw new Error(`Chat status failed (${response.status}).`);
  const data: unknown = await response.json();
  if (!isRecord(data) || (data.mode !== 'mock' && data.mode !== 'live')) throw new Error('Invalid chat status.');
  return { mode: data.mode, budget: parseBudget(data.budget) };
}
