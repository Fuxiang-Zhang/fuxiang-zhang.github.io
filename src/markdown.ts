/*
 * Reads `data/site.md` — the single source of truth for the homepage — into the
 * validated `SiteData` structure. The same parser runs in the browser, in the
 * Node preview server, and in the Cloudflare Worker, so every surface sees the
 * same content. The Markdown source is kept on `SiteData.source` because the
 * chat backend hands it to the model verbatim (see `chat/prompt.ts`).
 *
 * Records are headings or `- **Title**` list items. Fields come first, followed
 * by prose and children. List item content is indented two spaces; nested lists
 * add two more. An id is an `Id` field, and inline links use [label](url).
 * Only the keys in `fieldKeys` are read as fields, so prose that happens to
 * start with `Something:` stays prose.
 */
import { parseSiteData, parseLinks, type Node as SiteNode, type Publication, type SiteData } from './types.js';

export const siteFile = 'data/site.md';

interface Node {
  level: number;
  indent?: number;
  title: string;
  fields: Map<string, string>;
  paragraphs: string[];
  children: Node[];
}

const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*$/;
const ITEM = /^( *)- \*\*(.+?)\*\*[ \t]*$/;
const ID = /^[a-z0-9][a-z0-9-]*$/;
const FIELD = /^([A-Za-z][A-Za-z0-9 ]{0,23}):[ \t]*(.*)$/;
/** Closed vocabulary; each record's supported field locations are checked below. */
const fieldKeys = new Set([
  'id', 'position', 'email', 'links', 'authors', 'venue', 'venue short',
  'year', 'topic', 'paper', 'code', 'role', 'location', 'period',
  'command', 'summary', 'cards',
]);
const COMMAND = /^\/[a-z][a-z0-9-]*$/;

/** Recognises a `Key: value` line, normalising the key; anything else is prose. */
function fieldOf(line: string): [string, string] | undefined {
  const match = FIELD.exec(line);
  if (!match) return undefined;
  const key = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
  return fieldKeys.has(key) ? [key, match[2].trim()] : undefined;
}
/** A colon-ended sentence without a value is prose; an unknown Key: value is a typo. */
const looksLikeField = (line: string) => Boolean(FIELD.exec(line)?.[2].trim());

/** Splits the lines under one record into its fields and its unwrapped paragraphs. */
function fill(node: Node, lines: string[]): void {
  let index = 0;
  while (index < lines.length && !lines[index].trim()) index += 1;
  for (; index < lines.length; index += 1) {
    const entry = fieldOf(lines[index]);
    if (!entry) {
      // Sections are free-form, so a misspelled key would otherwise vanish into the prose.
      if (looksLikeField(lines[index])) {
        throw new Error(`Unknown field "${lines[index].split(':')[0].trim()}" under "${node.title}".`);
      }
      break;
    }
    if (node.fields.has(entry[0])) throw new Error(`Repeated "${entry[0]}" field under "${node.title}".`);
    node.fields.set(entry[0], entry[1]);
  }
  let paragraph: string[] = [];
  const end = () => {
    if (paragraph.length) node.paragraphs.push(paragraph.join(' '));
    paragraph = [];
  };
  for (; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) { end(); continue; }
    // Fields only count directly under their record title; further down they would be silently read as prose.
    if (!paragraph.length && fieldOf(line)) throw new Error(`Move "${line}" directly under the "${node.title}" record.`);
    paragraph.push(line);
  }
  end();
}

function parseTree(source: string): Node {
  const root: Node = { level: 0, title: 'the document', fields: new Map(), paragraphs: [], children: [] };
  const stack = [root];
  let pending: string[] = [];
  const flush = () => { fill(stack[stack.length - 1], pending); pending = []; };
  for (const line of source.split(/\r?\n/)) {
    const heading = HEADING.exec(line);
    const item = ITEM.exec(line);
    if (item) {
      flush();
      const indent = item[1].length;
      while ((stack.at(-1)!.indent ?? -1) >= indent) stack.pop();
      const parent = stack.at(-1)!;
      if (parent.level < 2 || indent !== (parent.indent === undefined ? 0 : parent.indent + 2)) {
        throw new Error(`Invalid list indentation for "${item[2]}"; place lists under a section and indent nested items two spaces.`);
      }
      const title = item[2].trim();
      if (!title) throw new Error('A list item has no title.');
      const node: Node = { level: parent.level, indent, title, fields: new Map(), paragraphs: [], children: [] };
      parent.children.push(node);
      stack.push(node);
      continue;
    }
    if (!heading) {
      if (/^\s*-\s+/.test(line)) throw new Error('Write list items as - **Title**.');
      const current = stack.at(-1)!;
      if (current.indent !== undefined && line.trim()) {
        const prefix = ' '.repeat(current.indent + 2);
        if (!line.startsWith(prefix)) throw new Error(`Indent content under "${current.title}" by ${prefix.length} spaces.`);
        const content = line.slice(prefix.length);
        if (HEADING.test(content)) throw new Error(`Use a nested list item under "${current.title}", not an indented heading.`);
        pending.push(content);
      } else pending.push(line);
      continue;
    }
    flush();
    while (stack.at(-1)!.indent !== undefined) stack.pop();
    const node: Node = {
      level: heading[1].length, title: heading[2].trim(),
      fields: new Map(), paragraphs: [], children: [],
    };
    if (!node.title) throw new Error('A heading has no title.');
    while (stack.length > 1 && stack[stack.length - 1].level >= node.level) stack.pop();
    const parent = stack[stack.length - 1];
    if (node.level > parent.level + 1) throw new Error(`Heading "${node.title}" skips a level.`);
    parent.children.push(node);
    stack.push(node);
  }
  flush();
  return root;
}

const only = (node: Node, allowed: string[]): Node => {
  for (const key of node.fields.keys()) {
    if (!allowed.includes(key)) throw new Error(`Unknown field "${key}" under "${node.title}".`);
  }
  return node;
};
const text = (node: Node, key: string): string | undefined => node.fields.get(key) || undefined;
function required(node: Node, key: string): string {
  const value = text(node, key);
  if (value === undefined) throw new Error(`Missing "${key}" under "${node.title}".`);
  return value;
}
function prose(node: Node): string {
  if (!node.paragraphs.length) throw new Error(`Missing the description under "${node.title}".`);
  return node.paragraphs.join('\n\n');
}
/** The slug a heading is addressed by: a field like any other, not part of the title. */
function idOf(node: Node): string | undefined {
  const value = text(node, 'id');
  if (value !== undefined && !ID.test(value)) throw new Error(`Invalid Id "${value}" under "${node.title}".`);
  return value;
}
function requiredId(node: Node): string {
  const value = idOf(node);
  if (value === undefined) throw new Error(`Missing "id" under "${node.title}".`);
  return value;
}
function yearOf(node: Node): number {
  const value = Number(required(node, 'year'));
  if (!Number.isInteger(value)) throw new Error(`Invalid Year under "${node.title}".`);
  return value;
}
/** Optional keys are left out entirely, so the parsed record matches the declared optional fields. */
const optional = <T>(key: string, value: T | undefined) => value === undefined ? {} : { [key]: value };

function publicationOf(node: Node): Publication {
  if (node.indent !== undefined) throw new Error(`Publication "${node.title}" must use a heading.`);
  if (node.children.length) throw new Error(`Publication \"${node.title}\" cannot contain child records.`);
  only(node, ['id', 'authors', 'venue', 'venue short', 'year', 'topic', 'paper', 'code']);
  return {
    id: requiredId(node), title: node.title,
    authors: required(node, 'authors'), venue: required(node, 'venue'), venueShort: required(node, 'venue short'),
    year: yearOf(node), topic: required(node, 'topic'),
    links: { paper: required(node, 'paper'), ...optional('code', text(node, 'code')) },
    ...optional('abstract', node.paragraphs.length ? prose(node) : undefined),
  };
}

const toNode = (node: Node): SiteNode => ({
  title: node.title,
  ...(node.indent === undefined ? {} : { kind: 'item' as const }),
  fields: Object.fromEntries(node.fields),
  prose: node.paragraphs,
  children: node.children.map(toNode),
});

export function parseSiteMarkdown(source: string): SiteData {
  const root = parseTree(source);
  const [head, ...extra] = root.children;
  if (!head || head.level !== 1 || extra.length) throw new Error('The file must hold exactly one "# Name" heading.');
  if (root.paragraphs.length || root.fields.size) throw new Error('Content above the "# Name" heading would not be published.');
  only(head, ['position', 'email', 'links']);
  if (head.paragraphs.length) throw new Error('Move profile prose into a ## section.');

  /*
   * Sections are whatever the file writes: every `##` under the title is one, in
   * that order. Each declares the command that prints it; the heading text, the
   * command and the order are the file's to change, and nothing here names them.
   */
  const byId = new Map<string, Node>();
  const taken = new Set<string>();
  for (const node of head.children) {
    const command = text(node, 'command');
    if (command !== undefined) {
      if (!COMMAND.test(command)) throw new Error(`Invalid Command "${command}" under "${node.title}"; expected a slash command.`);
      if (['/help', '/main', '/paper'].includes(command)) throw new Error(`The Command under "${node.title}" cannot be ${command}, which the page reserves.`);
      if (taken.has(command)) throw new Error(`Repeated Command "${command}" under "${node.title}".`);
      taken.add(command);
    } else if (idOf(node) === undefined) {
      throw new Error(`"## ${node.title}" needs a Command, or an Id if it is data another section prints.`);
    }
    const id = idOf(node) ?? (command ?? node.title).replace(/^\//, '');
    if (['main', 'paper', 'help'].includes(id)) throw new Error(`Reserved section id "${id}".`);
    if (byId.has(id)) throw new Error(`Repeated section id "${id}" on "## ${node.title}".`);
    byId.set(id, node);
  }
  if (!taken.size) throw new Error('The file holds no "## Section" with a Command to show.');

  /*
   * Publications are the records of whatever section a `Cards` field points at.
   * Nothing is guessed from a record's fields: the file says which section holds
   * the papers, and only those records are read as publications.
   */
  const publications: Publication[] = [];
  const sources = new Set<Node>();
  for (const node of head.children) {
    const cards = text(node, 'cards');
    if (cards === undefined) continue;
    const source = byId.get(cards);
    if (!source) throw new Error(`The Cards field under "${node.title}" names no section: "${cards}".`);
    if (source === node) throw new Error(`The Cards field under "${node.title}" points at its own section.`);
    if (node.children.length) throw new Error(`Cards section "${node.title}" cannot contain child records.`);
    if (!sources.has(source)) publications.push(...source.children.map(publicationOf));
    sources.add(source);
  }

  const validateRecord = (node: Node) => {
    only(node, ['role', 'location', 'period', 'links']);
    parseLinks(text(node, 'links'));
    node.children.forEach(validateRecord);
  };
  for (const node of head.children) {
    only(node, ['id', 'command', 'summary', 'cards']);
    if (text(node, 'summary') && !text(node, 'command')) throw new Error(`Summary under "${node.title}" needs a Command.`);
    if (sources.has(node)) {
      if (text(node, 'command') || text(node, 'cards') || node.paragraphs.length) {
        throw new Error(`Publication source "${node.title}" may only contain its Id and publication records.`);
      }
    } else {
      if (!text(node, 'command')) throw new Error(`Section "${node.title}" is neither a command nor a Cards source.`);
      node.children.forEach(validateRecord);
    }
  }

  return parseSiteData({
    source,
    profile: {
      name: head.title,
      position: required(head, 'position'),
      email: required(head, 'email'),
      links: parseLinks(text(head, 'links')),
    },
    sections: head.children.map(toNode),
    publications,
  });
}

/** Reads the Markdown source with the supplied text reader and returns validated site data. */
export async function loadSiteData(readText: (path: string) => Promise<string>): Promise<SiteData> {
  return parseSiteMarkdown(await readText(siteFile));
}
