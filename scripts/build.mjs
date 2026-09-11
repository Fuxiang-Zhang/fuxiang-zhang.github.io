// Bootstrap the TypeScript compiler without requiring an existing .build/ directory.
import { mkdtemp, rename, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const stage = await mkdtemp(join(root, '.build-'));
const compiled = join(stage, 'compiled');
const site = join(stage, 'site');
const directoryURL = path => pathToFileURL(path + '/');
const replacements = [
  { source: compiled, target: join(root, '.build'), backup: join(stage, 'previous-build') },
  { source: site, target: join(root, 'dist'), backup: join(stage, 'previous-dist') },
];
const moved = [];
try {
  const result = spawnSync(process.execPath, [
    join(root, 'node_modules/typescript/bin/tsc'), '--outDir', compiled,
  ], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('TypeScript compilation failed.');
  const { buildSite } = await import(pathToFileURL(join(compiled, 'scripts/build.js')).href);
  await buildSite(directoryURL(root), directoryURL(compiled), directoryURL(site));

  // Publish only after compilation, content validation, and asset copying all succeed.
  for (const replacement of replacements) {
    const step = { ...replacement, backedUp: false, published: false };
    moved.push(step);
    try {
      await rename(step.target, step.backup);
      step.backedUp = true;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(step.source, step.target);
    step.published = true;
  }
  console.log('Built static site in dist/.');
} catch (error) {
  for (const step of moved.reverse()) {
    if (step.published) await rm(step.target, { recursive: true, force: true });
    if (step.backedUp) await rename(step.backup, step.target);
  }
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await rm(stage, { recursive: true, force: true });
}
