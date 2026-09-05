import { journeySections } from './content.js';
import type { Language, Localized, SectionId, Contribution, Experience } from './types.js';

const entities: Record<string, string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
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
    return `<li>${title}<span>${text(bullet.description)}</span></li>`;
  };
  const renderEntry = (entry: Experience, timeline: boolean) => `<article class="${timeline ? 'timeline-item' : 'journey-list-item'}">
    ${entry.date ? `<div class="timeline-date">${text(entry.date)}</div>` : ''}
    <h3>${text(entry.title)}</h3>
    ${entry.role ? `<p class="journey-role">${text(entry.role)}</p>` : ''}
    <p>${text(entry.description)}</p>
    ${entry.bullets ? `<ul class="journey-contributions">${entry.bullets.map(renderBullet).join('')}</ul>` : ''}
    ${entry.links ? `<div class="journey-links">${entry.links.filter(link=>/^https?:\/\//i.test(link.url)).map(link=>`<a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${text(link.label)} ↗</a>`).join('')}</div>` : ''}
  </article>`;
  return journeySections.filter(section => sectionIds === null || sectionIds.includes(section.id)).map(section => `<section class="journey-section" aria-labelledby="journey-${section.id}"><h2 id="journey-${section.id}">${text(section.title)}</h2><div class="${section.type === 'timeline' ? 'timeline' : 'journey-list'}">${section.entries.map(entry=>renderEntry(entry,section.type==='timeline')).join('')}</div></section>`).join('');
}
