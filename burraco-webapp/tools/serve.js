/* Server statico minimo per provare l'app in locale: `npm start`.
   Serve perché i moduli e il service worker non funzionano aprendo
   il file con doppio clic (file://), ma solo via http. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORTA = process.env.PORT || 8080;
const RADICE = new URL('..', import.meta.url).pathname;
const TIPI = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  let via = decodeURIComponent(req.url.split('?')[0]);
  if (via.endsWith('/')) via += 'index.html';
  const file = join(RADICE, normalize(via).replace(/^(\.\.[/\\])+/, ''));
  try {
    const dati = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TIPI[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(dati);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Non trovato: ' + via);
  }
}).listen(PORTA, () => console.log(`Burraco in ascolto su http://localhost:${PORTA}`));
