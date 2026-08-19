/* =============================================================================
 * 30_pdf.js  –  PDF-Ausgabe im FLL-Format
 * Baumkontrolltool Hundertmark, v1.5
 *
 * Ein einziges Layout für alles. Einzelbaum = 2 Seiten. Bestand = derselbe
 * Zweiseiter je Baum, davor Deckblatt, Zusammenfassung, Bestandsliste und
 * Maßnahmenliste.
 *
 * Grundlage: FLL-Baumkontrollrichtlinien, 3. Ausgabe 2020.
 * Dringlichkeitsstufen nach GALK-Musterdienstanweisung 2021.
 *
 * Abhängigkeiten: jsPDF, jsPDF-AutoTable (beide einkompiliert).
 *
 * -----------------------------------------------------------------------------
 * ERWARTETES DATENMODELL
 * -----------------------------------------------------------------------------
 * PDF.erzeugen({
 *   auftrag: {
 *     auftraggeber, objekt, auftragsNr, kontrollart, datum, datumBis,
 *     belaubung, witterung, kontrolleur, qualifikation, zertNr, berichtsdatum
 *   },
 *   baeume: [{
 *     nr, stammzahl, artDt, artBot,
 *     hoehe, kroneD, stammumfang, messhoehe, kronenansatz, alter,
 *     strasse, hausNr, flurstueck, umfeld, gpsLat, gpsLon,
 *     phase, zustand, erwartung, roloff,
 *     intervallMatrix, intervall, naechsteKontrolle,
 *     befunde: { K:[..], S:[..], W:[..], Wu:[..], V:[..] },   // angekreuzte Codes
 *     pilz: { name, bot, faeule, lage },
 *     grenzen, bemerkung, befundtext,
 *     massnahmen: [{ text, stufe, frist, begruendung }],       // stufe 1..5
 *     fotos: [ dataURL ],
 *     historie: [{ datum, handlungsbedarf, eu, pflege, faellung, intervall, frist, kuerzel }]
 *   }]
 * }, { modus: 'einzel' | 'bestand' })
 *
 * Wenn die App andere Feldnamen benutzt, nur MAP unten anpassen –
 * der Rest des Moduls fasst die Rohdaten nicht an.
 * ========================================================================== */

var PDF = (function () {
  'use strict';

  /* --- Firmenstammdaten. Aus den Einstellungen überschreibbar. ------------ */
  var FIRMA = {
    name:   'Baumpflege Hundertmark',
    zusatz: 'Fachbetrieb für Baumpflege · Baumkontrolle · Verkehrssicherheit',
    anschrift: '',              // z. B. 'Musterstraße 1 · 20255 Hamburg'
    kontakt:   '',              // z. B. 'Tel. 040 000000 · info@…'
    logo:      null             // dataURL, optional
  };

  var NORM = 'Baumkontrollrichtlinien – Richtlinien für Baumkontrollen zur ' +
             'Überprüfung der Verkehrssicherheit, FLL, 3. Ausgabe 2020';

  /* --- Farben ------------------------------------------------------------- */
  var C = {
    gruen:  [45, 90, 61],
    grau:   [74, 74, 74],
    linie:  [187, 187, 187],
    fein:   [221, 221, 221],
    label:  [119, 119, 119],
    text:   [26, 26, 26],
    weich:  [102, 102, 102],
    hell:   [240, 245, 241],
    kopfBg: [238, 241, 238],
    weiss:  [255, 255, 255],
    warn:   [176, 48, 48]
  };

  /* --- Dringlichkeit nach GALK 2021 --------------------------------------- */
  var DRING = {
    1: { kurz: 'unverzüglich',   lang: 'unverzüglich',                 bg: [176,  48,  48], fg: [255,255,255] },
    2: { kurz: '6 Wochen',       lang: 'innerhalb von 6 Wochen',       bg: [209, 117,  26], fg: [255,255,255] },
    3: { kurz: '6 Monate',       lang: 'innerhalb von 6 Monaten',      bg: [201, 162,  39], fg: [ 58, 47,  0] },
    4: { kurz: 'nächstes Jahr',  lang: 'innerhalb des nächsten Jahres',bg: [ 91, 140,  62], fg: [255,255,255] },
    5: { kurz: 'bis nächste RK', lang: 'bis zur nächsten Regelkontrolle', bg: [107, 114, 128], fg: [255,255,255] }
  };

  /* --- Seitenmaße in mm --------------------------------------------------- */
  var M = { l: 12, r: 12, o: 12, u: 14, b: 210, h: 297 };
  M.w = M.b - M.l - M.r;                       // nutzbare Breite 186 mm

  /* --- Feld-Mapping. Nur hier anfassen, wenn die App anders heißt. -------- */
  var MAP = {
    baumNr:  function (b) { return b.nr; },
    artDt:   function (b) { return b.artDt; },
    artBot:  function (b) { return b.artBot; },
    massnahmen: function (b) { return b.massnahmen || []; },
    befunde: function (b) { return b.befunde || {}; },
    fotos:   function (b) { return b.fotos || []; }
  };

  /* =========================================================================
   * Kleine Helfer
   * ====================================================================== */

  function t(doc, txt, x, y, opt) {
    opt = opt || {};
    doc.setFont('helvetica', opt.bold ? 'bold' : (opt.italic ? 'italic' : 'normal'));
    doc.setFontSize(opt.size || 8.2);
    doc.setTextColor.apply(doc, opt.color || C.text);
    doc.text(String(txt == null ? '' : txt), x, y, { align: opt.align || 'left', baseline: opt.baseline || 'alphabetic' });
  }

  function rect(doc, x, y, w, h, fill, stroke, lw) {
    if (fill)   doc.setFillColor.apply(doc, fill);
    if (stroke) doc.setDrawColor.apply(doc, stroke);
    doc.setLineWidth(lw == null ? 0.2 : lw);
    doc.rect(x, y, w, h, fill && stroke ? 'FD' : (fill ? 'F' : 'S'));
  }

  function line(doc, x1, y1, x2, y2, color, lw) {
    doc.setDrawColor.apply(doc, color || C.fein);
    doc.setLineWidth(lw == null ? 0.2 : lw);
    doc.line(x1, y1, x2, y2);
  }

  /** Zeilenumbruch mit Rückgabe der belegten Höhe. */
  function textBlock(doc, txt, x, y, w, opt) {
    opt = opt || {};
    var size = opt.size || 8,
        lh   = opt.lh || 3.6;
    doc.setFont('helvetica', opt.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor.apply(doc, opt.color || C.text);
    var zeilen = doc.splitTextToSize(String(txt == null ? '' : txt), w);
    for (var i = 0; i < zeilen.length; i++) doc.text(zeilen[i], x, y + i * lh);
    return zeilen.length * lh;
  }

  /** Kopfzeile jeder Seite außer dem Deckblatt. */
  function kopf(doc, nummer, rechts) {
    var y = M.o + 4;
    t(doc, FIRMA.name, M.l, y, { size: 13, bold: true, color: C.gruen });
    t(doc, FIRMA.zusatz, M.l, y + 3.4, { size: 7, color: C.weich });
    t(doc, 'Bericht-Nr.', M.b - M.r, y - 3.6, { size: 7.4, align: 'right', color: C.weich });
    t(doc, nummer || '', M.b - M.r, y, { size: 10.5, bold: true, align: 'right' });
    if (rechts) t(doc, rechts, M.b - M.r, y + 3.4, { size: 7.4, align: 'right', color: C.weich });
    line(doc, M.l, y + 5.4, M.b - M.r, y + 5.4, C.gruen, 0.9);
    return y + 8.6;
  }

  /** Grüner oder grauer Blocktitel. Gibt das y unter dem Balken zurück. */
  function blockTitel(doc, txt, y, sekundaer) {
    var hoehe = 4.4;
    rect(doc, M.l, y, M.w, hoehe, sekundaer ? C.grau : C.gruen, null);
    t(doc, txt.toUpperCase(), M.l + 1.8, y + 3.1, { size: 7.2, bold: true, color: C.weiss });
    return y + hoehe;
  }

  /**
   * Feldraster wie im Muster: vier Spalten, Label klein darüber, Wert fett.
   * felder: [{ lab, val, sub, span, hl }]
   */
  function feldGrid(doc, felder, y) {
    var spalten = 4,
        sw = M.w / spalten,
        zh = 7.8,
        x = M.l, zeileY = y, genutzt = 0;

    rect(doc, M.l, y, M.w, 0, null, null);   // Rahmen zeichnen wir am Ende

    felder.forEach(function (f) {
      var span = f.span || 1;
      if (genutzt + span > spalten) { genutzt = 0; zeileY += zh; x = M.l; }
      var bw = sw * span;
      if (f.hl) rect(doc, x, zeileY, bw, zh, C.hell, null);
      t(doc, String(f.lab || '').toUpperCase(), x + 1.8, zeileY + 2.6, { size: 5.6, color: C.label });
      t(doc, f.val == null ? '' : f.val, x + 1.8, zeileY + 6.1,
        { size: 8.2, bold: true, color: f.hl ? C.gruen : C.text });
      if (f.sub) {
        var vb = doc.getTextWidth(String(f.val == null ? '' : f.val));
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.2);
        vb = doc.getTextWidth(String(f.val == null ? '' : f.val));
        t(doc, f.sub, x + 1.8 + vb + 1.4, zeileY + 6.1, { size: 7, color: C.weich });
      }
      line(doc, x + bw, zeileY, x + bw, zeileY + zh, C.fein);
      line(doc, x, zeileY + zh, x + bw, zeileY + zh, C.fein);
      x += bw; genutzt += span;
    });

    var unten = zeileY + zh;
    rect(doc, M.l, y, M.w, unten - y, null, C.linie);
    return unten;
  }

  /** Kasten mit Fließtext, optional feste Mindesthöhe. */
  function textKasten(doc, txt, y, minH, opt) {
    opt = opt || {};
    var pad = 1.8,
        h = 0;
    var zeilen = String(txt == null ? '' : txt).split('\n');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(opt.size || 8);
    var alle = [];
    zeilen.forEach(function (z) {
      alle = alle.concat(doc.splitTextToSize(z, (opt.w || M.w) - 2 * pad - 1));
    });
    h = Math.max(minH || 0, alle.length * (opt.lh || 3.5) + 2 * pad);
    rect(doc, opt.x || M.l, y, opt.w || M.w, h, null, C.linie);
    var yy = y + pad + 2.4;
    alle.forEach(function (z) {
      t(doc, z, (opt.x || M.l) + pad + 0.6, yy, { size: opt.size || 8 });
      yy += (opt.lh || 3.5);
    });
    return y + h;
  }

  /** Checkbox, weil die Zeichen ☐/☒ nicht in der Standardkodierung liegen. */
  function checkbox(doc, x, y, an) {
    var s = 2.1;
    doc.setDrawColor.apply(doc, an ? C.warn : [170, 170, 170]);
    doc.setLineWidth(0.18);
    doc.rect(x, y - s + 0.35, s, s, 'S');
    if (an) {
      doc.setLineWidth(0.32);
      doc.line(x + 0.3, y - s + 0.65, x + s - 0.3, y - 0.05);
      doc.line(x + s - 0.3, y - s + 0.65, x + 0.3, y - 0.05);
    }
  }

  /** Farbige Dringlichkeits-Badge. Gibt die belegte Breite zurück. */
  function badge(doc, stufe, x, y) {
    var d = DRING[stufe];
    if (!d) { t(doc, '–', x, y, { size: 7, color: [187, 187, 187] }); return 3; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.4);
    var w = doc.getTextWidth(d.kurz) + 2.6;
    rect(doc, x, y - 2.8, w, 3.6, d.bg, null);
    t(doc, d.kurz, x + 1.3, y - 0.3, { size: 6.4, bold: true, color: d.fg });
    return w;
  }

  /* =========================================================================
   * Einzelblatt Seite 1 – Daten
   * ====================================================================== */
  function blattSeite1(doc, a, b, titel) {
    var y = kopf(doc, a.auftragsNr, 'Einzelblatt ' + MAP.baumNr(b) + ' · Seite 1');

    t(doc, titel || ('Baumkontrollprotokoll – ' + (a.kontrollart || 'Regelkontrolle')), M.l, y + 3.2, { size: 11, bold: true });
    t(doc, NORM, M.l, y + 6.8, { size: 7.2, color: C.weich });
    y += 10.4;

    y = blockTitel(doc, 'Auftrag und Kontrolle', y);
    y = feldGrid(doc, [
      { lab: 'Auftraggeber', val: a.auftraggeber, span: 2 },
      { lab: 'Objekt',       val: a.objekt,       span: 2 },
      { lab: 'Kontrollart',  val: a.kontrollart || 'Regelkontrolle' },
      { lab: 'Kontrolldatum', val: a.datum },
      { lab: 'Belaubungszustand', val: a.belaubung },
      { lab: 'Witterung',    val: a.witterung },
      { lab: 'Baumkontrolleur', val: a.kontrolleur, span: 2 },
      { lab: 'Qualifikation', val: a.qualifikation,
        sub: a.zertNr ? '· Zert.-Nr. ' + a.zertNr : '', span: 2 }
    ], y);
    y += 2.4;

    y = blockTitel(doc, 'Baum und Standort', y);
    y = feldGrid(doc, [
      { lab: 'Baum-Nr.', val: MAP.baumNr(b) },
      { lab: 'Baumart',  val: MAP.artDt(b), sub: MAP.artBot(b) ? '· ' + MAP.artBot(b) : '', span: 2 },
      { lab: 'Stammzahl', val: b.stammzahl },
      { lab: 'Baumhöhe', val: b.hoehe != null ? b.hoehe + ' m' : '', sub: '± 2 m' },
      { lab: 'Kronendurchmesser', val: b.kroneD != null ? b.kroneD + ' m' : '', sub: '± 2 m' },
      { lab: 'Stammumfang', val: b.stammumfang != null ? b.stammumfang + ' cm' : '',
        sub: '· gemessen in ' + (b.messhoehe || '1,00 m') },
      { lab: 'Kronenansatz', val: b.kronenansatz != null ? b.kronenansatz + ' m' : '' },
      { lab: 'Standort', val: [b.strasse, b.hausNr].filter(Boolean).join(' '), span: 2 },
      { lab: 'Flurstück', val: b.flurstueck },
      { lab: 'Alter am Standort', val: b.alter },
      { lab: 'Baumumfeld', val: b.umfeld, span: 2 },
      { lab: 'Koordinaten', val: (b.gpsLat && b.gpsLon) ? (b.gpsLat + ' N · ' + b.gpsLon + ' E') : '–',
        sub: (b.gpsLat && b.gpsLon) ? '· GPS ± 5 m' : '', span: 2 }
    ], y);
    y += 2.4;

    y = blockTitel(doc, 'Einstufung nach FLL und Kontrollintervall', y);
    y = feldGrid(doc, [
      { lab: 'Entwicklungsphase', val: b.phase },
      { lab: 'Zustand', val: b.zustand },
      { lab: 'Sicherheitserwartung des Verkehrs', val: b.erwartung },
      { lab: 'Vitalität nach Roloff (freiw.)', val: b.roloff || '–' },
      { lab: 'Kontrollintervall lt. FLL-Matrix', val: b.intervallMatrix, hl: true },
      { lab: 'Festgelegtes Intervall', val: b.intervall, hl: true },
      { lab: 'Nächste Regelkontrolle spätestens', val: b.naechsteKontrolle, hl: true, span: 2 }
    ], y);
    y += 2.4;

    /* Kontrollgänge – das Blatt als Baumkontrollbuch über vier Zyklen */
    y = blockTitel(doc, 'Kontrollgänge – Baumkontrollbuch', y, true);
    var hist = b.historie && b.historie.length ? b.historie.slice(0, 4) : [];
    while (hist.length < 4) hist.push(null);
    var zeilenDef = [
      ['Datum',                 'datum'],
      ['Handlungsbedarf',       'handlungsbedarf'],
      ['Eingehende Untersuchung', 'eu'],
      ['Baumpflegemaßnahme',    'pflege'],
      ['Fällung',               'faellung'],
      ['Künftiges Intervall',   'intervall'],
      ['Erledigungsfrist',      'frist'],
      ['Kontrolleur / Kürzel',  'kuerzel']
    ];
    doc.autoTable({
      startY: y,
      margin: { left: M.l, right: M.r },
      tableWidth: M.w,
      styles: { fontSize: 7, cellPadding: 1.1, lineColor: C.linie, lineWidth: 0.15, textColor: C.text },
      headStyles: { fillColor: C.kopfBg, textColor: [68, 68, 68], fontSize: 6.4, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: M.w * 0.3, fontStyle: 'bold', fillColor: [250, 250, 250] } },
      head: [['', '1. Kontrollgang', '2. Kontrollgang', '3. Kontrollgang', '4. Kontrollgang']],
      body: zeilenDef.map(function (zd) {
        return [zd[0]].concat(hist.map(function (h) { return h ? (h[zd[1]] || '') : '–'; }));
      })
    });
    y = doc.lastAutoTable.finalY + 2.4;

    y = blockTitel(doc, 'Grenzen der Kontrolle nach FLL 5.4', y, true);
    y = textKasten(doc, b.grenzen || 'Keine Einschränkungen der Beurteilbarkeit festgestellt.', y, 9);
    y += 2.4;

    /* Bemerkungen und Skizzenfeld nebeneinander */
    var linkeB = M.w * 0.535, rechteB = M.w - linkeB - 2.4;
    var yb = blockTitel2(doc, 'Bemerkungen', y, M.l, linkeB);
    blockTitel2(doc, 'Lageskizze / Standort', y, M.l + linkeB + 2.4, rechteB);
    var hK = 16;
    textKasten(doc, b.bemerkung || '', yb, hK, { x: M.l, w: linkeB });
    rect(doc, M.l + linkeB + 2.4, yb, rechteB, hK, null, C.linie);
    for (var g = 3.2; g < hK; g += 3.2) {
      line(doc, M.l + linkeB + 2.4, yb + g, M.l + linkeB + 2.4 + rechteB, yb + g, [244, 246, 244]);
    }
  }

  /** Blocktitel mit eigener Breite, für die zweispaltige Zeile. */
  function blockTitel2(doc, txt, y, x, w) {
    rect(doc, x, y, w, 4.4, C.grau, null);
    t(doc, txt.toUpperCase(), x + 1.8, y + 3.1, { size: 7.2, bold: true, color: C.weiss });
    return y + 4.4;
  }

  /* =========================================================================
   * Einzelblatt Seite 2 – Befund
   * ====================================================================== */

  /* Schadsymptomkatalog nach FLL 2020, gegliedert nach Baumteilen. */
  var KATALOG = {
    K: ['Astab-/Astausbrüche','Astrisse','Astungswunden / -fäulen','baumfremder Bewuchs',
        'auffällige Belaubung','Fehlentwicklungen','Höhlungen','Kappungsstellen',
        'vorh. Kronensicherung','Lichtraumprofil','Pilzbefall','Rindenschäden',
        'Totholzbildung','Vergabelungen','Wipfeldürre','Zwiesel'],
    S: ['Anfahrschäden','Astungswunden','baumfremder Bewuchs','Fäulen','Gewindestangen / Plomben',
        'Höhlungen','Pilzbefall','Rindenschäden','Risse','Schadinsekten / Bohrmehl',
        'Schrägstand','Stammaustriebe','Wuchsanomalien','Zwiesel','eingew. Drähte / Schnüre'],
    W: ['Adventiv-/Würgewurzeln','Bodenaufwölbungen','Höhlungen','Pilzbefall','Rindenschäden',
        'Risse','Stammfußverbreiterung','Stockaustriebe','Wuchsanomalien'],
    Wu:['Bodenaufwölbungen','Bodenrisse','Pilzbefall'],
    V: ['Baugruben / -gräben','Bodenauftrag / -abtrag','Bodenverdichtung','Bodenversiegelung',
        'Freistellung','Grundwasserabsenkung','Grundwasseranstau']
  };

  function symSpalte(doc, x, y, breite, titel, gruppe, codes, angekreuzt) {
    t(doc, titel.toUpperCase(), x + 1.6, y + 2.6, { size: 6.4, bold: true, color: C.gruen });
    line(doc, x + 1.6, y + 3.6, x + breite - 1.6, y + 3.6, [219, 228, 221]);
    var yy = y + 6.4;
    codes.forEach(function (bez, i) {
      var code = gruppe + (i + 1),
          an = angekreuzt.indexOf(code) >= 0;
      checkbox(doc, x + 1.6, yy, an);
      t(doc, bez, x + 4.8, yy, { size: 6.6, bold: an, color: an ? C.text : [153, 153, 153] });
      yy += 2.95;
    });
    return yy;
  }

  function blattSeite2(doc, a, b) {
    var y = kopf(doc, a.auftragsNr, 'Einzelblatt ' + MAP.baumNr(b) + ' · Seite 2');
    y += 1.6;

    var bef = MAP.befunde(b);
    y = blockTitel(doc, 'Schadsymptome – Negativerfassung, nur Auffälligkeiten angekreuzt', y);
    var sw = M.w / 4, top = y, unten = y;
    var e1 = symSpalte(doc, M.l,          y, sw, 'Krone (K1–K15)',  'K', KATALOG.K, bef.K || []);
    var e2 = symSpalte(doc, M.l + sw,     y, sw, 'Stamm (S1–S16)',  'S', KATALOG.S, bef.S || []);
    var e3 = symSpalte(doc, M.l + sw * 2, y, sw, 'Stammfuß / Wurzelanlauf (W1–W9)', 'W', KATALOG.W, bef.W || []);
    var e3b = symSpalte(doc, M.l + sw * 2, e3 + 1.2, sw, 'Wurzelbereich (Wu1–Wu3)', 'Wu', KATALOG.Wu, bef.Wu || []);
    var e4 = symSpalte(doc, M.l + sw * 3, y, sw, 'Baumumfeld (V1–V7)', 'V', KATALOG.V, bef.V || []);

    /* Pilzbestimmung in der vierten Spalte unter dem Baumumfeld */
    if (b.pilz && b.pilz.name) {
      var xp = M.l + sw * 3, yp = e4 + 1.2;
      t(doc, 'PILZBESTIMMUNG', xp + 1.6, yp + 2.6, { size: 6.4, bold: true, color: C.gruen });
      line(doc, xp + 1.6, yp + 3.6, xp + sw - 1.6, yp + 3.6, [219, 228, 221]);
      var yy = yp + 6.4;
      t(doc, b.pilz.name, xp + 1.6, yy, { size: 6.6, bold: true }); yy += 2.95;
      if (b.pilz.bot)    { t(doc, b.pilz.bot, xp + 1.6, yy, { size: 6.6, italic: true, color: C.weich }); yy += 2.95; }
      if (b.pilz.faeule) { t(doc, 'Fäuletyp: ' + b.pilz.faeule, xp + 1.6, yy, { size: 6.6, color: C.weich }); yy += 2.95; }
      if (b.pilz.lage)   { t(doc, 'Lage: ' + b.pilz.lage, xp + 1.6, yy, { size: 6.6, color: C.weich }); yy += 2.95; }
      e4 = yy;
    }

    unten = Math.max(e1, e2, e3b, e4) + 0.8;
    rect(doc, M.l, top, M.w, unten - top, null, C.linie);
    for (var s = 1; s < 4; s++) line(doc, M.l + sw * s, top, M.l + sw * s, unten, C.fein);
    y = unten + 2.4;

    y = blockTitel(doc, 'Befund', y);
    y = textKasten(doc, b.befundtext || '', y, 10, { lh: 3.6 });
    y += 2.4;

    var mn = MAP.massnahmen(b);
    y = blockTitel(doc, 'Maßnahmen und Fristen', y);
    doc.autoTable({
      startY: y,
      margin: { left: M.l, right: M.r },
      tableWidth: M.w,
      styles: { fontSize: 7.2, cellPadding: 1.2, lineColor: [204, 204, 204], lineWidth: 0.15, valign: 'top' },
      headStyles: { fillColor: C.kopfBg, textColor: [68, 68, 68], fontSize: 6.4, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: M.w * 0.32 },
        1: { cellWidth: M.w * 0.17 },
        2: { cellWidth: M.w * 0.15 },
        3: { cellWidth: M.w * 0.36 }
      },
      head: [['Maßnahme', 'Dringlichkeit', 'Frist', 'Begründung']],
      body: mn.length ? mn.map(function (m) {
        return [m.text || '', '', m.frist || '', m.begruendung || ''];
      }) : [['Keine Maßnahmen erforderlich.', '', '', '']],
      didDrawCell: function (data) {
        if (data.section === 'body' && data.column.index === 1 && mn.length) {
          var m = mn[data.row.index];
          if (m && m.stufe) badge(doc, m.stufe, data.cell.x + 1.2, data.cell.y + 3.6);
        }
      }
    });
    y = doc.lastAutoTable.finalY + 2.4;

    /* Fotos */
    var fotos = MAP.fotos(b);
    y = blockTitel(doc, 'Fotodokumentation', y, true);
    var fh = 16, fx = M.l + 1.4, fw = (M.w - 2.8 - 3 * 1.4) / 4;
    rect(doc, M.l, y, M.w, fh + 2.8, null, C.linie);
    for (var i = 0; i < 4; i++) {
      var x = fx + i * (fw + 1.4);
      if (fotos[i]) {
        try { doc.addImage(fotos[i], 'JPEG', x, y + 1.4, fw, fh); } catch (e) { /* defekt, dann leer */ }
      } else {
        rect(doc, x, y + 1.4, fw, fh, [236, 238, 236], [213, 216, 213], 0.15);
      }
    }
    y += fh + 5.2;

    /* Rechtstexte zweispaltig */
    y = blockTitel(doc, 'Grundlagen, Methodik und Hinweise', y, true);
    var punkte = [
      ['Grundlage:', (a.kontrollart || 'Regelkontrolle') + ' gemäß FLL-Baumkontrollrichtlinien, 3. Ausgabe 2020. Rechtsgrundlage ist die Verkehrssicherungspflicht nach § 823 BGB.'],
      ['Methode:', 'Sichtkontrolle durch fachlich qualifizierte Inaugenscheinnahme vom Boden aus, Besichtigung des Baumes von allen Seiten. Es erfolgte keine eingehende Untersuchung im Sinne der FLL-Baumuntersuchungsrichtlinien.'],
      ['Momentaufnahme:', 'Der Befund gilt zum Zeitpunkt der Kontrolle. Witterungsereignisse, Eingriffe am Baum oder Veränderungen im Umfeld erfordern eine Zusatzkontrolle.'],
      ['Grenzen der Kontrolle', 'nach FLL 5.4 sind auf Seite 1 dokumentiert und schränken die Beurteilbarkeit in den genannten Bereichen ein.'],
      ['Restrisiko:', 'Absolute Sicherheit ist bei Bäumen nicht herstellbar (BGH 21.01.1965, NJW 1965, 815; BGH 06.03.2014, III ZR 352/13).'],
      ['Umsetzung:', 'Die Verantwortung für die fristgerechte Umsetzung der empfohlenen Maßnahmen liegt beim Eigentümer bzw. Verkehrssicherungspflichtigen.'],
      ['Artenschutz:', 'Vor Maßnahmen an Höhlen- und Habitatbäumen ist § 44 BNatSchG zu beachten. Weder Verkehrssicherung noch Artenschutz haben absoluten Vorrang.'],
      ['Aufbewahrung:', 'Die Dokumentation ist 5 Jahre ab der letzten Eintragung aufzubewahren.']
    ];
    y = rechtsBlock(doc, punkte, y);

    /* Unterschrift */
    y += 3.2;
    var sb = (M.w - 2 * 6) / 3;
    [[a.kontrolleur || '', (a.qualifikation || '') + (FIRMA.name ? ' · ' + FIRMA.name : '')],
     [a.datum || '', 'Datum der Kontrolle'],
     ['', 'Unterschrift Baumkontrolleur']].forEach(function (p, i) {
      var x = M.l + i * (sb + 6);
      line(doc, x, y, x + sb, y, [51, 51, 51], 0.3);
      t(doc, p[0], x, y + 3.4, { size: 8, bold: true });
      t(doc, p[1], x, y + 6.4, { size: 6.4, color: C.weich });
    });
  }

  /** Nummerierte Rechtstexte in zwei Spalten. */
  function rechtsBlock(doc, punkte, y) {
    var pad = 1.8,
        sw = (M.w - 2 * pad - 4) / 2,
        haelfte = Math.ceil(punkte.length / 2),
        spalten = [punkte.slice(0, haelfte), punkte.slice(haelfte)],
        hoehen = [0, 0], gerendert = [];

    doc.setFontSize(5.9);
    spalten.forEach(function (sp, si) {
      var yy = 0;
      sp.forEach(function (p, pi) {
        var nr = (si * haelfte + pi + 1) + '.';
        doc.setFont('helvetica', 'normal');
        var zeilen = doc.splitTextToSize(p[0] + ' ' + p[1], sw - 4);
        gerendert.push({ si: si, nr: nr, fett: p[0], zeilen: zeilen, y: yy });
        yy += zeilen.length * 2.5 + 0.9;
      });
      hoehen[si] = yy;
    });

    var h = Math.max(hoehen[0], hoehen[1]) + 2 * pad;
    rect(doc, M.l, y, M.w, h, null, C.linie);

    gerendert.forEach(function (g) {
      var x = M.l + pad + g.si * (sw + 4),
          yy = y + pad + 2.2 + g.y;
      t(doc, g.nr, x, yy, { size: 5.9, color: C.weich });
      g.zeilen.forEach(function (z, i) {
        if (i === 0) {
          t(doc, g.fett, x + 3.4, yy, { size: 5.9, bold: true, color: [51, 51, 51] });
          doc.setFont('helvetica', 'bold'); doc.setFontSize(5.9);
          var fw = doc.getTextWidth(g.fett);
          t(doc, z.substring(g.fett.length).trim(), x + 3.4 + fw + 0.8, yy, { size: 5.9, color: C.weich });
        } else {
          t(doc, z, x + 3.4, yy, { size: 5.9, color: C.weich });
        }
        yy += 2.5;
      });
    });
    return y + h;
  }

  /* =========================================================================
   * Berichtsteil für Bestände
   * ====================================================================== */

  function deckblatt(doc, a, anzahl) {
    var y = 48;
    if (FIRMA.logo) {
      try { doc.addImage(FIRMA.logo, 'PNG', M.b / 2 - 20, y - 22, 40, 18); } catch (e) {}
    }
    t(doc, FIRMA.name, M.b / 2, y, { size: 24, bold: true, color: C.gruen, align: 'center' });
    t(doc, FIRMA.zusatz.replace('Fachbetrieb für ', ''), M.b / 2, y + 6, { size: 8, color: C.weich, align: 'center' });
    rect(doc, M.b / 2 - 35, y + 18, 70, 0.9, C.gruen, null);

    t(doc, 'Baumkontrollbericht', M.b / 2, y + 40, { size: 19, bold: true, align: 'center' });
    var nz = doc.splitTextToSize((a.kontrollart || 'Regelkontrolle') + ' gemäß ' + NORM, 120);
    nz.forEach(function (z, i) {
      t(doc, z, M.b / 2, y + 47 + i * 4, { size: 8, color: C.weich, align: 'center' });
    });

    var dy = y + 47 + nz.length * 4 + 12,
        dw = 130, dx = (M.b - dw) / 2, lw = 46, zh = 7.2;
    var daten = [
      ['Objekt', a.objekt], ['Auftraggeber', a.auftraggeber], ['Auftrags-Nr.', a.auftragsNr],
      ['Kontrollart', a.kontrollart || 'Regelkontrolle'],
      ['Kontrollzeitraum', a.datumBis ? (a.datum + ' – ' + a.datumBis) : a.datum],
      ['Belaubungszustand', a.belaubung], ['Umfang', anzahl + ' Bäume'],
      ['Baumkontrolleur', a.kontrolleur + (a.qualifikation ? ', ' + a.qualifikation : '')],
      ['Berichtsdatum', a.berichtsdatum || a.datum]
    ];
    daten.forEach(function (d, i) {
      var yy = dy + i * zh;
      rect(doc, dx, yy, lw, zh, [244, 246, 244], null);
      t(doc, String(d[0]).toUpperCase(), dx + 2.4, yy + 4.6, { size: 6.4, color: C.weich });
      t(doc, d[1] || '', dx + lw + 2.4, yy + 4.6, { size: 8.4, bold: true });
      if (i) line(doc, dx, yy, dx + dw, yy, C.fein);
    });
    rect(doc, dx, dy, dw, daten.length * zh, null, C.linie);
    line(doc, dx + lw, dy, dx + lw, dy + daten.length * zh, C.fein);

    var fuss = [FIRMA.name, FIRMA.anschrift, FIRMA.kontakt].filter(Boolean).join(' · ');
    if (fuss) t(doc, fuss, M.b / 2, M.h - 20, { size: 7, color: [136, 136, 136], align: 'center' });
  }

  function zusammenfassung(doc, a, baeume) {
    var y = kopf(doc, a.auftragsNr, 'Zusammenfassung');
    t(doc, 'Zusammenfassung der Kontrolle', M.l, y + 3.2, { size: 11, bold: true });
    t(doc, [a.objekt, 'Kontrolle vom ' + a.datum + (a.datumBis ? '–' + a.datumBis : ''),
            baeume.length + ' Bäume'].filter(Boolean).join(' · '),
      M.l, y + 6.8, { size: 7.2, color: C.weich });
    y += 10.4;

    /* Kennzahlen */
    var alleM = [];
    baeume.forEach(function (b) {
      MAP.massnahmen(b).forEach(function (m) { alleM.push({ b: b, m: m }); });
    });
    var mitM   = baeume.filter(function (b) { return MAP.massnahmen(b).length; }).length,
        sofort = einzig(alleM.filter(function (x) { return x.m.stufe === 1; })),
        eu     = einzig(alleM.filter(function (x) { return /eingehende untersuchung/i.test(x.m.text || ''); }));

    var kacheln = [
      [baeume.length, 'kontrollierte Bäume', false],
      [mitM,          'Bäume mit Maßnahmenbedarf', false],
      [sofort,        'Bäume mit Sofortmaßnahme', true],
      [eu,            'eingehende Untersuchungen', false]
    ];
    var kw = (M.w - 3 * 1.8) / 4;
    kacheln.forEach(function (k, i) {
      var x = M.l + i * (kw + 1.8);
      rect(doc, x, y, kw, 13.4, null, C.linie);
      t(doc, String(k[0]), x + 2.4, y + 7.4, { size: 18, bold: true, color: k[2] ? C.warn : C.gruen });
      var lz = doc.splitTextToSize(String(k[1]).toUpperCase(), kw - 4.8);
      doc.setFontSize(5.6);
      lz.forEach(function (z, j) { t(doc, z, x + 2.4, y + 10.4 + j * 2.4, { size: 5.6, color: C.weich }); });
    });
    y += 15.8;

    /* Zustandsbalken */
    var ok  = baeume.filter(function (b) { return /gesund|leicht/i.test(b.zustand || ''); }).length,
        bad = baeume.length - ok;
    y = blockTitel(doc, 'Zustand des Bestandes nach FLL', y);
    var by = y + 2.2, bh = 4.6, wOk = M.w * (ok / Math.max(1, baeume.length));
    rect(doc, M.l + 1.8, by, M.w - 3.6, bh, null, C.linie, 0.15);
    if (ok)  rect(doc, M.l + 1.8, by, (M.w - 3.6) * ok / baeume.length, bh, [91, 140, 62], null);
    if (bad) rect(doc, M.l + 1.8 + (M.w - 3.6) * ok / baeume.length, by, (M.w - 3.6) * bad / baeume.length, bh, C.warn, null);
    if (ok)  t(doc, ok + ' gesund / leicht geschädigt', M.l + 1.8 + (M.w - 3.6) * ok / baeume.length / 2, by + 3.1,
               { size: 6, bold: true, color: C.weiss, align: 'center' });
    if (bad) t(doc, bad + ' stärker geschädigt', M.l + 1.8 + (M.w - 3.6) * (ok / baeume.length + bad / baeume.length / 2), by + 3.1,
               { size: 6, bold: true, color: C.weiss, align: 'center' });

    var phasen = {}, txtY = by + bh + 4.4;
    baeume.forEach(function (b) { phasen[b.phase] = (phasen[b.phase] || 0) + 1; });
    var satz = 'Der Bestand umfasst ' + baeume.length + ' Bäume. ' + bad + ' davon ' +
               (bad === 1 ? 'ist stärker geschädigt und wird' : 'sind stärker geschädigt und werden') +
               ' jährlich kontrolliert. Entwicklungsphasen: ' +
               Object.keys(phasen).map(function (p) { return phasen[p] + ' ' + p; }).join(', ') + '.';
    var hh = textBlock(doc, satz, M.l + 2.4, txtY, M.w - 4.8, { size: 8 });
    rect(doc, M.l, y, M.w, (txtY + hh - y) + 1.4, null, C.linie);
    y = txtY + hh + 3.8;

    /* Maßnahmenbedarf nach Dringlichkeit */
    y = blockTitel(doc, 'Maßnahmenbedarf nach Dringlichkeit', y);
    var zeilen = [];
    [1, 2, 3, 4, 5].forEach(function (st) {
      var g = alleM.filter(function (x) { return x.m.stufe === st; });
      if (!g.length) return;
      var nummern = g.map(function (x) { return MAP.baumNr(x.b); })
                     .filter(function (v, i, arr) { return arr.indexOf(v) === i; }).sort();
      zeilen.push([st, String(g.length), g[0].m.frist || '', nummern.join(', ')]);
    });
    doc.autoTable({
      startY: y, margin: { left: M.l, right: M.r }, tableWidth: M.w,
      styles: { fontSize: 7.2, cellPadding: 1.3, lineColor: [204, 204, 204], lineWidth: 0.15 },
      headStyles: { fillColor: C.kopfBg, textColor: [68, 68, 68], fontSize: 6.4, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: M.w * 0.22 }, 1: { cellWidth: M.w * 0.14 }, 2: { cellWidth: M.w * 0.2 } },
      head: [['Dringlichkeit', 'Maßnahmen', 'Frist', 'Betroffene Baum-Nummern']],
      body: zeilen.map(function (z) { return ['', z[1], z[2], z[3]]; }),
      didDrawCell: function (data) {
        if (data.section === 'body' && data.column.index === 0) {
          badge(doc, zeilen[data.row.index][0], data.cell.x + 1.3, data.cell.y + 3.7);
        }
      }
    });
    y = doc.lastAutoTable.finalY + 2.8;

    /* Intervalle */
    var iv = {};
    baeume.forEach(function (b) { iv[b.intervall] = (iv[b.intervall] || 0) + 1; });
    y = blockTitel(doc, 'Kontrollintervalle und nächste Regelkontrolle', y);
    doc.autoTable({
      startY: y, margin: { left: M.l, right: M.r }, tableWidth: M.w,
      styles: { fontSize: 7.2, cellPadding: 1.3, lineColor: [204, 204, 204], lineWidth: 0.15 },
      headStyles: { fillColor: C.kopfBg, textColor: [68, 68, 68], fontSize: 6.4, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: M.w * 0.24, fontStyle: 'bold' }, 1: { cellWidth: M.w * 0.14 }, 2: { cellWidth: M.w * 0.26 } },
      head: [['Intervall', 'Bäume', 'Nächste Regelkontrolle', 'Grundlage']],
      body: Object.keys(iv).map(function (k) {
        var beispiel = baeume.filter(function (b) { return b.intervall === k; })[0];
        return [k, String(iv[k]), (beispiel && beispiel.naechsteKontrolle) || '–', grundlage(k)];
      })
    });
  }

  function grundlage(intervall) {
    if (/jähr/i.test(intervall))  return 'stärker geschädigt oder Alterungsphase bei höherer Sicherheitserwartung';
    if (/^2/.test(intervall))     return 'Reifephase, höhere Sicherheitserwartung';
    if (/^3/.test(intervall))     return 'Reifephase, geringere Sicherheitserwartung';
    return 'Jugendphase bei bedarfsgerechter Jungbaumpflege nach ZTV-Baumpflege';
  }

  function einzig(liste) {
    var s = [];
    liste.forEach(function (x) { if (s.indexOf(MAP.baumNr(x.b)) < 0) s.push(MAP.baumNr(x.b)); });
    return s.length;
  }

  function bestandsliste(doc, a, baeume) {
    var y = kopf(doc, a.auftragsNr, 'Bestandsliste');
    t(doc, 'Bestandsliste', M.l, y + 3.2, { size: 11, bold: true });
    t(doc, 'Alle kontrollierten Bäume · Sortierung nach Baum-Nr. · Maße gerundet gemäß FLL (± 2 m)',
      M.l, y + 6.8, { size: 7.2, color: C.weich });
    y += 10.4;

    var stufen = baeume.map(function (b) {
      var mn = MAP.massnahmen(b);
      if (!mn.length) return null;
      return Math.min.apply(null, mn.map(function (m) { return m.stufe || 5; }));
    });

    doc.autoTable({
      startY: y, margin: { left: M.l, right: M.r }, tableWidth: M.w,
      showHead: 'everyPage',
      styles: { fontSize: 6.6, cellPadding: 0.9, lineColor: [204, 204, 204], lineWidth: 0.15, valign: 'top' },
      headStyles: { fillColor: C.kopfBg, textColor: [68, 68, 68], fontSize: 5.9, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: M.w * 0.052, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: M.w * 0.15 },
        2: { cellWidth: M.w * 0.05, halign: 'center' },
        3: { cellWidth: M.w * 0.055, halign: 'center' },
        4: { cellWidth: M.w * 0.05, halign: 'center' },
        5: { cellWidth: M.w * 0.083, halign: 'center' },
        6: { cellWidth: M.w * 0.09 },
        7: { cellWidth: M.w * 0.075, halign: 'center' },
        8: { cellWidth: M.w * 0.085, halign: 'center', fontStyle: 'bold' },
        9: { cellWidth: M.w * 0.11, halign: 'center' },
        10:{ cellWidth: 'auto' }
      },
      head: [['Nr.', 'Baumart', 'Höhe\nm', 'Krone\nm', 'Umf.\ncm', 'Entwickl.-\nphase', 'Zustand',
              'Sicherh.-\nerwartung', 'Intervall', 'Dringlichkeit', 'Maßnahme']],
      body: baeume.map(function (b) {
        var mn = MAP.massnahmen(b);
        return [
          MAP.baumNr(b), MAP.artDt(b) + (MAP.artBot(b) ? '\n' + MAP.artBot(b) : ''),
          b.hoehe, b.kroneD, b.stammumfang, b.phase, b.zustand, b.erwartung, b.intervall,
          '', mn.length ? mn.map(function (m) { return m.text; }).join(', ') : '–'
        ];
      }),
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.minCellHeight = 5.4;
        }
      },
      didDrawCell: function (data) {
        if (data.section === 'body' && data.column.index === 1) {
          /* botanischen Namen kursiv und kleiner nachziehen */
          var b = baeume[data.row.index];
          if (MAP.artBot(b)) {
            rect(doc, data.cell.x + 0.4, data.cell.y + 3.1, data.cell.width - 0.8, 2.6, C.weiss, null);
            t(doc, MAP.artBot(b), data.cell.x + 0.9, data.cell.y + 5.1,
              { size: 5.6, italic: true, color: [136, 136, 136] });
          }
        }
        if (data.section === 'body' && data.column.index === 9) {
          var st = stufen[data.row.index];
          if (st) {
            doc.setFontSize(6.4); doc.setFont('helvetica', 'bold');
            var bw = doc.getTextWidth(DRING[st].kurz) + 2.6;
            badge(doc, st, data.cell.x + (data.cell.width - bw) / 2, data.cell.y + 3.4);
          } else {
            t(doc, '–', data.cell.x + data.cell.width / 2, data.cell.y + 3.1,
              { size: 6.6, color: [187, 187, 187], align: 'center' });
          }
        }
      }
    });
  }

  function massnahmenliste(doc, a, baeume) {
    var y = kopf(doc, a.auftragsNr, 'Maßnahmen');
    t(doc, 'Maßnahmen nach Dringlichkeit', M.l, y + 3.2, { size: 11, bold: true });
    t(doc, 'Dringlichkeitsstufen nach GALK-Musterdienstanweisung 2021 · Umsetzungsverantwortung liegt beim Eigentümer',
      M.l, y + 6.8, { size: 7.2, color: C.weich });
    y += 10.4;

    var alle = [];
    baeume.forEach(function (b) {
      MAP.massnahmen(b).forEach(function (m) { alle.push({ b: b, m: m }); });
    });
    alle.sort(function (x, z) { return (x.m.stufe || 9) - (z.m.stufe || 9); });

    doc.autoTable({
      startY: y, margin: { left: M.l, right: M.r }, tableWidth: M.w,
      showHead: 'everyPage',
      styles: { fontSize: 7, cellPadding: 1.2, lineColor: [204, 204, 204], lineWidth: 0.15, valign: 'top' },
      headStyles: { fillColor: C.kopfBg, textColor: [68, 68, 68], fontSize: 6.2, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: M.w * 0.14, halign: 'center' },
        1: { cellWidth: M.w * 0.06, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: M.w * 0.14 },
        3: { cellWidth: M.w * 0.26 },
        4: { cellWidth: M.w * 0.13, halign: 'center' },
        5: { cellWidth: 'auto' }
      },
      head: [['Dringlichkeit', 'Nr.', 'Baumart', 'Maßnahme', 'Frist', 'Begründung']],
      body: alle.map(function (x) {
        return ['', MAP.baumNr(x.b), MAP.artDt(x.b), x.m.text || '', x.m.frist || '', x.m.begruendung || ''];
      }),
      didDrawCell: function (data) {
        if (data.section === 'body' && data.column.index === 0) {
          var st = alle[data.row.index].m.stufe;
          if (st) {
            doc.setFontSize(6.4); doc.setFont('helvetica', 'bold');
            var bw = doc.getTextWidth(DRING[st].kurz) + 2.6;
            badge(doc, st, data.cell.x + (data.cell.width - bw) / 2, data.cell.y + 3.6);
          }
        }
      }
    });
    y = doc.lastAutoTable.finalY + 3.2;

    if (y < M.h - 60) {
      y = blockTitel(doc, 'Hinweise zur Umsetzung', y, true);
      y = rechtsBlock(doc, [
        ['Sofortmaßnahmen:', 'Als unverzüglich eingestufte Maßnahmen sind ohne Verzug umzusetzen. Bis zur Umsetzung ist der Gefahrenbereich abzusperren und der Bestand der Absperrung arbeitstäglich zu prüfen.'],
        ['Artenschutz:', 'Vor Fällungen und vor Arbeiten an Höhlen- und Habitatbäumen ist § 44 BNatSchG zu prüfen. Weder Verkehrssicherung noch Artenschutz haben absoluten Vorrang.'],
        ['Nachkontrolle:', 'Nach Umsetzung der Maßnahmen ist eine Nachkontrolle durchzuführen und zu dokumentieren.'],
        ['Ausführung:', 'Alle Schnittmaßnahmen nach ZTV-Baumpflege 2017. Umsetzungsverantwortung und Fristenüberwachung liegen beim Eigentümer bzw. Verkehrssicherungspflichtigen.'],
        ['Dokumentation:', 'Dieser Bericht ist 5 Jahre ab der letzten Eintragung aufzubewahren.']
      ], y);

      y += 3.2;
      var sb = (M.w - 2 * 6) / 3;
      [[a.kontrolleur || '', (a.qualifikation || '') + (FIRMA.name ? ' · ' + FIRMA.name : '')],
       [a.berichtsdatum || a.datum || '', 'Berichtsdatum'],
       ['', 'Unterschrift Baumkontrolleur']].forEach(function (p, i) {
        var x = M.l + i * (sb + 6);
        line(doc, x, y, x + sb, y, [51, 51, 51], 0.3);
        t(doc, p[0], x, y + 3.4, { size: 8, bold: true });
        t(doc, p[1], x, y + 6.4, { size: 6.4, color: C.weich });
      });
    }
  }

  function trenner(doc, a, anzahl) {
    kopf(doc, a.auftragsNr, 'Einzelkontrollblätter');
    t(doc, 'Einzelkontrollblätter', M.b / 2, M.h / 2 - 4, { size: 15, bold: true, color: C.gruen, align: 'center' });
    t(doc, 'Je Baum zwei Seiten im FLL-Format.', M.b / 2, M.h / 2 + 3, { size: 8.4, color: C.weich, align: 'center' });
    t(doc, 'Es folgen ' + anzahl + (anzahl === 1 ? ' Baum.' : ' Bäume.'), M.b / 2, M.h / 2 + 8, { size: 8.4, color: C.weich, align: 'center' });
  }

  /* =========================================================================
   * Öffentliche API
   * ====================================================================== */

  function neuesDokument() {
    var doc = new jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({ title: 'Baumkontrollprotokoll', creator: FIRMA.name });
    return doc;
  }

  function seitenzahlen(doc) {
    var n = doc.internal.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      if (i === 1 && n > 2) continue;              // Deckblatt bleibt frei
      t(doc, 'Seite ' + i + ' von ' + n, M.b - M.r, M.h - 7, { size: 6.2, color: [153, 153, 153], align: 'right' });
    }
  }

  function erzeugen(daten, opt) {
    opt = opt || {};
    var a = daten.auftrag || {},
        baeume = daten.baeume || [],
        modus = opt.modus || (baeume.length > 1 ? 'bestand' : 'einzel'),
        doc = neuesDokument();

    if (modus === 'bestand') {
      deckblatt(doc, a, baeume.length);
      doc.addPage(); zusammenfassung(doc, a, baeume);
      doc.addPage(); bestandsliste(doc, a, baeume);
      doc.addPage(); massnahmenliste(doc, a, baeume);
      doc.addPage(); trenner(doc, a, baeume.length);
      baeume.forEach(function (b) {
        doc.addPage(); blattSeite1(doc, a, b, 'Einzelkontrollblatt – Baum ' + MAP.baumNr(b));
        doc.addPage(); blattSeite2(doc, a, b);
      });
    } else {
      baeume.forEach(function (b, i) {
        if (i) doc.addPage();
        blattSeite1(doc, a, b);
        doc.addPage(); blattSeite2(doc, a, b);
      });
    }

    seitenzahlen(doc);
    return doc;
  }

  /* =========================================================================
   * Angebot
   *
   * Bewusst ein eigenes Dokument. Wer kontrolliert und ausführt, steht sonst
   * im Verdacht, sich Arbeit herbeizuschreiben. Das Protokoll bleibt neutral
   * und liefert die Begründung, das Angebot nur den Preis.
   *
   * Positionen sind nach Dringlichkeit gruppiert und haben Zwischensummen,
   * damit der Kunde auch nur die vorderen Blöcke beauftragen kann.
   * ====================================================================== */

  /** Glättung der Katalogtexte fürs Angebot. Liegt in 10_data.js, damit App
   *  und PDF dieselbe Fassung verwenden. */
  function leistungstext(txt) {
    return (typeof DATA !== 'undefined' && DATA.leistungstext)
      ? DATA.leistungstext(txt) : String(txt || '');
  }

  function euro(n) {
    return (Math.round(n * 100) / 100).toLocaleString('de-DE',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function angebot(daten, posten, opt) {
    opt = opt || {};
    var a = daten.auftrag || {},
        ust = opt.ust == null ? 19 : opt.ust,
        doc = neuesDokument();

    /* --- Briefkopf --- */
    var y = M.o + 4;
    t(doc, FIRMA.name, M.l, y, { size: 13, bold: true, color: C.gruen });
    t(doc, FIRMA.zusatz, M.l, y + 3.4, { size: 7, color: C.weich });
    t(doc, 'Angebots-Nr.', M.b - M.r, y - 3.6, { size: 7.4, align: 'right', color: C.weich });
    t(doc, opt.angebotsNr || a.auftragsNr || '', M.b - M.r, y, { size: 10.5, bold: true, align: 'right' });
    t(doc, opt.datum || a.berichtsdatum || a.datum || '', M.b - M.r, y + 3.4,
      { size: 7.4, align: 'right', color: C.weich });
    line(doc, M.l, y + 5.4, M.b - M.r, y + 5.4, C.gruen, 0.9);
    y += 12;

    /* --- Empfänger --- */
    t(doc, a.auftraggeber || '', M.l, y, { size: 9.4, bold: true });
    y += 10;

    t(doc, 'Angebot über Baumpflegearbeiten', M.l, y, { size: 12.5, bold: true });
    y += 5;
    t(doc, a.objekt || '', M.l, y, { size: 8.4, color: C.weich });
    y += 7;

    var einleitung = 'auf Grundlage der Regelkontrolle vom ' + (a.datum || '') +
      (a.datumBis ? ' bis ' + a.datumBis : '') +
      ' unterbreiten wir Ihnen folgendes Angebot über die im Kontrollbericht empfohlenen ' +
      'Maßnahmen. Die fachliche Begründung je Baum entnehmen Sie bitte dem Kontrollbericht, ' +
      'der diesem Angebot zugrunde liegt.';
    t(doc, 'Sehr geehrte Damen und Herren,', M.l, y, { size: 8.4 });
    y += 4.4;
    y += textBlock(doc, einleitung, M.l, y, M.w, { size: 8.4, lh: 3.9 }) + 4;

    /* --- Positionen, nach Dringlichkeit gruppiert --- */
    var pos = 0, gesamt = 0, zwischen = [], y2 = y;

    [1, 2, 3, 4, 5].forEach(function (stufe) {
      var gruppe = posten.filter(function (p) { return p.stufe === stufe; });
      if (!gruppe.length) return;

      var summe = gruppe.reduce(function (s, p) { return s + (p.preis || 0); }, 0),
          offen = gruppe.filter(function (p) { return !p.preis; }).length;
      gesamt += summe;
      zwischen.push({ stufe: stufe, summe: summe, anzahl: gruppe.length });

      var d = DRING[stufe];
      if (y2 > M.h - 42) { doc.addPage(); y2 = M.o + 6; }

      /* Farbiger Gruppenbalken statt einer Dringlichkeitsspalte je Zeile */
      rect(doc, M.l, y2, M.w, 4.8, d.bg, null);
      t(doc, ('Ausführung ' + d.lang).toUpperCase(), M.l + 2, y2 + 3.3,
        { size: 7, bold: true, color: d.fg });
      t(doc, gruppe.length + (gruppe.length === 1 ? ' Position' : ' Positionen'),
        M.b - M.r - 2, y2 + 3.3, { size: 7, bold: true, color: d.fg, align: 'right' });
      y2 += 4.8;

      doc.autoTable({
        startY: y2,
        margin: { left: M.l, right: M.r },
        tableWidth: M.w,
        showHead: 'everyPage',
        styles: { fontSize: 7.6, cellPadding: 1.5, lineColor: [204, 204, 204], lineWidth: 0.15, valign: 'top' },
        headStyles: { fillColor: C.kopfBg, textColor: [68, 68, 68], fontSize: 6.4, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: M.w * 0.06, halign: 'center' },
          1: { cellWidth: M.w * 0.1, halign: 'center' },
          2: { cellWidth: M.w * 0.19 },
          3: { cellWidth: M.w * 0.3 },
          4: { cellWidth: M.w * 0.15, halign: 'center' },
          5: { cellWidth: 'auto', halign: 'right' }
        },
        head: [['Pos.', 'Baum-Nr.', 'Baum und Standort', 'Leistung', 'Ausführung bis', 'Netto']],
        body: gruppe.map(function (p) {
          pos++;
          return [String(pos), p.nr,
            p.art + (p.standort ? '\n' + p.standort : ''),
            leistungstext(p.text), (p.frist || '').replace(/^bis /, ''),
            p.preis ? euro(p.preis) : 'auf Anfrage'];
        })
      });

      var zy = doc.lastAutoTable.finalY;
      if (zy > M.h - 14) { doc.addPage(); zy = M.o + 6; }
      rect(doc, M.l + M.w * 0.6, zy, M.w * 0.4, 5.2, [246, 248, 246], C.linie);
      t(doc, 'Zwischensumme ' + d.kurz, M.l + M.w * 0.615, zy + 3.5, { size: 7.2, bold: true });
      if (offen) t(doc, '+ ' + offen + ' Position' + (offen === 1 ? '' : 'en') + ' auf Anfrage',
                   M.l + 1.6, zy + 3.5, { size: 6.6, color: C.weich });
      t(doc, euro(summe), M.b - M.r - 1.6, zy + 3.5, { size: 7.6, bold: true, align: 'right', color: C.gruen });
      y2 = zy + 8.4;
    });

    if (y2 > M.h - 60) { doc.addPage(); y2 = M.o + 6; }

    /* --- Summen --- */
    var sx = M.l + M.w * 0.5, sw = M.w * 0.5, sh = 6;
    [['Summe netto', gesamt, false],
     ['zzgl. ' + ust + ' % Umsatzsteuer', gesamt * ust / 100, false],
     ['Gesamtbetrag brutto', gesamt * (100 + ust) / 100, true]
    ].forEach(function (r, i) {
      var yy = y2 + i * sh;
      if (r[2]) rect(doc, sx, yy, sw, sh, C.hell, C.linie);
      else      line(doc, sx, yy + sh, sx + sw, yy + sh, C.fein);
      t(doc, r[0], sx + 2.4, yy + 4.1, { size: r[2] ? 8.6 : 8, bold: r[2] });
      t(doc, euro(r[1]), M.b - M.r - 2.4, yy + 4.1,
        { size: r[2] ? 9.4 : 8, bold: true, align: 'right', color: r[2] ? C.gruen : C.text });
    });
    y2 += 3 * sh + 6;

    /* --- Teilbeauftragung --- */
    if (zwischen.length > 1) {
      y2 = blockTitel(doc, 'Teilbeauftragung möglich', y2, true);
      var zeilen = [], laufend = 0;
      zwischen.forEach(function (z) {
        laufend += z.summe;
        zeilen.push([DRING[z.stufe].lang, String(z.anzahl), euro(z.summe), euro(laufend)]);
      });
      doc.autoTable({
        startY: y2, margin: { left: M.l, right: M.r }, tableWidth: M.w,
        styles: { fontSize: 7.4, cellPadding: 1.4, lineColor: [204, 204, 204], lineWidth: 0.15 },
        headStyles: { fillColor: C.kopfBg, textColor: [68, 68, 68], fontSize: 6.4, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'center', cellWidth: M.w * 0.14 },
                        2: { halign: 'right', cellWidth: M.w * 0.2 },
                        3: { halign: 'right', cellWidth: M.w * 0.24, fontStyle: 'bold' } },
        head: [['Beauftragung bis einschließlich', 'Positionen', 'Betrag netto', 'Summe netto']],
        body: zeilen
      });
      y2 = doc.lastAutoTable.finalY + 4;
    }

    if (y2 > M.h - 52) { doc.addPage(); y2 = M.o + 6; }

    /* --- Hinweise --- */
    y2 = blockTitel(doc, 'Hinweise', y2, true);
    y2 = rechtsBlock(doc, [
      ['Grundlage:', 'Die Positionen entsprechen den im Kontrollbericht vom ' +
        (a.berichtsdatum || a.datum || '') + ' empfohlenen Maßnahmen. Preise verstehen sich netto je Baum.'],
      ['Ausführung:', 'Alle Arbeiten nach ZTV-Baumpflege 2017 durch fachlich qualifiziertes Personal, ' +
        'einschließlich Sicherung der Arbeitsstelle und Abfuhr des Schnittguts.'],
      ['Fristen:', 'Die genannten Termine ergeben sich aus der Dringlichkeitseinstufung der Kontrolle. ' +
        'Bei späterer Beauftragung kann die Frist nicht mehr eingehalten werden.'],
      ['Verkehrssicherung:', 'Die Verantwortung für die Verkehrssicherheit bleibt bis zur Ausführung ' +
        'beim Eigentümer. Als unverzüglich eingestufte Positionen dulden keinen Aufschub.'],
      ['Artenschutz:', 'Vor Fällungen und Arbeiten an Höhlen- und Habitatbäumen wird § 44 BNatSchG geprüft. ' +
        'Ergibt sich daraus eine Verzögerung, wird das vorab mitgeteilt.'],
      ['Gültigkeit:', 'Dieses Angebot ist ' + (opt.gueltigTage || 60) + ' Tage gültig. ' +
        'Zahlbar innerhalb von 14 Tagen nach Rechnungsstellung ohne Abzug.']
    ], y2);

    y2 += 5;
    if (y2 < M.h - 26) {
      t(doc, 'Wir freuen uns auf Ihren Auftrag.', M.l, y2, { size: 8.4 });
      y2 += 9;
      var sb = (M.w - 12) / 3;
      [[a.kontrolleur || '', FIRMA.name],
       [opt.datum || a.berichtsdatum || a.datum || '', 'Datum'],
       ['', 'Auftragserteilung Kunde']].forEach(function (p, i) {
        var x = M.l + i * (sb + 6);
        line(doc, x, y2, x + sb, y2, [51, 51, 51], 0.3);
        t(doc, p[0], x, y2 + 3.4, { size: 8, bold: true });
        t(doc, p[1], x, y2 + 6.4, { size: 6.4, color: C.weich });
      });
    }

    seitenzahlen(doc);
    return doc;
  }

  function dateiname(a, modus) {
    var teil = (a.objekt || 'Baumkontrolle').replace(/[^\wäöüÄÖÜß -]/g, '').trim().replace(/\s+/g, '_'),
        vorn = modus === 'bestand' ? 'Baumkontrollbericht_'
             : (modus === 'angebot' ? 'Angebot_' : 'Baumkontrollprotokoll_');
    return vorn + teil + '_' + (a.datum || '').replace(/\./g, '-') + '.pdf';
  }

  return {
    FIRMA: FIRMA,
    DRING: DRING,
    KATALOG: KATALOG,
    erzeugen: erzeugen,
    angebot: angebot,
    speichern: function (daten, opt) {
      var doc = erzeugen(daten, opt);
      doc.save(dateiname(daten.auftrag || {}, (opt && opt.modus) ||
        ((daten.baeume || []).length > 1 ? 'bestand' : 'einzel')));
    },
    speichereAngebot: function (daten, posten, opt) {
      var doc = angebot(daten, posten, opt);
      doc.save(dateiname(daten.auftrag || {}, 'angebot'));
    },
    setzeFirma: function (obj) { Object.keys(obj || {}).forEach(function (k) { FIRMA[k] = obj[k]; }); }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PDF;
