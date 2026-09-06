import { commandOf, sectionId, type SiteData, type SectionId, type Content } from './types.js';

export interface Command {
  name: string;
  description: string;
  /** The `##` section this command prints; absent for commands the page itself provides. */
  topic?: SectionId;
  action?: 'help';
}

/** `/help` is the page's own, not a section of the file, so it is the one command written here. */
export const HELP: Command = { name: '/help', description: 'Print available commands', action: 'help' };

/*
 * The command list is data/site.md's own: one command per `##` section, named and
 * described by that section, in the order the file writes them. Adding a section
 * with a `Command:` line adds a command and a route, with no code change.
 */
export function buildCommands(site: SiteData): readonly Command[] {
  const fromSections = site.sections.flatMap(section => {
    const name = commandOf(section);
    return name ? [{ name, description: section.fields.summary ?? section.title, topic: sectionId(section) }] : [];
  });
  return [...fromSections, HELP];
}

export type ParsedInput = { kind: 'empty' } | { kind: 'question'; text: string }
  | { kind: 'command'; command: Command } | { kind: 'invalid' };

/** Slash input is always handled locally, including unknown commands. */
export function parseInput(value: string, commands: readonly Command[]): ParsedInput {
  const text = value.trim();
  if (!text) return { kind: 'empty' };
  if (!text.startsWith('/')) return { kind: 'question', text };
  const command = commands.find(command => command.name === text);
  return command ? { kind: 'command', command } : { kind: 'invalid' };
}

export function matchCommands(value: string, commands: readonly Command[]): readonly Command[] {
  const text = value.trimStart();
  return text.startsWith('/') && !/\s/.test(text)
    ? commands.filter(command => command.name.startsWith(text)) : [];
}

/** The navigable section ids, in file order. */
export const sectionIds = (site: SiteData): string[] =>
  site.sections.filter(commandOf).map(sectionId);

export const commandForTopic = (commands: readonly Command[], topic: SectionId): Command | undefined =>
  commands.find(command => command.topic === topic);

/** Route aliases are resolved against the loaded file, after checking actual section ids. */
export function resolveRoute(hash: string, site: SiteData): Content | null {
  const [name, id] = hash.replace(/^#/, '').split('/');
  if (name === 'main') return null; // Native skip-to-content anchor.
  if (name === 'paper') return { kind: 'paper', paperId: id ?? '' };
  if (name === 'help') return { kind: 'help' };
  const ids = sectionIds(site);
  if (ids.includes(name)) return { kind: 'preset', topic: name };
  const paperSection = site.sections.find(section => section.fields.cards && commandOf(section));
  const papers = paperSection ? sectionId(paperSection) : undefined;
  const aliases: Record<string, string | undefined> = {
    overview: ids.includes('bio') ? 'bio' : ids[0],
    journey: 'work', experiences: 'work', miscellaneous: 'misc',
    publication: papers,
    publications: papers,
  };
  const alias = aliases[name];
  return { kind: 'preset', topic: alias && ids.includes(alias) ? alias : ids[0] ?? '' };
}
