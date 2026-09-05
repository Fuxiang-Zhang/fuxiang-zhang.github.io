import { isOfftopicReply, MAX_PAPER_CARDS, splitPaperMarkers } from './chat.js';
import { copy, suggestions, type CopyKey } from './content.js';
import { commands, commandForTopic } from './commands.js';
import { nameBanner } from './banner.js';
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
const promptLine = (command: string) => `<div class="command-echo"><span class="command-prompt" aria-hidden="true">›</span> ${escapeHTML(command)}</div>`;

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
  return sectionIds.map(id => `<section class="cv-section">
      <h2>${t(id)}</h2>
      <div class="cv-list">${bodies[id]()}</div>
      </section>`).join('');
}

const paperTitle = (paper: Publication) => escapeHTML(paper.title);
const paperLinks = (paper: Publication) =>
  [external(paper.links.paper, `[${t('openPaper')}]`), external(paper.links.code, `[${t('openCode')}]`)].filter(Boolean).join(' ');
const topicName = (site: SiteData, topic: ResearchTopic) => site.research.find(interest => interest.id === topic)?.shortName ?? topic;
const byYear = (a: Publication, b: Publication) => b.year - a.year;
const equalNote = (papers: Publication[]) => papers.some(paper => paper.authors.includes('*')) ? `<p class="footnote">${t('equal')}</p>` : '';

interface RenderContext {
  site: SiteData;
  loadFailed: boolean;
}

/** All templates are pure: the controller owns DOM updates and interaction state. */
export function createRenderer({ site, loadFailed }: RenderContext) {
  const { profile, publications } = site;
  const chip = (label: string, attributes: string) => `<button class="chip" ${attributes}>${label}</button>`;
  const showChip = (kind: Content['kind'], label: string, extra = '') => chip(`${label} →`, `data-show="${kind}"${extra}`);
  const opening = (body: string) => `<div class="message bot-message opening"><div class="message-body">${body}</div></div>`;
  /** One publication as terminal output, with complete authors and links. */
  function paperCard(paper: Publication) {
    return `<article class="paper">
      <div class="paper-meta"><span class="paper-venue-tag">${escapeHTML(paper.venueShort)}</span><span class="paper-year">${paper.year}</span><span class="paper-topic">${escapeHTML(topicName(site, paper.topic))}</span></div>
      <button class="paper-title" data-paper="${escapeHTML(paper.id)}">${paperTitle(paper)}</button>
      <p class="paper-authors">${authorMarkup(paper.authors)}</p>
      <div class="paper-actions">${[
        external(paper.links.paper, `[${t('openPaper')}]`, 'paper-action'),
        external(paper.links.code, `[${t('openCode')}]`, 'paper-action'),
      ].filter(Boolean).join('')}<button class="paper-action ask-paper" data-ask="${escapeHTML(paper.id)}" aria-label="${t('askPaper')}">${t('askCommand')}</button></div>
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
    const banner = nameBanner(profile.name);
    return `<h1 class="bio-name">${escapeHTML(profile.name)}</h1>
      ${banner.length ? `<div class="name-banner" aria-hidden="true">${banner.map(word => `<pre>${escapeHTML(word)}</pre>`).join('')}</div>` : ''}
      <p class="bio-position">${escapeHTML(profile.position)}</p>
      <div class="bio-links">${profile.links.map(link => external(link.url, `[${escapeHTML(link.label)}]`)).join(' ')}
      ${profile.email ? `<a href="mailto:${escapeHTML(profile.email)}">[Email]</a>` : ''}</div>
      <div class="bio-copy">${profile.bio.map(paragraph => `<p>${inline(paragraph)}</p>`).join('')}</div>
      <nav class="preset-links" aria-label="Content presets">${presetLinks()}</nav>
      <p class="terminal-note">Click a command above, type /help, or ask your question below.</p>`;
  }
  function presetLinks() {
    return commands.filter(command => command.name !== '/bio' && command.name !== '/help').map(command => `<button type="button" data-command="${command.name}">${command.name}</button>`).join('<span aria-hidden="true"> · </span>');
  }
  function helpContent() {
    return `<h2>Available commands</h2><div class="help-list">${commands.map(command =>
      `<div><button type="button" data-command="${command.name}">${command.name}</button><span>${escapeHTML(command.description)}</span></div>`).join('')}</div>
      <p>Click or type a command to print its output here. Earlier output stays above.</p>
      <p class="terminal-note">Tab completes a command. Enter runs it. Shift+Enter adds a line.<br>Plain text sends a question to the assistant.</p>`;
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
    const papers = filterPublications(publications, { category, topic });
    const title = category ? t(category) : topic ? topicName(site, topic) : t('openAll');
    return `<h3 class="content-title">${escapeHTML(title)} <span class="content-count">${papers.length}</span></h3>
      <div class="paper-list">${papersList(papers)}</div>${equalNote(papers)}`;
  }
  function contentBody(content: Content) {
    if (loadFailed && content.kind !== 'help') return loadError();
    switch (content.kind) {
      case 'preset': return openings[content.topic]();
      case 'help': return helpContent();
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

  /** Plain profile summary retained for alternate rendering consumers. */
  function profileCard() {
    return `<p>${escapeHTML(profile.name)}</p><p>${escapeHTML(profile.position)}</p>
      ${profile.photo ? `<img src="${escapeHTML(profile.photo)}" alt="${escapeHTML(profile.name)}" width="56" height="56">` : ''}
      ${profile.email ? `<a href="mailto:${escapeHTML(profile.email)}">[Email]</a>` : ''}
      ${profile.links.map(link => external(link.url, `[${escapeHTML(link.label)}]`)).join(' ')}`;
  }
  /*
   * Reply text with the publications the assistant named rendered as cards.
   * Every text run is escaped on its own, so model output never reaches the
   * page as markup, and a marker that is unknown, repeated or over the limit is
   * dropped rather than shown. An off-topic refusal renders as the page's own
   * notice instead of the reply.
   */
  function replyBody(text: string, failed: boolean): string {
    const textClass = `message-text ${failed ? 'message-error' : ''}`;
    // A refusal is shown in the page's own words, so the model never writes this text.
    if (isOfftopicReply(text)) return `<div class="message-text message-offtopic">${escapeHTML(t('offtopic'))}</div>`;
    const shown = new Set<string>();
    const body = splitPaperMarkers(text).map(part => {
      if ('paperId' in part) {
        const paper = publications.find(paper => paper.id === part.paperId);
        if (!paper || shown.has(paper.id) || shown.size >= MAX_PAPER_CARDS) return '';
        shown.add(paper.id);
        return paperCard(paper);
      }
      const run = part.text.trim();
      return run ? `<div class="${textClass}">${escapeHTML(run)}</div>` : '';
    }).join('');
    return body || `<div class="${textClass}"></div>`;
  }
  function messages(thread: Thread) {
    return thread.messages.map(message => {
      const anchor = `id="message-${escapeHTML(message.id)}"`;
      if (message.role === 'user') {
        return `<div class="message user-message" ${anchor}>${promptLine(message.text)}</div>`;
      }
      if (message.role === 'content') {
        const content = message.content;
        const command = content.kind === 'preset' ? commandForTopic(content.topic).name
          : content.kind === 'help' ? '/help' : content.kind === 'research' ? '/research'
          : '/papers';
        return `<div class="message content-message" ${anchor}>${promptLine(command)}<div class="message-body">${contentBody(content)}</div></div>`;
      }
      if (message.state === 'pending') {
        return `<div class="message bot-message" ${anchor}><div class="message-body">
          <div class="thinking" aria-label="${t('thinking')}"><span></span><span></span><span></span></div>
        </div></div>`;
      }
      const retryable = message.state === 'error' || message.state === 'stopped';
      const text = message.state === 'error' ? message.error ?? t('failed') : message.state === 'stopped' ? t('stopped') : message.text;
      const action = retryable
        ? `<button data-retry="${escapeHTML(message.id)}">${t('retry')}</button>`
        : `<button data-copy="${escapeHTML(message.id)}">${t('copy')}</button>`;
      return `<div class="message bot-message" ${anchor}><div class="message-body">
        ${replyBody(text, message.state === 'error')}
        <div class="message-controls"><span class="reply-label">${t(message.mode === 'live' ? 'aiReply' : 'simulated')}</span>${action}</div>
      </div></div>`;
    }).join('');
  }

  function paperDetail(paper: Publication) {
    return `<h3 class="detail-title">${paperTitle(paper)}</h3>
      <div class="detail-label">${t('authors')}</div>
      <p class="detail-authors">${authorMarkup(paper.authors)}</p>${paper.authors.includes('*') ? `<p class="footnote">${t('equal')}</p>` : ''}
      <div class="detail-label">${t('venue')}</div>
      <p class="detail-venue"><em>${escapeHTML(paper.venue)}</em>, ${paper.year} · ${escapeHTML(topicName(site, paper.topic))}</p>${paper.abstract ? `
      <div class="detail-label">${t('abstract')}</div>
      <p class="detail-abstract">${inline(paper.abstract)}</p>` : ''}
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
    page: (page: Page, intro = true) => `${page === 'chat' ? '' : promptLine(commandForTopic(page).name)}${intro ? opening(openings[page]()) : ''}<div id="messages" class="messages" aria-label="${t('conversations')}">
      </div>`,
    papers: papersList, messages, paperDetail, paperContext, profileCard,
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
