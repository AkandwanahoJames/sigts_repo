// Service Worker for PWA - Offline-first caching
// Following structured approach with event-driven architecture

const CACHE_NAME = 'bwindi-v7';
const STATIC_CACHE = 'bwindi-static-v7';
const DYNAMIC_CACHE = 'bwindi-dynamic-v7';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json'
];

// API endpoints to cache (GET requests only)
const API_CACHE_PATTERNS = [
    '/api/animals',
    '/api/locations',
    '/api/cultural',
    '/api/safety-tips',
    '/api/faqs'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    
    // Activate immediately
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== STATIC_CACHE && 
                        cacheName !== DYNAMIC_CACHE && 
                        cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Claim clients immediately
    return self.clients.claim();
});

// Fetch event - cache-first strategy for offline-first
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return fetch(event.request);
    }
    
    // Check if API request
    const isApiRequest = requestUrl.pathname.startsWith('/api/');
    
    if (isApiRequest) {
        // API requests: Network-first with cache fallback
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache successful responses
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(DYNAMIC_CACHE).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache
                    return caches.match(event.request);
                })
        );
    } else {
        // Static assets: Network-first strategy to avoid stale UI
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(STATIC_CACHE).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request).then((cached) => {
                        if (cached) return cached;
                        return caches.match('/index.html');
                    });
                })
        );
    }
});

// Force clients to update SW immediately
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    console.log('Background sync event:', event.tag);
    
    if (event.tag === 'sync-sightings') {
        event.waitUntil(syncSightings());
    }
});

async function syncSightings() {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const requests = await cache.keys();
        
        for (const request of requests) {
            if (request.url.includes('/api/sightings')) {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.delete(request);
                }
            }
        }
    } catch (error) {
        console.error('Sync failed:', error);
    }
}
