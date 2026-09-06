import { isOfftopicReply, MAX_PAPER_CARDS, splitPaperMarkers } from './chat.js';
import { copy, type CopyKey } from './content.js';
import { buildCommands, commandForTopic } from './commands.js';
import { nameBanner } from './banner.js';
import {
  cardsOf, commandOf, idOf, paperCardId, sectionId, parseLinks,
  type Content, type Link, type Node as SiteNode, type Publication, type SectionId, type SiteData, type Message,
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

const promptLine = (command: string) => `<div class="command-echo"><span class="command-prompt" aria-hidden="true">›</span> ${escapeHTML(command)}</div>`;

/** The same optional subtitle is used at every heading depth. */
const subtitleOf = (node: SiteNode) =>
  [node.fields.role, node.fields.location].filter(Boolean).join(' · ');
const paperTitle = (paper: Publication) => escapeHTML(paper.title);
const paperLinks = (paper: Publication) =>
  [external(paper.links.paper, `[${t('openPaper')}]`), external(paper.links.code, `[${t('openCode')}]`)].filter(Boolean).join(' ');
const equalNote = (papers: Publication[]) => papers.some(paper => paper.authors.includes('*')) ? `<p class="footnote">${t('equal')}</p>` : '';

interface RenderContext {
  site: SiteData;
  loadFailed: boolean;
}

/** All templates are pure: the controller owns DOM updates and interaction state. */
export function createRenderer({ site, loadFailed }: RenderContext) {
  const { profile, publications } = site;
  const commands = buildCommands(site);
  const papersById = new Map(publications.map(paper => [paper.id, paper]));
  const sectionsById = new Map(site.sections.map(section => [sectionId(section), section]));
  const getPaper = (id: string) => papersById.get(id);
  const sectionOf = (id: string) => sectionsById.get(id);
  /** The preset the page opens on: the file's first section with a command. */
  const home = site.sections.filter(commandOf).map(sectionId)[0] ?? '';
  /** The command whose section prints the publication cards; it labels paper output. */
  const papersCommand = commands.find(command => {
    const section = command.topic === undefined ? undefined : sectionOf(command.topic);
    return section !== undefined && cardsOf(section) !== undefined;
  })?.name ?? '';
  /** One publication as terminal output, with complete authors and links. */
  function paperCard(paper: Publication) {
    return `<article class="paper">
      <div class="paper-meta"><span class="paper-venue-tag">${escapeHTML(paper.venueShort)}</span><span class="paper-year">${paper.year}</span><span class="paper-topic">${escapeHTML(paper.topic)}</span></div>
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
      <button class="text-link" data-reload>${t('reload')}</button>
      </div>`;
  }

  /** Authored markers render the same cards as chat, without chat's three-card limit. */
  const siteProse = (paragraphs: string[]) => paragraphs.map(paragraph => {
    const id = paperCardId(paragraph);
    if (id) {
      const paper = getPaper(id);
      return paper ? paperCard(paper) : '';
    }
    return `<p>${inline(paragraph)}</p>`;
  }).join('');

  /** Headings and list items share all field rendering; authored syntax selects their tags. */
  function renderNode(node: SiteNode, level: number): string {
    const subtitle = subtitleOf(node);
    const item = node.kind === 'item';
    const tag = item ? 'strong' : `h${Math.min(level, 6)}`;
    const wrapper = item ? 'li' : 'section';
    return `<${wrapper} class="cv-row">
      <div class="cv-heading"><${tag}>${escapeHTML(node.title)}</${tag}>${node.fields.period
        ? `<span class="cv-period">${escapeHTML(node.fields.period)}</span>` : ''}</div>${subtitle
        ? `<p class="cv-subtitle">${escapeHTML(subtitle)}</p>` : ''}
      ${siteProse(node.prose)}${bracketLinks(parseLinks(node.fields.links), 'cv-links')}
      ${renderNodes(node.children, level + (item ? 0 : 1))}
      </${wrapper}>`;
  }
  /** Document order and heading depth are preserved regardless of prose or field presence. */
  function renderNodes(nodes: SiteNode[], level: number): string {
    let html = '';
    let inList = false;
    for (const node of nodes) {
      const item = node.kind === 'item';
      if (item && !inList) html += '<ul class="cv-list">';
      if (!item && inList) html += '</ul>';
      inList = item;
      html += renderNode(node, level);
    }
    return html + (inList ? '</ul>' : '');
  }

  /** The papers a section prints, when its `Cards` field names the section that holds them. */
  function cardsFor(section: SiteNode): Publication[] | undefined {
    const source = cardsOf(section);
    if (source === undefined) return undefined;
    const ids = new Set((sectionOf(source)?.children ?? []).map(idOf));
    return publications.filter(paper => ids.has(paper.id));
  }

  /*
   * A preset prints its section and nothing else: the file's own heading, the
   * prose under it, then its records. The home preset carries the profile
   * header, because that is the screen the page opens on.
   */
  function sectionOpening(section: SiteNode): string {
    if (loadFailed) return loadError();
    const id = sectionId(section);
    const papers = cardsFor(section);
    const body = papers
      ? `<div class="paper-list">${papersList(papers)}</div>${equalNote(papers)}`
      : renderNodes(section.children, 3);
    const head = `<h2 class="section-title">${escapeHTML(section.title)}</h2>${siteProse(section.prose)}`;
    if (id !== home) return head + body;
    const banner = nameBanner(profile.name);
    return `<h1 class="bio-name">${escapeHTML(profile.name)}</h1>
      ${banner.length ? `<div class="name-banner" aria-hidden="true">${banner.map(word => `<pre>${escapeHTML(word)}</pre>`).join('')}</div>` : ''}
      <p class="bio-position">${escapeHTML(profile.position)}</p>
      <div class="bio-links">${profile.links.map(link => external(link.url, `[${escapeHTML(link.label)}]`)).join(' ')}
      ${profile.email ? `<a href="mailto:${escapeHTML(profile.email)}">[Email]</a>` : ''}</div>
      <div class="bio-copy">${head}${body}</div>
      <nav class="preset-links" aria-label="Content presets">${presetLinks(id)}</nav>
      <p class="terminal-note">Click a command above, type /help, or ask your question below.</p>`;
  }
  /** Every preset the file declares except the one being read, in file order. */
  function presetLinks(current: string) {
    return commands.filter(command => command.topic && command.topic !== current)
      .map(command => `<button type="button" data-command="${escapeHTML(command.name)}">${escapeHTML(command.name)}</button>`)
      .join('<span aria-hidden="true"> · </span>');
  }
  function helpContent() {
    return `<h2>Available commands</h2><div class="help-list">${commands.map(command =>
      `<div><button type="button" data-command="${escapeHTML(command.name)}">${escapeHTML(command.name)}</button><span>${escapeHTML(command.description)}</span></div>`).join('')}</div>
      <p>Click or type a command to print its output here. Earlier output stays above.</p>
      <p class="terminal-note">Tab completes a command. Enter runs it. Shift+Enter adds a line.<br>Plain text sends a question to the assistant.</p>`;
  }
  function contentBody(content: Content) {
    if (loadFailed && content.kind !== 'help') return loadError();
    switch (content.kind) {
      case 'preset': return pageBody(content.topic);
      case 'help': return helpContent();
      case 'paper': {
        const paper = getPaper(content.paperId);
        return paper ? paperDetail(paper) : `<p class="empty-results">${t('noResults')}</p>`;
      }
    }
  }
  const papersList = (papers: Publication[]) => papers.length
    ? papers.map(paper => paperCard(paper)).join('')
    : `<p class="empty-results">${t('noResults')}</p>`;

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
        const paper = getPaper(part.paperId);
        if (!paper || shown.has(paper.id) || shown.size >= MAX_PAPER_CARDS) return '';
        shown.add(paper.id);
        return paperCard(paper);
      }
      const run = part.text.trim();
      return run ? `<div class="${textClass}">${escapeHTML(run)}</div>` : '';
    }).join('');
    return body || `<div class="${textClass}"></div>`;
  }
  function message(message: Message): string {
    const anchor = `id="message-${escapeHTML(message.id)}"`;
    if (message.role === 'user') {
      return `<div class="message user-message" ${anchor}>${promptLine(message.text)}</div>`;
    }
    if (message.role === 'content') {
      const content = message.content;
      const command = content.kind === 'preset' ? commandForTopic(commands, content.topic)?.name ?? content.topic
        : content.kind === 'help' ? '/help'
        : papersCommand;
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
  }

  function paperDetail(paper: Publication) {
    return `<h3 class="detail-title">${paperTitle(paper)}</h3>
      <div class="detail-label">${t('authors')}</div>
      <p class="detail-authors">${authorMarkup(paper.authors)}</p>${paper.authors.includes('*') ? `<p class="footnote">${t('equal')}</p>` : ''}
      <div class="detail-label">${t('venue')}</div>
      <p class="detail-venue"><em>${escapeHTML(paper.venue)}</em>, ${paper.year} · ${escapeHTML(paper.topic)}</p>${paper.abstract ? `
      <div class="detail-label">${t('abstract')}</div>
      <div class="detail-abstract">${siteProse(paper.abstract.split(/\n\s*\n/))}</div>` : ''}
      <p class="detail-links">${paperLinks(paper)}</p>
      <p class="detail-ask"><button class="text-link" data-ask="${escapeHTML(paper.id)}">${t('askPaper')} →</button><br><span class="footnote">${t('detailDescription')}</span></p>`;
  }
  function paperContext(paper: Publication | undefined) {
    return paper ? `<span>${t('context')}: ${paperTitle(paper)}</span>
      <button type="button" id="remove-context" aria-label="${t('removeContext')}">×</button>` : '';
  }
  /** The section requested by a preset command. */
  function pageBody(page: SectionId): string {
    const section = sectionOf(page);
    return section ? sectionOpening(section) : loadError();
  }
  return { message, paperContext };
}
