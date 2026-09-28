/* Service Worker – macht die App offline verfügbar. */
var CACHE = 'baumkontrolle';
var DATEIEN = ['./', './index.html', './manifest.webmanifest',
               './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
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
  /* Kartenkacheln kommen von fremden Servern und haben im Cache der App
     nichts verloren: ein Tag Kartenarbeit waeren hunderte Megabyte, und wenn
     der Speicher ueberlaeuft, wirft der Browser den ganzen Cache weg. Dann
     startet die App auf der Baustelle nicht mehr. Der Browser haelt die
     Kacheln ohnehin in seinem normalen Zwischenspeicher. */
  if (e.request.url.indexOf(self.location.origin) !== 0) return;
  e.respondWith(
    caches.match(e.request).then(function (treffer) {
      var netz = fetch(e.request).then(function (antwort) {
        if (antwort && antwort.status === 200) {
          if (treffer && geaendert(treffer, antwort)) sagBescheid();
          var kopie = antwort.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, kopie); });
        }
        return antwort;
      }).catch(function () { return treffer; });
      return treffer || netz;
    })
  );
});

/* GitHub Pages liefert einen ETag je Datei. Ändert er sich, liegt eine neue
   Fassung im Cache – ohne dass irgendein Inhalt gelesen werden müsste. */
function geaendert(alt, neu) {
  var a = alt.headers.get('etag'), b = neu.headers.get('etag');
  return !!(a && b && a !== b);
}

/* Beim Neuladen laufen mehrere Anfragen gleichzeitig, und die erste davon
   kommt oft an, bevor die neue Seite überhaupt zuhört. Deshalb wird der
   Fund gemerkt und die Seite darf jederzeit nachfragen. */
var neueDa = false;

function sagBescheid() {
  neueDa = true;
  self.clients.matchAll({ type: 'window' }).then(function (fenster) {
    fenster.forEach(function (f) { f.postMessage({ art: 'neueFassung' }); });
  });
}

self.addEventListener('message', function (e) {
  if (e.data && e.data.art === 'fassungPruefen' && neueDa && e.source) {
    e.source.postMessage({ art: 'neueFassung' });
  }
});
