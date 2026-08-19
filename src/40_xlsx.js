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
      ['Witterung', a.witterung],
      ['Baumkontrolleur', a.kontrolleur],
      ['Qualifikation', a.qualifikation + (a.zertNr ? ' (Zert.-Nr. ' + a.zertNr + ')' : '')],
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
    var kopf = ['Baum-Nr.', 'Baumart deutsch', 'Baumart botanisch', 'Stammzahl', 'Straße',
      'Haus-Nr.', 'Flurstück', 'Baumumfeld', 'Breite', 'Länge', 'Höhe (m)', 'Krone Ø (m)',
      'Stammumfang (cm)', 'Messhöhe', 'Kronenansatz (m)', 'Alter', 'Entwicklungsphase',
      'Zustand', 'Sicherheitserwartung', 'Vitalität Roloff', 'Intervall (FLL-Vorschlag)',
      'Intervall festgelegt', 'Nächste Regelkontrolle', 'Schadsymptome', 'Pilzart', 'Fäuletyp',
      'Befund', 'Grenzen der Kontrolle', 'Bemerkung', 'Anzahl Maßnahmen', 'Höchste Dringlichkeit'];

    var zeilen = [kopf].concat(baeume.map(function (b) {
      var mn = b.massnahmen || [],
          stufe = mn.length ? Math.min.apply(null, mn.map(function (m) { return m.stufe || 5; })) : null;
      return [b.nr, b.artDt, b.artBot, b.stammzahl, b.strasse, b.hausNr, b.flurstueck, b.umfeld,
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
        [x.b.strasse, x.b.hausNr].filter(Boolean).join(' '),
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

    /* --- Kontrolltermine --- */
    var tz = [['Baum-Nr.', 'Baumart', 'Standort', 'Zustand', 'Intervall',
               'Nächste Regelkontrolle', 'Grundlage']];
    baeume.forEach(function (b) {
      tz.push([b.nr, b.artDt, [b.strasse, b.hausNr].filter(Boolean).join(' '), b.zustand,
        b.intervall, b.naechsteKontrolle, DATA.intervallGrundlage(b.intervall)]);
    });
    blatt(mappe, 'Kontrolltermine', tz, [9, 20, 24, 18, 16, 20, 56]);

    XLSX.writeFile(mappe, dateiname(a, 'Baumkontrolle'));
  }

  function num(v) {
    var n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? (v || '') : n;
  }

  /* =========================================================================
   * Kalkulation
   * ====================================================================== */
  function kalkulation(daten, preise, einst) {
    var a = daten.auftrag, baeume = daten.baeume,
        mappe = XLSX.utils.book_new(),
        ust = (einst && einst.ust) || 19;

    var posten = [];
    baeume.forEach(function (b) {
      (b.massnahmen || []).forEach(function (m) {
        var kl = DATA.hoehenklasse(b.hoehe),
            reihe = preise[m.text],
            preis = reihe ? (reihe[kl] || 0) : 0;
        posten.push({
          nr: b.nr, art: b.artDt, hoehe: b.hoehe, klasse: DATA.HOEHENKLASSEN[kl],
          text: m.text, stufe: m.stufe, frist: m.frist, preis: preis
        });
      });
    });

    var netto = posten.reduce(function (s, p) { return s + p.preis; }, 0);

    /* --- Einzelaufstellung --- */
    var z = [['Baum-Nr.', 'Baumart', 'Höhe (m)', 'Höhenklasse', 'Leistung', 'Dringlichkeit',
              'Frist', 'Einzelpreis netto (€)']];
    posten.forEach(function (p) {
      z.push([p.nr, p.art, num(p.hoehe), p.klasse, p.text, DRING[p.stufe] || '', p.frist, p.preis]);
    });
    z.push([]);
    z.push(['', '', '', '', '', '', 'Summe netto', netto]);
    z.push(['', '', '', '', '', '', 'zzgl. ' + ust + ' % USt.', Math.round(netto * ust) / 100]);
    z.push(['', '', '', '', '', '', 'Summe brutto', Math.round(netto * (100 + ust)) / 100]);
    blatt(mappe, 'Einzelaufstellung', z, [9, 20, 10, 14, 38, 26, 18, 20]);

    /* --- Zusammenfassung nach Dringlichkeit --- */
    var nachStufe = [['Dringlichkeit', 'Anzahl Leistungen', 'Betrag netto (€)']];
    [1, 2, 3, 4, 5].forEach(function (st) {
      var g = posten.filter(function (p) { return p.stufe === st; });
      if (g.length) nachStufe.push([DRING[st], g.length,
        g.reduce(function (s, p) { return s + p.preis; }, 0)]);
    });
    nachStufe.push([]);
    nachStufe.push(['Summe netto', posten.length, netto]);
    nachStufe.push([]);
    nachStufe.push(['Nach Leistung']);
    nachStufe.push(['Leistung', 'Anzahl', 'Betrag netto (€)']);
    var nachLeistung = {};
    posten.forEach(function (p) {
      if (!nachLeistung[p.text]) nachLeistung[p.text] = { n: 0, s: 0 };
      nachLeistung[p.text].n++;
      nachLeistung[p.text].s += p.preis;
    });
    Object.keys(nachLeistung).sort(function (x, y) { return nachLeistung[y].s - nachLeistung[x].s; })
      .forEach(function (k) { nachStufe.push([k, nachLeistung[k].n, nachLeistung[k].s]); });
    blatt(mappe, 'Zusammenfassung', nachStufe, [38, 18, 20]);

    /* --- Preisliste zur Nachvollziehbarkeit --- */
    var pl = [['Leistung'].concat(DATA.HOEHENKLASSEN)];
    Object.keys(preise).forEach(function (k) { pl.push([k].concat(preise[k])); });
    pl.push([]);
    pl.push(['Stand', a.datum]);
    pl.push(['Alle Preise netto in Euro je Baum.']);
    blatt(mappe, 'Preisliste', pl, [40, 13, 13, 13, 13]);

    XLSX.writeFile(mappe, dateiname(a, 'Kalkulation'));
  }

  return { bestand: bestand, kalkulation: kalkulation };
})();
