#!/usr/bin/env python3
"""
pwa.py – schnürt aus Baumkontrolle.html den Ordner docs/ für GitHub Pages.

Ergebnis ist eine installierbare Offline-App: einmal online öffnen, „Zum
Home-Bildschirm" hinzufügen, danach läuft sie ohne Netz.

Aufruf:  python3 build.py && python3 pwa.py
"""

import os
import re
import hashlib

HIER = os.path.dirname(os.path.abspath(__file__))
QUELLE = os.path.join(HIER, 'Baumkontrolle.html')
DOCS = os.path.join(HIER, 'docs')

MANIFEST = """{
  "name": "Baumkontrolle Hundertmark",
  "short_name": "Baumkontrolle",
  "description": "Baumkontrolle nach FLL-Baumkontrollrichtlinien 2020. Einzelbaum und Bestand, PDF und Excel, vollständig offline.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f2f3f2",
  "theme_color": "#2d5a3d",
  "lang": "de",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
"""

# Der Service Worker legt die App beim ersten Aufruf in den Cache und bedient
# sie danach von dort. Neue Fassungen werden im Hintergrund nachgeladen, aber
# nie mitten in einer laufenden Erfassung aktiviert.
SW = """/* Service Worker – macht die App offline verfügbar. */
var CACHE = 'baumkontrolle-%(version)s';
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
"""

REGISTRIERUNG = """
<script>
/* Service Worker nur registrieren, wenn die App über http(s) läuft.
   Bei einer lokal geöffneten Datei gibt es keinen – und das ist in Ordnung. */
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  });
}
</script>
"""

KOPF = """<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
"""


def main():
    if not os.path.exists(QUELLE):
        print('Baumkontrolle.html fehlt. Erst build.py laufen lassen.')
        return 1

    os.makedirs(DOCS, exist_ok=True)
    with open(QUELLE, 'r', encoding='utf-8') as f:
        html = f.read()

    version = hashlib.sha1(html.encode('utf-8')).hexdigest()[:8]

    # Achtung: SheetJS enthält den Textbaustein
    # '<html><head><title>SheetJS Table Export</title></head><body>' … '</body></html>'.
    # Nach </head> oder </body> zu suchen trifft deshalb mitten in die Bibliothek
    # und zerschießt sie – die App startet dann gar nicht mehr.
    # Der eigene <title> ist eindeutig, und das echte </body> ist das letzte.
    TITEL = '<title>Baumkontrolle</title>'

    if 'manifest.webmanifest' not in html:
        if TITEL not in html:
            raise SystemExit('Titelmarke nicht gefunden – 01_head.html geändert?')
        html = html.replace(TITEL, TITEL + '\n' + KOPF, 1)

    if 'serviceWorker' not in html:
        i = html.rfind('</body>')
        if i < 0:
            raise SystemExit('Kein </body> gefunden')
        html = html[:i] + REGISTRIERUNG + html[i:]

    with open(os.path.join(DOCS, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    with open(os.path.join(DOCS, 'manifest.webmanifest'), 'w', encoding='utf-8') as f:
        f.write(MANIFEST)
    with open(os.path.join(DOCS, 'sw.js'), 'w', encoding='utf-8') as f:
        f.write(SW % {'version': version})
    # GitHub Pages soll die Dateien nicht durch Jekyll schicken
    open(os.path.join(DOCS, '.nojekyll'), 'w').close()

    groesse = sum(os.path.getsize(os.path.join(DOCS, n)) for n in os.listdir(DOCS))
    print('docs/ fertig, Fassung %s, %.0f KB' % (version, groesse / 1024))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
