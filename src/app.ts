import { ChatError, isOfftopicReply, requestReply, requestStatus, stripPaperMarkers } from './chat.js';
import { createBudgetMonitor } from './budget.js';
import { siteConfig } from './config.js';
import { copy, type CopyKey } from './content.js';
import { buildCommands, matchCommands, parseInput, resolveRoute, type Command } from './commands.js';
import { typingAction } from './input.js';
import { createRenderer, escapeHTML } from './render.js';
import { conversationHistory, createState, prepareReply, showContent } from './state.js';
import { revealHTML, type Reveal } from './stream.js';
import { MAX_MESSAGE, type BudgetStatus, type ChatMode, type Content, type Publication } from './types.js';
import { loadSiteData } from './markdown.js';

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
let pending: AbortController | undefined;
/** Replies that stream in on their next render, and the streams currently running. */
const revealNext = new Set<string>();
const reveals = new Map<string, Reveal>();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const input = $<HTMLTextAreaElement>('#message');
const scrollArea = $('#scroll-area');
let theme = readPreference('fz-terminal-theme', 'light') === 'dark' ? 'dark' : 'light';
/** What the backend reported: reply mode and today's token budget. */
let chatMode: ChatMode | undefined;
let budget: BudgetStatus | null = null;
let candidates: readonly Command[] = [];
let selectedCommand = 0;
const t = (key: CopyKey): string => copy[key];
let view = createRenderer(state);
/** The file's own command list; empty of sections until the content loads. */
let pageCommands = buildCommands(state.site);
let papersById = new Map<string, Publication>();
const getPaper = (id: string | null) => papersById.get(id ?? '');
const announce = (message: string) => { $('#announcement').textContent = message; };

/** Preserve unchanged output and active animations when a reply is appended or updated. */
const rendered = new Map<string, string>();
function renderMessages(followLatest = true) {
  const container = $('#messages');
  for (const message of state.current.messages) {
    // Content and completed user messages never change; assistant state can change on retry.
    const signature = message.role === 'assistant' ? JSON.stringify(message) : message.id;
    if (rendered.get(message.id) === signature) continue;
    const previous = document.getElementById(`message-${message.id}`);
    reveals.get(message.id)?.cancel();
    if (previous) previous.outerHTML = view.message(message);
    else container.insertAdjacentHTML('beforeend', view.message(message));
    rendered.set(message.id, signature);
    if (revealNext.has(message.id)) {
      const body = document.getElementById(`message-${message.id}`)?.querySelector<HTMLElement>('.message-body');
      if (body) startReveal(message.id, body, followLatest);
    }
  }
  revealNext.clear();
}
const nearBottom = () => scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight < 48;
const panelReveals = new WeakMap<HTMLDetailsElement, Reveal>();
const revealedPanels = new WeakSet<HTMLDetailsElement>();
function revealCollapse(panel: HTMLDetailsElement) {
  if (!panel.open) {
    panelReveals.get(panel)?.cancel();
    panelReveals.delete(panel);
    revealedPanels.delete(panel);
    return;
  }
  const body = panel.querySelector<HTMLElement>('.collapse-body');
  if (!body || revealedPanels.has(panel)) return;
  revealedPanels.add(panel);
  if (reduceMotion.matches) return;
  // Follow the expanding panel, rather than jumping past it to later sections.
  // An upward scroll hands control back to the reader for this reveal.
  let following = true;
  let previousTop = scrollArea.scrollTop;
  const onScroll = () => {
    if (scrollArea.scrollTop < previousTop - 2) following = false;
    previousTop = scrollArea.scrollTop;
  };
  scrollArea.addEventListener('scroll', onScroll);
  const reveal = revealHTML(body, body.innerHTML, {
    instantSelector: '.collapse-body, .name-banner',
    onStep: () => {
      body.querySelectorAll<HTMLDetailsElement>('.content-collapse[open]').forEach(revealCollapse);
      if (!following || !panel.open) return;
      const overflow = body.getBoundingClientRect().bottom - scrollArea.getBoundingClientRect().bottom + 20;
      if (overflow > 0) scrollArea.scrollTop += overflow;
      previousTop = scrollArea.scrollTop;
    },
  });
  previousTop = scrollArea.scrollTop;
  panelReveals.set(panel, reveal);
  void reveal.done.then(() => {
    scrollArea.removeEventListener('scroll', onScroll);
    if (panelReveals.get(panel) === reveal) panelReveals.delete(panel);
  });
}
// Native details handles both pointer and keyboard activation; toggle does not bubble.
document.addEventListener('toggle', event => {
  const panel = event.target;
  if (panel instanceof HTMLDetailsElement && panel.matches('.content-collapse')) revealCollapse(panel);
}, true);
/** Streams a rendered reply into view, following the newest text until the reader scrolls away. */
function startReveal(id: string, body: HTMLElement, followLatest: boolean) {
  if (reduceMotion.matches) return;
  let following = followLatest;
  const onScroll = () => { following = nearBottom(); };
  scrollArea.addEventListener('scroll', onScroll);
  scrollArea.style.scrollBehavior = 'auto';
  const reveal = revealHTML(body, body.innerHTML, {
    instantSelector: '.collapse-body, .name-banner',
    onStep: () => {
      const openPanels = body.querySelectorAll<HTMLDetailsElement>('.content-collapse[open]');
      // A visitor may open a heading before its body reaches the overview stream.
      openPanels.forEach(revealCollapse);
      if (following && !openPanels.length) scrollArea.scrollTop = scrollArea.scrollHeight;
    },
  });
  reveals.set(id, reveal);
  void reveal.done.then(() => {
    scrollArea.removeEventListener('scroll', onScroll);
    if (reveals.get(id) === reveal) reveals.delete(id);
    if (!reveals.size) scrollArea.style.scrollBehavior = '';
  });
}
/** The status bar names the reply source: the configured backend until the backend reports, then what it actually returned. */
function renderChatMode(mode = chatMode) {
  chatMode = mode;
  $('#chat-mode').textContent = t(budget?.exhausted ? 'chatBudget'
    : mode === 'live' ? 'chatLive' : mode === 'mock' ? 'chatMock' : siteConfig.chatEndpoint ? 'chatConnected' : 'chatMock');
}
const budgetText = (status: BudgetStatus) => t('budgetNotice').replace('{time}',
  new Date(status.resetsAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }));
/** Shows the exhausted-budget notice above the prompt and rechecks once the budget resets. */
function renderBudget(status: BudgetStatus | null) {
  budget = status;
  const notice = $('#budget-notice');
  notice.hidden = !status?.exhausted;
  notice.textContent = status?.exhausted ? budgetText(status) : '';
  renderChatMode();
}
function applyBudget(status: BudgetStatus | null | undefined) {
  if (status === undefined) return;
  budgetMonitor.update(status);
  renderBudget(status);
}
const budgetMonitor = createBudgetMonitor(
  () => requestStatus(siteConfig.chatEndpoint),
  status => { chatMode = status.mode; renderBudget(status.budget); },
);
function renderTheme() {
  document.documentElement.dataset.theme = theme;
  $('#theme-toggle').textContent = theme === 'dark' ? '[light]' : '[dark]';
  $('#theme-toggle').setAttribute('aria-label', t(theme === 'dark' ? 'themeLight' : 'themeDark'));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#17191b' : '#fafafa');
}
function updateComposer() {
  const busy = Boolean(pending);
  const send = $<HTMLButtonElement>('#send-button');
  send.disabled = !busy && !input.value.trim();
  send.textContent = busy ? '[stop]' : '[enter]';
  send.setAttribute('aria-label', t(busy ? 'stop' : 'send'));
  input.readOnly = busy;
  $('#chat-form').setAttribute('aria-busy', String(busy));
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  const paper = getPaper(state.current.paperId);
  $('#context-chip').hidden = !paper;
  $('#context-chip').innerHTML = view.paperContext(paper);
  const last = state.current.messages.at(-1);
  const status = busy ? 'preparing reply' : last?.role === 'assistant' && last.state === 'error' ? 'reply failed'
    : last?.role === 'assistant' && last.state === 'stopped' ? 'reply stopped' : 'ready';
  $('#terminal-status').textContent = status;
}
function scrollToLatest() {
  scrollArea.scrollTop = scrollArea.scrollHeight;
}
function scrollToMessage(id: string) {
  const element = document.getElementById(`message-${id}`);
  if (!element) return;
  scrollArea.scrollTop += element.getBoundingClientRect().top - scrollArea.getBoundingClientRect().top - 16;
}
function closeCommands() {
  candidates = [];
  $('#command-menu').hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
}
function renderCommands() {
  $('#command-menu').hidden = !candidates.length;
  input.setAttribute('aria-expanded', String(Boolean(candidates.length)));
  if (!candidates.length) { input.removeAttribute('aria-activedescendant'); return; }
  $('#command-options').innerHTML = candidates.map((command, index) =>
    `<div class="command-option" role="option" id="command-option-${index}" aria-selected="${index === selectedCommand}" data-command="${command.name}"><span>${command.name}</span><span>${escapeHTML(command.description)}</span><span aria-hidden="true">↵</span></div>`).join('');
  input.setAttribute('aria-activedescendant', `command-option-${selectedCommand}`);
  document.getElementById(`command-option-${selectedCommand}`)?.scrollIntoView({ block: 'nearest' });
}
function executeCommand(command: Command, fromInput = false) {
  if (fromInput) { input.value = ''; state.current.draft = ''; }
  $('#command-error').hidden = true;
  closeCommands();
  if (command.topic) show({ kind: 'preset', topic: command.topic });
  else show({ kind: 'help' });
  updateComposer();
  if (fromInput) input.focus({ preventScroll: true });
}
function submitInput() {
  if (Boolean(pending)) { void sendMessage(); return; }
  const parsed = parseInput(input.value, pageCommands);
  if (parsed.kind === 'command') { executeCommand(parsed.command, true); return; }
  if (parsed.kind === 'invalid') {
    closeCommands();
    $('#command-error').textContent = 'Unknown command or unsupported arguments. Type / to see available commands.';
    $('#command-error').hidden = false;
    input.focus();
    return;
  }
  if (parsed.kind === 'question') { closeCommands(); void sendMessage(); }
}
/** Every preset is printed into the same transcript, including repeated commands. */
function show(content: Content, animate = true) {
  const message = showContent(state.current, content);
  // Command output streams in like a reply and keeps the newest text in view; the opening screen appears at once.
  if (animate) revealNext.add(message.id);
  renderMessages(animate);
  scrollToMessage(message.id);
  updateComposer();
}
let routed = false;
function route() {
  closeCommands();
  $('#command-error').hidden = true;
  const content = resolveRoute(location.hash, state.site);
  if (content) show(content, routed);
  else if (!routed) show(resolveRoute('', state.site)!, false);
  routed = true;
}
/** Puts the selected paper into the current terminal prompt as question context. */
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
  if (pending) {
    pending.abort();
    return;
  }
  // Once the daily budget is gone, questions are held back instead of failing at the backend.
  if (budget?.exhausted) {
    announce(budgetText(budget));
    $('#budget-notice').scrollIntoView({ block: 'nearest' });
    input.focus({ preventScroll: true });
    return;
  }
  thread.draft = input.value;
  const reply = prepareReply(thread, retryId);
  if (!reply) return;
  input.value = thread.draft;
  const controller = new AbortController();
  pending = controller;
  let frame = 0;
  const paint = () => {
    frame = 0;
    const following = nearBottom();
    renderMessages(following);
    if (following) scrollToLatest();
  };
  renderMessages();
  updateComposer();
  scrollToLatest();
  announce(t('thinking'));
  try {
    const result = await requestReply({
      message: reply.prompt, paperId: reply.paperId,
      history: conversationHistory(thread, reply.id), signal: controller.signal,
      onDelta: text => {
        reply.text += text;
        reply.mode = 'live';
        if (!frame) frame = requestAnimationFrame(paint);
      },
    }, siteConfig.chatEndpoint);
    controller.signal.throwIfAborted();
    reply.text = result.text;
    reply.mode = result.mode;
    reply.error = undefined;
    reply.state = 'done';
    if (result.mode === 'mock') revealNext.add(reply.id);
    renderChatMode(result.mode);
    applyBudget(result.budget);
    announce(t(result.mode === 'live' ? 'aiReply' : 'simulated') + ': ' + result.text);
  } catch (error) {
    reply.state = error instanceof Error && error.name === 'AbortError' ? 'stopped' : 'error';
    // Rate limits and outages carry a message written for visitors; other failures use the generic text.
    reply.error = error instanceof ChatError && [429, 502, 503].includes(error.status) ? error.message : undefined;
    if (error instanceof ChatError) applyBudget(error.budget ?? undefined);
    announce(reply.state === 'stopped' ? t('stopped') : reply.error ?? t('failed'));
  } finally {
    if (frame) cancelAnimationFrame(frame);
    pending = undefined;
    const following = nearBottom();
    renderMessages(following);
    updateComposer();
    if (following) scrollToLatest();
  }
}

$('#chat-form').addEventListener('submit', event => {
  event.preventDefault();
  submitInput();
});
input.addEventListener('input', () => {
  state.current.draft = input.value;
  updateComposer();
  $('#command-error').hidden = true;
  candidates = matchCommands(input.value, pageCommands);
  selectedCommand = 0;
  renderCommands();
});
input.addEventListener('keydown', event => {
  if (event.isComposing) return;
  if (candidates.length && !event.shiftKey) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectedCommand = (selectedCommand + (event.key === 'ArrowDown' ? 1 : -1) + candidates.length) % candidates.length;
      renderCommands();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      input.value = candidates[selectedCommand].name;
      state.current.draft = input.value;
      closeCommands();
      updateComposer();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      executeCommand(candidates[selectedCommand], true);
      return;
    }
  }
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!Boolean(pending)) submitInput();
  }
});
$('#theme-toggle').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  savePreference('fz-terminal-theme', theme);
  renderTheme();
});
$('#close-commands').addEventListener('click', () => { closeCommands(); input.focus(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeCommands();
  if (event.defaultPrevented || input.readOnly || isEditing(event.target) || hasTextSelection()) return;
  const target = event.target instanceof Element ? event.target : null;
  const action = typingAction(event, Boolean(target?.closest('button, a, summary, [role="button"]')));
  if (!action) return;
  input.focus({ preventScroll: true });
  // IME and dead keys must complete through the browser's native composition path.
  if (action === 'focus') return;
  event.preventDefault();
  insertText(event.key);
});

function isEditing(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'));
}
function hasTextSelection() {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed);
}
function insertText(text: string) {
  const available = input.maxLength - input.value.length + input.selectionEnd - input.selectionStart;
  let value = '';
  for (const character of text) {
    if (value.length + character.length > available) break;
    value += character;
  }
  if (!value) return;
  input.setRangeText(value, input.selectionStart, input.selectionEnd, 'end');
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
document.addEventListener('paste', event => {
  if (event.defaultPrevented || input.readOnly || isEditing(event.target) || hasTextSelection()) return;
  const text = event.clipboardData?.getData('text/plain');
  if (!text) return;
  event.preventDefault();
  input.focus({ preventScroll: true });
  insertText(text);
});
// Clicking ordinary output keeps the prompt ready, including before IME composition.
document.addEventListener('pointerup', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (event.pointerType !== 'mouse' || event.button !== 0 || input.readOnly || hasTextSelection()
    || !target?.closest('#app-shell') || target.closest('a, button, summary, input, textarea, select, [contenteditable], [role="option"]')) return;
  input.focus({ preventScroll: true });
});
document.addEventListener('click', async event => {
  const target = event.target instanceof Element ? event.target : null;
  const authoredLink = target?.closest<HTMLAnchorElement>('a[href^="#"]');
  if (authoredLink && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    const hash = authoredLink.getAttribute('href');
    const command = pageCommands.find(c => hash === `#${c.topic ?? c.action}`);
    if (command) { event.preventDefault(); executeCommand(command); return; }
  }
  const commandTarget = target?.closest<HTMLElement>('[data-command]');
  if (commandTarget) {
    if (commandTarget instanceof HTMLAnchorElement && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    const command = pageCommands.find(command => command.name === commandTarget.dataset.command);
    if (command) {
      event.preventDefault();
      executeCommand(command, Boolean(commandTarget.closest('#command-options')));
    }
    return;
  }
  if (!target?.closest('.composer-wrap')) closeCommands();
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button) return;
  const { paper, ask, retry, copy } = button.dataset;
  if (paper && getPaper(paper)) show({ kind: 'paper', paperId: paper });
  if (ask) {
    const publication = getPaper(ask);
    if (publication) askAboutPaper(publication);
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
    if (!message || message.role !== 'assistant') return;
    try {
      await navigator.clipboard.writeText(isOfftopicReply(message.text) ? t('offtopic') : stripPaperMarkers(message.text));
      announce(t('copied'));
      button.textContent = t('copied');
    } catch { announce(t('copyFailed')); }
  }
});
window.addEventListener('hashchange', route);
// Keep the input above the on-screen keyboard on narrow viewports.
function updateViewport() {
  const viewport = window.visualViewport;
  document.documentElement.style.setProperty('--mobile-height', `${viewport?.height ?? window.innerHeight}px`);
}
window.visualViewport?.addEventListener('resize', updateViewport);
window.addEventListener('resize', updateViewport);
updateViewport();
try {
  state.site = await loadSiteData(async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return response.text();
  });
} catch { state.loadFailed = true; }
view = createRenderer(state);
pageCommands = buildCommands(state.site);
if (!state.loadFailed) {
  document.title = state.site.profile.title;
  for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) document.querySelector(selector)?.setAttribute('content', state.site.profile.description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', state.site.profile.title);
  const homeLink = document.querySelector<HTMLAnchorElement>('#home-link');
  const homeCommand = pageCommands.find(command => command.topic === state.site.profile.home);
  if (homeLink) {
    homeLink.textContent = state.site.profile.title;
    homeLink.href = `#${state.site.profile.home}`;
    homeLink.dataset.command = homeCommand?.name ?? '';
  }
}
papersById = new Map(state.site.publications.map(paper => [paper.id, paper]));
input.maxLength = MAX_MESSAGE;
renderTheme();
renderChatMode();
void budgetMonitor.refresh();
input.placeholder = t('placeholder');
route();
if (matchMedia('(pointer: fine)').matches
  && (document.activeElement === document.body || document.activeElement === document.documentElement)) {
  input.focus({ preventScroll: true });
}
