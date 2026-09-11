import { aliases } from './papers.js';
import type { Node, SiteData } from '../src/types.js';

export type ContextMode = 'full' | 'selective';
export const contextMode = (value?: string): ContextMode => value === 'full' ? 'full' : 'selective';
const contexts = new WeakMap<SiteData, string>();
const displayFields = new Set(['command', 'summary', 'cards', 'id', 'ref']);

/** A factual projection of the authored tree, with publication details stored separately. */
export function compactContext(site: SiteData): string {
  const cached = contexts.get(site);
  if (cached) return cached;
  const contributions = new Map<string, Set<string>>();
  function render(nodes: Node[], path: string[] = []): string {
    return nodes.flatMap(node => {
      if (node.kind === 'publication' || node.kind === 'profile') return [];
      const heading = node.title ? [...path, node.title] : path;
      if (node.kind === 'paper') {
        const description = render(node.body).trim();
        const entries = contributions.get(node.fields.ref) ?? new Set<string>();
        if (description) entries.add(`${heading.join(' / ')}: ${description}`);
        contributions.set(node.fields.ref, entries);
        return [];
      }
      const fields = Object.entries(node.fields).filter(([key]) => !displayFields.has(key))
        .map(([key, value]) => `${key}: ${value}`);
      return [node.title, ...fields, node.text ?? '', render(node.body, heading)].filter(Boolean);
    }).join('\n');
  }
  const body = render(site.sections);
  const profile = `${site.profile.name}\n${site.profile.position}\nEmail: ${site.profile.email}\n${site.profile.links.map(link => `${link.label}: ${link.url}`).join('\n')}`;
  const index = site.publications.map(paper => [
    `Id: ${paper.id} | ${paper.title} | ${paper.year} | ${paper.venue} | ${paper.topic}${aliases[paper.id]?.length ? ` | Also known as: ${aliases[paper.id].join(", ")}` : ''}`,
    ...(contributions.get(paper.id) ?? []),
  ].join('\n')).join('\n\n');
  const result = `${profile}\n\n${body}\n\n# Complete publication index\n${index}`;
  contexts.set(site, result);
  return result;
}
