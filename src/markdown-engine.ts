import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { detailsPlugin } from './markdown-details.js';

/** Shared standard Markdown engine. Raw HTML stays text; components are parsed separately. */
export const markdown = new MarkdownIt({ html: false, breaks: false });
markdown.validateLink = url => /^(https?:\/\/|mailto:|#|\/[^/]|\.\.?\/)/i.test(url);
const linkOpen = markdown.renderer.rules.link_open;
markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  if (/^https?:/i.test(String(tokens[index].attrGet('href') ?? ''))) {
    tokens[index].attrSet('target', '_blank');
    tokens[index].attrSet('rel', 'noopener noreferrer');
  }
  return linkOpen ? linkOpen(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
};
for (const name of ['paper', 'publication', 'profile']) {
  markdown.use(container, name, { validate: (info: string) => new RegExp(`^${name}(?:\\s|\\{|$)`).test(info.trim()) });
}
markdown.use(detailsPlugin);
export const renderInline = (text: string): string => markdown.renderInline(text);
