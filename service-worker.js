const CACHE_NAME = 'drift-13-14-self-destruct';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      const regs = await self.registration.unregister();
      const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
      for (const client of clients) client.navigate(client.url);
    } catch (e) {}
  })());
});
