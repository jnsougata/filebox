const CACHE_NAME = 'cache-v1';
const urlsToCache = [
    '/assets/',
    '/static/',
    '/scripts/',
    '/styles/',
    '/pwa/',
];

self.addEventListener('install', (ev) => {
    ev.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('fetch',  (ev) => {
    
});