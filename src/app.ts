import { requestReply } from './chat.js';
import { siteConfig } from './config.js';
import { translations, type CopyKey } from './content.js';
import { renderJourney, escapeHTML, authorMarkup, external, icon } from './render.js';
import { topics, parsePublications, type Language, type Page, type Topic, type Publication, type Filters, type Thread, type AssistantMessage } from './types.js';

function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}
const isTopic = (value: string): value is Topic => topics.some(topic => topic === value);
const readPreference = (key: string, fallback: string) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const savePreference = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Preferences remain usable in memory. */ } };
let language: Language = readPreference('fz-language', 'en') === 'zh' ? 'zh' : 'en';
let theme = readPreference('fz-theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') === 'dark' ? 'dark' : 'light';
const t = (key: string): string => translations[language][key as CopyKey] || key;
const makeThread = (id: string, topic: Page): Thread => ({ id, topic, messages: [], draft: '', scroll: 0, paperId: null });
const threads = new Map<string, Thread>(topics.map(topic => [topic, makeThread(topic, topic)]));
const chatOrder: string[] = [];
let current = threads.get('overview')!;
let activeTopic: Page = 'overview';
let publications: Publication[] = [];
let loadFailed = false;
let filters: Filters = { query: '', year: '', topic: '', category: '' };
let openPaperId: string | null = null;
const pending = new Map<string, AbortController>();
const getPaper = (id: string | null) => publications.find(paper => paper.id === id);
const announce = (message: string) => { $('#announcement').textContent = message; };

function byline(label = 'curated') {
  return `<div class="assistant-byline"><span class="assistant-avatar" aria-hidden="true">${icon('chat')}</span><span>${t('assistantName')}</span><span class="byline-tag">${t(label)}</span></div>`;
}
function paperCard(paper: Publication, featured = false) {
  const authorList = paper.authors.split(',');
  const excerpt = authorList.length > 6 ? `${authorList.slice(0, 4).join(',')}, …` : paper.authors;
  return `<article class="paper-card"><div class="paper-meta"><span class="venue-badge">${escapeHTML(paper.venueShort)} ${paper.year}</span><span>${t(paper.topic)}</span></div>
    <button class="paper-title" data-paper="${paper.id}">${escapeHTML(paper.title)}</button>
    ${featured ? '' : `<p class="paper-authors">${authorMarkup(excerpt)}${!excerpt.includes('Fuxiang Zhang') ? ' · <strong>Fuxiang Zhang</strong>' : ''}</p>`}
    <div class="paper-footer"><span class="paper-links">${external(paper.links.paper, 'Paper ↗')}${external(paper.links.code, 'Code ↗')}</span><button class="ask-paper" data-ask="${paper.id}">${t('askPaper')} ${icon('arrow')}</button></div></article>`;
}
function overview() {
  const selected = ['paper-6', 'paper-7', 'paper-9'].map(getPaper).filter((p): p is Publication => p !== undefined);
  return `${byline('introduction')}<h1 class="hero-title">${t('hero')}</h1><p class="intro">${t('intro')}</p>
    <div class="interest-tags">${['llm','rl','marl'].map(topic => `<button class="interest-tag" data-filter-topic="${topic}">${t(topic)}</button>`).join('')}</div>
    <div class="suggestions"><a class="suggestion" href="#research">${t('exploreResearch')} ${icon('arrow')}</a><a class="suggestion" href="#publications">${t('findPaper')} ${icon('arrow')}</a><a class="suggestion" href="mailto:zfx.agi@gmail.com">${t('contact')} ${icon('arrow')}</a></div>
    <div class="section-heading"><h2>${t('selected')}</h2><a class="text-button" href="#publications">${t('allPapers')}</a></div>
    ${loadFailed ? loadError() : `<div class="paper-list featured">${selected.map(p => paperCard(p, true)).join('')}</div><p class="section-footnote">${t('latestNote')}</p>`}`;
}
function research() {
  return `${byline()}<h1 class="page-title">${t('researchTitle')}</h1><p class="page-description">${t('researchDescription')}</p>
    ${['llm','rl','marl'].map((topic, index) => `<section class="research-card"><div class="research-card-header"><span class="research-number">0${index+1}</span><h2>${t(topic)}</h2></div><p>${t(`${topic}Description`)}</p><button class="text-button" data-filter-topic="${topic}">${t('relatedPapers')} ${icon('arrow')}</button></section>`).join('')}`;
}
function loadError() {
  return `<div class="empty-results"><p>${t('loadError')}</p><button class="text-button" data-reload>${t('reload')}</button> · <a href="reading.html">${t('readingFallback')}</a></div>`;
}
function publicationsView() {
  const years = [...new Set(publications.map(p => p.year))].sort((a,b) => b-a);
  const select = (key: keyof Filters, all: CopyKey, values: [string | number, string | number][]) => `<select id="filter-${key}" aria-label="${t(all)}"><option value="">${t(all)}</option>${values.map(([value, label]) => `<option value="${value}" ${String(filters[key]) === String(value) ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
  return `${byline()}<h1 class="page-title">${t('publications')}<span class="publication-total">${publications.length}</span></h1><p class="page-description">${t('publicationsDescription')}</p>
    ${loadFailed ? loadError() : `<div class="filter-bar"><label class="search-field">${icon('search')}<span class="sr-only">${t('search')}</span><input type="search" id="paper-search" placeholder="${t('search')}" value="${escapeHTML(filters.query)}"></label>${select('year','allYears',years.map(y=>[y,y]))}${select('topic','allTopics',['llm','rl','marl'].map(k=>[k,t(k)]))}${select('category','allTypes',['reports','conference','journal'].map(k=>[k,t(k)]))}</div><div class="filter-summary"><span id="filter-count" aria-live="polite"></span><button class="text-button" data-clear-filters>${t('clear')}</button></div><div id="publication-results" class="paper-list"></div><p class="section-footnote">${t('equal')}</p>`}`;
}
function cvPage(page: 'work' | 'miscellaneous') {
  const sections = page === 'work' ? ['experience'] as const : ['education', 'service', 'awards'] as const;
  return `${byline()}<h1 class="page-title">${t(`${page}Title`)}</h1><p class="page-description">${t(`${page}Description`)}</p>
    ${renderJourney(language, false, [...sections])}
    ${page === 'work' ? '' : `<section class="contact-card"><div><h2>${t('contactTitle')}</h2><p>${t('contactDescription')}</p></div><a href="mailto:zfx.agi@gmail.com">Email Fuxiang ↗</a></section>`}`;
}
function chatIntro() {
  return `<div class="chat-intro">${byline('introduction')}<h1 class="hero-title">${t('chatTitle')}</h1><p class="intro">${t('chatDescription')}</p><div class="suggestions"><a class="suggestion" href="#research">${t('exploreResearch')} ${icon('arrow')}</a><a class="suggestion" href="#publications">${t('findPaper')} ${icon('arrow')}</a><a class="suggestion" href="#miscellaneous">${t('miscellaneous')} ${icon('arrow')}</a></div></div>`;
}
function renderFilters() {
  if (!document.querySelector('#publication-results')) return;
  const query = filters.query.toLocaleLowerCase().trim();
  const result = publications.filter(p => (!query || `${p.title} ${p.authors} ${p.venue}`.toLocaleLowerCase().includes(query)) && (!filters.year || String(p.year) === filters.year) && (!filters.topic || p.topic === filters.topic) && (!filters.category || p.category === filters.category)).sort((a,b)=>b.year-a.year);
  $('#filter-count').textContent = `${result.length} / ${publications.length} ${t('showing')}`;
  $('#publication-results').innerHTML = result.length ? result.map(p=>paperCard(p)).join('') : `<p class="empty-results">${t('noResults')}</p>`;
}
function renderMessages() {
  const container = $('#messages');
  if (!container) return;
  container.innerHTML = current.messages.map(message => {
    if (message.role === 'user') return `<div class="message user-message"><div class="user-bubble">${escapeHTML(message.text)}</div></div>`;
    const text = message.state === 'error' ? t('failed') : message.state === 'stopped' ? t('stopped') : message.text;
    return `<div class="message bot-message">${byline('simulated')}${message.state === 'pending' ? `<div class="thinking" aria-label="${t('thinking')}"><span></span><span></span><span></span></div>` : `<div class="message-text ${message.state === 'error' ? 'message-error' : ''}">${escapeHTML(text)}</div><div class="message-controls">${message.state === 'error' || message.state === 'stopped' ? `<button data-retry="${message.id}">${t('retry')} ↗</button>` : `<button data-copy="${message.id}">${icon('copy')}${t('copy')}</button>`}</div>`}</div>`;
  }).join('');
}
function renderNavigation() {
  $('#current-topic').textContent = activeTopic === 'chat' ? current.title || t('chatTitleShort') : t(activeTopic);
  $('#topic-nav').innerHTML = topics.map(topic => `<a class="nav-item ${activeTopic === topic ? 'active' : ''}" href="#${topic}" ${activeTopic===topic?'aria-current="page"':''}>${icon(topic)}<span>${t(topic)}</span>${topic==='publications'?`<span class="nav-count">${publications.length}</span>`:''}</a>`).join('');
  const recent = [...chatOrder].reverse().slice(0,8);
  $('#recent-chats').innerHTML = recent.length ? recent.map(id => {
    const thread = threads.get(id)!;
    const title = thread.title || t('chatTitleShort');
    return `<a href="#chat/${id}" class="recent-item ${current.id===id?'active':''}" ${current.id===id?'aria-current="page"':''} title="${escapeHTML(title)}">${icon('chat')}<span>${escapeHTML(title)}</span></a>`;
  }).join('') : `<p class="recent-empty">${t('recentEmpty')}</p>`;
}
function render() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n || ''); });
  $('#language-toggle').innerHTML = language === 'en' ? 'EN <span>/ 中</span>' : '中 <span>/ EN</span>';
  $('#language-toggle').setAttribute('aria-label', language === 'en' ? 'Switch to Chinese' : '切换为英文');
  $('#theme-toggle').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
  $('#theme-toggle').setAttribute('aria-label', t(theme === 'dark' ? 'themeLight' : 'themeDark'));
  document.title = `Fuxiang Zhang · ${activeTopic === 'chat' ? t('chatTitleShort') : t(activeTopic)}`;
  const view = { overview, research, publications: publicationsView, work: () => cvPage('work'), miscellaneous: () => cvPage('miscellaneous'), chat: chatIntro }[activeTopic];
  $('#content').innerHTML = `${view()}<div id="messages" class="messages" aria-label="${t('newChat')}"></div>`;
  $('#year').textContent = String(new Date().getFullYear());
  $<HTMLTextAreaElement>('#message').placeholder = t('placeholder');
  $<HTMLTextAreaElement>('#message').value = current.draft;
  renderNavigation(); renderFilters(); renderMessages(); updateComposer();
  $('#scroll-area').scrollTop = current.scroll;
  if (openPaperId) renderPaper(openPaperId);
}
function updateComposer() {
  const busy = pending.has(current.id);
  $<HTMLButtonElement>('#send-button').disabled = !busy && !$<HTMLTextAreaElement>('#message').value.trim();
  $<HTMLButtonElement>('#send-button').textContent = busy ? '■' : '↑';
  $<HTMLButtonElement>('#send-button').setAttribute('aria-label', t(busy ? 'stop' : 'send'));
  $<HTMLTextAreaElement>('#message').readOnly = busy;
  $('#chat-form').setAttribute('aria-busy', String(busy));
  $<HTMLTextAreaElement>('#message').style.height = 'auto';
  $<HTMLTextAreaElement>('#message').style.height = `${Math.min($<HTMLTextAreaElement>('#message').scrollHeight, 140)}px`;
  const paper = getPaper(current.paperId);
  $('#context-chip').hidden = !paper;
  $('#context-chip').innerHTML = paper ? `<span>${t('context')}: ${escapeHTML(paper.title)}</span><button type="button" id="remove-context" aria-label="${t('removeContext')}">×</button>` : '';
}
function scrollToLatest() { $('#scroll-area').scrollTop = $('#scroll-area').scrollHeight; }
function route() {
  current.scroll = $('#scroll-area').scrollTop;
  current.draft = $<HTMLTextAreaElement>('#message').value;
  const [requestedSection, id] = location.hash.slice(1).split('/');
  const section = requestedSection === 'journey' ? 'miscellaneous' : requestedSection === 'publication' ? 'publications' : requestedSection;
  if (section !== requestedSection) history.replaceState(null, '', `#${section}`);
  if (section === 'chat' && threads.has(id)) { activeTopic = 'chat'; current = threads.get(id)!; }
  else { activeTopic = isTopic(section) ? section : section === 'paper' ? 'publications' : 'overview'; current = threads.get(activeTopic)!; }
  openPaperId = section === 'paper' && getPaper(id) ? id : null;
  if (!openPaperId && $<HTMLDialogElement>('#paper-dialog').open) $<HTMLDialogElement>('#paper-dialog').close();
  setMenu(false); render();
  if (openPaperId && !$<HTMLDialogElement>('#paper-dialog').open) $<HTMLDialogElement>('#paper-dialog').showModal();
}
function setMenu(open: boolean) {
  $('#sidebar').classList.toggle('open', open);
  $('#sidebar-scrim').hidden = !open;
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
  $('#menu-toggle').setAttribute('aria-label', t(open?'menuClose':'menuOpen'));
  // The off-canvas navigation is removed from keyboard access on small screens.
  const mobile = matchMedia('(max-width: 760px)').matches;
  $('#sidebar').inert = mobile && !open;
  if (mobile) {
    $('#content').inert = open;
    $('.composer-region').inert = open;
    $('.topbar-actions').inert = open;
  } else { $('#content').inert = false; $('.composer-region').inert = false; $('.topbar-actions').inert = false; }
}
function newConversation(paper?: Publication) {
  const id = crypto.randomUUID();
  const thread = makeThread(id, 'chat');
  if (paper) { thread.paperId = paper.id; thread.title = paper.title; thread.draft = t('paperPrompt') + paper.title; }
  threads.set(id, thread); chatOrder.push(id);
  location.hash = `chat/${id}`;
  setTimeout(() => $<HTMLTextAreaElement>('#message').focus(), 0);
}
function renderPaper(id: string) {
  const paper = getPaper(id);
  if (!paper) return;
  $('#paper-detail').innerHTML = `<div class="dialog-header"><span>${t('details')}</span><button class="icon-button" data-close-dialog aria-label="${t('close')}" autofocus>✕</button></div><div class="paper-meta"><span class="venue-badge">${escapeHTML(paper.venueShort)} ${paper.year}</span><span>${t(paper.topic)}</span></div><h2 id="paper-dialog-title" class="dialog-title">${escapeHTML(paper.title)}</h2><div class="detail-label">${t('authors')}</div><div class="detail-authors">${authorMarkup(paper.authors)}</div>${paper.authors.includes('*') ? `<p class="section-footnote">${t('equal')}</p>` : ''}<div class="detail-label">${t('venue')}</div><div class="detail-venue">${escapeHTML(paper.venue)}, ${paper.year}</div><div class="detail-links">${external(paper.links.paper,t('openPaper'))}${external(paper.links.code,t('openCode'))}</div><section class="detail-ask"><strong>${t('detailTitle')}</strong><p>${t('detailDescription')}</p><button data-ask="${paper.id}">${t('askPaper')} →</button></section>`;
}
function closePaper() {
  const previous = openPaperId;
  openPaperId = null;
  $<HTMLDialogElement>('#paper-dialog').close();
  if (location.hash.startsWith('#paper/')) { history.replaceState(null, '', '#publications'); }
  if (previous) document.querySelector<HTMLElement>(`[data-paper="${previous}"]`)?.focus();
}
async function sendMessage(retryId?: string) {
  const thread = current;
  if (pending.has(thread.id)) { pending.get(thread.id)?.abort(); return; }
  const retry = retryId ? thread.messages.find((m): m is AssistantMessage => m.role === 'assistant' && m.id === retryId && ['error','stopped'].includes(m.state)) : null;
  if (retryId && !retry) return;
  const message = retry ? retry.prompt : $<HTMLTextAreaElement>('#message').value.trim();
  if (!message || message.length > 2000) return;
  if (!retry) thread.messages.push({ id: crypto.randomUUID(), role:'user', text:message });
  const reply: AssistantMessage = retry || { id:crypto.randomUUID(), role:'assistant', text:'', prompt:message, paperId:thread.paperId, state:'pending' };
  reply.state = 'pending'; reply.text = '';
  if (!retry) thread.messages.push(reply);
  if (thread.topic === 'chat' && !thread.title) thread.title = message.slice(0,70);
  thread.draft = ''; $<HTMLTextAreaElement>('#message').value = '';
  const controller = new AbortController();
  pending.set(thread.id, controller);
  // A timeout makes network failures recoverable even when the remote server hangs.
  const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 15000);
  renderMessages(); renderNavigation(); updateComposer(); scrollToLatest(); announce(t('thinking'));
  try {
    const result = await requestReply({ message, language, topic:thread.topic, paperId:reply.paperId, signal:controller.signal }, siteConfig.chatEndpoint);
    controller.signal.throwIfAborted();
    reply.text = result.text; reply.state = 'done';
    if (current === thread) announce(t('simulated') + ': ' + result.text);
  } catch (error) {
    reply.state = error instanceof Error && error.name === 'AbortError' ? 'stopped' : 'error';
    if (current === thread) announce(t(reply.state === 'stopped' ? 'stopped' : 'failed'));
  } finally {
    clearTimeout(timeout); pending.delete(thread.id);
    if (current === thread) { renderMessages(); updateComposer(); scrollToLatest(); $<HTMLTextAreaElement>('#message').focus(); }
  }
}

$('#chat-form').addEventListener('submit', event => { event.preventDefault(); sendMessage(); });
$<HTMLTextAreaElement>('#message').addEventListener('input', () => { current.draft = $<HTMLTextAreaElement>('#message').value; updateComposer(); });
$<HTMLTextAreaElement>('#message').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!pending.has(current.id)) sendMessage(); }
});
$('#new-chat').addEventListener('click', () => newConversation());
$('#theme-toggle').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; savePreference('fz-theme', theme); current.scroll=$('#scroll-area').scrollTop; render(); });
$('#language-toggle').addEventListener('click', () => { current.scroll=$('#scroll-area').scrollTop; current.draft=$<HTMLTextAreaElement>('#message').value; language=language==='en'?'zh':'en'; savePreference('fz-language',language); render(); });
$('#menu-toggle').addEventListener('click', () => setMenu(!$('#sidebar').classList.contains('open')));
$('#sidebar-scrim').addEventListener('click', () => { setMenu(false); $('#menu-toggle').focus(); });
matchMedia('(max-width: 760px)').addEventListener('change', () => setMenu(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('#sidebar').classList.contains('open')) { setMenu(false); $('#menu-toggle').focus(); }
  if (event.key === 'Tab' && $('#sidebar').classList.contains('open') && matchMedia('(max-width: 760px)').matches) {
    const focusable = [...$('#sidebar').querySelectorAll<HTMLElement>('a,button'), $('#menu-toggle')];
    const first=focusable[0], last=focusable.at(-1);
    if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
  }
});
$<HTMLDialogElement>('#paper-dialog').addEventListener('cancel', event => { event.preventDefault(); closePaper(); });
$<HTMLDialogElement>('#paper-dialog').addEventListener('click', event => { if (event.target === $<HTMLDialogElement>('#paper-dialog')) { const bounds=$<HTMLDialogElement>('#paper-dialog').getBoundingClientRect(); if(event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePaper(); } });
document.addEventListener('click', async event => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button) return;
  if (button.dataset.paper) { location.hash=`paper/${button.dataset.paper}`; }
  if (button.dataset.ask) { const paper=getPaper(button.dataset.ask); if(paper){ closePaper(); newConversation(paper); } }
  if ('closeDialog' in button.dataset) closePaper();
  if (button.dataset.filterTopic) { filters={query:'',year:'',topic:button.dataset.filterTopic,category:''}; if(location.hash==='#publications'){render();} else {location.hash='publications';} }
  if ('clearFilters' in button.dataset) { filters={query:'',year:'',topic:'',category:''}; current.scroll=$('#scroll-area').scrollTop; render(); $('#paper-search')?.focus(); }
  if ('reload' in button.dataset) location.reload();
  if (button.id === 'remove-context') { current.paperId=null; updateComposer(); $<HTMLTextAreaElement>('#message').focus(); }
  if (button.dataset.retry) sendMessage(button.dataset.retry);
  if (button.dataset.copy) {
    const message=current.messages.find(m=>m.id===button.dataset.copy);
    if(message) { try { await navigator.clipboard.writeText(message.text); announce(t('copied')); button.textContent=t('copied'); } catch { announce(t('copyFailed')); } }
  }
});
document.addEventListener('input', event => { const target = event.target; if(target instanceof HTMLInputElement && target.id==='paper-search') { filters.query=target.value; renderFilters(); } });
document.addEventListener('change', event => { const target = event.target; if(target instanceof HTMLSelectElement && target.id.startsWith('filter-')) { const key=target.id.slice(7); if(key==='year'||key==='topic'||key==='category'){filters[key]=target.value;renderFilters();} } });
window.addEventListener('hashchange', route);
try {
  const response = await fetch('data/publications.json');
  if (!response.ok) throw new Error('Could not load publications');
  publications = parsePublications(await response.json());
} catch { loadFailed = true; }
route();
