import {
  emptySite, MAX_MESSAGE, MAX_REPLY, MAX_HISTORY, MAX_HISTORY_CHARS,
  type AssistantMessage, type ChatTurn, type Content, type ContentMessage, type Thread,
} from './types.js';

export const makeThread = (): Thread => ({ messages: [], draft: '', paperId: null });

/** Commands and questions share one terminal transcript. */
export function createState() {
  return { current: makeThread(), site: emptySite(), loadFailed: false };
}

/** Retrying reuses the original prompt/context without consuming the next message's draft. */
export function prepareReply(thread: Thread, retryId?: string): AssistantMessage | undefined {
  const retry = retryId ? thread.messages.find((message): message is AssistantMessage =>
    message.role === 'assistant' && message.id === retryId
    && (message.state === 'error' || message.state === 'stopped')) : undefined;
  if (retryId && !retry) return;
  const prompt = retry?.prompt ?? thread.draft.trim();
  if (!prompt || prompt.length > MAX_MESSAGE) return;
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
  return reply;
}

/** Recent completed turns before `replyId`, sent along with a question so the model can follow the conversation. */
export function conversationHistory(thread: Thread, replyId: string, limit = MAX_HISTORY): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const message of thread.messages) {
    if (message.id === replyId) break;
    if (message.role === 'user') turns.push({ role: 'user', text: message.text });
    else if (message.role === 'assistant' && message.state === 'done') turns.push({ role: 'assistant', text: message.text });
  }
  // The question right before the reply is sent as `message`, not repeated in the history.
  if (turns.at(-1)?.role === 'user') turns.pop();
  const recent: ChatTurn[] = [];
  let size = 0;
  for (const turn of turns.reverse()) {
    const bound = turn.role === 'user' ? MAX_MESSAGE : MAX_REPLY;
    if (recent.length >= Math.min(limit, MAX_HISTORY) || size + turn.text.length > MAX_HISTORY_CHARS || turn.text.length > bound) break;
    size += turn.text.length;
    recent.unshift(turn);
  }
  // Do not start with an orphan answer if its question had to be discarded.
  if (recent[0]?.role === 'assistant') recent.shift();
  return recent;
}

/** Appends command output, including repeated commands, to the transcript. */
export function showContent(thread: Thread, content: Content): ContentMessage {
  const message: ContentMessage = { id: crypto.randomUUID(), role: 'content', content };
  thread.messages.push(message);
  return message;
}
