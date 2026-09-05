import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { mockReply } from './src/chat.js';
import { isRecord } from './src/types.js';

const root = new URL('../dist/', import.meta.url);
const publicFiles = new Map<string, [string, string]>([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/reading.html', ['reading.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']],
  ...['content', 'render', 'types'].map((name): [string, [string, string]] => [`/${name}.js`, [`${name}.js`, 'text/javascript']]),
  ['/chat.js', ['chat.js', 'text/javascript']], ['/config.js', ['config.js', 'text/javascript']],
  ['/data/publications.json', ['data/publications.json', 'application/json']],
  ['/assets/Photo.JPG', ['assets/Photo.JPG', 'image/jpeg']],
  ['/assets/favicon.svg', ['assets/favicon.svg', 'image/svg+xml']],
  ['/redirect/index.html', ['redirect/index.html', 'text/html']], ['/redirect/', ['redirect/index.html', 'text/html']],
]);

function json(res: http.ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

export function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
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
        return json(res, 200, mockReply(input.language === 'zh' ? 'zh' : 'en'));
      } catch { if (!res.writableEnded) json(res, 500, { error: 'Could not process request.' }); }
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method || '')) return json(res, 405, { error: 'Method not allowed.' });
    const file = publicFiles.get(pathname);
    if (!file) return json(res, 404, { error: 'Not found.' });
    try {
      const data = await readFile(new URL(file[0], root));
      res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { json(res, 404, { error: 'Not found.' }); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  createServer().listen(port, host, () => console.log(`Local: http://${host}:${port}`));
}
