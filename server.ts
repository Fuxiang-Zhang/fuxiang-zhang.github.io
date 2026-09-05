import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockReply } from './src/chat.js';
import { isRecord } from './src/types.js';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};
function inside(root: string, path: string): boolean {
  const child = relative(root, path);
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function json(res: http.ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

export function createServer(publicRoot = root) {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname); }
    catch { return json(res, 400, { error: 'Invalid URL.' }); }
    if (pathname === '/api/chat') {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Use POST.' }); }
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Expected JSON.' });
      try {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 12000) return json(res, 413, { error: 'Request too large.' });
        }
        let input: unknown;
        try { input = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid JSON.' }); }
        if (!isRecord(input) || typeof input.message !== 'string' || !input.message.trim() || input.message.length > 2000) {
          return json(res, 400, { error: 'Message must contain 1–2000 characters.' });
        }
        return json(res, 200, mockReply());
      } catch { if (!res.writableEnded) json(res, 500, { error: 'Could not process request.' }); }
      return;
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
  createServer().listen(port, host, () => console.log(`Local: http://${host}:${port}`));
}
