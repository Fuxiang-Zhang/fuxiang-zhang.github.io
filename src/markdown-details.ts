import type { MarkdownIt } from 'markdown-it';

/** GitHub-style details markup, parsed as a component without enabling arbitrary HTML. */
export function detailsPlugin(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'details', (state, startLine, endLine, silent) => {
    const lineAt = (line: number) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]).trim();
    const opening = lineAt(startLine);
    if (!/^<details\b/i.test(opening)) return false;
    if (silent) return true;
    const error = (message: string): never => { throw new Error(`Line ${startLine + 1}: ${message}`); };
    if (!/^<details(?:\s+open(?:\s*=\s*(?:"(?:open)?"|'(?:open)?'|open))?)?\s*>$/i.test(opening)) {
      return error('Use <details> or <details open>; other attributes are not supported.');
    }
    let summaryStart = startLine + 1;
    while (summaryStart < endLine && !lineAt(summaryStart)) summaryStart++;
    let summaryEnd = summaryStart;
    let summaryMarkup = lineAt(summaryStart);
    while (summaryEnd + 1 < endLine && !/<\/summary>\s*$/i.test(summaryMarkup)) {
      if (summaryEnd - summaryStart > 20 || /<\/?details\b/i.test(summaryMarkup)) break;
      summaryMarkup += ' ' + lineAt(++summaryEnd);
    }
    const summary = /^<summary>\s*([\s\S]+?)\s*<\/summary>$/i.exec(summaryMarkup);
    if (!summary) return error('A details block must start with <summary>Title</summary>.');
    const heading = /^<h([1-6])>\s*([\s\S]+?)\s*<\/h\1>$/i.exec(summary[1]);
    const title = heading ? heading[2] : summary[1];
    if (/<\/?(?:details|summary|h[1-6])\b/i.test(title)) return error('Malformed summary heading.');

    let depth = 1;
    let closeLine = summaryEnd + 1;
    let fence: { marker: string; length: number } | undefined;
    for (; closeLine < endLine; closeLine++) {
      const text = lineAt(closeLine);
      if (state.sCount[closeLine] - state.blkIndent >= 4) continue;
      const code = /^(`{3,}|~{3,})(.*)$/.exec(text);
      if (fence) {
        if (code && code[1][0] === fence.marker && code[1].length >= fence.length && !code[2].trim()) fence = undefined;
        continue;
      }
      if (code) { fence = { marker: code[1][0], length: code[1].length }; continue; }
      if (/^<details\b/i.test(text)) depth++;
      if (/^<\/details>$/i.test(text) && --depth === 0) break;
    }
    if (depth) return error('Unclosed <details> block.');
    const token = state.push('details_open', 'details', 1);
    token.block = true;
    token.map = [startLine, closeLine + 1];
    token.meta = { title, level: heading ? Number(heading[1]) : undefined, open: /\sopen\b/i.test(opening) };
    const previousMax = state.lineMax;
    state.lineMax = closeLine;
    state.md.block.tokenize(state, summaryEnd + 1, closeLine);
    state.lineMax = previousMax;
    const close = state.push('details_close', 'details', -1);
    close.block = true;
    state.line = closeLine + 1;
    return true;
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
}
