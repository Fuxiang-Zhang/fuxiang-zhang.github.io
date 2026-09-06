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
  name: string; position: string; email: string;
  links: Link[];
}

/*
 * One heading or list item in data/site.md, with its fields, prose and children.
 * The shape is the
 * document's own: the parser does not know what a section is called or what it
 * holds, and the page decides how to draw a node from the fields it carries.
 */
export interface Node {
  title: string;
  /** Written as `- **Title**`; omitted for headings. Syntax alone selects the wrapper. */
  kind?: 'heading' | 'item';
  /** Field keys are lowercased, so `Venue short:` reads as `fields['venue short']`. */
  fields: Readonly<Record<string, string>>;
  prose: string[];
  children: Node[];
}

/** A record in a Cards source is a publication; the page renders it as a card. */
export interface Publication {
  id: string; title: string; authors: string; venue: string; venueShort: string;
  year: number; topic: string;
  links: { paper: string; code?: string };
  /** The paper's own abstract, so the page and the assistant can discuss its content. */
  abstract?: string;
}

export interface SiteData {
  /** The Markdown source the data was parsed from; the chat backend sends it to the model as-is. */
  source: string;
  profile: Profile;
  /** The `##` sections, in file order: the page's presets and routes. */
  sections: Node[];
  /** Every node that reads as a publication, in file order, so papers stay addressable. */
  publications: Publication[];
}
export const emptySite = (): SiteData => ({
  source: '',
  profile: { name: '', position: '', email: '', links: [] },
  sections: [], publications: [],
});

/**
 * The slash command a `##` section is printed by. A section without one is data
 * the file keeps but does not show on its own — the publications, for instance,
 * which the `/papers` section renders by naming them in its `Cards` field.
 */
export const commandOf = (section: Node): string | undefined => section.fields.command;
/** The id of the section whose records this one prints as publication cards. */
export const cardsOf = (section: Node): string | undefined => section.fields.cards;
/** The slug a node is addressed by, where it declares one. */
export const idOf = (node: Node): string | undefined => node.fields.id;
/** A standalone paragraph embeds a publication card in authored site content. */
export const paperCardId = (paragraph: string): string | undefined =>
  /^\[\[paper:([a-z0-9][a-z0-9-]*)\]\]$/.exec(paragraph)?.[1];
/** The section id and route hash: the section's own `Id` when it has one, else its command. */
export const sectionId = (section: Node): string =>
  idOf(section) ?? (commandOf(section) ?? section.title).replace(/^\//, '');

/** Shared bounds, measured in UTF-16 characters except MAX_BODY (UTF-8 bytes). */
export const MAX_MESSAGE = 2000;
export const MAX_REPLY = 20_000;
export const MAX_HISTORY = 8;
export const MAX_HISTORY_CHARS = 24_000;
// Allow JSON escaping of the bounded text, plus metadata.
export const MAX_BODY = 160_000;

/* Chat API contract, shared by the browser client (src/chat.ts) and the backend (chat/handler.ts). */
export interface ChatTurn { role: 'user' | 'assistant'; text: string }
export interface ChatRequest { message: string; topic?: SectionId; paperId?: string | null; history?: ChatTurn[] }
/** `mock` replies are canned placeholders; `live` replies come from the model. */
export type ChatMode = 'mock' | 'live';
/** Today's token budget as reported by the backend; `resetsAt` is the next UTC midnight. */
export interface BudgetStatus { used: number; limit: number; exhausted: boolean; resetsAt: string }
export interface ChatReply { id: string; text: string; mode: ChatMode; budget?: BudgetStatus }
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
  && isString(n.title)
  && (n.kind === undefined || n.kind === 'heading' || n.kind === 'item')
  && isRecord(n.fields) && Object.values(n.fields).every(isString)
  && Array.isArray(n.prose) && n.prose.every(isString)
  && Array.isArray(n.children) && n.children.every(isNode);
const isProfile = (p: unknown): p is Profile => isRecord(p) && strings(p, ['name', 'position', 'email'])
  && Array.isArray(p.links) && p.links.every(isLink);

/** Walks a node and everything nested inside it, in document order. */
export function* walk(nodes: readonly Node[]): Generator<Node> {
  for (const node of nodes) { yield node; yield* walk(node.children); }
}

export function parseSiteData(value: unknown): SiteData {
  if (!isRecord(value)) throw new Error('Invalid site data.');
  if (!isProfile(value.profile)) throw new Error('Invalid profile data.');
  const publications = parsePublications(value.publications);
  const ids = new Set(publications.map(paper => paper.id));
  if (ids.size !== publications.length) throw new Error('Duplicate publication ids.');
  const site: SiteData = {
    source: typeof value.source === 'string' ? value.source : '',
    profile: value.profile,
    sections: list(value.sections, isNode, 'section'),
    publications,
  };
  // URL fields and authored references are validated before rendering.
  const used = new Set(publications.map(paper => paper.topic));
  for (const node of walk(site.sections)) {
    parseLinks(node.fields.links);
    const { topic, paper } = node.fields;
    if (node.fields.code !== undefined && !httpUrl(node.fields.code)) throw new Error(`Invalid Code URL under "${node.title}".`);
    if (topic && !used.has(topic)) throw new Error(`No publication has the topic: ${topic}.`);
    if (paper !== undefined && !httpUrl(paper)) {
      throw new Error(`Paper under "${node.title}" must be an HTTP(S) URL; use a standalone [[paper:id]] paragraph to embed a card.`);
    }
    for (const paragraph of node.prose) {
      const id = paperCardId(paragraph);
      if (id && !ids.has(id)) throw new Error(`Unknown publication: ${id} under "${node.title}".`);
      if (!id && /\[\[\s*paper\s*:/i.test(paragraph)) {
        throw new Error(`Write [[paper:id]] as a separate paragraph under "${node.title}".`);
      }
    }
  }
  return site;
}
