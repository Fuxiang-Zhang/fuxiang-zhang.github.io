export type Language = 'en' | 'zh';
export const topics = ['overview', 'research', 'work', 'publications', 'miscellaneous'] as const;
export type Topic = typeof topics[number];
export type Page = Topic | 'chat';
export type ResearchTopic = 'llm' | 'rl' | 'marl';
export type Category = 'reports' | 'conference' | 'journal';
export interface Publication {
  id: string; title: string; authors: string; venue: string; venueShort: string;
  year: number; category: Category; topic: ResearchTopic;
  links: { paper: string; code?: string };
}
export type Localized = Record<Language, string>;
export type SectionId = 'education' | 'experience' | 'service' | 'awards';
export interface Contribution { title: string | Localized; description: Localized; paperId?: string }
export interface Experience {
  title: Localized; description: Localized; date?: Localized; role?: Localized;
  bullets?: Contribution[]; links?: {url: string; label: string}[];
}
export interface Section { id: SectionId; title: Localized; type: 'timeline' | 'list'; entries: Experience[] }
export interface ChatRequest { message: string; language?: Language; topic?: Page; paperId?: string | null }
export interface ChatReply { id: string; text: string; mode: 'mock' }
export interface AssistantMessage {
  id: string; role: 'assistant'; text: string; prompt: string; paperId: string | null;
  state: 'pending' | 'done' | 'error' | 'stopped';
}
export type Message = { id: string; role: 'user'; text: string } | AssistantMessage;
export interface Thread { id: string; topic: Page; messages: Message[]; draft: string; scroll: number; paperId: string | null; title?: string }
export interface Filters { query: string; year: string; topic: string; category: string }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function parsePublications(value: unknown): Publication[] {
  if (!Array.isArray(value) || !value.every((p: unknown) => isRecord(p)
    && ['id', 'title', 'authors', 'venue', 'venueShort'].every(key => typeof p[key] === 'string')
    && typeof p.year === 'number' && Number.isInteger(p.year)
    && ['reports', 'conference', 'journal'].includes(String(p.category))
    && ['llm', 'rl', 'marl'].includes(String(p.topic))
    && isRecord(p.links) && typeof p.links.paper === 'string'
    && (p.links.code === undefined || typeof p.links.code === 'string'))) throw new Error('Invalid publication data.');
  return value as Publication[];
}
