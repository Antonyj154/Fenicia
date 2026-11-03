// FENICIA · Service worker: permite instalar el juego como app y abrirlo sin conexión.
// La versión cambia en cada compilación (scripts/standalone.py), así llegan las actualizaciones.
const VERSION = '__VERSION__';
const CACHE = 'fenicia-' + VERSION;
const CORE = ['./', './index.html', './manifest.webmanifest', './assets/icons/icon-192.png', './assets/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('fenicia-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;          // el audio se pide por partes: directo a la red
  const url = new URL(req.url);
  const html = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (html) {
    // La página: primero la red (para tener la última versión), si no hay conexión, la copia
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  if (url.origin !== location.origin && !url.hostname.endsWith('gstatic.com') && !url.hostname.endsWith('googleapis.com')) return;
  // Arte, datos y fuentes: de la copia si existe; si no, de la red y se guarda
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && !url.pathname.includes('/audio/')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
