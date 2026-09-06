import { isOfftopicReply, MAX_PAPER_CARDS, splitPaperMarkers, streamingReplyText } from './chat.js';
import { copy, type CopyKey } from './content.js';
import { buildCommands, commandForTopic } from './commands.js';
import { markdown, renderInline } from './markdown-engine.js';
import { parseBlocks } from './markdown.js';
import { nameBanner } from './banner.js';
import {
  cardsOf, sectionId, parseLinks,
  type Content, type Link, type Node as SiteNode, type Publication, type SectionId, type SiteData, type Message,
} from './types.js';

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHTML = (value: unknown): string => String(value).replace(/[&<>"']/g, char => entities[char]);
export const authorMarkup = (authors: string, owner: string): string => authors.split(',').map(part => {
  const name = part.trim().replace(/^and\s+/, '').replace(/\*$/, '');
  return name === owner ? `<strong>${escapeHTML(part)}</strong>` : escapeHTML(part);
}).join(',');
/** Show up to six authors, retaining original order and the owner's credit. */
export function compactAuthors(authors: string, owner: string): string {
  const names = authors.split(',').map(name => name.trim().replace(/^and\s+/, ''));
  if (names.length <= 6) return authors;
  const ownerIndex = names.findIndex(name => name.replace(/\*$/, '') === owner);
  const leadingCount = ownerIndex >= 6 ? 5 : 6;
  const visible = names.filter((_, index) => index < leadingCount || index === ownerIndex);
  if (ownerIndex >= 6) visible.splice(5, 0, '…');
  return `${visible.join(', ')}, et al.`;
}
export function external(url: string | undefined, label: string, className = ''): string {
  return /^https?:\/\//i.test(url || '') ? `<a${className ? ` class="${className}"` : ''} href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : '';
}
export const inline = renderInline;
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

  /** The command whose section prints the publication cards; it labels paper output. */
  const papersCommand = commands.find(command => {
    const section = command.topic === undefined ? undefined : sectionOf(command.topic);
    return section !== undefined && cardsOf(section) !== undefined;
  })?.name ?? '';
  /** One publication with compact author credits and links to the full details. */
  function paperCard(paper: Publication, description?: SiteNode[]) {
    return `<article class="paper">
      <div class="paper-meta"><span class="paper-venue-tag">${escapeHTML(paper.venueShort)}</span><span class="paper-year">${paper.year}</span></div>
      <button class="paper-title" data-paper="${escapeHTML(paper.id)}">${paperTitle(paper)}</button>
      ${description ? `<div class="paper-description">${renderNodes(description)}</div>` : ''}
      <p class="paper-authors">${authorMarkup(compactAuthors(paper.authors, profile.name), profile.name)}</p>
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

  function profileHeader(): string {
    const banner = nameBanner(profile.name);
    return `${banner.length ? `<div class="name-banner" aria-hidden="true">${banner.map(word => `<pre>${escapeHTML(word)}</pre>`).join('')}</div>` : ''}
      <p class="bio-position">${escapeHTML(profile.position)}</p>
      <div class="bio-links">${profile.links.map(link => external(link.url, `[${escapeHTML(link.label)}]`)).join(' ')}
      ${profile.email ? `<a href="mailto:${escapeHTML(profile.email)}">[Email]</a>` : ''}</div>`;
  }
  function metadata(node: SiteNode): string {
    const subtitle = subtitleOf(node);
    return `${subtitle ? `<p class="cv-subtitle">${escapeHTML(subtitle)}</p>` : ''}${bracketLinks(parseLinks(node.fields.links), 'cv-links')}`;
  }
  function heading(node: SiteNode): string {
    const tag = node.kind === 'item' ? 'strong' : `h${node.level ?? 3}`;
    return `<div class="cv-heading"><${tag}>${inline(node.title)}</${tag}>${node.fields.period ? `<span class="cv-period">${escapeHTML(node.fields.period)}</span>` : ''}</div>`;
  }
  function renderNode(node: SiteNode): string {
    switch (node.kind) {
      case 'markdown': return markdown.render(node.text ?? '', { references: node.references });
      case 'profile': return profileHeader();
      case 'paper': {
        const paper = getPaper(node.fields.ref);
        return paper ? paperCard(paper, node.body.length ? node.body : undefined) : '';
      }
      case 'publication': return '';
      case 'collapse': {
        const tag = node.level ? `h${node.level}` : 'span';
        return `<details class="content-collapse"${node.open ? ' open' : ''}><summary><${tag} class="collapse-heading"><span>${inline(node.title)}</span>${node.fields.period ? `<span class="cv-period">${escapeHTML(node.fields.period)}</span>` : ''}</${tag}></summary><div class="collapse-body">${metadata(node)}${renderNodes(node.body)}</div></details>`;
      }
      case 'list': {
        const tag = node.ordered ? 'ol' : 'ul';
        return `<${tag} class="cv-list"${node.ordered && node.start !== 1 ? ` start="${node.start}"` : ''}>${renderNodes(node.body)}</${tag}>`;
      }
      case 'item': return `<li class="cv-row">${node.title ? heading(node) : ''}${metadata(node)}${renderNodes(node.body)}</li>`;
      case 'heading': return `<section class="content-section">${heading(node)}${metadata(node)}${renderNodes(node.body)}</section>`;
    }
  }
  /** A single ordered tree drives every section and explicit component. */
  function renderNodes(nodes: SiteNode[]): string { return nodes.map(renderNode).join(''); }
  function cardsFor(section: SiteNode): Publication[] | undefined {
    const source = cardsOf(section);
    if (source === undefined) return undefined;
    return (sectionOf(source)?.body ?? []).flatMap(node => {
      const paper = getPaper(node.fields.id);
      return paper ? [paper] : [];
    });
  }
  function sectionOpening(section: SiteNode): string {
    if (loadFailed) return loadError();
    const papers = cardsFor(section);
    return `<h2 class="section-title">${inline(section.title)}</h2>${renderNodes(section.body)}${papers
      ? `<div class="paper-list">${papersList(papers)}</div>${equalNote(papers)}` : ''}`;
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
        ${message.text ? replyBody(streamingReplyText(message.text), false) + '<span class="stream-cursor" aria-hidden="true"></span>' : `<div class="thinking" aria-label="${t('thinking')}"><span></span><span></span><span></span></div>`}
      </div></div>`;
    }
    const retryable = message.state === 'error' || message.state === 'stopped';
    const text = message.state === 'error' ? message.error ?? t('failed') : message.state === 'stopped' ? t('stopped') : message.text;
    const action = retryable
      ? `<button data-retry="${escapeHTML(message.id)}">${t('retry')}</button>`
      : `<button data-copy="${escapeHTML(message.id)}">${t('copy')}</button>`;
    return `<div class="message bot-message" ${anchor}><div class="message-body">
      ${retryable && message.text ? replyBody(streamingReplyText(message.text), false) : ''}
      ${replyBody(text, message.state === 'error')}
      <div class="message-controls"><span class="reply-label">${t(message.mode === 'live' ? 'aiReply' : 'simulated')}</span>${action}</div>
    </div></div>`;
  }

  function paperDetail(paper: Publication) {
    return `<h3 class="detail-title">${paperTitle(paper)}</h3>
      <div class="detail-label">${t('authors')}</div>
      <p class="detail-authors">${authorMarkup(paper.authors, profile.name)}</p>${paper.authors.includes('*') ? `<p class="footnote">${t('equal')}</p>` : ''}
      <div class="detail-label">${t('venue')}</div>
      <p class="detail-venue"><em>${escapeHTML(paper.venue)}</em>, ${paper.year} · ${escapeHTML(paper.topic)}</p>${paper.abstract ? `
      <div class="detail-label">${t('abstract')}</div>
      <div class="detail-abstract">${renderNodes(parseBlocks(paper.abstract))}</div>` : ''}
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
