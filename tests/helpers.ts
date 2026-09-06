import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSiteData } from '../src/markdown.js';

export const readLocal = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
export const site = await loadSiteData(readLocal);

const decode = (text: string) => text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
  if (code.startsWith('#')) return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
  return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' } as Record<string, string>)[code.toLowerCase()] ?? entity;
});
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

// Compare text and destinations, never CSS classes, tag nesting, icons or layout.
// This extracts generated HTML content; it does not measure browser visibility.
export const textContent = (html: string) => normalize(decode(html
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<!--[^]*?-->/g, '')
  .replace(/<\/?(?:p|div|section|article|h[1-6]|li|br)\b[^>]*>/gi, ' ')
  .replace(/<[^>]*>/g, '')));

export function assertText(html: string, source: string, message?: string) {
  const expected = normalize(source.replace(/\[([^\]]+)\]\((?:https?:\/\/|#)[^\s)]+\)/g, '$1').replace(/\*\*(\S(?:[\s\S]*?\S)?)\*\*/g, '$1'));
  assert.ok(textContent(html).includes(expected), message ?? `Missing or changed content: ${expected}`);
  for (const match of source.matchAll(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)) assertLink(html, match[1]);
}

export function assertLink(html: string, url: string) {
  const destinations = [...html.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)].map(match => decode(match[2]));
  assert.ok(destinations.includes(url), `Missing or changed link: ${url}`);
}
