// Abre la app al instante y sin cobertura: sirve la copia guardada y actualiza
// en segundo plano, así que una versión nueva se ve en la siguiente apertura.
const CACHE = 'casa-v9';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'fonts/jakarta-latin.woff2',
  'fonts/jakarta-latin-ext.woff2',
  'manifest.webmanifest',
  'js/app.js',
  'js/firebase-config.js',
  'js/finances.js',
  'js/gifts.js',
  'js/habits.js',
  'js/products.js',
  'js/shopping.js',
  'js/store.js',
  'js/ui.js',
  'js/wishes.js',
  'js/vendor/Sortable.min.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // `reload` salta la caché HTTP del navegador: sense això una versió nova
  // podria barrejar fitxers nous i vells i trencar l'app.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  // ignoreSearch: el enlace de invitación ?hogar=… también debe abrir sin red.
  const cached = await cache.match(event.request, { ignoreSearch: event.request.mode === 'navigate' });
  const fresh = fetch(event.request).then((response) => {
    if (response.ok) cache.put(event.request, response.clone());
    return response;
  });
  if (!cached) return fresh;
  event.waitUntil(fresh.catch(() => {}));
  return cached;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isOwn = url.origin === location.origin;
  const isFirebaseSdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (isOwn || isFirebaseSdk) event.respondWith(staleWhileRevalidate(event));
});

// El servidor envía avisos con `tag` común: varios productos seguidos se
// sustituyen entre sí en vez de llenar la pantalla de notificaciones.
self.addEventListener('push', (event) => {
  const { title, body } = event.data.json().data;
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: 'icons/icon-192.png',
    tag: 'compra',
    renotify: true,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((open) => (open[0] ? open[0].focus() : self.clients.openWindow('./'))),
  );
});
