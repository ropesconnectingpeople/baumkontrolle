# Baumkontrolle

Eine einzelne HTML-Datei für Baumkontrollen nach FLL-Baumkontrollrichtlinien
2020, 3. Ausgabe. Läuft auf Telefon und Tablet eines Baumpflegebetriebs, im
Feld, oft ohne Empfang. Kein Server, kein Konto, keine laufenden Kosten.

Der Nutzer ist der Betriebsinhaber und der einzige Anwender. Er kontrolliert
Bäume auf Einzelgrundstücken und in Privatgärten.

## Bauen und prüfen

    python3 build.py     baut Baumkontrolle.html aus src/ und lib/
    python3 pwa.py       schreibt daraus docs/ für GitHub Pages
    sh test_alle.sh      baut, schreibt docs/ und fährt alle sieben Läufe durch

**Nie ohne grüne Tests ausliefern.** Die Testläufe brauchen Playwright mit
Chromium. `Baumkontrolle.html` und `docs/` sind Bauergebnisse und liegen mit im
Repo, damit GitHub Pages sie ausliefern kann — bearbeitet wird nur `src/`.

Veröffentlicht unter https://ropesconnectingpeople.github.io/baumkontrolle/
aus dem Ordner `docs/` des Hauptzweigs.

## Aufbau

    src/01_head.html   Kopf und das gesamte CSS
    src/02_body.html   Aufbau aller Ansichten
    src/05_db.js       IndexedDB, zwei Lager: auftraege und kunden
    src/10_data.js     Fachdaten nach FLL und GALK, 162 Baumarten
    src/20_app.js      Zustand, Ansichten, Formulare
    src/30_pdf.js      Protokoll-PDF im FLL-Format, jsPDF
    src/40_xlsx.js     Excel-Bestandsliste, SheetJS
    src/50_karte.js    Karte, Leaflet

`lib/` enthält jsPDF, AutoTable, SheetJS und Leaflet als fertige Dateien. Sie
werden einkompiliert, nicht aus dem Netz geladen.

## Was gilt

Diese Entscheidungen sind getroffen. Nicht ohne Rückfrage umkehren.

**Die App macht Baumkontrolle, sonst nichts.** Keine Angebote, keine Preise,
keine Kalkulation. Das läuft über sevDesk. Preise in einem Kontrollwerkzeug
laden zu dem Verdacht ein, man schreibe sich Arbeit herbei. Wer kontrolliert
und ausführt, hält beides getrennt.

**Eine Kontrolle gehört zu einem Grundstück.** Keine Objekthierarchie unter dem
Kunden. Objektadresse an der Kontrolle, Rechnungsadresse am Kunden.

**Auf der Karte setzt der Finger den Baum, nicht das GPS.** Die Ortung liegt bei
±5 m. Bei drei Metern Stammabstand landet der Punkt zuverlässig auf dem falschen
Baum. GPS liefert den Startpunkt, verschoben wird von Hand. Ohne diese Regel
täuscht die Karte Genauigkeit vor und ist schlimmer als keine Karte.

**Nichts Wichtiges hängt am Mauszeiger.** Zielgerät ist ein Tablet, dort liegt
kein Zeiger auf dem Schirm. Hover darf verschönern, nie erschließen. Jede
Verbindung braucht zusätzlich ein Fingerziel.

**Die Erfassung läuft ohne Netz vollständig durch.** Nur die Kartenkacheln
kommen von draußen. Ohne Empfang bleibt die Fläche grau und die Marken stehen
trotzdem richtig zueinander.

**Dieselbe Fassung läuft auf Telefon und Tablet.** Das Layout richtet sich nach
der Breite, ab 820 px zweispaltig. Kein zweites Programm, kein zweiter
Datenbestand.

**Deutsche Bezeichner, deutsche Kommentare.** Kommentare erklären, warum etwas
so ist, nicht was die Zeile tut.

## Fallstricke, die schon Zeit gekostet haben

- **SheetJS enthält den Textbaustein `</body></html>`.** Den Bau nie über
  `replace('</head>', …)` lösen.
- **`.karte` hat `overflow:hidden`.** Aufklappende Listen müssen schieben,
  nicht überlagern, sonst werden sie beschnitten.
- **`doc.addImage` skaliert bedingungslos.** Das Seitenverhältnis selbst über
  `getImageProperties()` rechnen, sonst stehen Hochformat-Fotos gestaucht im
  Bericht.
- **Leaflet misst im unsichtbaren Kasten null.** Die Karte erst bauen, wenn ihr
  Kasten Breite hat, und nach jedem Umschalten `invalidateSize()` rufen, ein
  Bild später.
- **`position:sticky` im Grid braucht `align-self:stretch`.** Sonst ist die
  Spalte genau so hoch wie ihr Inhalt und klebt nie.
- **Der Media Query fürs Tablet muss hinter der `main`-Regel stehen.** Sonst
  gewinnt deren `max-width:820px` und das Tablet bleibt so schmal wie ein
  Telefon.
- **Der Service Worker darf nur eigene Dateien cachen.** Kartenkacheln würden
  ihn zum Überlaufen bringen, und ein überlaufender Cache wird vom Browser ganz
  weggeworfen. Dann startet die App im Feld nicht mehr.
- **localStorage fasst rund 4 MB, ein Foto wiegt als Base64 etwa 600 KB.**
  Deshalb IndexedDB. Nichts Großes zurück in localStorage legen.
- **`has-text()` in Playwright ist unabhängig von Groß- und Kleinschreibung.**
  Für Knopftexte `>> text="Genau so"` nutzen.
- **„Speichern und nächsten Baum" legt den nächsten Baum gleich an.** Im
  Testlauf wird der Aufnehmen-Knopf nur einmal gebraucht.

## Daten und Vertraulichkeit

Dieses Repository ist öffentlich, weil GitHub Pages aus privaten Repos einen
bezahlten Plan braucht. Kontrollen enthalten Namen, Anschriften, Koordinaten und
Fotos fremder Grundstücke. **Nie echte Kontrolldaten, Kundendaten, Sicherungen
oder Protokolle einchecken.** Die `.gitignore` sperrt `*.json` und `korrektur/`
genau dafür.

## Nicht bauen

- Angebote, Preise, Kalkulation. Dafür gibt es sevDesk.
- Objekthierarchie unter dem Kunden.
- Kataster für große Liegenschaften. Dafür gibt es ImmoSpector Tree.
- Offline-Kacheln. Das Tablet hat eine SIM.
