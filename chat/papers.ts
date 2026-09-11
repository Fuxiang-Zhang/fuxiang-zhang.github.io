import type { FunctionTool } from 'openai/resources/responses/responses';
import type { SiteData } from '../src/types.js';

export const paperTool: FunctionTool = {
  type: 'function', name: 'get_papers',
  description: 'Read homepage publication details by exact IDs from the complete index. Batch all papers needed for a comparison. Read details before answering about authors, methods, results or links not already supplied.',
  strict: true,
  parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 50 } }, required: ['ids'], additionalProperties: false },
};

/** Stable editorial aliases; metadata and details still come exclusively from SiteData. */
export const aliases: Record<string, string[]> = {
  'coordination-skills': ['ODIS'], 'incentive-communication': ['MAIC'],
  'concentrative-coordination': ['MACC'], 'offline-task-representation': ['ReDA'],
  'policy-rehearsing': ['ReDM'], 'dataset-constraint': ['PRDC'],
  'multi-modal-imitation': ['GMAIL'], 'continual-coordination': ['MACPro'],
  'dr-mas': ['Dr. MAS'],
};
function mentions(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i').test(text);
}
export function preloadPaperIds(site: SiteData, message: string, focus?: string | null): string[] {
  const matched = site.publications.filter(paper => [paper.id, paper.title, ...(aliases[paper.id] ?? [])].some(name => mentions(message, name))).map(paper => paper.id);
  return matched.length ? matched : focus && site.publications.some(paper => paper.id === focus) ? [focus] : [];
}
export function getPapers(site: SiteData, ids: string[]) {
  return [...new Set(ids)].map(id => site.publications.find(paper => paper.id === id) ?? { id, error: 'Unknown publication ID. Use the complete index.' });
}
export function executePaperTool(site: SiteData, name: string, argumentsText: string): string {
  if (name !== 'get_papers') return JSON.stringify({ error: 'Unknown tool.' });
  try {
    const args = JSON.parse(argumentsText);
    if (!args || !Array.isArray(args.ids) || args.ids.length < 1 || args.ids.length > 50 || !args.ids.every((id: unknown) => typeof id === 'string')) throw new Error();
    return JSON.stringify(getPapers(site, args.ids));
  } catch { return JSON.stringify({ error: 'Expected ids: an array of 1–50 publication IDs.' }); }
}
