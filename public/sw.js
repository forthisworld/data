/*
 * data.ftw service worker: makes the atlas installable and usable offline.
 *  - map boundaries, icons and built assets: cache first (they are versioned or rarely change)
 *  - pages: network first, falling back to the last cached copy, then to the cached atlas
 *  - API calls: network only (search, MCP, contributions must be live)
 * Bump VERSION to drop old caches.
 */
const VERSION = 'v4';
const STATIC = `ftw-static-${VERSION}`;
const PAGES = `ftw-pages-${VERSION}`;
const PRECACHE = [
    '/in',
    '/geo/in/states.geojson',
    '/geo/in/districts.geojson',
    '/geo/in/india.geojson',
    '/geo/in/labels.geojson',
    '/geo/in/routes.geojson',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC).then(cache =>
            // Don't fail the install if one optional file is missing.
            Promise.all(PRECACHE.map(url => cache.add(url).catch(() => undefined)))
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => ![STATIC, PAGES].includes(k)).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/')) return; // always live

    const isStatic =
        url.pathname.startsWith('/_next/static/') ||
        url.pathname.startsWith('/geo/') ||
        url.pathname.startsWith('/icons/');

    if (isStatic) {
        event.respondWith(
            caches.match(req).then(hit => hit || fetch(req).then(res => {
                if (res.ok) { const copy = res.clone(); caches.open(STATIC).then(c => c.put(req, copy)); }
                return res;
            }))
        );
        return;
    }

    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req).then(res => {
                if (res.ok) { const copy = res.clone(); caches.open(PAGES).then(c => c.put(req, copy)); }
                return res;
            }).catch(() => caches.match(req).then(hit => hit || caches.match('/in')))
        );
    }
});
