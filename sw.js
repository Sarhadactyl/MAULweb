/* Increase this version whenever the offline shell or caching rules change. */
const VERSION = 'maul-pwa-v1';
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;
const PUBLIC_DATA = new Set(['/data/events.json', '/data/regioninfo.json', '/data/featured_mod.json']);
const CORE = [
  '/', '/offline.html', '/manifest.webmanifest', '/scripts/navbar.js', '/scripts/pwa.js',
  '/styles/navbar.css', '/styles/pwa.css', '/components/navbar.html',
  '/pwa/icons/apple-touch-icon.png', '/pwa/icons/icon-192.png', '/pwa/icons/icon-512.png',
  '/pwa/icons/icon-maskable-512.png', '/images/favicon.png', '/images/maulnobg.png',
  '/editor.html', '/tags.html', '/hexhelper.html', '/templates.html', '/regions.html'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(CORE)));
  // Updates wait for old app windows to close, avoiding a mix of code versions mid-edit.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('maul-pwa-') && ![SHELL, PAGES].includes(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function storedPage(request) {
  const pages = await caches.open(PAGES);
  const shell = await caches.open(SHELL);
  const find = async key => (await pages.match(key, { ignoreSearch: true })) || (await shell.match(key, { ignoreSearch: true }));
  const cached = await find(request);
  if (cached) return cached;
  const url = new URL(request.url);
  if (!url.pathname.split('/').pop().includes('.')) {
    return (await find(url.origin + url.pathname.replace(/\/$/, '') + '.html')) ||
      (await find(url.origin + url.pathname.replace(/\/?$/, '/') + 'index.html'));
  }
}

async function networkFirst(request, navigation) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic' && !response.redirected &&
        (!navigation || /text\/html/i.test(response.headers.get('Content-Type') || ''))) {
      try {
        const cache = await caches.open(PAGES);
        const key = new URL(request.url);
        key.search = '';
        // Cache only static HTML and the explicitly public, non-personal catalogue data below.
        await cache.put(key.href, response.clone());
        const keys = await cache.keys();
        while (keys.length > 40) await cache.delete(keys.shift());
      } catch { /* A full or unavailable cache must not prevent opening an online page. */ }
    }
    if (response.status >= 500) throw new Error('Server unavailable');
    return response;
  } catch {
    const cached = await storedPage(request);
    if (cached) return cached;
    if (navigation) return (await caches.match('/offline.html')) || new Response('You are offline. Reconnect to open MAUL.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Auth requests, POSTs, external APIs, Discord, and third-party assets go directly to the network.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, true));
  } else if (PUBLIC_DATA.has(url.pathname)) {
    event.respondWith(networkFirst(request, false));
  } else if (CORE.includes(url.pathname) && url.pathname !== '/') {
    if (!url.pathname.endsWith('.png')) {
      event.respondWith(networkFirst(request, false));
      return;
    }
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      return (await cache.match(url.pathname)) || fetch(request);
    })());
  }
});
