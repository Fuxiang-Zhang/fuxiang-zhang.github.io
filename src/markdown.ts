import { markdown } from './markdown-engine.js';
import { parseSiteData, parseLinks, sectionId, commandOf, walk, paperCardId, type Node, type Publication, type SiteData } from './types.js';

export const siteFile = 'data/site.md';
type Token = ReturnType<typeof markdown.parse>[number];
const fieldPattern = /^([A-Za-z][A-Za-z ]{0,23}):[ \t]*(.*)$/;
const knownFields = new Set(['id', 'position', 'email', 'links', 'home', 'title', 'description', 'authors', 'venue', 'venue short', 'year', 'topic', 'paper', 'code', 'role', 'location', 'period', 'command', 'summary', 'cards']);
const fail = (node: Pick<Node, 'line'>, message: string): never => { throw new Error(`Line ${node.line}: ${message}`); };
const node = (kind: Node['kind'], line: number, body: Node[] = []): Node => ({ kind, line, title: '', fields: {}, body });

function fieldsFrom(record: Node): void {
  const first = record.body[0];
  if (first?.kind !== 'markdown' || first.blockType !== 'paragraph' || !first.text) return;
  const lines = first.text.split('\n');
  let count = 0;
  for (const line of lines) {
    const match = fieldPattern.exec(line);
    if (!match || !match[2].trim()) break;
    const key = match[1].toLowerCase().trim();
    if (!knownFields.has(key)) fail({ line: first.line + count }, `Unknown field "${match[1]}".`);
    if (key in record.fields) fail(first, `Repeated "${key}" field.`);
    record.fields[key] = match[2].trim();
    count++;
  }
  if (count === lines.length) record.body.shift();
  else if (count) { first.text = lines.slice(count).join('\n'); first.line += count; }
}
function only(record: Node, allowed: string[]): void {
  for (const key of Object.keys(record.fields)) if (!allowed.includes(key)) fail(record, `Unknown field "${key}" under "${record.title}".`);
}
function required(record: Node, key: string): string {
  return record.fields[key] || fail(record, `Missing "${key}" under "${record.title}".`);
}
const slug = (value: string) => /^[a-z0-9][a-z0-9-]*$/.test(value);

/** Parse standard blocks first, retaining their sequence, then attach heading scopes. */
export function parseBlocks(source: string): Node[] {
  const env: { references?: Record<string, { href: string; title: string }> } = {};
  const tokens = markdown.parse(source, env);
  const lines = source.split(/\r?\n/);
  let index = 0;
  function blocks(stop = false): Node[] {
    const result: Node[] = [];
    while (index < tokens.length) {
      const token = tokens[index];
      if (token.nesting === -1) {
        if (!stop) throw new Error('Unexpected Markdown closing token.');
        index++;
        return result;
      }
      const line = (token.map?.[0] ?? 0) + 1;
      if (token.type === 'heading_open') {
        const heading = node('heading', line);
        heading.level = Number(token.tag.slice(1));
        heading.title = tokens[index + 1].content;
        index += 3;
        result.push(heading);
      } else if (token.type === 'paragraph_open') {
        const text = tokens[index + 1].content;
        const ref = paperCardId(text.trim());
        const paragraph = node(ref ? 'paper' : 'markdown', line);
        if (ref) paragraph.fields.ref = ref;
        else {
          paragraph.text = text;
          paragraph.blockType = 'paragraph';
          if (/^\s*(?::::|<\/?(?:details|summary)\b)/im.test(text)) fail(paragraph, 'Unknown or unmatched component fence.');
          // Code spans are literal examples, not publication references.
          const meaningful = (tokens[index + 1].children ?? []).filter(t => t.type !== 'code_inline').map(t => t.content).join('');
          if (/\[\[\s*paper\s*:/i.test(meaningful)) fail(paragraph, 'Write [[paper:id]] as a separate paragraph.');
        }
        result.push(paragraph);
        index += 3;
      } else if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
        index++;
        const list = node('list', line, blocks(true));
        list.ordered = token.type === 'ordered_list_open';
        list.start = Number(token.attrGet('start') ?? 1);
        result.push(list);
      } else if (token.type === 'list_item_open') {
        index++;
        const item = node('item', line, scope(blocks(true)));
        const first = item.body[0];
        const match = first?.kind === 'markdown' ? /^\*\*(.+?)\*\*(?:\n|$)/.exec(first.text ?? '') : null;
        if (match) {
          item.title = match[1];
          first.text = first.text!.slice(match[0].length);
          if (!first.text) item.body.shift();
          fieldsFrom(item);
        }
        result.push(item);
      } else if (token.type === 'details_open') {
        index++;
        const component = node('collapse', line, scope(blocks(true)));
        const details = token.meta as { title: string; level?: number; open: boolean };
        component.title = details.title;
        component.level = details.level;
        component.open = details.open;
        fieldsFrom(component);
        result.push(component);
      } else if (token.type.startsWith('container_') && token.nesting === 1) {
        const kind = token.type.slice(10, -5) as 'paper' | 'publication' | 'profile';
        const info = token.info.trim();
        const component = node(kind, line);
        if (!token.map || !/^\s*:{3,}\s*$/.test(lines[token.map[1]] ?? '')) fail(component, `Unclosed ${kind} component.`);
        if (kind === 'paper') {
          const match = /^paper\{ref="([a-z0-9][a-z0-9-]*)"\}$/.exec(info);
          if (!match) fail(component, 'Use :::paper{ref="paper-id"}.');
          component.fields.ref = match![1];
        } else if (info !== kind) fail(component, `Unsupported ${kind} component options.`);
        index++;
        const contents = blocks(true);
        component.body = scope(contents);
        if (kind === 'publication') {
          fieldsFrom(component);
          component.title = required(component, 'title');
          if (component.body.length) {
            const indent = /^ */.exec(lines[line - 1])![0].length;
            component.text = lines.slice(component.body[0].line - 1, token.map![1]).map(line => line.slice(Math.min(indent, /^ */.exec(line)![0].length))).join('\n').trim();
          }
        }
        result.push(component);
      } else {
        // Fences, blockquotes, tables, rules and other standard blocks are rendered
        // by the same Markdown engine. Keep their original source, including newlines.
        const start = index++;
        if (token.nesting === 1) {
          let depth = 1;
          while (index < tokens.length && depth) depth += tokens[index++].nesting;
        }
        result.push(fragment(token, tokens.slice(start, index), lines));
      }
    }
    return result;
  }
  function scope(flat: Node[]): Node[] {
    const root: Node[] = [];
    const stack: Node[] = [];
    for (const block of flat) {
      if (block.kind === 'heading') {
        while (stack.length && stack.at(-1)!.level! >= block.level!) stack.pop();
        (stack.at(-1)?.body ?? root).push(block);
        stack.push(block);
      } else (stack.at(-1)?.body ?? root).push(block);
    }
    for (const block of flat) if (block.kind === 'heading') fieldsFrom(block);
    return root;
  }
  const parsed = scope(blocks());
  for (const block of walk(parsed)) if (block.kind === 'markdown') block.references = env.references;
  return parsed;
}
function fragment(token: Token, tokens: Token[], lines: string[]): Node {
  const result = node('markdown', (token.map?.[0] ?? 0) + 1);
  result.blockType = token.type;
  if (!token.map) fail(result, `Unsupported block: ${token.type}.`);
  if (token.type === 'code_block') { result.text = token.content.split('\n').map(line => '    ' + line).join('\n'); return result; }
  const raw = lines.slice(...token.map!);
  const indent = /^ */.exec(raw[0] ?? '')![0].length;
  result.text = raw.map(line => line.slice(Math.min(indent, /^ */.exec(line)![0].length))).join('\n');
  // Containers inside standard quoted blocks would bypass component rendering.
  if (tokens.some(t => t.type.startsWith('container_') || t.type === 'details_open')) fail(result, 'Place components outside blockquotes and tables.');
  return result;
}

export function parseSiteMarkdown(source: string): SiteData {
  const roots = parseBlocks(source);
  const head = roots[0];
  if (roots.length !== 1 || head?.kind !== 'heading' || head.level !== 1) throw new Error('The file must hold exactly one "# Name" heading, with no content above it.');
  only(head, ['position', 'email', 'links', 'home', 'title', 'description']);
  const sections = head.body;
  if (sections.some(s => s.kind !== 'heading' || s.level !== 2)) fail(head, 'Profile prose belongs in a ## section.');
  const ids = new Set<string>();
  const commands = new Set<string>();
  for (const section of sections) {
    only(section, ['id', 'command', 'summary', 'cards']);
    const command = commandOf(section);
    if (!command && !section.fields.id) fail(section, 'Section needs a Command or Id.');
    const id = sectionId(section);
    if (!slug(id) || ['main', 'paper', 'help'].includes(id)) fail(section, `Invalid or reserved section Id: ${id}.`);
    if (ids.has(id)) fail(section, `Repeated section id: ${id}.`);
    ids.add(id);
    if (command) {
      if (!/^\/[a-z][a-z0-9-]*$/.test(command) || ['/help', '/main', '/paper'].includes(command)) fail(section, `Invalid or reserved Command: ${command}.`);
      if (commands.has(command)) fail(section, `Repeated Command: ${command}.`);
      commands.add(command);
    } else if (section.fields.summary) fail(section, 'Summary needs a Command.');
  }
  const home = required(head, 'home');
  if (!sections.some(s => sectionId(s) === home && commandOf(s))) fail(head, 'Home must name a command section Id.');
  const sources = new Set(sections.flatMap(s => s.fields.cards ? [s.fields.cards] : []));
  for (const id of sources) if (!ids.has(id)) fail(head, `Cards names no section: ${id}.`);
  const publications: Publication[] = [];
  for (const section of sections) {
    if (sources.has(sectionId(section))) {
      only(section, ['id']);
      for (const record of section.body) {
        if (record.kind !== 'publication') fail(record, 'A Cards source contains only :::publication definitions.');
        only(record, ['id', 'title', 'authors', 'venue', 'venue short', 'year', 'topic', 'paper', 'code']);
        const id = required(record, 'id');
        if (!slug(id)) fail(record, 'Invalid publication Id.');
        const year = Number(required(record, 'year'));
        if (!Number.isInteger(year)) fail(record, 'Invalid Year.');
        if ([...walk(record.body)].some(n => ['publication', 'profile', 'collapse'].includes(n.kind))) fail(record, 'Publication abstracts accept standard Markdown and paper references.');
        if (publications.some(p => p.id === id)) fail(record, `Duplicate publication id: ${id}.`);
        for (const key of ['paper', 'code']) {
          const url = record.fields[key];
          if (url) {
            try { if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error(); }
            catch { fail(record, `${key} must be an HTTP(S) URL.`); }
          }
        }
        publications.push({ id, title: record.title, authors: required(record, 'authors'), venue: required(record, 'venue'), venueShort: required(record, 'venue short'), year, topic: required(record, 'topic'), links: { paper: required(record, 'paper'), ...(record.fields.code ? { code: record.fields.code } : {}) },
          ...(record.body.length ? { abstract: record.text } : {}) });
      }
    } else {
      if (!commandOf(section)) fail(section, 'Section is neither a command nor a Cards source.');
      for (const block of walk(section.body)) {
        if (block.kind === 'publication') fail(block, 'Publication definitions belong in a Cards source.');
        only(block, block.kind === 'paper' ? ['ref'] : ['role', 'location', 'period', 'links']);
        if (block.kind === 'profile' && (block.body.length || Object.keys(block.fields).length)) fail(block, 'Profile component must be empty.');
        if (block.kind === 'paper' && [...walk(block.body)].some(n => ['paper', 'publication', 'profile', 'collapse'].includes(n.kind))) fail(block, 'A paper description contains standard Markdown blocks only.');
        if (block.kind === 'markdown' && block.blockType === 'paragraph' && /^(?:Id|Role|Location|Period|Links|Command|Summary|Cards):/m.test(block.text ?? '')) fail(block, 'Move metadata directly under its heading or list item.');
      }
    }
  }
  for (const record of walk([head])) {
    try { parseLinks(record.fields.links); }
    catch (error) { fail(record, error instanceof Error ? error.message : 'Invalid Links field.'); }
  }
  return parseSiteData({ source, sections, publications, profile: {
    name: head.title, position: required(head, 'position'), email: required(head, 'email'), links: parseLinks(head.fields.links),
    home, title: head.fields.title ?? `${head.title} - Homepage`, description: required(head, 'description'),
  } });
}
export async function loadSiteData(readText: (path: string) => Promise<string>): Promise<SiteData> {
  return parseSiteMarkdown(await readText(siteFile));
}
