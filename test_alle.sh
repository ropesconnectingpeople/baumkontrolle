#!/bin/sh
# Alle Testlaeufe hintereinander. Vorher bauen, sonst wird die alte Datei geprueft.
set -e
python3 build.py
python3 pwa.py
fehler=0
for t in test.js test_art.js test_fotos.js test_auftraege.js test_menge.js test_pwa.js; do
  printf '%-20s ' "$t"
  if node "$t" >/dev/null 2>&1; then
    echo "gruen"
  else
    echo "ROT"
    fehler=1
  fi
done
[ $fehler -eq 0 ] && echo "\nAlles gruen." || { echo "\nMindestens ein Lauf ist rot. Einzeln starten fuer die Ausgabe."; exit 1; }
