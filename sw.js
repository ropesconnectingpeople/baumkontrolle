/* Service Worker – macht die App offline verfügbar. */
var CACHE = 'baumkontrolle-8d9203fb';
var DATEIEN = ['./', './index.html', './manifest.webmanifest',
               './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(DATEIEN); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (namen) {
    return Promise.all(namen.filter(function (n) { return n !== CACHE; })
                            .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Erst aus dem Cache antworten, dann im Hintergrund auffrischen.
   So startet die App auf der Baustelle auch ohne Empfang sofort. */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (treffer) {
      var netz = fetch(e.request).then(function (antwort) {
        if (antwort && antwort.status === 200) {
          var kopie = antwort.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, kopie); });
        }
        return antwort;
      }).catch(function () { return treffer; });
      return treffer || netz;
    })
  );
});
