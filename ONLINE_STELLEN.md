# Morgen auf der Baustelle – zwei Wege

## Der schnelle Weg, ohne alles (2 Minuten)

`Baumkontrolle.html` aufs iPhone oder iPad laden und öffnen. Läuft sofort, ohne Netz,
ohne Konto.

**Ein Haken:** Bei einer Datei, die direkt aus „Dateien" geöffnet wird, behandelt Safari
den Speicher unzuverlässig. Im schlimmsten Fall sind die Bäume weg, sobald du den Tab
schließt. Die App merkt das und warnt dich beim Start – dann **nach jedem zweiten Baum
über Ausgabe → Sicherung eine Datei ablegen**.

Für einen einzelnen Baum reicht das. Für einen ganzen Bestand ist es zu riskant.

---

## Der richtige Weg (10 Minuten, einmalig)

Über GitHub Pages wird daraus eine echte App auf dem Homescreen: eigenes Symbol,
kein Browserrahmen, **sicherer Speicher**, und nach dem ersten Öffnen läuft sie
vollständig ohne Netz.

### 1. Repository anlegen

Auf **github.com** einloggen → oben rechts **+** → **New repository**

- **Repository name:** `baumkontrolle`
- **Private** wählen (deine Preise stecken drin)
- **Create repository**

### 2. Dateien hochladen

Im leeren Repository auf **uploading an existing file** klicken.

Aus `Baumkontrolle_Quellen.zip` den **kompletten Ordner `docs`** ins Browserfenster ziehen.
Er enthält:

    docs/index.html              die App
    docs/manifest.webmanifest    macht sie installierbar
    docs/sw.js                   sorgt für den Offline-Betrieb
    docs/icon-192.png            Symbol
    docs/icon-512.png            Symbol
    docs/apple-touch-icon.png    Symbol fürs iPhone
    docs/.nojekyll               damit GitHub die Dateien unangetastet lässt

Unten **Commit changes**.

> Falls die versteckte Datei `.nojekyll` beim Ziehen verschwindet: über
> **Add file → Create new file** eine Datei namens `docs/.nojekyll` anlegen und leer
> speichern.

### 3. Pages einschalten

**Settings** → links **Pages**

- **Source:** Deploy from a branch
- **Branch:** `main`, Ordner **`/docs`**
- **Save**

Nach ein bis zwei Minuten steht oben die Adresse:

    https://DEINNAME.github.io/baumkontrolle/

### 4. Aufs iPhone legen

Adresse in **Safari** öffnen (nicht Chrome – das Ablegen auf dem Homescreen kann nur
Safari). Dann **Teilen** → **Zum Home-Bildschirm**.

Fertig. Ab jetzt startet sie wie eine normale App, auch im Funkloch.

**Einmal vorher ausprobieren:** App öffnen, einen Testbaum anlegen, Flugmodus an,
App schließen und neu öffnen. Der Baum muss noch da sein.

---

## Wenn du etwas änderst

    python3 build.py     # baut Baumkontrolle.html aus src/
    python3 pwa.py       # schreibt daraus den Ordner docs/
    node test.js         # Vollerfassung, PDF, Excel, Angebot
    node test_pwa.js     # Manifest, Service Worker, Offline-Start

Danach `docs/index.html` und `docs/sw.js` im Repository ersetzen. Die Fassungsnummer im
Service Worker ändert sich automatisch mit dem Inhalt – das Gerät holt sich die neue
Fassung beim nächsten Start mit Netz.

---

## Was du vor dem ersten echten Einsatz noch eintragen solltest

Unter **Einstellungen**:

- Firmenname, Anschrift, Kontakt – die stehen auf jedem Protokoll
- Zertifikatsnummer unter **Auftrag → Kontrolleur**
- **Preise** auf deine Kalkulation ziehen; die eingebauten sind Richtwerte

Und einmal **Als sevDesk-Produkte (CSV)** exportieren und in sevDesk unter Produkte
importieren. Danach wählst du die Angebotspositionen dort nur noch aus.

---

## Auf der Baustelle

- Die App erinnert nach zehn Bäumen an eine Sicherung. Nimm sie ernst.
- Fotos: höchstens acht je Baum, sie werden automatisch verkleinert.
- GPS braucht die Standortfreigabe für Safari.
- Gelöschte Bäume liegen 30 Tage im Papierkorb unter Einstellungen.
