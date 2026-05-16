#!/usr/bin/env node
/**
 * motion-video-maker / preview.mjs
 * ----------------------------------------------------------------
 * Tiny static HTTP server that serves the project root so a
 * composition HTML file can be opened in any browser for live
 * inspection (the runtime auto-starts a wall-clock loop when
 * `window.__mvmRenderMode` is false).
 *
 * Usage:
 *   node scripts/preview.mjs [composition.html] [--port 5173]
 */
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let port = 5173;
let entry = 'templates/base.html';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port') port = parseInt(args[++i], 10);
  else if (args[i].startsWith('--')) continue;
  else entry = args[i];
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.otf':   'font/otf',
};

const server = http.createServer(async (req, res) => {
  try {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/' || url === '') url = '/' + entry;
    const filepath = path.normalize(path.join(ROOT, url));
    if (!filepath.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
    const data = await fs.readFile(filepath);
    const ext = path.extname(filepath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found: ' + req.url);
  }
});

server.listen(port, () => {
  console.log('[mvm] preview server: http://localhost:' + port + '/' + entry);
  console.log('[mvm] root:', ROOT);
});
