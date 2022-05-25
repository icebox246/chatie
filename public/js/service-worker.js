self.addEventListener('install', () => {
    console.log('Install!');
});

self.addEventListener(
    'fetch', (event) => {event.respondWith(fetch(event.request))});
