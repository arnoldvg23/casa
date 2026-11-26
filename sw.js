// Obre l'app a l'instant i sense cobertura: tot surt de la caché de la versió
// instal·lada. Quan n'hi ha una de nova, l'app ofereix «Actualitza».
const CACHE = 'casa-v13';
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

// L'SDK de Firebase té la versió a l'adreça: es pot guardar en una caché pròpia
// que no s'esborra en cada actualització de l'app (així funciona sense xarxa).
const SDK_CACHE = 'casa-firebase-11.10.0';

// Les versions fins a la v11 no saben mostrar l'avís «Actualitza»: si el
// mòbil en té una, la nova pren el control directament una sola vegada.
async function comesFromLegacy() {
  const keys = await caches.keys();
  return keys.some((key) => /^casa-v([0-9]+)$/.test(key) && Number(key.slice(6)) <= 11);
}

self.addEventListener('install', (event) => {
  // `reload` salta la caché HTTP del navegador: tota la versió es baixa de nou
  // i de cop, i fins que no hi és tota no s'instal·la.
  event.waitUntil((async () => {
    const legacy = await comesFromLegacy();
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })));
    if (legacy) self.skipWaiting();
  })());
});

// L'app demana activar la versió nova quan l'usuari toca «Actualitza».
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== SDK_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Els fitxers de l'app surten sempre de la caché de la versió instal·lada, mai
// barrejats amb fitxers d'una altra versió. Una versió nova només arriba amb
// un sw.js nou, que ho torna a baixar tot.
async function fromShell(request) {
  const cache = await caches.open(CACHE);
  // Qualsevol navegació (també l'enllaç d'invitació ?llar=…) obre index.html.
  const cached = request.mode === 'navigate'
    ? await cache.match('index.html')
    : await cache.match(request);
  return cached ?? fetch(request);
}

async function fromSdk(request) {
  const cache = await caches.open(SDK_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === location.origin) event.respondWith(fromShell(event.request));
  else if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/11.10.0/')) event.respondWith(fromSdk(event.request));
});

// El servidor envía avisos con `tag` común: varios productos seguidos se
// sustituyen entre sí en vez de llenar la pantalla de notificaciones.
self.addEventListener('push', (event) => {
  const { title, body } = event.data?.json()?.data ?? {};
  if (!title) return;
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
