import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { build } from 'esbuild';
import { escapeHTML } from '../src/render.js';
import { commandOf, sectionId } from '../src/types.js';
import { loadSiteData } from '../src/markdown.js';

/** Prepare a complete static export before the bootstrap publishes it. */
export async function buildSite(root: URL, compiled: URL, output: URL): Promise<void> {
  const site = await loadSiteData(path => readFile(new URL(path, root), 'utf8'));
  await mkdir(output, { recursive: true });
  for (const path of ['styles.css', 'assets', 'data', 'redirect']) {
    await cp(new URL(path, root), new URL(path, output), { recursive: true });
  }
  await cp(new URL('src/', compiled), output, { recursive: true });
  const values: Record<string, string> = {
    title: site.profile.title, description: site.profile.description, home: site.profile.home,
    homeCommand: commandOf(site.sections.find(s => sectionId(s) === site.profile.home)!)!,
  };
  const template = await readFile(new URL('index.html', root), 'utf8');
  await writeFile(new URL('index.html', output), template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`Unknown template variable: ${key}`);
    return escapeHTML(values[key]);
  }));
  await build({ entryPoints: [new URL('src/app.js', compiled).pathname], outfile: new URL('app.js', output).pathname,
    bundle: true, platform: 'browser', format: 'esm', target: 'es2022' });
  await writeFile(new URL('.nojekyll', output), '');
}
