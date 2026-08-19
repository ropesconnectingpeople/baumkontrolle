#!/usr/bin/env python3
"""
build.py – baut aus src/ die einzelne Datei Baumkontrolle.html.

Die Bibliotheken werden mit einkompiliert, damit die App ohne Internet läuft:
jsPDF und jsPDF-AutoTable für die PDF-Ausgabe, SheetJS für Excel.

Aufruf:  python3 build.py
"""

import os
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HIER, 'src')
LIB = os.path.join(HIER, 'lib')
ZIEL = os.path.join(HIER, 'Baumkontrolle.html')

BIBLIOTHEKEN = [
    ('jspdf.umd.min.js', 'jsPDF'),
    ('jspdf.plugin.autotable.min.js', 'jsPDF-AutoTable'),
    ('xlsx.full.min.js', 'SheetJS'),
]

QUELLEN = ['10_data.js', '20_app.js', '30_pdf.js', '40_xlsx.js']


def lies(pfad):
    with open(pfad, 'r', encoding='utf-8') as f:
        return f.read()


def main():
    fehlend = [n for n, _ in BIBLIOTHEKEN if not os.path.exists(os.path.join(LIB, n))]
    if fehlend:
        print('Fehlende Bibliotheken in lib/: ' + ', '.join(fehlend))
        print('Holen mit:  npm install jspdf jspdf-autotable xlsx')
        print('und die min.js-Dateien nach lib/ kopieren.')
        return 1

    teile = [lies(os.path.join(SRC, '01_head.html')),
             lies(os.path.join(SRC, '02_body.html'))]

    teile.append('\n<script>\n/* Bibliotheken einkompiliert – die App läuft offline. */\n')
    for name, titel in BIBLIOTHEKEN:
        teile.append('/* --- %s --- */\n' % titel)
        teile.append(lies(os.path.join(LIB, name)))
        teile.append('\n')
    teile.append('</script>\n')

    teile.append('<script>\n')
    for name in QUELLEN:
        teile.append('\n/* ===== %s ===== */\n' % name)
        teile.append(lies(os.path.join(SRC, name)))
    teile.append('\n</script>\n</body>\n</html>\n')

    inhalt = ''.join(teile)
    with open(ZIEL, 'w', encoding='utf-8') as f:
        f.write(inhalt)

    print('Gebaut: %s  (%.0f KB)' % (ZIEL, len(inhalt.encode('utf-8')) / 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())
