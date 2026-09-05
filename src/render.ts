import { copy, suggestions, type CopyKey } from './content.js';
import { filterPublications } from './state.js';
import {
  topics, categories, researchTopics,
  type Category, type Content, type Link, type Publication, type Page, type ResearchTopic, type SiteData, type Thread,
} from './types.js';

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHTML = (value: unknown): string => String(value).replace(/[&<>"']/g, char => entities[char]);
export const authorMarkup = (authors: string): string => escapeHTML(authors).replace(/Fuxiang Zhang\*?/g, name => `<strong>${name}</strong>`);
export function external(url: string | undefined, label: string, className = ''): string {
  return /^https?:\/\//i.test(url || '') ? `<a${className ? ` class="${className}"` : ''} href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : '';
}
/** Escapes text from site data and turns [label](https://…) into links; everything else stays plain text. */
export function inline(text: string): string {
  return escapeHTML(text).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label: string, url: string) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
}
const bracketLinks = (links: Link[] | undefined, className: string) => links?.length
  ? `<p class="${className}">${links.map(link => external(link.url, `[${escapeHTML(link.label)}]`)).join(' ')}</p>` : '';
const t = (key: CopyKey): string => copy[key];

const icons: Record<string, string> = {
  moon:'<path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  send:'<path d="M12 19V5m-6 6 6-6 6 6"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  external:'<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  code:'<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  chat:'<path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/>',
};
export const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
/** Filled brand glyphs for the sidebar quick links, keyed by link label (Simple Icons, CC0). */
const brandIcons: Record<string, string> = {
  email:'M2 5.5A2.5 2.5 0 0 1 4.5 3h15A2.5 2.5 0 0 1 22 5.5v.4l-10 6.25L2 5.9zM2 8.25l10 6.25 10-6.25V18.5a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5z',
  github:'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  scholar:'M5.242 13.769 0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z',
  linkedin:'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  x:'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
};
const brandIcon = (name: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${brandIcons[name]}" fill="currentColor"/></svg>`;
const brandFor = (label: string) => {
  const key = label.toLowerCase().replace(/[^a-z]/g, '');
  return key === 'x' || key === 'twitter' ? 'x' : key === 'googlescholar' ? 'scholar' : key in brandIcons ? key : '';
};
/** Abstract mark shown beside every reply; the photo stays in the Bio message. */
const botMark = '<div class="bot-mark" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.7 5.6 4.4 9.3 10 10-5.6.7-9.3 4.4-10 10-.7-5.6-4.4-9.3-10-10 5.6-.7 9.3-4.4 10-10z" fill="currentColor"/></svg></div>';

export type SectionId = 'education' | 'experience' | 'service' | 'awards';
/** One CV entry: period in the left column, everything else in the right column. */
const cvRow = (date: string | undefined, title: string, subtitle: string, description = '', extra = '') => `<article class="cv-row">
    <div class="cv-period">${escapeHTML(date ?? '')}</div>
    <div class="cv-body">
    <h3>${escapeHTML(title)}</h3>
    <p class="cv-subtitle">${escapeHTML(subtitle)}</p>${description ? `
    <p>${inline(description)}</p>` : ''}${extra}
    </div>
  </article>`;
const withLocation = (role: string, location?: string) => location ? `${role} · ${location}` : role;

/** Shared CV sections for the Experiences and Miscellaneous sessions, rendered from site data. */
export function renderJourney(site: SiteData, sectionIds: SectionId[]) {
  const bodies: Record<SectionId, () => string> = {
    education: () => site.education.map(entry =>
      cvRow(entry.period, entry.institution, withLocation(entry.degree, entry.location), entry.description, bracketLinks(entry.links, 'cv-links'))).join(''),
    experience: () => site.experience.map(entry => {
      const contributions = entry.contributions?.length ? `<ul class="cv-contributions">${entry.contributions.map(item => `<li>${item.paperId
        ? `<button class="cv-paper-link" data-paper="${escapeHTML(item.paperId)}">${escapeHTML(item.title)}</button>`
        : `<strong>${escapeHTML(item.title)}</strong>`}<span>${inline(item.description)}</span></li>`).join('')}</ul>` : '';
      return cvRow(entry.period, entry.organization, withLocation(entry.role, entry.location), entry.description, contributions + bracketLinks(entry.links, 'cv-links'));
    }).join(''),
    service: () => site.service.map(entry => cvRow(entry.period, entry.venue, entry.role)).join(''),
    awards: () => site.awards.map(entry => cvRow(entry.period, entry.title, entry.issuer)).join(''),
  };
  return sectionIds.map(id => `<section class="cv-section" aria-labelledby="journey-${id}">
      <h2 id="journey-${id}">${t(id)}</h2>
      <div class="cv-list">${bodies[id]()}</div>
      </section>`).join('');
}

const paperTitle = (paper: Publication) => escapeHTML(paper.title);
const paperLinks = (paper: Publication) =>
  [external(paper.links.paper, `[${t('openPaper')}]`), external(paper.links.code, `[${t('openCode')}]`)].filter(Boolean).join(' ');
const topicName = (site: SiteData, topic: ResearchTopic) => site.research.find(interest => interest.id === topic)?.shortName ?? topic;
const byYear = (a: Publication, b: Publication) => b.year - a.year;
const equalNote = (papers: Publication[]) => papers.some(paper => paper.authors.includes('*')) ? `<p class="footnote">${t('equal')}</p>` : '';
const linkIcon = icon('external'), codeIcon = icon('code'), chatIcon = icon('chat');

interface RenderContext {
  site: SiteData;
  loadFailed: boolean;
}

/** All templates are pure: the controller owns DOM updates and interaction state. */
export function createRenderer({ site, loadFailed }: RenderContext) {
  const { profile, publications } = site;
  const chip = (label: string, attributes: string) => `<button class="chip" ${attributes}>${label}</button>`;
  const showChip = (kind: Content['kind'], label: string, extra = '') => chip(`${label} →`, `data-show="${kind}"${extra}`);
  const opening = (body: string) => `<div class="message bot-message opening">${botMark}<div class="message-body">${body}</div></div>`;
  /** One publication as a card: full author list, venue and links. Nothing is abbreviated. */
  function paperCard(paper: Publication) {
    return `<article class="paper">
      <div class="paper-meta"><span class="paper-venue-tag">${escapeHTML(paper.venueShort)}</span><span class="paper-year">${paper.year}</span><span class="paper-topic">${escapeHTML(topicName(site, paper.topic))}</span></div>
      <button class="paper-title" data-paper="${escapeHTML(paper.id)}">${paperTitle(paper)}</button>
      <p class="paper-authors">${authorMarkup(paper.authors)}</p>
      <div class="paper-actions">${[
        external(paper.links.paper, `${linkIcon}${t('openPaper')}`, 'paper-action'),
        external(paper.links.code, `${codeIcon}${t('openCode')}`, 'paper-action'),
      ].filter(Boolean).join('')}<button class="paper-action ask-paper" data-ask="${escapeHTML(paper.id)}">${chatIcon}${t('askPaper')}</button></div>
      </article>`;
  }
  function loadError() {
    return `<div class="empty-results">
      <p>${t('loadError')}</p>
      <button class="text-link" data-reload>${t('reload')}</button> · <a href="reading.html">${t('readingFallback')}</a>
      </div>`;
  }

  const relatedLink = (topic?: ResearchTopic) => topic ? ` <button class="text-link" data-show="publications" data-topic="${topic}">${t('relatedPapers')} →</button>` : '';
  /* Opening messages: one screen of content per session; the full content is appended as replies. */
  function bioOpening() {
    if (loadFailed) return loadError();
    return `<p class="greeting">${t('greeting')} <strong>${escapeHTML(profile.name)}</strong>.</p>
      ${profile.bio.map(paragraph => `<p>${inline(paragraph)}</p>`).join('')}
      <div class="chips">${showChip('research', t('research'))}${showChip('publications', t('publications'))}</div>`;
  }
  const interests = () => site.interests.map(interest => `<section class="interest">
      <h3>${escapeHTML(interest.title)}</h3>
      <p>${inline(interest.description)}${relatedLink(interest.topic)}</p>${interest.points?.length ? `
      <ul class="interest-points">${interest.points.map(point => `<li><strong>${escapeHTML(point.title)}</strong>: ${inline(point.description)}${relatedLink(point.topic)}</li>`).join('')}</ul>` : ''}
      </section>`).join('');
  function researchOpening() {
    if (loadFailed) return loadError();
    return `<p>${t('researchOpening')}</p>${interests()}
      <div class="chips">${showChip('publications', t('publications'))}</div>`;
  }
  function publicationsOpening() {
    if (loadFailed) return loadError();
    const groups = categories.map(category => {
      const papers = publications.filter(paper => paper.category === category).sort(byYear);
      return papers.length ? `<section class="group">
        <h3 class="group-title">${t(category)} <span class="content-count">${papers.length}</span></h3>
        <div class="paper-list">${papersList(papers)}</div>
        </section>` : '';
    });
    return `<p>${t('publicationsOpening')}</p>${groups.join('')}${equalNote(publications)}`;
  }
  function experiencesOpening() {
    if (loadFailed) return loadError();
    return `<p>${t('experiencesOpening')}</p>${renderJourney(site, ['experience', 'education'])}`;
  }
  function miscOpening() {
    if (loadFailed) return loadError();
    return `<p>${t('miscOpening')}</p>${renderJourney(site, ['service', 'awards'])}`;
  }
  function chatOpening() {
    return `<p>${t('chatOpening')}</p>
      <div class="chips">${suggestions.map(text => chip(escapeHTML(text), `data-suggest="${escapeHTML(text)}"`)).join('')}</div>`;
  }

  /* Content replies: the complete content behind each opening message, appended to the conversation. */
  function publicationsContent(content: Extract<Content, { kind: 'publications' }>) {
    const { category, topic } = content;
    const papers = filterPublications(publications, { query: '', year: '', category: category ?? '', topic: topic ?? '' });
    const title = category ? t(category) : topic ? topicName(site, topic) : t('openAll');
    return `<h3 class="content-title">${escapeHTML(title)} <span class="content-count">${papers.length}</span></h3>
      <div class="paper-list">${papersList(papers)}</div>${equalNote(papers)}`;
  }
  function contentBody(content: Content) {
    if (loadFailed) return loadError();
    switch (content.kind) {
      case 'research': return `<p>${t('researchOpening')}</p>${interests()}`;
      case 'publications': return publicationsContent(content);
      case 'paper': {
        const paper = publications.find(paper => paper.id === content.paperId);
        return paper ? paperDetail(paper) : `<p class="empty-results">${t('noResults')}</p>`;
      }
    }
  }
  const papersList = (papers: Publication[]) => papers.length
    ? papers.map(paper => paperCard(paper)).join('')
    : `<p class="empty-results">${t('noResults')}</p>`;

  /** Photo, name and quick links at the top of the sidebar. */
  function profileCard() {
    return `${profile.photo ? `<a href="#bio"><img class="profile-photo" src="${escapeHTML(profile.photo)}" alt="${escapeHTML(profile.name)}" width="56" height="56"></a>` : ''}
      <a class="brand" href="#bio">${escapeHTML(profile.name || 'Fuxiang Zhang')}</a>
      ${profile.position ? `<p class="profile-position">${escapeHTML(profile.position)}</p>` : ''}
      ${profile.email ? `<p class="profile-links">${[
        `<a class="profile-link" href="mailto:${escapeHTML(profile.email)}" aria-label="Email" data-tip="Email">${brandIcon('email')}</a>`,
        ...profile.links.map(link => {
          const brand = brandFor(link.label);
          return external(link.url, brand ? brandIcon(brand) : escapeHTML(link.label), brand ? 'profile-link' : 'profile-link profile-link-text')
            .replace('target="_blank"', `aria-label="${escapeHTML(link.label)}" data-tip="${escapeHTML(link.label)}" target="_blank"`);
        }),
      ].join('')}</p>` : ''}`;
  }
  function messages(thread: Thread) {
    return thread.messages.map(message => {
      const anchor = `id="message-${escapeHTML(message.id)}"`;
      if (message.role === 'user') {
        return `<div class="message user-message" ${anchor}><div class="user-bubble">${escapeHTML(message.text)}</div></div>`;
      }
      if (message.role === 'content') {
        return `<div class="message bot-message content-message" ${anchor}>${botMark}<div class="message-body">${contentBody(message.content)}</div></div>`;
      }
      if (message.state === 'pending') {
        return `<div class="message bot-message" ${anchor}>${botMark}<div class="message-body">
          <div class="thinking" aria-label="${t('thinking')}"><span></span><span></span><span></span></div>
        </div></div>`;
      }
      const retryable = message.state === 'error' || message.state === 'stopped';
      const text = retryable ? t(message.state === 'error' ? 'failed' : 'stopped') : message.text;
      const action = retryable
        ? `<button data-retry="${escapeHTML(message.id)}">${t('retry')}</button>`
        : `<button data-copy="${escapeHTML(message.id)}">${t('copy')}</button>`;
      return `<div class="message bot-message" ${anchor}>${botMark}<div class="message-body">
        <div class="message-text ${message.state === 'error' ? 'message-error' : ''}">${escapeHTML(text)}</div>
        <div class="message-controls"><span class="reply-label">${t('simulated')}</span>${action}</div>
      </div></div>`;
    }).join('');
  }

  function navigation(current: Thread, chats: Thread[]) {
    const main = topics.map(topic => `<a class="nav-item ${current.topic === topic ? 'active' : ''}"
        href="#${topic}" ${current.topic === topic ? 'aria-current="page"' : ''}>${t(topic)}</a>`).join('');
    const recent = chats.slice().reverse().slice(0, 12);
    const history = recent.length ? `<span class="conversations-label">${t('conversations')}</span>${recent.map(thread => {
      const title = escapeHTML(thread.title || t('chatTitleShort'));
      return `<a href="#chat/${escapeHTML(thread.id)}" class="nav-item conversation-item ${current.id === thread.id ? 'active' : ''}"
          ${current.id === thread.id ? 'aria-current="page"' : ''} title="${title}">${title}</a>`;
    }).join('')}` : '';
    return { main, history };
  }

  function paperDetail(paper: Publication) {
    return `<h3 class="detail-title">${paperTitle(paper)}</h3>
      <div class="detail-label">${t('authors')}</div>
      <p class="detail-authors">${authorMarkup(paper.authors)}</p>${paper.authors.includes('*') ? `<p class="footnote">${t('equal')}</p>` : ''}
      <div class="detail-label">${t('venue')}</div>
      <p class="detail-venue"><em>${escapeHTML(paper.venue)}</em>, ${paper.year} · ${escapeHTML(topicName(site, paper.topic))}</p>
      <p class="detail-links">${paperLinks(paper)}</p>
      <p class="detail-ask"><button class="text-link" data-ask="${escapeHTML(paper.id)}">${t('askPaper')} →</button><br><span class="footnote">${t('detailDescription')}</span></p>`;
  }
  function paperContext(paper: Publication | undefined) {
    return paper ? `<span>${t('context')}: ${paperTitle(paper)}</span>
      <button type="button" id="remove-context" aria-label="${t('removeContext')}">×</button>` : '';
  }
  const openings: Record<Page, () => string> = {
    bio: bioOpening, research: researchOpening, publications: publicationsOpening, experiences: experiencesOpening, miscellaneous: miscOpening, chat: chatOpening,
  };
  return {
    /** A conversation started from a session skips the greeting: its first message is the question itself. */
    page: (page: Page, intro = true) => `${intro ? opening(openings[page]()) : ''}<div id="messages" class="messages" aria-label="${t('conversations')}">
      </div>`,
    papers: papersList, messages, navigation, paperDetail, paperContext, profileCard,
  };
}

/** The classic single-page homepage, generated from the same site data at build time. */
export function renderReading(site: SiteData) {
  const { profile } = site;
  const groups: Record<Category, string> = { reports: 'Preprint and Technical Reports', conference: 'Conference Papers', journal: 'Journal Papers' };
  const row = (period: string | undefined, title: string, subtitle: string, description: string, links?: Link[]) => `
  <div class="cv-item">
    <div>
      <h5>${escapeHTML(title)}</h5>
      <p>${escapeHTML(subtitle)}</p>
      <p>${inline(description)}</p>${links?.length ? `
      <p class="links">${links.map(link => external(link.url, `[${escapeHTML(link.label)}]`)).join(' ')}</p>` : ''}
    </div>
    <span class="cv-period">${escapeHTML(period ?? '')}</span>
  </div>`;
  const paper = (p: Publication) => `
  <div class="publication-item" id="${escapeHTML(p.id)}">
    <h5>${paperTitle(p)}</h5>
    <p>
      ${authorMarkup(p.authors)}<br>
      <em>${escapeHTML(p.venue)}</em>, ${p.year}<br>
      <span class="links">${[external(p.links.paper, '[Paper]'), external(p.links.code, '[Code]')].filter(Boolean).join(' ')}</span>
    </p>
  </div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(profile.name)} | Homepage</title>
  <meta name="description" content="${escapeHTML(profile.name)}’s academic homepage: biography, research interests, experience, and complete publication list.">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px auto; padding: 0 20px; background: #f5f7fa; color: #333; max-width: 1200px; }
    .container { display: flex; flex-wrap: wrap; }
    .left-panel { flex: 1; min-width: 300px; padding-right: 40px; text-align: center; }
    .right-panel { flex: 3; min-width: 600px; }
    .profile-pic { width: 100%; max-width: 180px; border-radius: 10px; }
    h1, h2, h3 { color: #2c3e50; }
    h1 { font-size: 2.2em; }
    h2 { margin: 42px 0 22px; font-size: 1.9em; font-weight: 700; color: #1c2e46; display: flex; align-items: center; gap: 16px; letter-spacing: 0.01em; }
    h2::after { content: ''; flex: 1; height: 2px; background: linear-gradient(90deg, rgba(41, 128, 185, 0.4), rgba(41, 128, 185, 0)); border-radius: 1px; }
    h3 { position: relative; margin: 34px 0 18px; font-size: 1.28em; font-weight: 600; color: #1f3d5e; letter-spacing: 0.03em; }
    h3::after { content: ''; position: absolute; left: 0; bottom: -10px; width: 64px; height: 3px; background: linear-gradient(90deg, #2980b9, #6bc4ff); border-radius: 2px; }
    a { color: #2980b9; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .links a { margin-right: 10px; }
    .back-link { display: inline-block; margin-bottom: 12px; font-size: 0.9em; }
    .publication-item, .cv-item { margin-bottom: 1.5em; line-height: 1.4; }
    .publication-item h5, .cv-item h5 { margin: 0 0 0.2em 0; font-size: 1.1em; }
    .publication-item h5 a { color: #333; }
    .publication-item p, .cv-item p { margin: 0; color: #555; }
    .publication-item .links a, .cv-item .links a { margin-right: 8px; font-size: 0.9em; }
    .cv-item { display: flex; justify-content: space-between; gap: 24px; }
    .cv-period { flex: none; color: #777; font-size: 0.95em; white-space: nowrap; }
    .cv-item ul { margin: 0.5em 0 0; padding-left: 20px; color: #555; }
    .cv-item li { margin-bottom: 0.35em; }
    @media (max-width: 700px) { .right-panel { min-width: 0; } .cv-item { flex-direction: column; gap: 4px; } }
  </style>
</head>
<body>

<div class="container">
  <div class="left-panel">
    <img src="${escapeHTML(profile.photo)}" alt="${escapeHTML(profile.name)}" class="profile-pic"/>
    <h1>${escapeHTML(profile.name)}</h1>
    <p>${escapeHTML(profile.position)}</p>
    <div class="links">
      <p><a href="mailto:${escapeHTML(profile.email)}">Email</a></p>${profile.links.map(link => `
      <p>${external(link.url, escapeHTML(link.label))}</p>`).join('')}
    </div>
    <p><a class="back-link" href="index.html">Interactive homepage →</a></p>
  </div>

<div class="right-panel">
<h2>About Me</h2>${profile.bio.map(paragraph => `
<p>${inline(paragraph)}</p>`).join('')}

<h2>Research Interests</h2>${site.interests.map(interest => `
<h3>${escapeHTML(interest.title)}</h3>
<p>${inline(interest.description)}</p>${interest.points?.length ? `
<ul>${interest.points.map(point => `
  <li><strong>${escapeHTML(point.title)}</strong>: ${inline(point.description)}</li>`).join('')}
</ul>` : ''}`).join('')}

<h2>Education</h2>${site.education.map(entry => row(entry.period, entry.institution, withLocation(entry.degree, entry.location), entry.description, entry.links)).join('')}

<h2>Experience</h2>${site.experience.map(entry => `
  <div class="cv-item">
    <div>
      <h5>${escapeHTML(entry.organization)}</h5>
      <p>${escapeHTML(withLocation(entry.role, entry.location))}</p>
      <p>${inline(entry.description)}</p>${entry.contributions?.length ? `
      <ul>${entry.contributions.map(item => `
        <li><strong>${item.paperId ? `<a href="#${escapeHTML(item.paperId)}">${escapeHTML(item.title)}</a>` : escapeHTML(item.title)}</strong> — ${inline(item.description)}</li>`).join('')}
      </ul>` : ''}${entry.links?.length ? `
      <p class="links">${entry.links.map(link => external(link.url, `[${escapeHTML(link.label)}]`)).join(' ')}</p>` : ''}
    </div>
    <span class="cv-period">${escapeHTML(entry.period)}</span>
  </div>`).join('')}

<h2>Publications</h2>${categories.map(category => `

<h3>${groups[category]}</h3>${site.publications.filter(p => p.category === category).map(paper).join('')}`).join('')}

<p><em>* denotes equal contribution</em></p>

<h2>Academic Service</h2>${site.service.map(entry => `
  <div class="cv-item">
    <div><h5>${escapeHTML(entry.venue)}</h5><p>${escapeHTML(entry.role)}</p></div>
    <span class="cv-period">${escapeHTML(entry.period ?? '')}</span>
  </div>`).join('')}

<h2>Honors &amp; Awards</h2>${site.awards.map(entry => `
  <div class="cv-item">
    <div><h5>${escapeHTML(entry.title)}</h5><p>${escapeHTML(entry.issuer)}</p></div>
    <span class="cv-period">${escapeHTML(entry.period)}</span>
  </div>`).join('')}
</div>
</div>

<footer>
    <p style="text-align: center; margin-top: 30px; color: #777;">&copy; ${new Date().getFullYear()} ${escapeHTML(profile.name)}</p>
</footer>

</body>
</html>
`;
}
