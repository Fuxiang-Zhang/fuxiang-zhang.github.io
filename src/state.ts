import {
  emptySite, isTopic, topics,
  type AssistantMessage, type Content, type ContentMessage, type Filters, type Page, type Publication, type Thread,
} from './types.js';

export const emptyFilters = (): Filters => ({ query: '', year: '', topic: '', category: '' });
export const makeThread = (id: string, topic: Page): Thread => ({
  id, topic, messages: [], draft: '', scroll: 0, paperId: null,
});

export function createState() {
  const threads = new Map<string, Thread>(topics.map(topic => [topic, makeThread(topic, topic)]));
  return {
    threads,
    chatOrder: [] as string[],
    current: threads.get('bio')!,
    site: emptySite(),
    loadFailed: false,
    filters: emptyFilters(),
    paper: null as { id: string; returnHash: string } | null,
  };
}
export type AppState = ReturnType<typeof createState>;

function pageThread(state: AppState, hash: string): Thread | undefined {
  const [section, id] = hash.replace(/^#/, '').split('/');
  if (section === 'chat') {
    const thread = state.threads.get(id);
    return thread?.topic === 'chat' ? thread : undefined;
  }
  return isTopic(section) ? state.threads.get(section) : undefined;
}

/** Paper URLs retain their background route in browser history, including Back/Forward. */
export function navigate(state: AppState, hash: string, paperOrigin?: string): string {
  const canonical = hash.replace(/^#overview$/, '#bio').replace(/^#(journey|work)$/, '#experiences').replace(/^#publication$/, '#publications');
  const [section, id] = canonical.replace(/^#/, '').split('/');
  const paper = section === 'paper' && state.site.publications.find(paper => paper.id === id);
  state.paper = paper ? {
    id: paper.id,
    returnHash: paperOrigin && pageThread(state, paperOrigin) ? paperOrigin : '#publications',
  } : null;
  const background = state.paper?.returnHash ?? (section === 'paper' ? '#publications' : canonical);
  state.current = pageThread(state, background) ?? state.threads.get('bio')!;
  return canonical;
}

/** A conversation is worth keeping once it holds a message or an unsent draft. */
export const isKeptChat = (thread: Thread) => thread.messages.length > 0 || thread.draft.trim() !== '';
/** Drops conversations that were opened but never used, except the one being viewed. */
export function pruneEmptyChats(state: AppState, keep?: Thread) {
  state.chatOrder = state.chatOrder.filter(id => {
    const thread = state.threads.get(id);
    if (!thread || thread === keep || isKeptChat(thread)) return Boolean(thread);
    state.threads.delete(id);
    return false;
  });
}

/** Moves a question typed in a session into its own conversation, which is opened only when the question is sent. */
export function startConversation(state: AppState, thread: Thread, id: string, paper?: Publication): Thread {
  const chat = makeThread(id, 'chat');
  chat.paperId = paper?.id ?? null;
  if (paper) chat.title = paper.title;
  chat.draft = thread.draft;
  thread.paperId = null;
  thread.draft = '';
  state.threads.set(chat.id, chat);
  state.chatOrder.push(chat.id);
  return chat;
}

/** Retrying reuses the original prompt/context without consuming the next message's draft. */
export function prepareReply(thread: Thread, retryId?: string): AssistantMessage | undefined {
  const retry = retryId ? thread.messages.find((message): message is AssistantMessage =>
    message.role === 'assistant' && message.id === retryId
    && (message.state === 'error' || message.state === 'stopped')) : undefined;
  if (retryId && !retry) return;
  const prompt = retry?.prompt ?? thread.draft.trim();
  if (!prompt || prompt.length > 2000) return;
  const reply: AssistantMessage = retry ?? {
    id: crypto.randomUUID(), role: 'assistant', text: '', prompt,
    paperId: thread.paperId, state: 'pending',
  };
  reply.state = 'pending';
  reply.text = '';
  if (!retry) {
    thread.messages.push({ id: crypto.randomUUID(), role: 'user', text: prompt }, reply);
    thread.draft = '';
  }
  if (thread.topic === 'chat' && !thread.title) thread.title = prompt.slice(0, 70);
  return reply;
}

/** Appends site content as a reply, reusing the previous message when the same content was just shown. */
export function showContent(thread: Thread, content: Content): ContentMessage {
  const last = thread.messages.at(-1);
  if (last?.role === 'content' && JSON.stringify(last.content) === JSON.stringify(content)) return last;
  const message: ContentMessage = { id: crypto.randomUUID(), role: 'content', content };
  thread.messages.push(message);
  return message;
}

export function filterPublications(publications: Publication[], filters: Filters): Publication[] {
  const query = filters.query.toLocaleLowerCase().trim();
  return publications.filter(paper =>
    (!query || `${paper.title} ${paper.authors} ${paper.venue}`.toLocaleLowerCase().includes(query))
    && (!filters.year || String(paper.year) === filters.year)
    && (!filters.topic || paper.topic === filters.topic)
    && (!filters.category || paper.category === filters.category))
    .sort((a, b) => b.year - a.year);
}
