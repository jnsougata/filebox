const CACHE_NAME = 'cache-v1';
const urlsToCache = [
    '/',
    '/manifest.json',
    '/service-worker.js',
    '/assets/icon.png',
    '/scripts/index.js',
    '/scripts/helper.js',
    '/scripts/worker.js',
    '/scripts/uploader.js',
    '/scripts/login.js',
    '/scripts/shared.js',
    '/styles/index.css',
    
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