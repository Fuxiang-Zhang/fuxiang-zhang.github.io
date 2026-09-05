import type { Topic } from './types.js';

export interface Command {
  name: string;
  description: string;
  topic?: Topic;
  action?: 'help';
}

export const commands: readonly Command[] = [
  { name: '/bio', description: 'Print biography and contact links', topic: 'bio' },
  { name: '/research', description: 'Print research interests and directions', topic: 'research' },
  { name: '/papers', description: 'Print publications, code, and paper details', topic: 'publications' },
  { name: '/experience', description: 'Print research, industry, and education', topic: 'experiences' },
  { name: '/misc', description: 'Print academic service and honors', topic: 'miscellaneous' },
  { name: '/help', description: 'Print available commands', action: 'help' },
];

export type ParsedInput = { kind: 'empty' } | { kind: 'question'; text: string }
  | { kind: 'command'; command: Command } | { kind: 'invalid' };

/** Slash input is always handled locally, including unknown commands. */
export function parseInput(value: string): ParsedInput {
  const text = value.trim();
  if (!text) return { kind: 'empty' };
  if (!text.startsWith('/')) return { kind: 'question', text };
  const command = commands.find(command => command.name === text);
  return command ? { kind: 'command', command } : { kind: 'invalid' };
}

export function matchCommands(value: string): readonly Command[] {
  const text = value.trimStart();
  return text.startsWith('/') && !/\s/.test(text)
    ? commands.filter(command => command.name.startsWith(text)) : [];
}

export const commandForTopic = (topic: Topic) => commands.find(command => command.topic === topic)!;
