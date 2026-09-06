import http from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleChat, DEFAULT_TOKEN_BUDGET, type ChatEnv } from './chat/handler.js';
import { MemoryStore, numericSetting } from './chat/limits.js';
import { loadSiteData } from './src/markdown.js';
import { MAX_BODY, type SiteData } from './src/types.js';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};
function inside(root: string, path: string): boolean {
  const child = relative(root, path);
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function json(res: http.ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

/*
 * Local chat backend: the same handler as the Cloudflare Worker, fed with the
 * exported site data. With OPENAI_API_KEY set (e.g. in .env) replies are live;
 * otherwise they are the labelled mock. Rate limits are kept generous locally.
 */
export function createServer(publicRoot = root) {
  const store = new MemoryStore();
  let site: Promise<SiteData> | undefined;
  async function chatEnv(host = 'localhost'): Promise<ChatEnv> {
    site ??= loadSiteData(path => readFile(join(publicRoot, path), 'utf8'));
    return {
      site: await site,
      openaiKey: process.env.OPENAI_API_KEY || undefined,
      model: process.env.OPENAI_MODEL || undefined,
      allowedOrigins: [`http://${host}`],
      store,
      perHour: 200,
      tokenBudget: numericSetting(process.env.TOKEN_BUDGET_PER_DAY, DEFAULT_TOKEN_BUDGET),
    };
  }

  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname); }
    catch { return json(res, 400, { error: 'Invalid URL.' }); }
    if (pathname === '/api/chat') {
      const controller = new AbortController();
      const disconnect = () => { if (!res.writableFinished) controller.abort(); };
      res.on('close', disconnect);
      try {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY) return json(res, 413, { error: 'Request too large.' });
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks).toString('utf8');
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') headers.set(name, value);
        }
        const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/api/chat'}`, {
          signal: controller.signal, method: req.method, headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method ?? '') ? undefined : body,
        });
        const response = await handleChat(request, await chatEnv(req.headers.host));
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.flushHeaders();
        if (response.body) await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>), res);
        else res.end();
        return;
      } catch {
        if (res.headersSent || res.destroyed) res.destroy();
        else json(res, 503, { error: 'The assistant is unavailable right now.' });
        return;
      } finally { res.off('close', disconnect); }
    }
    if (!['GET', 'HEAD'].includes(req.method || '')) return json(res, 405, { error: 'Method not allowed.' });
    try {
      const canonicalRoot = await realpath(publicRoot);
      const requested = resolve(canonicalRoot, `.${pathname}`);
      if (pathname.includes('\\') || pathname.includes('\0') || !inside(canonicalRoot, requested)) {
        return json(res, 404, { error: 'Not found.' });
      }
      let file = await realpath(requested);
      if (!inside(canonicalRoot, file)) return json(res, 404, { error: 'Not found.' });
      if ((await stat(file)).isDirectory()) {
        if (!pathname.endsWith('/')) {
          res.writeHead(308, { Location: `${new URL(req.url || '/', 'http://localhost').pathname}/${new URL(req.url || '/', 'http://localhost').search}` });
          return res.end();
        }
        file = await realpath(join(file, 'index.html'));
      }
      if (!inside(canonicalRoot, file) || !(await stat(file)).isFile()) {
        return json(res, 404, { error: 'Not found.' });
      }
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': mimeTypes[extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': data.length,
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { json(res, 404, { error: 'Not found.' }); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const server = createServer();
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use, probably by an earlier preview server.\nFind it with: lsof -nP -iTCP:${port} -sTCP:LISTEN   then stop it with: kill <PID>\nOr start on another port: PORT=3001 npm run dev`);
      process.exit(1);
    }
    throw error;
  });
  server.listen(port, host, () => console.log(`Local: http://${host}:${port}`));
}
