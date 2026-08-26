/* Service worker: tiene l'app giocabile anche senza connessione.
   Alza VERSIONE a ogni rilascio: la vecchia cache viene buttata. */
const VERSIONE = 'burraco-v13';

const FILE = [
  './',
  './index.html',
  './styles.css',
  './src/engine.js',
  './src/ui.js',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(VERSIONE)
      // addAll fallisce tutto se un file manca: qui li mettiamo uno a uno
      .then(c => Promise.all(FILE.map(f => c.add(f).catch(() => { }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(nomi => Promise.all(nomi.filter(n => n !== VERSIONE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // I font di Google: si usano se ci sono, altrimenti valgono i caratteri di sistema.
  if (url.origin !== self.location.origin) {
    ev.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copia = res.clone();
        caches.open(VERSIONE).then(c => c.put(req, copia)).catch(() => { });
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // File dell'app: si serve subito la copia locale e nel frattempo si aggiorna.
  ev.respondWith(
    caches.match(req).then(hit => {
      const rete = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copia = res.clone();
          caches.open(VERSIONE).then(c => c.put(req, copia)).catch(() => { });
        }
        return res;
      }).catch(() => hit || caches.match('./index.html'));
      return hit || rete;
    })
  );
});
