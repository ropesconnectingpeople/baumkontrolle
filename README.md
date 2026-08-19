# Baumkontrolle – Hundertmark

Baumkontrolltool nach FLL-Baumkontrollrichtlinien, 3. Ausgabe 2020.
Einzelbaum und Bestand, Ausgabe als PDF und Excel. Kein Kataster, kein Server,
kein Konto. Läuft offline im Browser, gedacht für iPhone und iPad.

## Online stellen und aufs iPhone legen

Siehe `ONLINE_STELLEN.md` – GitHub Pages, Ordner `docs/`, dann „Zum Home-Bildschirm".
Danach läuft die App offline mit sicherem Speicher.

## Benutzen

`Baumkontrolle.html` auf das Gerät legen und im Browser öffnen. Auf dem iPhone
über Teilen → „Zum Home-Bildschirm" ablegen, dann startet sie wie eine App.
Alle Daten bleiben auf dem Gerät (localStorage). Regelmäßig über
Ausgabe → Sicherung eine JSON-Datei ablegen.

## Neu bauen

    npm install jspdf jspdf-autotable xlsx
    cp node_modules/jspdf/dist/jspdf.umd.min.js lib/
    cp node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js lib/
    cp node_modules/xlsx/dist/xlsx.full.min.js lib/
    python3 build.py

## Testen

    npm install playwright
    node test.js       # Vollerfassung, PDF, Excel, Angebot, sevDesk-Liste
    node test_pwa.js   # Manifest, Service Worker, Offline-Start

## Aufbau

| Datei | Inhalt |
|---|---|
| `src/01_head.html` | CSS, mobil optimiert |
| `src/02_body.html` | Markup aller Ansichten |
| `src/10_data.js` | Baumarten, Schadsymptome, Maßnahmen, Pilze, Intervallmatrix, Preise |
| `src/20_app.js` | Erfassung, Liste, Speicherung, Navigation |
| `src/30_pdf.js` | PDF im FLL-Format |
| `src/40_xlsx.js` | Excel: Bestandsliste und Kalkulation |
| `build.py` | baut daraus die einzelne HTML-Datei |
| `pwa.py` | schreibt daraus den Ordner `docs/` für GitHub Pages |
| `test.js` | Vollerfassung mit Playwright |
| `test_pwa.js` | prüft Manifest, Service Worker und den Offline-Start |

Preise erscheinen nur in der Kalkulation, nie im Kontrollprotokoll.
