import { requestReply } from './chat.js';
import { siteConfig } from './config.js';
import { translations, type CopyKey } from './content.js';
import { createRenderer, icon } from './render.js';
import { createState, emptyFilters, filterPublications, makeThread, navigate, prepareReply } from './state.js';
import { isCategory, isRecord, isResearchTopic, parsePublications, type Language, type Publication } from './types.js';

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
const input = $<HTMLTextAreaElement>('#message');
const scrollArea = $('#scroll-area');
const dialog = $<HTMLDialogElement>('#paper-dialog');
const mobile = matchMedia('(max-width: 760px)');
let language: Language = readPreference('fz-language', 'en') === 'zh' ? 'zh' : 'en';
let theme = readPreference('fz-theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') === 'dark' ? 'dark' : 'light';
const t = (key: CopyKey): string => translations[language][key];
const view = () => createRenderer({ ...state, language });
const getPaper = (id: string | null) => state.publications.find(paper => paper.id === id);
const announce = (message: string) => { $('#announcement').textContent = message; };

function saveView() {
  state.current.scroll = scrollArea.scrollTop;
  state.current.draft = input.value;
}
function renderFilters() {
  if (!document.querySelector('#publication-results')) return;
  const result = filterPublications(state.publications, state.filters);
  $('#filter-count').textContent = `${result.length} / ${state.publications.length} ${t('showing')}`;
  $('#publication-results').innerHTML = view().papers(result);
}
function renderMessages() {
  $('#messages').innerHTML = view().messages(state.current);
}
function renderNavigation() {
  const { current, threads, chatOrder } = state;
  $('#current-topic').textContent = current.topic === 'chat' ? current.title || t('chatTitleShort') : t(current.topic);
  const chats = chatOrder.flatMap(id => threads.get(id) ?? []);
  const navigation = view().navigation(current, chats);
  $('#topic-nav').innerHTML = navigation.main;
  $('#recent-chats').innerHTML = navigation.history;
}
function renderTheme() {
  document.documentElement.dataset.theme = theme;
  $('#theme-toggle').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
  $('#theme-toggle').setAttribute('aria-label', t(theme === 'dark' ? 'themeLight' : 'themeDark'));
}
function render() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => {
    const key = element.dataset.i18n;
    if (key && Object.hasOwn(translations.en, key)) element.textContent = t(key as CopyKey);
  });
  $('#language-toggle').innerHTML = language === 'en' ? 'EN <span>/ 中</span>' : '中 <span>/ EN</span>';
  $('#language-toggle').setAttribute('aria-label', language === 'en' ? 'Switch to Chinese' : '切换为英文');
  renderTheme();
  document.title = `Fuxiang Zhang · ${t(state.current.topic === 'chat' ? 'chatTitleShort' : state.current.topic)}`;
  $('#content').innerHTML = view().page(state.current.topic);
  $('#year').textContent = String(new Date().getFullYear());
  input.placeholder = t('placeholder');
  input.value = state.current.draft;
  renderNavigation();
  renderFilters();
  renderMessages();
  updateComposer();
  scrollArea.scrollTop = state.current.scroll;
  const paper = getPaper(state.paper?.id ?? null);
  if (paper) $('#paper-detail').innerHTML = view().paperDetail(paper);
}
function updateComposer() {
  const busy = pending.has(state.current.id);
  const send = $<HTMLButtonElement>('#send-button');
  send.disabled = !busy && !input.value.trim();
  send.textContent = busy ? '■' : '↑';
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
function route() {
  saveView();
  const historyState: unknown = history.state;
  const origin = isRecord(historyState) && typeof historyState.paperOrigin === 'string'
    ? historyState.paperOrigin : undefined;
  const hash = navigate(state, location.hash, origin);
  if (hash !== location.hash) history.replaceState(null, '', hash);
  if (!state.paper && dialog.open) dialog.close();
  setMenu(false);
  render();
  if (state.paper && !dialog.open) dialog.showModal();
}
function setMenu(open: boolean) {
  $('#sidebar').classList.toggle('open', open);
  $('#sidebar-scrim').hidden = !open;
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
  $('#menu-toggle').setAttribute('aria-label', t(open ? 'menuClose' : 'menuOpen'));
  $('#sidebar').inert = mobile.matches && !open;
  for (const selector of ['#content', '.composer-region', '.topbar-actions']) {
    $(selector).inert = mobile.matches && open;
  }
}
function newConversation(paper?: Publication) {
  const thread = makeThread(crypto.randomUUID(), 'chat');
  if (paper) {
    thread.paperId = paper.id;
    thread.title = paper.title;
    thread.draft = t('paperPrompt') + paper.title;
  }
  state.threads.set(thread.id, thread);
  state.chatOrder.push(thread.id);
  location.hash = `chat/${thread.id}`;
  setTimeout(() => input.focus(), 0);
}
function openPaper(id: string) {
  if (!getPaper(id)) return;
  const returnHash = state.paper?.returnHash
    ?? (state.current.topic === 'chat' ? `#chat/${state.current.id}` : `#${state.current.topic}`);
  history.pushState({ paperOrigin: returnHash }, '', `#paper/${encodeURIComponent(id)}`);
  route();
}
function closePaper() {
  const paper = state.paper;
  if (!paper) return;
  history.replaceState(null, '', paper.returnHash);
  route();
  document.querySelector<HTMLElement>(`[data-paper="${CSS.escape(paper.id)}"]`)?.focus();
}
async function sendMessage(retryId?: string) {
  const thread = state.current;
  if (pending.has(thread.id)) {
    pending.get(thread.id)?.abort();
    return;
  }
  thread.draft = input.value;
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
      message: reply.prompt, language, topic: thread.topic, paperId: reply.paperId, signal: controller.signal,
    }, siteConfig.chatEndpoint);
    controller.signal.throwIfAborted();
    reply.text = result.text;
    reply.state = 'done';
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
$('#new-chat').addEventListener('click', () => newConversation());
$('#theme-toggle').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  savePreference('fz-theme', theme);
  renderTheme();
});
$('#language-toggle').addEventListener('click', () => {
  saveView();
  language = language === 'en' ? 'zh' : 'en';
  savePreference('fz-language', language);
  render();
});
$('#menu-toggle').addEventListener('click', () => setMenu(!$('#sidebar').classList.contains('open')));
$('#sidebar-scrim').addEventListener('click', () => {
  setMenu(false);
  $('#menu-toggle').focus();
});
mobile.addEventListener('change', () => setMenu(false));
document.addEventListener('keydown', event => {
  if (!$('#sidebar').classList.contains('open')) return;
  if (event.key === 'Escape') {
    setMenu(false);
    $('#menu-toggle').focus();
  }
  if (event.key === 'Tab' && mobile.matches) {
    const focusable = [...$('#sidebar').querySelectorAll<HTMLElement>('a,button'), $('#menu-toggle')];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  closePaper();
});
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePaper();
});
document.addEventListener('click', async event => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button) return;
  const { paper, ask, filterTopic, retry, copy } = button.dataset;
  if (paper) openPaper(paper);
  if (ask) {
    const publication = getPaper(ask);
    if (publication) {
      closePaper();
      newConversation(publication);
    }
  }
  if ('closeDialog' in button.dataset) closePaper();
  if (isResearchTopic(filterTopic)) {
    state.filters = { ...emptyFilters(), topic: filterTopic };
    if (location.hash === '#publications') { saveView(); render(); }
    else location.hash = 'publications';
  }
  if ('clearFilters' in button.dataset) {
    state.filters = emptyFilters();
    saveView();
    render();
    $('#paper-search').focus();
  }
  if ('reload' in button.dataset) location.reload();
  if (button.id === 'remove-context') {
    state.current.paperId = null;
    updateComposer();
    input.focus();
  }
  if (retry) void sendMessage(retry);
  if (copy) {
    const message = state.current.messages.find(message => message.id === copy);
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message.text);
      announce(t('copied'));
      button.textContent = t('copied');
    } catch { announce(t('copyFailed')); }
  }
});
document.addEventListener('input', event => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.id === 'paper-search') {
    state.filters.query = target.value;
    renderFilters();
  }
});
document.addEventListener('change', event => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  const value = target.value;
  if (target.id === 'filter-year') state.filters.year = value;
  else if (target.id === 'filter-topic' && (value === '' || isResearchTopic(value))) state.filters.topic = value;
  else if (target.id === 'filter-category' && (value === '' || isCategory(value))) state.filters.category = value;
  else return;
  renderFilters();
});
window.addEventListener('hashchange', route);
try {
  const response = await fetch('data/publications.json');
  if (!response.ok) throw new Error('Could not load publications');
  state.publications = parsePublications(await response.json());
} catch { state.loadFailed = true; }
route();
