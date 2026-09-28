/* =============================================================================
 * 40_xlsx.js  –  Excel-Ausgabe
 * Baumkontrolltool Hundertmark
 *
 * Zwei Mappen: die Bestandsliste zur Weitergabe an den Auftraggeber und die
 * Kalkulation mit Preisen für den eigenen Gebrauch. Preise erscheinen nie
 * im Kontrollprotokoll und nie in der Bestandsliste.
 * ========================================================================== */

var XLS = (function () {
  'use strict';

  var DRING = { 1: 'unverzüglich', 2: 'innerhalb 6 Wochen', 3: 'innerhalb 6 Monaten',
                4: 'im nächsten Jahr', 5: 'bis zur nächsten Regelkontrolle' };

  function breiten(spalten) {
    return spalten.map(function (w) { return { wch: w }; });
  }

  function blatt(mappe, name, zeilen, spaltenbreiten) {
    var ws = XLSX.utils.aoa_to_sheet(zeilen);
    if (spaltenbreiten) ws['!cols'] = breiten(spaltenbreiten);
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(mappe, ws, name.substring(0, 31));
    return ws;
  }

  function dateiname(a, art) {
    var teil = String(a.objekt || 'Baumkontrolle')
      .replace(/[^\wäöüÄÖÜß -]/g, '').trim().replace(/\s+/g, '_');
    return art + '_' + teil + '_' + String(a.datum || '').replace(/\./g, '-') + '.xlsx';
  }

  function symptomText(b) {
    if (!b.befunde) return '';
    var teile = [];
    Object.keys(DATA.SYMPTOME).forEach(function (g) {
      (b.befunde[g] || []).forEach(function (code) {
        var i = parseInt(code.replace(/\D/g, ''), 10) - 1,
            bez = DATA.SYMPTOME[g].codes[i];
        if (bez) teile.push(DATA.SYMPTOME[g].titel + ': ' + bez);
      });
    });
    return teile.join(' · ');
  }

  /* =========================================================================
   * Bestandsliste
   * ====================================================================== */
  function bestand(daten) {
    var a = daten.auftrag, baeume = daten.baeume,
        mappe = XLSX.utils.book_new();

    /* --- Deckblatt --- */
    var schwer = baeume.filter(function (b) { return b.zustand === 'stärker geschädigt'; }).length,
        mitM = baeume.filter(function (b) { return (b.massnahmen || []).length; }).length,
        alleM = [];
    baeume.forEach(function (b) {
      (b.massnahmen || []).forEach(function (m) { alleM.push({ b: b, m: m }); });
    });

    blatt(mappe, 'Deckblatt', [
      ['Baumkontrolle'],
      [],
      ['Grundlage', 'FLL-Baumkontrollrichtlinien, 3. Ausgabe 2020'],
      ['Objekt', a.objekt],
      ['Auftraggeber', a.auftraggeber],
      ['Auftrags-Nr.', a.auftragsNr],
      ['Kontrollart', a.kontrollart],
      ['Kontrolldatum', a.datum + (a.datumBis ? ' bis ' + a.datumBis : '')],
      ['Belaubungszustand', a.belaubung],
      ['Erfassungsrichtung', a.erfassungsrichtung || '–'],
      ['Objektstandort', (a.gpsLat && a.gpsLon) ? (a.gpsLat + ' N / ' + a.gpsLon + ' E') : '–'],
      ['Witterung', a.witterung],
      ['Baumkontrolleur', a.kontrolleur],
      ['Qualifikation', a.qualifikationVoll || a.qualifikation],
      [],
      ['Kontrollierte Bäume', baeume.length],
      ['davon stärker geschädigt', schwer],
      ['Bäume mit Maßnahmenbedarf', mitM],
      ['Maßnahmen insgesamt', alleM.length],
      ['davon unverzüglich', alleM.filter(function (x) { return x.m.stufe === 1; }).length],
      [],
      ['Hinweis', 'Die Dokumentation ist 5 Jahre ab der letzten Eintragung aufzubewahren.'],
      ['', 'Die Umsetzungsverantwortung liegt beim Eigentümer bzw. Verkehrssicherungspflichtigen.']
    ], [26, 62]);

    /* --- Bestandsliste --- */
    var kopf = ['Baum-Nr.', 'Baumart deutsch', 'Baumart botanisch', 'Stammzahl', 'Lagebeschreibung',
      'Haus-Nr.', 'Flurstück', 'Baumumfeld', 'Breite', 'Länge', 'Höhe (m)', 'Krone Ø (m)',
      'Stammumfang (cm)', 'Messhöhe', 'Kronenansatz (m)', 'Alter', 'Entwicklungsphase',
      'Zustand', 'Sicherheitserwartung', 'Vitalität Roloff', 'Intervall (FLL-Vorschlag)',
      'Intervall festgelegt', 'Nächste Regelkontrolle', 'Schadsymptome', 'Pilzart', 'Fäuletyp',
      'Befund', 'Grenzen der Kontrolle', 'Bemerkung', 'Anzahl Maßnahmen', 'Höchste Dringlichkeit'];

    var zeilen = [kopf].concat(baeume.map(function (b) {
      var mn = b.massnahmen || [],
          stufe = mn.length ? Math.min.apply(null, mn.map(function (m) { return m.stufe || 5; })) : null;
      return [b.nr, b.artDt, b.artBot, b.stammzahl, b.lage || b.strasse, b.hausNr, b.flurstueck, b.umfeld,
        b.gpsLat, b.gpsLon, num(b.hoehe), num(b.kroneD), num(b.stammumfang), b.messhoehe,
        num(b.kronenansatz), b.alter, b.phase, b.zustand, b.erwartung, b.roloff,
        b.intervallMatrix, b.intervall, b.naechsteKontrolle, symptomText(b),
        b.pilz ? b.pilz.name : '', b.pilz ? b.pilz.faeule : '',
        b.befundtext, b.grenzen, b.bemerkung, mn.length, stufe ? DRING[stufe] : ''];
    }));
    blatt(mappe, 'Bestandsliste', zeilen,
      [9, 20, 22, 9, 20, 8, 12, 18, 10, 10, 9, 10, 14, 10, 13, 9, 15, 17, 17, 15, 18, 16, 18, 42, 18, 12, 46, 34, 28, 12, 20]);

    /* --- Maßnahmen --- */
    var mz = [['Dringlichkeit', 'Stufe', 'Baum-Nr.', 'Baumart', 'Standort', 'Maßnahme', 'Frist',
               'Begründung', 'Erledigt am', 'Bemerkung Ausführung']];
    alleM.sort(function (x, z) { return (x.m.stufe || 9) - (z.m.stufe || 9); });
    alleM.forEach(function (x) {
      mz.push([DRING[x.m.stufe] || '', x.m.stufe || '', x.b.nr, x.b.artDt,
        [x.b.lage || x.b.strasse, x.b.hausNr].filter(Boolean).join(' '),
        x.m.text, x.m.frist, x.m.begruendung, '', '']);
    });
    blatt(mappe, 'Maßnahmen', mz, [26, 7, 9, 20, 24, 38, 18, 46, 13, 26]);

    /* --- Befundübersicht: welches Symptom wie oft --- */
    var zaehler = {};
    baeume.forEach(function (b) {
      if (!b.befunde) return;
      Object.keys(DATA.SYMPTOME).forEach(function (g) {
        (b.befunde[g] || []).forEach(function (code) {
          var i = parseInt(code.replace(/\D/g, ''), 10) - 1,
              bez = DATA.SYMPTOME[g].codes[i];
          if (!bez) return;
          var k = DATA.SYMPTOME[g].titel + '|' + bez;
          if (!zaehler[k]) zaehler[k] = { anzahl: 0, baeume: [] };
          zaehler[k].anzahl++;
          zaehler[k].baeume.push(b.nr);
        });
      });
    });
    var bz = [['Baumteil', 'Schadsymptom', 'Anzahl Bäume', 'Anteil', 'Baum-Nummern']];
    Object.keys(zaehler).sort(function (x, z) { return zaehler[z].anzahl - zaehler[x].anzahl; })
      .forEach(function (k) {
        var t = k.split('|');
        bz.push([t[0], t[1], zaehler[k].anzahl,
          Math.round(zaehler[k].anzahl / baeume.length * 100) + ' %',
          zaehler[k].baeume.join(', ')]);
      });
    blatt(mappe, 'Befundübersicht', bz, [24, 34, 13, 9, 40]);

    /* --- Kronensicherungen --- */
    var ks = [['Baum-Nr.', 'Baumart', 'Bezeichnung', 'Farbe', 'Einbaujahr', 'Einsatzdauer (J.)',
               'Austauschjahr', 'Systemtyp', 'Bauart', 'Verbundform', 'Hersteller', 'Bruchlast (t)',
               'Anzahl', 'Einbauhöhe (m)', 'Ø Astbasis (cm)', 'Bemessung ZTV (t)', 'Mängel',
               'Bewertung', 'Bemerkung']];
    baeume.forEach(function (b) {
      (b.ks || []).forEach(function (k) {
        var dauer = parseInt(k.einsatzdauer, 10) || 8,
            astbasis = parseFloat(k.astbasis),
            bem = astbasis ? DATA.ksBemessung(astbasis, /statisch/i.test(k.system || '')) : '';
        ks.push([b.nr, b.artDt, k.bezeichnung, k.farbe, num(k.einbaujahr), dauer,
          k.einbaujahr ? parseInt(k.einbaujahr, 10) + dauer : '',
          k.system, k.bauart, k.verbund, k.hersteller, num(k.bruchlast), num(k.anzahl),
          num(k.einbauhoehe), num(k.astbasis), bem,
          (k.maengel || []).join(', '), k.bewertung, k.bemerkung]);
      });
    });
    if (ks.length > 1) {
      ks.push([]);
      ks.push(['Jahresfarben (Achtjahreszyklus, Branchenkonvention der Hersteller, keine Norm)']);
      ks.push(['Farbe', 'Einbaujahre']);
      DATA.KS_FARBEN.forEach(function (f) {
        ks.push([f.name, DATA.ksJahre(f.name, new Date().getFullYear()).join(' · ')]);
      });
      blatt(mappe, 'Kronensicherungen', ks,
        [9, 18, 20, 10, 11, 13, 13, 24, 18, 20, 16, 12, 8, 13, 15, 15, 40, 16, 30]);
    }

    /* --- Kontrolltermine --- */
    var tz = [['Baum-Nr.', 'Baumart', 'Standort', 'Zustand', 'Intervall',
               'Nächste Regelkontrolle', 'Grundlage']];
    baeume.forEach(function (b) {
      tz.push([b.nr, b.artDt, [b.lage || b.strasse, b.hausNr].filter(Boolean).join(' '), b.zustand,
        b.intervall, b.naechsteKontrolle, DATA.intervallGrundlage(b.intervall)]);
    });
    blatt(mappe, 'Kontrolltermine', tz, [9, 20, 24, 18, 16, 20, 56]);

    XLSX.writeFile(mappe, dateiname(a, 'Baumkontrolle'));
  }

  function num(v) {
    var n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? (v || '') : n;
  }

  return { bestand: bestand };
})();

</script>

<script>
/* Service Worker nur registrieren, wenn die App über http(s) läuft.
   Bei einer lokal geöffneten Datei gibt es keinen – und das ist in Ordnung. */
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  });
  /* Meldungen des Service Workers werden bis zum Freischalten zwischengelagert;
     ohne startMessages() ginge eine früh gesendete Nachricht verloren. */
  navigator.serviceWorker.addEventListener('message', function (e) {
    if (e.data && e.data.art === 'neueFassung' && window.App) App.neueFassung();
  });
  navigator.serviceWorker.startMessages();

  /* Zweimal nachfragen: einmal sofort, einmal nachdem das Nachladen im
     Hintergrund durch sein kann. Die App ist gross, das dauert. */
  function nachfragen() {
    navigator.serviceWorker.ready.then(function (r) {
      if (r && r.active) r.active.postMessage({ art: 'fassungPruefen' });
    }).catch(function () {});
  }
  window.addEventListener('load', function () {
    setTimeout(nachfragen, 1500);
    setTimeout(nachfragen, 6000);
  });
}