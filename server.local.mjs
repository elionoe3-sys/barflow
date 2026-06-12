import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const DIST_DIR = resolve('dist');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function getLocalIps() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item.address);
}

async function serveFile(pathname) {
  const requestedPath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = join(DIST_DIR, requestedPath);
  if (existsSync(filePath)) return { body: await readFile(filePath), ext: extname(filePath) };
  return { body: await readFile(join(DIST_DIR, 'index.html')), ext: '.html' };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const { body, ext } = await serveFile(url.pathname);
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`BarFlow local server error: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`BarFlow serveur local lancé sur le port ${PORT}`);
  console.log('Depuis ce PC : http://localhost:' + PORT);
  for (const ip of getLocalIps()) console.log(`Depuis téléphone/tablette : http://${ip}:${PORT}`);
});