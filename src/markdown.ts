/*
 * Reads `data/site.md` — the single source of truth for the homepage — into the
 * validated `SiteData` structure. The same parser runs in the browser, in the
 * Node preview server, and in the Cloudflare Worker, so every surface sees the
 * same content. The Markdown source is kept on `SiteData.source` because the
 * chat backend hands it to the model verbatim (see `chat/prompt.ts`).
 *
 * Format: every record is a heading, the `Key: value` lines directly beneath it
 * are its fields, and the paragraphs that follow are its prose. A heading may
 * carry an explicit id as `{#slug}`; inline links are written [label](url).
 * Only the keys in `fieldKeys` are read as fields, so prose that happens to
 * start with `Something:` stays prose.
 */
import { parseSiteData, type Link, type SiteData } from './types.js';

export const siteFile = 'data/site.md';

interface Node {
  level: number;
  title: string;
  id?: string;
  fields: Map<string, string>;
  paragraphs: string[];
  children: Node[];
}

const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*$/;
const ANCHOR = /^(.*?)[ \t]*\{#([a-z0-9][a-z0-9-]*)\}$/;
const FIELD = /^([A-Za-z][A-Za-z0-9 ]{0,23}):[ \t]*(.*)$/;
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const fieldKeys = new Set([
  'position', 'email', 'photo', 'links', 'short name', 'authors', 'venue', 'venue short',
  'year', 'category', 'topic', 'paper', 'code', 'role', 'location', 'period', 'degree', 'issuer',
]);
const sectionNames = ['bio', 'research topics', 'research interests', 'publications', 'experience', 'education', 'service', 'awards'];

/** Recognises a `Key: value` line, normalising the key; anything else is prose. */
function fieldOf(line: string): [string, string] | undefined {
  const match = FIELD.exec(line);
  if (!match) return undefined;
  const key = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
  return fieldKeys.has(key) ? [key, match[2].trim()] : undefined;
}

/** Splits the lines under one heading into its fields and its unwrapped paragraphs. */
function fill(node: Node, lines: string[]): void {
  let index = 0;
  while (index < lines.length && !lines[index].trim()) index += 1;
  for (; index < lines.length; index += 1) {
    const entry = fieldOf(lines[index]);
    if (!entry) break;
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
    // Fields only count directly under their heading; further down they would be silently read as prose.
    if (!paragraph.length && fieldOf(line)) throw new Error(`Move "${line}" directly under the "${node.title}" heading.`);
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
    if (!heading) { pending.push(line); continue; }
    flush();
    const anchor = ANCHOR.exec(heading[2]);
    const node: Node = {
      level: heading[1].length, title: (anchor ? anchor[1] : heading[2]).trim(),
      id: anchor?.[2], fields: new Map(), paragraphs: [], children: [],
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
function anchorId(node: Node): string {
  if (!node.id) throw new Error(`Missing the {#id} marker on "${node.title}".`);
  return node.id;
}
function linkList(node: Node): Link[] | undefined {
  const value = text(node, 'links');
  if (value === undefined) return undefined;
  const found = [...value.matchAll(LINK)].map(match => ({ label: match[1], url: match[2] }));
  if (!found.length) throw new Error(`The Links field under "${node.title}" holds no [label](url) links.`);
  return found;
}
function yearOf(node: Node): number {
  const value = Number(required(node, 'year'));
  if (!Number.isInteger(value)) throw new Error(`Invalid Year under "${node.title}".`);
  return value;
}
/** Optional keys are left out entirely, so the parsed record matches the declared optional fields. */
const optional = <T>(key: string, value: T | undefined) => value === undefined ? {} : { [key]: value };

export function parseSiteMarkdown(source: string): SiteData {
  const root = parseTree(source);
  const [head, ...extra] = root.children;
  if (!head || head.level !== 1 || extra.length) throw new Error('The file must hold exactly one "# Name" heading.');
  if (root.paragraphs.length || root.fields.size) throw new Error('Content above the "# Name" heading would not be published.');
  only(head, ['position', 'email', 'photo', 'links']);

  const sections = new Map<string, Node>();
  for (const section of head.children) {
    const name = section.title.toLowerCase();
    if (!sectionNames.includes(name)) throw new Error(`Unknown section "## ${section.title}".`);
    if (sections.has(name)) throw new Error(`Repeated section "## ${section.title}".`);
    sections.set(name, section);
  }
  for (const name of sectionNames) if (!sections.has(name)) throw new Error(`Missing section "## ${name}".`);
  const section = (name: string): Node => sections.get(name)!;
  const items = (name: string): Node[] => section(name).children;

  return parseSiteData({
    source,
    profile: {
      name: head.title,
      position: required(head, 'position'),
      photo: required(head, 'photo'),
      email: required(head, 'email'),
      links: linkList(head) ?? [],
      bio: section('bio').paragraphs,
    },
    research: items('research topics').map(node => ({
      id: anchorId(node), name: node.title,
      shortName: required(only(node, ['short name']), 'short name'), description: prose(node),
    })),
    interests: items('research interests').map(node => ({
      title: node.title, description: prose(only(node, ['topic'])),
      ...optional('topic', text(node, 'topic')),
      ...optional('points', node.children.length ? node.children.map(point => ({
        title: point.title, description: prose(only(point, ['topic'])), ...optional('topic', text(point, 'topic')),
      })) : undefined),
    })),
    publications: items('publications').map(node => {
      only(node, ['authors', 'venue', 'venue short', 'year', 'category', 'topic', 'paper', 'code']);
      return {
        id: anchorId(node), title: node.title,
        authors: required(node, 'authors'), venue: required(node, 'venue'), venueShort: required(node, 'venue short'),
        year: yearOf(node), category: required(node, 'category'), topic: required(node, 'topic'),
        links: { paper: required(node, 'paper'), ...optional('code', text(node, 'code')) },
        ...optional('abstract', node.paragraphs.length ? prose(node) : undefined),
      };
    }),
    experience: items('experience').map(node => {
      only(node, ['role', 'location', 'period', 'links']);
      return {
        organization: node.title, role: required(node, 'role'),
        ...optional('location', text(node, 'location')),
        period: required(node, 'period'), description: prose(node),
        ...optional('links', linkList(node)),
        ...optional('contributions', node.children.length ? node.children.map(item => ({
          title: item.title, ...optional('paperId', text(only(item, ['paper']), 'paper')), description: prose(item),
        })) : undefined),
      };
    }),
    education: items('education').map(node => {
      only(node, ['degree', 'location', 'period', 'links']);
      return {
        institution: node.title, degree: required(node, 'degree'),
        ...optional('location', text(node, 'location')),
        period: required(node, 'period'), description: prose(node),
        ...optional('links', linkList(node)),
      };
    }),
    service: items('service').map(node => ({
      venue: node.title, role: required(only(node, ['role', 'period']), 'role'), ...optional('period', text(node, 'period')),
    })),
    awards: items('awards').map(node => ({
      title: node.title, issuer: required(only(node, ['issuer', 'period']), 'issuer'), period: required(node, 'period'),
    })),
  });
}

/** Reads the Markdown source with the supplied text reader and returns validated site data. */
export async function loadSiteData(readText: (path: string) => Promise<string>): Promise<SiteData> {
  return parseSiteMarkdown(await readText(siteFile));
}
