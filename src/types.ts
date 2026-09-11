/** A section is addressed by its Id field, or its slash command without the slash. */
export type SectionId = string;

/*
 * Site data: the single source of truth for everything shown on the homepage,
 * rendered by the chat homepage. It is written
 * as one Markdown file, `data/site.md`, which `parseSiteMarkdown` (src/markdown.ts)
 * turns into a `SiteData` object and `parseSiteData` below validates.
 * Text fields may contain inline links written as [label](https://…);
 * everything else is treated as plain text.
 */
export interface Link { label: string; url: string }
/** The supported Links field grammar, shared by validation and rendering. */
export function parseLinks(value: string | undefined): Link[] {
  if (value === undefined) return [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const found = [...value.matchAll(pattern)].map(match => ({ label: match[1], url: match[2] }));
  if (!found.length || value.replace(pattern, '').replace(/[,\s]+/g, '')) {
    throw new Error('The Links field must contain only [label](url) links separated by commas or spaces.');
  }
  for (const link of found) if (!httpUrl(link.url)) throw new Error('Invalid Links URL.');
  return found;
}
const httpUrl = (value: string): boolean => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

export interface Profile {
  name: string; position: string; email: string; links: Link[];
  home: string; title: string; description: string;
}

/** Ordered authored blocks. Components are explicit; headings retain their depth. */
export interface Node {
  kind: 'heading' | 'item' | 'list' | 'collapse' | 'paper' | 'publication' | 'profile' | 'markdown';
  title: string;
  fields: Record<string, string>;
  body: Node[];
  line: number;
  level?: number;
  text?: string;
  blockType?: string;
  references?: Record<string, { href: string; title: string }>;
  open?: boolean;
  ordered?: boolean;
  start?: number;
}
export interface Publication {
  id: string; title: string; authors: string; venue: string; venueShort: string;
  year: number; topic: string;
  links: { paper: string; code?: string };
  abstract?: string;
}
export interface SiteData {
  source: string;
  profile: Profile;
  sections: Node[];
  publications: Publication[];
}
export const emptySite = (): SiteData => ({
  source: '', profile: { name: '', position: '', email: '', links: [], home: '', title: '', description: '' },
  sections: [], publications: [],
});
export const commandOf = (section: Node): string | undefined => section.fields.command;
export const cardsOf = (section: Node): string | undefined => section.fields.cards;
export const idOf = (node: Node): string | undefined => node.fields.id;
export const paperCardId = (paragraph: string): string | undefined =>
  /^\[\[paper:([a-z0-9][a-z0-9-]*)\]\]$/.exec(paragraph)?.[1];
export const sectionId = (section: Node): string =>
  idOf(section) ?? (commandOf(section) ?? section.title).replace(/^\//, '');
export function* walk(nodes: readonly Node[]): Generator<Node> {
  for (const node of nodes) { yield node; yield* walk(node.body); }
}

/** Shared bounds, measured in UTF-16 characters except MAX_BODY (UTF-8 bytes). */
export const CHAT_TIMEOUT_MS = 60_000;
export const MAX_MESSAGE = 2000;
export const MAX_REPLY = 20_000;
export const MAX_HISTORY = 8;
export const MAX_HISTORY_CHARS = 24_000;
// Allow JSON escaping of the bounded text, plus metadata.
export const MAX_BODY = 160_000;

/* Chat API contract, shared by the browser client (src/chat.ts) and the backend (chat/handler.ts). */
export interface ChatTurn { role: 'user' | 'assistant'; text: string }
export interface ChatRequest { message: string; paperId?: string | null; history?: ChatTurn[] }
/** `mock` replies are canned placeholders; `live` replies come from the model. */
export type ChatMode = 'mock' | 'live';
/** Today's token budget as reported by the backend; `resetsAt` is the next UTC midnight. */
export interface BudgetStatus { used: number; limit: number; exhausted: boolean; resetsAt: string }
export interface ChatReply { id: string; text: string; mode: ChatMode; budget?: BudgetStatus }
/** Live responses use newline-delimited JSON; only done marks a complete answer. */
export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; reply: ChatReply }
  | { type: 'error'; error: string; status: number };
/** Answer to GET /api/chat: what kind of replies to expect and whether the budget allows questions right now. */
export interface ChatStatus { mode: ChatMode; budget: BudgetStatus | null }
export interface AssistantMessage {
  id: string; role: 'assistant'; text: string; prompt: string; paperId: string | null;
  state: 'pending' | 'done' | 'error' | 'stopped';
  mode?: ChatMode;
  /** Server-provided explanation shown instead of the generic failure text. */
  error?: string;
}
export type Content =
  | { kind: 'preset'; topic: SectionId }
  | { kind: 'help' }
  | { kind: 'paper'; paperId: string };
export interface ContentMessage { id: string; role: 'content'; content: Content }
export type Message = { id: string; role: 'user'; text: string } | AssistantMessage | ContentMessage;
/** One transcript with an optional paper context for the next question. */
export interface Thread { messages: Message[]; draft: string; paperId: string | null }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const isString = (value: unknown): value is string => typeof value === 'string';
const strings = (record: Record<string, unknown>, keys: string[]) => keys.every(key => isString(record[key]));
const optionalStrings = (record: Record<string, unknown>, keys: string[]) => keys.every(key => record[key] === undefined || isString(record[key]));
const isLink = (value: unknown): value is Link => isRecord(value) && strings(value, ['label', 'url']);
const list = <T>(value: unknown, check: (item: unknown) => item is T, name: string): T[] => {
  if (!Array.isArray(value) || !value.every(check)) throw new Error(`Invalid ${name} data.`);
  return value;
};

export function parsePublications(value: unknown): Publication[] {
  return list(value, (p: unknown): p is Publication => isRecord(p)
    && strings(p, ['id', 'title', 'authors', 'venue', 'venueShort'])
    && typeof p.year === 'number' && Number.isInteger(p.year)
    && isString(p.topic) && !!p.topic.trim()
    && optionalStrings(p, ['abstract'])
    && isRecord(p.links) && isString(p.links.paper) && optionalStrings(p.links, ['code']), 'publication');
}
const isNode = (n: unknown): n is Node => isRecord(n)
  && isString(n.title) && typeof n.line === 'number'
  && ['heading', 'item', 'list', 'collapse', 'paper', 'publication', 'profile', 'markdown'].includes(String(n.kind))
  && isRecord(n.fields) && Object.values(n.fields).every(isString)
  && Array.isArray(n.body) && n.body.every(isNode);
const isProfile = (p: unknown): p is Profile => isRecord(p)
  && strings(p, ['name', 'position', 'email', 'home', 'title', 'description'])
  && Array.isArray(p.links) && p.links.every(isLink);

export function parseSiteData(value: unknown): SiteData {
  if (!isRecord(value) || !isProfile(value.profile)) throw new Error('Invalid site data.');
  const publications = parsePublications(value.publications);
  const ids = new Set(publications.map(p => p.id));
  if (ids.size !== publications.length) throw new Error('Duplicate publication ids.');
  for (const p of publications) {
    if (!httpUrl(p.links.paper) || (p.links.code && !httpUrl(p.links.code))) throw new Error('Paper and Code must be HTTP(S) URLs.');
  }
  const site: SiteData = {
    source: typeof value.source === 'string' ? value.source : '', profile: value.profile,
    sections: list(value.sections, isNode, 'section'), publications,
  };
  for (const node of walk(site.sections)) {
    parseLinks(node.fields.links);
    if (node.kind === 'paper' && !ids.has(node.fields.ref)) {
      throw new Error(`Line ${node.line}: Unknown publication: ${node.fields.ref}.`);
    }
  }
  return site;
}
