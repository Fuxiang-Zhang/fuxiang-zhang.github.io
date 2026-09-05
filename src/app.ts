import { requestReply } from './chat.js';
import { siteConfig } from './config.js';
import { copy, type CopyKey } from './content.js';
import { createRenderer, icon } from './render.js';
import { createState, isKeptChat, makeThread, navigate, prepareReply, pruneEmptyChats, showContent, startConversation } from './state.js';
import { revealHTML, type Reveal } from './stream.js';
import { isCategory, isContentKind, isRecord, isResearchTopic, loadSiteData, type Content, type Publication } from './types.js';

function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}
function readPreference(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; }
  catch { return fallback; }
}
function savePreference(key: string, value: string) {
  try { localStorage.setItem(key, value); }
  catch { /* Preferences remain usable in memory. */ }
}

const state = createState();
const pending = new Map<string, AbortController>();
/** Replies that stream in on their next render, and the streams currently running. */
const revealNext = new Set<string>();
const reveals = new Map<string, Reveal>();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const input = $<HTMLTextAreaElement>('#message');
const scrollArea = $('#scroll-area');
const sidebar = $('#sidebar');
let theme = readPreference('fz-theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') === 'dark' ? 'dark' : 'light';
const t = (key: CopyKey): string => copy[key];
const view = () => createRenderer(state);
const getPaper = (id: string | null) => state.site.publications.find(paper => paper.id === id);
const announce = (message: string) => { $('#announcement').textContent = message; };

function saveView() {
  state.current.scroll = scrollArea.scrollTop;
  state.current.draft = input.value;
}
function renderMessages() {
  for (const reveal of reveals.values()) reveal.cancel();
  reveals.clear();
  $('#messages').innerHTML = view().messages(state.current);
  for (const id of revealNext) {
    const body = document.querySelector<HTMLElement>(`#message-${CSS.escape(id)} .message-body`);
    if (body) startReveal(id, body);
  }
  revealNext.clear();
}
const nearBottom = () => scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight < 48;
/** Streams a rendered reply into view, following the newest text until the reader scrolls away. */
function startReveal(id: string, body: HTMLElement) {
  if (reduceMotion.matches) return;
  let following = true;
  const onScroll = () => { following = nearBottom(); };
  scrollArea.addEventListener('scroll', onScroll);
  scrollArea.style.scrollBehavior = 'auto';
  const reveal = revealHTML(body, body.innerHTML, {
    onStep: () => { if (following) scrollArea.scrollTop = scrollArea.scrollHeight; },
  });
  reveals.set(id, reveal);
  void reveal.done.then(() => {
    scrollArea.removeEventListener('scroll', onScroll);
    reveals.delete(id);
    if (!reveals.size) scrollArea.style.scrollBehavior = '';
  });
}
function renderNavigation() {
  const { current, threads, chatOrder } = state;
  const chats = chatOrder.flatMap(id => threads.get(id) ?? []).filter(isKeptChat);
  const navigation = view().navigation(current, chats);
  $('#sidebar-profile').innerHTML = view().profileCard();
  $('#topic-nav').innerHTML = navigation.main;
  $('#recent-chats').innerHTML = navigation.history;
  $('#recent-chats').hidden = !navigation.history;
  $('#mobile-title').textContent = current.topic === 'chat' ? current.title || t('chatTitleShort') : t(current.topic);
}
function renderTheme() {
  document.documentElement.dataset.theme = theme;
  $('#theme-toggle').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
  $('#theme-toggle').setAttribute('aria-label', t(theme === 'dark' ? 'themeLight' : 'themeDark'));
}
function render() {
  renderTheme();
  document.title = `Fuxiang Zhang · ${t(state.current.topic === 'chat' ? 'chatTitleShort' : state.current.topic)}`;
  $('#content').innerHTML = view().page(state.current.topic, state.current.topic !== 'chat' || state.current.intro === true);
  input.placeholder = t('placeholder');
  input.value = state.current.draft;
  renderNavigation();
  renderMessages();
  updateComposer();
  scrollArea.scrollTop = state.current.scroll;
}
function updateComposer() {
  const busy = pending.has(state.current.id);
  const send = $<HTMLButtonElement>('#send-button');
  send.disabled = !busy && !input.value.trim();
  send.innerHTML = icon(busy ? 'stop' : 'send');
  send.setAttribute('aria-label', t(busy ? 'stop' : 'send'));
  input.readOnly = busy;
  $('#chat-form').setAttribute('aria-busy', String(busy));
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  const paper = getPaper(state.current.paperId);
  $('#context-chip').hidden = !paper;
  $('#context-chip').innerHTML = view().paperContext(paper);
}
function scrollToLatest() {
  scrollArea.scrollTop = scrollArea.scrollHeight;
}
function scrollToMessage(id: string) {
  const element = document.getElementById(`message-${id}`);
  if (!element) return;
  scrollArea.scrollTop = element.offsetTop - 16;
}
function setMenu(open: boolean) {
  sidebar.classList.toggle('open', open);
  $('#scrim').hidden = !open;
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
}
/** Appends site content to the current conversation as a reply and scrolls to it. */
function show(content: Content) {
  const before = state.current.messages.length;
  const message = showContent(state.current, content);
  if (state.current.messages.length > before) revealNext.add(message.id);
  renderMessages();
  scrollToMessage(message.id);
}
function route() {
  saveView();
  const historyState: unknown = history.state;
  const origin = isRecord(historyState) && typeof historyState.paperOrigin === 'string'
    ? historyState.paperOrigin : undefined;
  const hash = navigate(state, location.hash, origin);
  pruneEmptyChats(state, state.current);
  // Shared paper links open the paper as a reply in its session instead of keeping a separate route.
  const paper = state.paper;
  if (paper) {
    showContent(state.current, { kind: 'paper', paperId: paper.id });
    state.current.scroll = Number.MAX_SAFE_INTEGER;
    state.paper = null;
  }
  const target = paper?.returnHash ?? hash;
  if (target !== location.hash) history.replaceState(null, '', target);
  setMenu(false);
  render();
}
function newConversation() {
  if (state.current.topic === 'chat' && !isKeptChat(state.current)) {
    input.focus();
    return;
  }
  const thread = makeThread(crypto.randomUUID(), 'chat');
  thread.intro = true;
  state.threads.set(thread.id, thread);
  state.chatOrder.push(thread.id);
  location.hash = `chat/${thread.id}`;
  setTimeout(() => input.focus(), 0);
}
/** Puts a paper into the composer; the conversation about it opens once the question is sent. */
function askAboutPaper(paper: Publication) {
  state.current.paperId = paper.id;
  input.value = t('paperPrompt') + paper.title;
  state.current.draft = input.value;
  updateComposer();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}
async function sendMessage(retryId?: string) {
  const thread = state.current;
  if (pending.has(thread.id)) {
    pending.get(thread.id)?.abort();
    return;
  }
  thread.draft = input.value;
  // Questions typed in a session get their own conversation; the session keeps only its content.
  if (thread.topic !== 'chat' && !retryId && thread.draft.trim()) {
    const chat = startConversation(state, thread, crypto.randomUUID(), getPaper(thread.paperId));
    input.value = '';
    history.pushState(null, '', `#chat/${chat.id}`);
    route();
    void sendMessage();
    return;
  }
  const reply = prepareReply(thread, retryId);
  if (!reply) return;
  input.value = thread.draft;
  const controller = new AbortController();
  pending.set(thread.id, controller);
  const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 15000);
  renderMessages();
  renderNavigation();
  updateComposer();
  scrollToLatest();
  announce(t('thinking'));
  try {
    const result = await requestReply({
      message: reply.prompt, topic: thread.topic, paperId: reply.paperId, signal: controller.signal,
    }, siteConfig.chatEndpoint);
    controller.signal.throwIfAborted();
    reply.text = result.text;
    reply.state = 'done';
    revealNext.add(reply.id);
    if (state.current === thread) announce(t('simulated') + ': ' + result.text);
  } catch (error) {
    reply.state = error instanceof Error && error.name === 'AbortError' ? 'stopped' : 'error';
    if (state.current === thread) announce(t(reply.state === 'stopped' ? 'stopped' : 'failed'));
  } finally {
    clearTimeout(timeout);
    pending.delete(thread.id);
    if (state.current === thread) {
      renderMessages();
      updateComposer();
      scrollToLatest();
      input.focus();
    }
  }
}

$('#chat-form').addEventListener('submit', event => {
  event.preventDefault();
  void sendMessage();
});
input.addEventListener('input', () => {
  state.current.draft = input.value;
  updateComposer();
});
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!pending.has(state.current.id)) void sendMessage();
  }
});
$('#theme-toggle').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  savePreference('fz-theme', theme);
  renderTheme();
});
$('#new-chat').innerHTML = `${icon('plus')}<span>${t('newChat')}</span>`;
$('#new-chat').addEventListener('click', () => newConversation());
$('#menu-toggle').innerHTML = icon('menu');
$('#menu-toggle').setAttribute('aria-label', t('menu'));
$('#menu-toggle').addEventListener('click', () => setMenu(!sidebar.classList.contains('open')));
$('#close-menu').innerHTML = icon('close');
$('#close-menu').setAttribute('aria-label', t('closeMenu'));
$('#close-menu').addEventListener('click', () => setMenu(false));
$('#scrim').addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && sidebar.classList.contains('open')) setMenu(false);
});
document.addEventListener('click', async event => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button) return;
  const { paper, ask, category, topic, retry, copy, suggest } = button.dataset;
  const kind = button.dataset.show;
  if (paper && getPaper(paper)) show({ kind: 'paper', paperId: paper });
  if (ask) {
    const publication = getPaper(ask);
    if (publication) askAboutPaper(publication);
  }
  if (kind === 'research') show({ kind });
  if (isContentKind(kind) && kind === 'publications') {
    show({ kind, ...(isCategory(category) ? { category } : {}), ...(isResearchTopic(topic) ? { topic } : {}) });
  }
  if ('reload' in button.dataset) location.reload();
  if (button.id === 'remove-context') {
    state.current.paperId = null;
    updateComposer();
    input.focus();
  }
  if (suggest) {
    input.value = suggest;
    state.current.draft = suggest;
    void sendMessage();
  }
  if (retry) void sendMessage(retry);
  if (copy) {
    const message = state.current.messages.find(message => message.id === copy);
    if (!message || message.role !== 'assistant') return;
    try {
      await navigator.clipboard.writeText(message.text);
      announce(t('copied'));
      button.textContent = t('copied');
    } catch { announce(t('copyFailed')); }
  }
});
window.addEventListener('hashchange', route);
try {
  state.site = await loadSiteData(async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return response.json();
  });
} catch { state.loadFailed = true; }
route();
