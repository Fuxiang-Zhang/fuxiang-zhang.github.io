import { watch } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
let server: ChildProcess | undefined;
let building = false;
let dirty = false;
let timer: ReturnType<typeof setTimeout>;

function startServer() {
  server = spawn(process.execPath, ['--env-file-if-exists=.env', '.build/server.js'], { cwd: root, stdio: 'inherit' });
  server.on('error', error => console.error(error.message));
}
async function stopServer() {
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await exited;
  }
}
async function rebuild() {
  dirty = true;
  if (building) return;
  building = true;
  try {
    while (dirty) {
      dirty = false;
      const build = spawn('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
      const [code] = await once(build, 'exit');
      if (code === 0) {
        await stopServer();
        startServer();
        console.log('Updated. Refresh the browser to see your changes.');
      } else console.error('Build failed; the last working preview is still running.');
    }
  } catch (error) { console.error(error); }
  finally { building = false; }
}

startServer();
const watcher = watch(root, { recursive: true }, (_, filename) => {
  if (!filename || !/^(src\/|chat\/|worker\/|scripts\/|data\/|assets\/|redirect\/|index\.html$|styles\.css$|server\.ts$|tsconfig\.json$)/.test(filename)) return;
  clearTimeout(timer);
  timer = setTimeout(() => void rebuild(), 150);
});
// SIGHUP covers a closed terminal window, so the preview server does not outlive the watcher.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.once(signal, () => {
    clearTimeout(timer);
    watcher.close();
    void stopServer().finally(() => process.exit(0));
  });
}
