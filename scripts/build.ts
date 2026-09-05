import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { renderJourney, escapeHTML, authorMarkup, external as link } from '../src/render.js';
import { parsePublications } from '../src/types.js';
import { translations } from '../src/content.js';

const root = new URL('../../', import.meta.url);
const output = new URL('dist/', root);
const papers = parsePublications(JSON.parse(await readFile(new URL('data/publications.json', root), 'utf8')));
const groups = { reports:'Preprints, technical reports & workshops', conference:'Conference papers', journal:'Journal papers' };
const reading = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Fuxiang Zhang · Academic homepage</title><meta name="description" content="Fuxiang Zhang’s academic biography and complete publication list. Large language models, reinforcement learning, and multi-agent reinforcement learning."><link rel="stylesheet" href="styles.css"><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"></head>
<body><main class="reading-page"><a class="back-to-chat inline-link" href="index.html">← Back to the research space</a><img class="reading-photo" src="assets/Photo.JPG" alt="Fuxiang Zhang"><h1>Fuxiang Zhang</h1>
<p>${translations.en.intro}</p>
<div class="social-links"><a href="mailto:zfx.agi@gmail.com">Email ↗</a>${link('https://github.com/mansicer','GitHub ↗')}${link('https://scholar.google.com/citations?user=GZRrWXAAAAAJ','Google Scholar ↗')}${link('https://www.linkedin.com/in/fuxiang-zhang-2b7bb418a/','LinkedIn ↗')}</div>
<h2>Research interests</h2><p>Large Language Models · Reinforcement Learning · Multi-Agent Reinforcement Learning</p>
${renderJourney('en', true)}
${Object.entries(groups).map(([category, title]) => `<section><h2>${title}</h2>${papers.filter(p=>p.category===category).map(p=>`<article class="paper-card" id="${p.id}"><h3>${escapeHTML(p.title)}</h3><p class="paper-authors">${authorMarkup(p.authors)}</p><p class="paper-authors"><em>${escapeHTML(p.venue)}</em>, ${p.year}</p><div class="paper-links">${Object.entries(p.links).map(([name,url])=>link(url,`${name==='paper'?'Paper':'Code'} ↗`)).join('')}</div></article>`).join('')}</section>`).join('')}
<p class="section-footnote">* denotes equal contribution.</p><footer><p class="section-footnote">© ${new Date().getFullYear()} Fuxiang Zhang</p></footer></main></body></html>\n`;

// Generate the no-JavaScript view from the exact same publication records.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of ['index.html', 'styles.css', 'assets', 'data', 'redirect']) {
  await cp(new URL(path, root), new URL(path, output), { recursive: true });
}
await cp(new URL('.build/src/', root), output, { recursive: true });
await writeFile(new URL('reading.html', output), reading);
await writeFile(new URL('.nojekyll', output), '');
console.log(`Built static site in dist/ with ${papers.length} publications. Server code is excluded.`);
