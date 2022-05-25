self.addEventListener('install', () => {
    console.log('Install!');
});
self.addEventListener('activate', () => {
    console.log('Activate!');
});
self.addEventListener(
    'fetch', (event) => {event.respondWith(fetch(event.request))});
