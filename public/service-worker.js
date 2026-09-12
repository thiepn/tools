'use strict';

const CACHE_NAME = 'tiny-tools-pwa-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './maskable-icon.svg'
];

const scopeUrl = new URL('./', self.registration.scope);
const assetPrefix = new URL('./assets/', scopeUrl).pathname;
const staticPaths = new Set(CORE.slice(2).map(path => new URL(path, scopeUrl).pathname));

async function putIfUsable(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(CORE.map(async path => {
    try {
      const request = new Request(new URL(path, scopeUrl), { cache: 'reload' });
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response);
    } catch (_) {
      // Runtime caching can repair optional entries later.
    }
  }));

  const shell = await cache.match(new Request(new URL('./index.html', scopeUrl))) ||
                await cache.match(new Request(new URL('./', scopeUrl)));
  if (!shell) throw new Error('Tiny Tools PWA could not cache an app shell.');
}

self.addEventListener('install', event => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('tiny-tools-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, navigation = false) {
  try {
    const response = await fetch(request);
    await putIfUsable(request, response);
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (navigation) {
      return (await caches.match(new Request(new URL('./index.html', scopeUrl)))) ||
             (await caches.match(new Request(new URL('./', scopeUrl)))) ||
             Response.error();
    }
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    await putIfUsable(request, response);
    return response;
  } catch (_) {
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, true));
    return;
  }

  if (url.pathname.startsWith(assetPrefix) || staticPaths.has(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
