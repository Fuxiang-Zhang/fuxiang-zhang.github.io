export const topics = ['bio', 'research', 'publications', 'experiences', 'miscellaneous'] as const;
export type Topic = typeof topics[number];
export type Page = Topic | 'chat';
export const researchTopics = ['llm', 'rl', 'marl'] as const;
export const categories = ['reports', 'conference', 'journal'] as const;
export type ResearchTopic = typeof researchTopics[number];
export type Category = typeof categories[number];
export const isTopic = (value: unknown): value is Topic => topics.some(topic => topic === value);
export const isResearchTopic = (value: unknown): value is ResearchTopic => researchTopics.some(topic => topic === value);
export const isCategory = (value: unknown): value is Category => categories.some(category => category === value);
/** Site content that can be appended to a conversation as a reply: research interests, a publication list, or one paper. */
export const contentKinds = ['research', 'publications', 'paper'] as const;
export type ContentKind = typeof contentKinds[number];
export const isContentKind = (value: unknown): value is ContentKind => contentKinds.some(kind => kind === value);

/*
 * Site data: the single source of truth for everything shown on the homepage,
 * rendered by both the chat homepage and the static reading view. It is written
 * as one Markdown file, `data/site.md`, which `parseSiteMarkdown` (src/markdown.ts)
 * turns into a `SiteData` object and `parseSiteData` below validates.
 * Text fields may contain inline links written as [label](https://…);
 * everything else is treated as plain text.
 */
export interface Link { label: string; url: string }
export interface Profile {
  name: string; position: string; photo: string; email: string;
  links: Link[];
  /** Biography paragraphs. */
  bio: string[];
}
/** Publication topics: used for filtering and for naming a paper's topic. */
export interface ResearchInterest { id: ResearchTopic; name: string; shortName: string; description: string }
/** Research-interest sections shown on the Bio page; `topic` links a section or point to the matching publication filter. */
export interface InterestPoint { title: string; description: string; topic?: ResearchTopic }
export interface Interest { title: string; description: string; topic?: ResearchTopic; points?: InterestPoint[] }
export interface Publication {
  id: string; title: string; authors: string; venue: string; venueShort: string;
  year: number; category: Category; topic: ResearchTopic;
  links: { paper: string; code?: string };
  /** The paper's own abstract, so the page and the assistant can discuss its content. */
  abstract?: string;
}
export interface Contribution { title: string; description: string; paperId?: string }
export interface Experience {
  organization: string; role: string; location?: string; period: string; description: string;
  links?: Link[]; contributions?: Contribution[];
}
export interface Education {
  institution: string; degree: string; location?: string; period: string; description: string; links?: Link[];
}
export interface ServiceEntry { venue: string; role: string; period?: string }
export interface Award { title: string; issuer: string; period: string }
export interface SiteData {
  /** The Markdown source the data was parsed from; the chat backend sends it to the model as-is. */
  source: string;
  profile: Profile;
  research: ResearchInterest[];
  interests: Interest[];
  publications: Publication[];
  experience: Experience[];
  education: Education[];
  service: ServiceEntry[];
  awards: Award[];
}
export const emptySite = (): SiteData => ({
  source: '',
  profile: { name: '', position: '', photo: '', email: '', links: [], bio: [] },
  research: [], interests: [], publications: [], experience: [], education: [], service: [], awards: [],
});

/* Chat API contract, shared by the browser client (src/chat.ts) and the backend (chat/handler.ts). */
export interface ChatTurn { role: 'user' | 'assistant'; text: string }
export interface ChatRequest { message: string; topic?: Page; paperId?: string | null; history?: ChatTurn[] }
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
  | { kind: 'preset'; topic: Topic }
  | { kind: 'help' }
  | { kind: 'research' }
  | { kind: 'publications'; category?: Category; topic?: ResearchTopic }
  | { kind: 'paper'; paperId: string };
export interface ContentMessage { id: string; role: 'content'; content: Content }
export type Message = { id: string; role: 'user'; text: string } | AssistantMessage | ContentMessage;
/** `intro` marks a conversation opened from the New chat button; it shows the greeting and suggested questions. */
export interface Thread { id: string; topic: Page; messages: Message[]; draft: string; scroll: number; paperId: string | null; title?: string; intro?: boolean }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const isString = (value: unknown): value is string => typeof value === 'string';
const strings = (record: Record<string, unknown>, keys: string[]) => keys.every(key => isString(record[key]));
const optionalStrings = (record: Record<string, unknown>, keys: string[]) => keys.every(key => record[key] === undefined || isString(record[key]));
const isLink = (value: unknown): value is Link => isRecord(value) && strings(value, ['label', 'url']);
const optionalLinks = (value: unknown) => value === undefined || (Array.isArray(value) && value.every(isLink));
const list = <T>(value: unknown, check: (item: unknown) => item is T, name: string): T[] => {
  if (!Array.isArray(value) || !value.every(check)) throw new Error(`Invalid ${name} data.`);
  return value;
};

export function parsePublications(value: unknown): Publication[] {
  return list(value, (p: unknown): p is Publication => isRecord(p)
    && strings(p, ['id', 'title', 'authors', 'venue', 'venueShort'])
    && typeof p.year === 'number' && Number.isInteger(p.year)
    && isCategory(p.category)
    && isResearchTopic(p.topic)
    && optionalStrings(p, ['abstract'])
    && isRecord(p.links) && isString(p.links.paper) && optionalStrings(p.links, ['code']), 'publication');
}
const isContribution = (c: unknown): c is Contribution => isRecord(c) && strings(c, ['title', 'description']) && optionalStrings(c, ['paperId']);
const optionalTopic = (value: unknown) => value === undefined || isResearchTopic(value);
const isInterestPoint = (p: unknown): p is InterestPoint => isRecord(p) && strings(p, ['title', 'description']) && optionalTopic(p.topic);
const isInterest = (i: unknown): i is Interest => isRecord(i) && strings(i, ['title', 'description']) && optionalTopic(i.topic)
  && (i.points === undefined || (Array.isArray(i.points) && i.points.every(isInterestPoint)));
const isProfile = (p: unknown): p is Profile => isRecord(p) && strings(p, ['name', 'position', 'photo', 'email'])
  && Array.isArray(p.links) && p.links.every(isLink) && Array.isArray(p.bio) && p.bio.every(isString);

export function parseSiteData(value: unknown): SiteData {
  if (!isRecord(value)) throw new Error('Invalid site data.');
  if (!isProfile(value.profile)) throw new Error('Invalid profile data.');
  const publications = parsePublications(value.publications);
  const ids = new Set(publications.map(paper => paper.id));
  if (ids.size !== publications.length) throw new Error('Duplicate publication ids.');
  const site: SiteData = {
    source: typeof value.source === 'string' ? value.source : '',
    profile: value.profile,
    research: list(value.research, (r: unknown): r is ResearchInterest => isRecord(r) && isResearchTopic(r.id) && strings(r, ['name', 'shortName', 'description']), 'research'),
    interests: list(value.interests, isInterest, 'interests'),
    publications,
    experience: list(value.experience, (e: unknown): e is Experience => isRecord(e)
      && strings(e, ['organization', 'role', 'period', 'description']) && optionalStrings(e, ['location']) && optionalLinks(e.links)
      && (e.contributions === undefined || (Array.isArray(e.contributions) && e.contributions.every(isContribution))), 'experience'),
    education: list(value.education, (e: unknown): e is Education => isRecord(e)
      && strings(e, ['institution', 'degree', 'period', 'description']) && optionalStrings(e, ['location']) && optionalLinks(e.links), 'education'),
    service: list(value.service, (s: unknown): s is ServiceEntry => isRecord(s) && strings(s, ['venue', 'role']) && optionalStrings(s, ['period']), 'service'),
    awards: list(value.awards, (a: unknown): a is Award => isRecord(a) && strings(a, ['title', 'issuer', 'period']), 'award'),
  };
  for (const topic of researchTopics) {
    if (!site.research.some(interest => interest.id === topic)) throw new Error(`Missing research interest: ${topic}.`);
  }
  for (const contribution of site.experience.flatMap(entry => entry.contributions ?? [])) {
    if (contribution.paperId && !ids.has(contribution.paperId)) throw new Error(`Unknown publication: ${contribution.paperId}.`);
  }
  return site;
}
