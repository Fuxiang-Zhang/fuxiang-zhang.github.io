import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { renderReading } from '../src/render.js';
import { loadSiteData } from '../src/markdown.js';

/** Prepare a complete static export before the bootstrap publishes it. */
export async function buildSite(root: URL, compiled: URL, output: URL): Promise<void> {
  const site = await loadSiteData(path => readFile(new URL(path, root), 'utf8'));
  await mkdir(output, { recursive: true });
  for (const path of ['index.html', 'styles.css', 'assets', 'data', 'redirect']) {
    await cp(new URL(path, root), new URL(path, output), { recursive: true });
  }
  await cp(new URL('src/', compiled), output, { recursive: true });
  await writeFile(new URL('reading.html', output), renderReading(site));
  await writeFile(new URL('.nojekyll', output), '');
}
