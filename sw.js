/* Service worker Авторынка: установка на главный экран и работа без сети */
const VERSION = 'ar-v5';
const CORE = ['./', 'index.html', 'style.css?v=5', 'common.js?v=5', 'app.js?v=5', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // GitHub API, шрифты — напрямую
  if (url.pathname.endsWith('/admin.html') || url.pathname.endsWith('/admin.js') || url.pathname.includes('/data/admins.json')) return;

  // Страницы и база объявлений — сначала сеть (свежие данные), без сети — из кеша
  if (req.mode === 'navigate' || url.pathname.endsWith('/data/db.json')) {
    const key = req.mode === 'navigate' ? './' : new Request(url.origin + url.pathname);
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key)));
    return;
  }
  // Статика и фото — из кеша, в фоне обновляем
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req);
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
