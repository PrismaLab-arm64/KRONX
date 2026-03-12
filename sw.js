/* =========================================================
   ECHO_OFF — Service Worker (SAFE UPDATE + PWA CACHE FIX)
   Objetivo:
   - Evitar que el cache congele tus cambios de UI
   - Mantener PWA offline-friendly sin romper app.js
   - Network-first para navegación (index.html)
   - Stale-while-revalidate para assets (css/js/img)
   ========================================================= */

'use strict';

// 🔁 CAMBIA ESTO cada vez que subas cambios importantes de UI
const SW_VERSION = 'echo_off_sw_2026-02-07_0';

// Nombres de caché versionados
const CACHE_STATIC = `${SW_VERSION}::static`;
const CACHE_RUNTIME = `${SW_VERSION}::runtime`;

// App shell (archivos base). Si alguno no existe, NO rompe instalación (usa allSettled).
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-app.png',

  // ✅ si ya lo agregaste para el rediseño:
  './theme.clean.css',

  // ✅ si vas a usar fondo patrón (opcional):
  './bg-pattern.jpg'
];

// Helpers
const isGET = (req) => req.method === 'GET';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // Fuerza que el SW nuevo se instale sin esperar pestañas antiguas
    self.skipWaiting();

    const cache = await caches.open(CACHE_STATIC);

    // Usamos allSettled para que si faltan assets (ej bg-pattern.jpg),
    // NO se rompa la instalación ni tu app.
    const results = await Promise.allSettled(
      APP_SHELL.map((url) => cache.add(url))
    );

    // Si quieres depurar: ver qué falló
    // results.forEach((r, i) => { if (r.status === 'rejected') console.warn('SW cache fail:', APP_SHELL[i]); });
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Toma control inmediato de clientes abiertos
    if (self.clients && self.clients.claim) {
      await self.clients.claim();
    }

    // Limpia caches viejos (de versiones anteriores)
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => {
        const isCurrent = (key === CACHE_STATIC || key === CACHE_RUNTIME);
        if (!isCurrent) return caches.delete(key);
        return Promise.resolve(true);
      })
    );
  })());
});

/**
 * Estrategias:
 * 1) Navegación (index.html) -> NETWORK FIRST (para ver cambios siempre)
 * 2) Assets GET (css/js/img) -> STALE WHILE REVALIDATE
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo manejamos GET
  if (!isGET(req)) return;

  const url = new URL(req.url);

  // Evita interferir con extensiones o chrome-devtools
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const isNavigation = (req.mode === 'navigate') ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_RUNTIME);
  try {
    // Pedimos siempre al servidor primero
    const fresh = await fetch(req, { cache: 'no-store' });
    // Guardamos copia para offline
    cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    // Fallback a cache si no hay red
    const cached = await cache.match(req);
    if (cached) return cached;

    // Último fallback a index.html cacheado (para SPA/PWA)
    const staticCache = await caches.open(CACHE_STATIC);
    const shell = await staticCache.match('./index.html');
    if (shell) return shell;

    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_RUNTIME);
  const cached = await cache.match(req);

  const fetchPromise = (async () => {
    try {
      const fresh = await fetch(req);
      // Solo cachear respuestas válidas
      if (fresh && (fresh.status === 200 || fresh.type === 'opaque')) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      // Si falla red, devolvemos cache si existe
      if (cached) return cached;
      throw err;
    }
  })();

  // Si hay cache, responde rápido; si no, espera red
  return cached || fetchPromise;
}

// Permite “forzar actualización” desde app.js si envías mensajes al SW
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data && data.type === 'CLEAR_CACHES') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    })());
  }
});
