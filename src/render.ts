import { journeySections, translations, type CopyKey } from './content.js';
import {
  topics, researchTopics, categories,
  type Language, type Localized, type SectionId, type Contribution,
  type Experience, type Publication, type Filters, type Page, type Thread,
} from './types.js';

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHTML = (value: unknown): string => String(value).replace(/[&<>"']/g, char => entities[char]);
export const authorMarkup = (authors: string): string => escapeHTML(authors).replace(/Fuxiang Zhang\*?/g, name => `<strong>${name}</strong>`);
export function external(url: string | undefined, label: string, className = ''): string {
  return /^https?:\/\//i.test(url || '') ? `<a class="${className}" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : '';
}

const icons: Record<string, string> = {
  overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  research:'<circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3M16 8l3-3"/>',
  publications:'<path d="M5 3h11l3 3v15H5zM9 3v6h6M9 13h6m-6 4h6"/>',
  miscellaneous:'<circle cx="5" cy="4" r="2"/><path d="M7 4h5a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h10m-3-3 3 3-3 3"/>',
  work:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12a24 24 0 0 0 18 0M12 11v4"/>',
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  moon:'<path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  chat:'<path d="M21 11a8 8 0 0 1-8 8H6l-3 3V11a9 9 0 0 1 18 0Z"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v12h5"/>',
};
export const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.chat}</svg>`;

/** Shared content for Work, Miscellaneous, and the complete static reading view. */
export function renderJourney(language: Language = 'en', reading = false, sectionIds: SectionId[] | null = null) {
  const text = (value: string | Localized | undefined) => escapeHTML(typeof value === 'string' ? value : value?.[language] || value?.en || '');
  const renderBullet = (bullet: Contribution) => {
    const title = bullet.paperId
      ? reading
        ? `<a class="journey-paper-link" href="#${escapeHTML(bullet.paperId)}">${text(bullet.title)}</a>`
        : `<button class="journey-paper-link" data-paper="${escapeHTML(bullet.paperId)}">${text(bullet.title)}</button>`
      : `<strong>${text(bullet.title)}</strong>`;
    return `<li>${title}<span>${text(bullet.description)}</span>
      </li>`;
  };
  const renderEntry = (entry: Experience, timeline: boolean) => `<article class="${timeline ? 'timeline-item' : 'journey-list-item'}">
    ${entry.date ? `<div class="timeline-date">${text(entry.date)}</div>` : ''}
    <h3>${text(entry.title)}</h3>
    ${entry.role ? `<p class="journey-role">${text(entry.role)}</p>` : ''}
    <p>${text(entry.description)}</p>
    ${entry.bullets ? `<ul class="journey-contributions">${entry.bullets.map(renderBullet).join('')}</ul>` : ''}
    ${entry.links ? `<div class="journey-links">${entry.links.filter(link=>/^https?:\/\//i.test(link.url)).map(link=>`<a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${text(link.label)} ↗</a>`).join('')}</div>` : ''}
  </article>`;
  return journeySections.filter(section => sectionIds === null || sectionIds.includes(section.id)).map(section => `<section class="journey-section" aria-labelledby="journey-${section.id}">
      <h2 id="journey-${section.id}">${text(section.title)}</h2>
      <div class="${section.type === 'timeline' ? 'timeline' : 'journey-list'}">${section.entries.map(entry=>renderEntry(entry,section.type==='timeline')).join('')}</div>
      </section>`).join('');
}

const paperTitle = (paper: Publication) => escapeHTML(paper.title);
const paperLinks = (paper: Publication, paperLabel = 'Paper ↗', codeLabel = 'Code ↗') =>
  external(paper.links.paper, paperLabel) + external(paper.links.code, codeLabel);

interface RenderContext {
  language: Language;
  publications: Publication[];
  filters: Filters;
  loadFailed: boolean;
}

/** All templates are pure: the controller owns DOM updates and interaction state. */
export function createRenderer({ language, publications, filters, loadFailed }: RenderContext) {
  const t = (key: CopyKey): string => translations[language][key];
  const getPaper = (id: string) => publications.find(paper => paper.id === id);
  function byline(label: CopyKey = 'curated') {
    return `<div class="assistant-byline">
      <span class="assistant-avatar" aria-hidden="true">${icon('chat')}</span>
      <span>${t('assistantName')}</span>
      <span class="byline-tag">${t(label)}</span>
      </div>`;
  }
  function paperMeta(paper: Publication) {
    return `<div class="paper-meta">
      <span class="venue-badge">${escapeHTML(paper.venueShort)} ${paper.year}</span>
      <span>${t(paper.topic)}</span>
    </div>`;
  }
  function suggestions(links: [string, CopyKey][]) {
    return `<div class="suggestions">${links.map(([href, label]) =>
      `<a class="suggestion" href="${escapeHTML(href)}">${t(label)} ${icon('arrow')}</a>`).join('')}</div>`;
  }
  function paperCard(paper: Publication, featured = false) {
    const authorList = paper.authors.split(',');
    const excerpt = authorList.length > 6 ? `${authorList.slice(0, 4).join(',')}, …` : paper.authors;
    return `<article class="paper-card">
      ${paperMeta(paper)}
      <button class="paper-title" data-paper="${escapeHTML(paper.id)}">${paperTitle(paper)}</button>
      ${featured ? '' : `<p class="paper-authors">${authorMarkup(excerpt)}${!excerpt.includes('Fuxiang Zhang') ? ' · <strong>Fuxiang Zhang</strong>' : ''}</p>`}
      <div class="paper-footer">
      <span class="paper-links">${paperLinks(paper)}</span>
      <button class="ask-paper" data-ask="${escapeHTML(paper.id)}">${t('askPaper')} ${icon('arrow')}</button>
      </div>
      </article>`;
  }
  function overview() {
    const selected = ['paper-6', 'paper-7', 'paper-9'].map(getPaper).filter((p): p is Publication => p !== undefined);
    return `${byline('introduction')}<h1 class="hero-title">${t('hero')}</h1>
      <p class="intro">${t('intro')}</p>
      <div class="interest-tags">${researchTopics.map(topic => `<button class="interest-tag" data-filter-topic="${topic}">${t(topic)}</button>`).join('')}</div>
      ${suggestions([['#research', 'exploreResearch'], ['#publications', 'findPaper'], ['mailto:zfx.agi@gmail.com', 'contact']])}
      <div class="section-heading">
      <h2>${t('selected')}</h2>
      <a class="text-button" href="#publications">${t('allPapers')}</a>
      </div>
      ${loadFailed ? loadError() : `<div class="paper-list featured">${selected.map(p => paperCard(p, true)).join('')}</div>
      <p class="section-footnote">${t('latestNote')}</p>`}`;
  }
  function research() {
    return `${byline()}<h1 class="page-title">${t('researchTitle')}</h1>
      <p class="page-description">${t('researchDescription')}</p>
      ${researchTopics.map((topic, index) => `<section class="research-card">
      <div class="research-card-header">
      <span class="research-number">0${index + 1}</span>
      <h2>${t(topic)}</h2>
      </div>
      <p>${t(`${topic}Description`)}</p>
      <button class="text-button" data-filter-topic="${topic}">${t('relatedPapers')} ${icon('arrow')}</button>
      </section>`).join('')}`;
  }
  function loadError() {
    return `<div class="empty-results">
      <p>${t('loadError')}</p>
      <button class="text-button" data-reload>${t('reload')}</button> · <a href="reading.html">${t('readingFallback')}</a>
      </div>`;
  }
  function publicationsView() {
    const years = [...new Set(publications.map(p => p.year))].sort((a, b) => b - a);
    const select = (key: Exclude<keyof Filters, 'query'>, all: CopyKey, values: [string | number, string | number][]) => `<select id="filter-${key}" aria-label="${t(all)}">
      <option value="">${t(all)}</option>${values.map(([value, label]) => `<option value="${value}" ${String(filters[key]) === String(value) ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
    return `${byline()}<h1 class="page-title">${t('publications')}<span class="publication-total">${publications.length}</span>
      </h1>
      <p class="page-description">${t('publicationsDescription')}</p>
      ${loadFailed ? loadError() : `<div class="filter-bar">
      <label class="search-field">${icon('search')}<span class="sr-only">${t('search')}</span>
      <input type="search" id="paper-search" placeholder="${t('search')}" value="${escapeHTML(filters.query)}">
      </label>
      ${select('year', 'allYears', years.map(year => [year, year]))}
      ${select('topic', 'allTopics', researchTopics.map(topic => [topic, t(topic)]))}
      ${select('category', 'allTypes', categories.map(category => [category, t(category)]))}</div>
      <div class="filter-summary">
      <span id="filter-count" aria-live="polite"></span>
      <button class="text-button" data-clear-filters>${t('clear')}</button>
      </div>
      <div id="publication-results" class="paper-list"></div>
      <p class="section-footnote">${t('equal')}</p>`}`;
  }
  function cvPage(page: 'work' | 'miscellaneous') {
    const sections: SectionId[] = page === 'work' ? ['experience'] : ['education', 'service', 'awards'];
    return `${byline()}<h1 class="page-title">${t(`${page}Title`)}</h1>
      <p class="page-description">${t(`${page}Description`)}</p>
      ${renderJourney(language, false, sections)}
      ${page === 'work' ? '' : `<section class="contact-card">
      <div>
      <h2>${t('contactTitle')}</h2>
      <p>${t('contactDescription')}</p>
      </div>
      <a href="mailto:zfx.agi@gmail.com">Email Fuxiang ↗</a>
      </section>`}`;
  }
  function chatIntro() {
    return `<div class="chat-intro">${byline('introduction')}<h1 class="hero-title">${t('chatTitle')}</h1>
      <p class="intro">${t('chatDescription')}</p>
      ${suggestions([['#research', 'exploreResearch'], ['#publications', 'findPaper'], ['#miscellaneous', 'miscellaneous']])}
      </div>`;
  }
  function messages(thread: Thread) {
    return thread.messages.map(message => {
      if (message.role === 'user') {
        return `<div class="message user-message"><div class="user-bubble">${escapeHTML(message.text)}</div></div>`;
      }
      if (message.state === 'pending') {
        return `<div class="message bot-message">${byline('simulated')}
          <div class="thinking" aria-label="${t('thinking')}"><span></span><span></span><span></span></div>
        </div>`;
      }
      const retryable = message.state === 'error' || message.state === 'stopped';
      const text = retryable ? t(message.state === 'error' ? 'failed' : 'stopped') : message.text;
      const action = retryable
        ? `<button data-retry="${escapeHTML(message.id)}">${t('retry')} ↗</button>`
        : `<button data-copy="${escapeHTML(message.id)}">${icon('copy')}${t('copy')}</button>`;
      return `<div class="message bot-message">${byline('simulated')}
        <div class="message-text ${message.state === 'error' ? 'message-error' : ''}">${escapeHTML(text)}</div>
        <div class="message-controls">${action}</div>
      </div>`;
    }).join('');
  }

  function navigation(current: Thread, chats: Thread[]) {
    const main = topics.map(topic => `<a class="nav-item ${current.topic === topic ? 'active' : ''}"
        href="#${topic}" ${current.topic === topic ? 'aria-current="page"' : ''}>
        ${icon(topic)}<span>${t(topic)}</span>
        ${topic === 'publications' ? `<span class="nav-count">${publications.length}</span>` : ''}
      </a>`).join('');
    const recent = chats.slice().reverse().slice(0, 8);
    const history = recent.length ? recent.map(thread => {
      const title = escapeHTML(thread.title || t('chatTitleShort'));
      return `<a href="#chat/${escapeHTML(thread.id)}" class="recent-item ${current.id === thread.id ? 'active' : ''}"
          ${current.id === thread.id ? 'aria-current="page"' : ''} title="${title}">
          ${icon('chat')}<span>${title}</span>
        </a>`;
    }).join('') : `<p class="recent-empty">${t('recentEmpty')}</p>`;
    return { main, history };
  }

  function paperDetail(paper: Publication) {
    return `<div class="dialog-header">
      <span>${t('details')}</span>
      <button class="icon-button" data-close-dialog aria-label="${t('close')}" autofocus>✕</button>
      </div>
      ${paperMeta(paper)}
      <h2 id="paper-dialog-title" class="dialog-title">${paperTitle(paper)}</h2>
      <div class="detail-label">${t('authors')}</div>
      <div class="detail-authors">${authorMarkup(paper.authors)}</div>${paper.authors.includes('*') ? `<p class="section-footnote">${t('equal')}</p>` : ''}<div class="detail-label">${t('venue')}</div>
      <div class="detail-venue">${escapeHTML(paper.venue)}, ${paper.year}</div>
      <div class="detail-links">${paperLinks(paper, t('openPaper'), t('openCode'))}</div>
      <section class="detail-ask">
      <strong>${t('detailTitle')}</strong>
      <p>${t('detailDescription')}</p>
      <button data-ask="${escapeHTML(paper.id)}">${t('askPaper')} →</button>
      </section>`;
  }
  function paperContext(paper: Publication | undefined) {
    return paper ? `<span>${t('context')}: ${paperTitle(paper)}</span>
      <button type="button" id="remove-context" aria-label="${t('removeContext')}">×</button>` : '';
  }
  const pages: Record<Page, () => string> = {
    overview, research, publications: publicationsView,
    work: () => cvPage('work'), miscellaneous: () => cvPage('miscellaneous'), chat: chatIntro,
  };
  return {
    page: (page: Page) => `${pages[page]()}<div id="messages" class="messages" aria-label="${t('newChat')}">
      </div>`,
    papers: (papers: Publication[]) => papers.length
      ? papers.map(paper => paperCard(paper)).join('')
      : `<p class="empty-results">${t('noResults')}</p>`,
    messages, navigation, paperDetail, paperContext,
  };
}

export function renderReading(papers: Publication[]) {
  const groups = { reports:'Preprints, technical reports & workshops', conference:'Conference papers', journal:'Journal papers' };
  return `<!DOCTYPE html>
  <html lang="en">
      <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Fuxiang Zhang · Academic homepage</title>
      <meta name="description" content="Fuxiang Zhang’s academic biography and complete publication list. Large language models, reinforcement learning, and multi-agent reinforcement learning.">
      <link rel="stylesheet" href="styles.css">
      <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
      </head>
  <body>
      <main class="reading-page">
      <a class="back-to-chat inline-link" href="index.html">← Back to the research space</a>
      <img class="reading-photo" src="assets/Photo.JPG" alt="Fuxiang Zhang">
      <h1>Fuxiang Zhang</h1>
  <p>${translations.en.intro}</p>
  <div class="social-links">
      <a href="mailto:zfx.agi@gmail.com">Email ↗</a>${external('https://github.com/mansicer','GitHub ↗')}${external('https://scholar.google.com/citations?user=GZRrWXAAAAAJ','Google Scholar ↗')}${external('https://www.linkedin.com/in/fuxiang-zhang-2b7bb418a/','LinkedIn ↗')}</div>
  <h2>Research interests</h2>
      <p>Large Language Models · Reinforcement Learning · Multi-Agent Reinforcement Learning</p>
  ${renderJourney('en', true)}
  ${Object.entries(groups).map(([category, title]) => `<section>
      <h2>${title}</h2>${papers.filter(p=>p.category===category).map(p=>`<article class="paper-card" id="${escapeHTML(p.id)}">
      <h3>${paperTitle(p)}</h3>
      <p class="paper-authors">${authorMarkup(p.authors)}</p>
      <p class="paper-authors">
      <em>${escapeHTML(p.venue)}</em>, ${p.year}</p>
      <div class="paper-links">${paperLinks(p)}</div>
      </article>`).join('')}</section>`).join('')}
  <p class="section-footnote">* denotes equal contribution.</p>
      <footer>
      <p class="section-footnote">© ${new Date().getFullYear()} Fuxiang Zhang</p>
      </footer>
      </main>
      </body>
      </html>\n`;
}
