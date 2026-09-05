import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
async function snapshot(directory: string): Promise<Record<string, string>> {
  const files = await readdir(directory, { recursive: true, withFileTypes: true });
  const hashes: Record<string, string> = {};
  for (const file of files) {
    if (file.isFile()) {
      const path = join(file.parentPath, file.name);
      hashes[path.slice(directory.length)] = createHash('sha256').update(await readFile(path)).digest('hex');
    }
  }
  return hashes;
}

test('build removes stale modules and preserves the last successful output on failures', async t => {
  const fixture = await mkdtemp(join(tmpdir(), 'fuxiang-build-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  for (const path of ['src', 'scripts', 'server.ts', 'tsconfig.json', 'package.json', 'index.html', 'styles.css', 'assets', 'data', 'redirect']) {
    await cp(join(root, path), join(fixture, path), { recursive: true });
  }
  await symlink(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
  const build = () => exec(process.execPath, ['scripts/build.mjs'], { cwd: fixture });
  const obsolete = join(fixture, 'src/obsolete.ts');
  await writeFile(obsolete, 'export const obsolete = true;');
  await build();
  assert.match(await readFile(join(fixture, 'dist/obsolete.js'), 'utf8'), /obsolete/);
  await rm(obsolete);
  await writeFile(join(fixture, 'assets/new-resource.txt'), 'New resource');
  await build();
  await assert.rejects(readFile(join(fixture, 'dist/obsolete.js')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(fixture, '.build/src/obsolete.js')), { code: 'ENOENT' });
  assert.equal(await readFile(join(fixture, 'dist/assets/new-resource.txt'), 'utf8'), 'New resource');
  const before = await snapshot(join(fixture, 'dist'));
  const compiledBefore = await snapshot(join(fixture, '.build'));
  const unchanged = async () => {
    assert.deepEqual(await snapshot(join(fixture, 'dist')), before);
    assert.deepEqual(await snapshot(join(fixture, '.build')), compiledBefore);
    assert.deepEqual((await readdir(fixture)).filter(name => name.startsWith('.build-')), []);
  };
  await writeFile(obsolete, 'const broken: string = 123;');
  await assert.rejects(build());
  await unchanged();
  await rm(obsolete);
  const data = join(fixture, 'data/cv.json');
  const validData = await readFile(data);
  await writeFile(data, '{"experience":[{"organization":"incomplete"}]}');
  await assert.rejects(build());
  await unchanged();
  await writeFile(data, validData);
  await rm(join(fixture, 'assets'), { recursive: true });
  await assert.rejects(build());
  await unchanged();
});
