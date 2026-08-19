/* =============================================================================
 * 20_app.js  –  Erfassung, Liste, Speicherung, Navigation
 * Baumkontrolltool Hundertmark
 * ========================================================================== */

var App = (function () {
  'use strict';

  var VERSION = '2.0';
  var SCHLUESSEL = 'baumkontrolle.v2';
  var PAPIERKORB_TAGE = 30;

  /* --- Zustand ------------------------------------------------------------ */
  var S = leererZustand();
  var aktuellerBaum = null;      // Index in S.baeume, null = keiner offen
  var ansicht = 'liste';
  var speicherFallback = null;   // greift, wenn localStorage blockt
  var rueckgaengig = null;
  var meldungTimer = null;

  function leererZustand() {
    return {
      version: VERSION,
      auftrag: {
        auftraggeber: '', objekt: '', auftragsNr: '', kontrollart: 'Regelkontrolle',
        datum: heuteISO(), datumBis: '', belaubung: 'belaubt', witterung: 'trocken, bedeckt',
        kontrolleur: '', qualifikation: 'FLL-zertifizierter Baumkontrolleur', zertNr: '',
        berichtsdatum: heuteISO()
      },
      baeume: [],
      papierkorb: [],
      einstellungen: {
        name: 'Baumpflege Hundertmark',
        zusatz: 'Fachbetrieb für Baumpflege · Baumkontrolle · Verkehrssicherheit',
        anschrift: '', kontakt: '', ust: 19, stundensatz: 85
      },
      preise: null,               // null = Standardpreise aus DATA
      seitSicherung: 0            // Bäume seit der letzten abgelegten Sicherung
    };
  }

  /* =========================================================================
   * Datum
   * ====================================================================== */
  function heuteISO() { return new Date().toISOString().slice(0, 10); }

  function deDatum(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : iso;
  }

  function plusJahre(iso, jahre) {
    if (!iso || !jahre) return '';
    var d = new Date(iso);
    d.setFullYear(d.getFullYear() + jahre);
    return d.toISOString().slice(0, 10);
  }

  function plusTage(iso, tage) {
    if (!iso || tage == null) return '';
    var d = new Date(iso);
    d.setDate(d.getDate() + tage);
    return d.toISOString().slice(0, 10);
  }

  function monatJahr(iso) {
    if (!iso) return '';
    var m = ['Januar','Februar','März','April','Mai','Juni','Juli','August',
             'September','Oktober','November','Dezember'];
    var d = new Date(iso);
    return m[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* =========================================================================
   * Speicherung
   * ====================================================================== */
  function sichern() {
    var text = JSON.stringify(S);
    try {
      localStorage.setItem(SCHLUESSEL, text);
      speicherFallback = null;
      return true;
    } catch (e) {
      /* Speicher voll: älteste Papierkorb-Einträge opfern, nie die laufende Erfassung */
      var geopfert = 0;
      while (S.papierkorb.length && geopfert < 50) {
        S.papierkorb.sort(function (a, b) { return (a.geloescht || '').localeCompare(b.geloescht || ''); });
        S.papierkorb.shift(); geopfert++;
        try {
          localStorage.setItem(SCHLUESSEL, JSON.stringify(S));
          melde(geopfert + (geopfert === 1 ? ' alter Papierkorb-Eintrag wurde' : ' alte Papierkorb-Einträge wurden') +
                ' verworfen, um Platz zu schaffen.');
          return true;
        } catch (e2) { /* weiter opfern */ }
      }
      speicherFallback = S;
      melde('Speicher voll. Bitte jetzt eine Sicherung ablegen.', 'Ausgabe', function () { zeige('ausgabe'); });
      return false;
    }
  }

  function laden() {
    try {
      var roh = localStorage.getItem(SCHLUESSEL);
      if (!roh) return;
      var d = JSON.parse(roh);
      if (d && d.baeume) {
        S = d;
        if (!S.papierkorb) S.papierkorb = [];
        if (!S.einstellungen) S.einstellungen = leererZustand().einstellungen;
      }
    } catch (e) {
      melde('Gespeicherte Daten konnten nicht gelesen werden.');
    }
  }

  /** Verfallene Papierkorb-Einträge beim Start entfernen. */
  function papierkorbAufraeumen() {
    var vorher = S.papierkorb.length,
        grenze = plusTage(heuteISO(), -PAPIERKORB_TAGE);
    S.papierkorb = S.papierkorb.filter(function (e) {
      return !e.geloescht || e.geloescht >= grenze;
    });
    var weg = vorher - S.papierkorb.length;
    if (weg) melde(weg + (weg === 1 ? ' Eintrag im Papierkorb war' : ' Einträge im Papierkorb waren') +
                   ' älter als ' + PAPIERKORB_TAGE + ' Tage und wurde' + (weg === 1 ? '' : 'n') + ' entfernt.');
    return weg;
  }

  /* =========================================================================
   * Meldung mit optionaler Aktion
   * ====================================================================== */
  function melde(text, knopfText, aktion, dauer) {
    var box = document.getElementById('meldung'),
        knopf = document.getElementById('meldungKnopf');
    document.getElementById('meldungText').textContent = text;
    if (knopfText) {
      knopf.style.display = '';
      knopf.textContent = knopfText;
      knopf.onclick = function () { versteckeMeldung(); if (aktion) aktion(); };
    } else {
      knopf.style.display = 'none';
    }
    box.classList.add('an');
    clearTimeout(meldungTimer);
    meldungTimer = setTimeout(versteckeMeldung, dauer || (knopfText ? 7000 : 3400));
  }

  function versteckeMeldung() {
    document.getElementById('meldung').classList.remove('an');
  }

  /* =========================================================================
   * Navigation
   * ====================================================================== */
  var TITEL = {
    liste: 'Baumkontrolle', auftrag: 'Auftrag', baum: 'Baum',
    ausgabe: 'Ausgabe', einstellungen: 'Einstellungen'
  };

  function zeige(name, ohneHistorie) {
    var alt = document.querySelector('.view.aktiv');
    if (alt) alt.classList.remove('aktiv');
    var neu = document.getElementById('view-' + name);
    if (neu) neu.classList.add('aktiv');
    ansicht = name;

    document.getElementById('titel').textContent =
      name === 'baum' ? ('Baum ' + (feldWert('b_nr') || '')) : TITEL[name];
    document.getElementById('btnZurueck').style.display = name === 'liste' ? 'none' : '';
    var akt = document.getElementById('btnAktion');
    akt.style.display = name === 'baum' ? '' : 'none';

    if (name === 'liste')         { zeichneListe(); zeichneAuftragKurz(); }
    if (name === 'ausgabe')       zeichneAusgabe();
    if (name === 'einstellungen') { zeichneEinstellungen(); zeichnePapierkorb(); }

    window.scrollTo(0, 0);
    if (!ohneHistorie) history.pushState({ view: name }, '', '');
  }

  function zurueck() {
    if (blendeOffen()) { blendeZu(); return; }
    if (ansicht === 'baum') { baumSpeichern(false); return; }
    zeige('liste');
  }

  /* =========================================================================
   * Formularhilfen
   * ====================================================================== */
  function el(id) { return document.getElementById(id); }
  function feldWert(id) { var e = el(id); return e ? e.value : ''; }
  function setzeFeld(id, wert) { var e = el(id); if (e) e.value = wert == null ? '' : wert; }

  function fuelleSelect(id, werte, leerText) {
    var e = el(id);
    if (!e) return;
    e.innerHTML = (leerText ? '<option value="">' + leerText + '</option>' : '') +
      werte.map(function (w) {
        var v = (w instanceof Array) ? w[0] : w,
            t = (w instanceof Array) ? w[1] : w;
        return '<option value="' + esc(v) + '">' + esc(t) + '</option>';
      }).join('');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* =========================================================================
   * Auftrag
   * ====================================================================== */
  function auftragLesen() {
    var a = S.auftrag;
    ['auftraggeber','objekt','auftragsNr','kontrollart','datum','datumBis','belaubung',
     'witterung','kontrolleur','qualifikation','zertNr'].forEach(function (k) {
      a[k] = feldWert('a_' + k);
    });
    a.berichtsdatum = a.berichtsdatum || heuteISO();
  }

  function auftragSchreiben() {
    var a = S.auftrag;
    ['auftraggeber','objekt','auftragsNr','kontrollart','datum','datumBis','belaubung',
     'witterung','kontrolleur','qualifikation','zertNr'].forEach(function (k) {
      setzeFeld('a_' + k, a[k]);
    });
  }

  function zeichneAuftragKurz() {
    var a = S.auftrag,
        teile = [];
    if (a.objekt)       teile.push('<b>' + esc(a.objekt) + '</b>');
    if (a.auftraggeber) teile.push(esc(a.auftraggeber));
    var zeile2 = [a.kontrollart, deDatum(a.datum), a.belaubung].filter(Boolean).join(' · ');
    if (a.kontrolleur)  zeile2 += (zeile2 ? ' · ' : '') + esc(a.kontrolleur);
    el('auftragKurz').innerHTML = teile.length
      ? teile.join('<br>') + '<div class="hinweis" style="margin-top:6px">' + esc(zeile2) + '</div>'
      : '<div class="hinweis">Noch keine Auftragsdaten erfasst.</div>';
  }

  /* =========================================================================
   * Baumliste
   * ====================================================================== */
  function zeichneListe() {
    var box = el('baumListe');
    el('baumZahl').textContent = S.baeume.length ? '(' + S.baeume.length + ')' : '';

    if (!S.baeume.length) {
      box.innerHTML = '<div class="leer"><div class="zeichen">&#9651;</div>' +
        'Noch kein Baum aufgenommen.<br>Mit „Baum aufnehmen" geht es los.</div>';
      return;
    }

    box.innerHTML = S.baeume.map(function (b, i) {
      var mn = b.massnahmen || [],
          stufe = mn.length ? Math.min.apply(null, mn.map(function (m) { return m.stufe || 5; })) : null,
          punkt = stufe === 1 || stufe === 2 ? 'p-rot' : (mn.length ? 'p-grau' : 'p-gruen'),
          zeile2 = [b.artDt, b.hoehe ? b.hoehe + ' m' : '', b.zustand,
                    mn.length ? mn.length + (mn.length === 1 ? ' Maßnahme' : ' Maßnahmen') : ''
                   ].filter(Boolean).join(' · ');
      return '<div class="baumzeile" id="bz' + i + '">' +
        '<div class="nr">' + esc(b.nr || (i + 1)) + '</div>' +
        '<div class="punkt ' + punkt + '"></div>' +
        '<div class="txt" onclick="App.baumOeffnen(' + i + ')">' +
          '<b>' + esc(b.artDt || 'Ohne Art') + '</b>' +
          '<span>' + esc(zeile2 || 'noch nicht bewertet') + '</span></div>' +
        '<button class="weg" onclick="App.loeschFrage(' + i + ')">&#128465;</button></div>';
    }).join('');
  }

  /** Inline-Abfrage statt Systemdialog. */
  function loeschFrage(i) {
    var zeile = el('bz' + i);
    if (!zeile) return;
    zeile.outerHTML = '<div class="loeschfrage" id="bz' + i + '">' +
      '<span>Baum ' + esc(S.baeume[i].nr || (i + 1)) + ' löschen?</span>' +
      '<button class="nein" onclick="App.zeichneListe()">Nein</button>' +
      '<button class="ja" onclick="App.baumLoeschen(' + i + ')">Löschen</button></div>';
  }

  function baumLoeschen(i) {
    var b = S.baeume[i];
    if (!b) return;
    b._position = i;
    b.geloescht = heuteISO();
    b._objekt = S.auftrag.objekt;
    S.papierkorb.push(b);
    S.baeume.splice(i, 1);
    rueckgaengig = { typ: 'baum', baum: b, position: i };
    sichern();
    zeichneListe();
    melde('Baum gelöscht. Bleibt 30 Tage im Papierkorb.', 'Rückgängig', function () {
      wiederherstellen(b);
    });
  }

  function wiederherstellen(b) {
    var idx = S.papierkorb.indexOf(b);
    if (idx >= 0) S.papierkorb.splice(idx, 1);
    var pos = b._position == null ? S.baeume.length : Math.min(b._position, S.baeume.length);
    delete b.geloescht; delete b._position; delete b._objekt;
    S.baeume.splice(pos, 0, b);
    sichern();
    zeichneListe();
    if (ansicht === 'einstellungen') zeichnePapierkorb();
    melde('Baum wiederhergestellt.');
  }

  /* =========================================================================
   * Baum anlegen und öffnen
   * ====================================================================== */
  function neuerBaum() {
    var nr = naechsteNummer();
    S.baeume.push({
      nr: nr, stammzahl: 1, artDt: '', artBot: '', hoehe: '', kroneD: '', stammumfang: '',
      messhoehe: '1,00 m', kronenansatz: '', alter: '',
      strasse: S.baeume.length ? (S.baeume[S.baeume.length - 1].strasse || '') : '',
      hausNr: '', flurstueck: '', umfeld: '', gpsLat: '', gpsLon: '',
      phase: 'Reifephase', zustand: 'gesund', erwartung: 'höher', roloff: '',
      intervallMatrix: '', intervall: '', intervallManuell: false, naechsteKontrolle: '',
      befunde: { K: [], S: [], W: [], Wu: [], V: [] },
      pilz: null, grenzen: '', bemerkung: '', befundtext: '',
      massnahmen: [], fotos: [], historie: []
    });
    baumOeffnen(S.baeume.length - 1);
  }

  /** Nummern werden nach dem Löschen bewusst nicht neu vergeben. */
  function naechsteNummer() {
    var hoechste = 0;
    S.baeume.concat(S.papierkorb).forEach(function (b) {
      var n = parseInt(String(b.nr).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > hoechste) hoechste = n;
    });
    return String(hoechste + 1).padStart(3, '0');
  }

  function baumOeffnen(i) {
    aktuellerBaum = i;
    var b = S.baeume[i];
    if (!b) return;

    ['nr','stammzahl','alter','hoehe','kroneD','kronenansatz','stammumfang','messhoehe',
     'strasse','hausNr','flurstueck','umfeld','gpsLat','gpsLon','phase','zustand','erwartung',
     'roloff','intervall','befundtext','grenzen','bemerkung'].forEach(function (k) {
      setzeFeld('b_' + k, b[k]);
    });
    el('b_artDt').textContent = b.artDt || 'Art wählen';
    el('b_artBot').textContent = b.artBot || '';

    zeichneSymptome(b);
    zeichnePilz(b);
    zeichneGrenzenWahl();
    zeichneMassnahmen(b);
    zeichneFotos(b);
    zeichneHistorie(b);
    intervallRechnen();
    zustandHilfe();

    zeige('baum');
  }

  function baumLesen() {
    if (aktuellerBaum == null) return null;
    var b = S.baeume[aktuellerBaum];
    if (!b) return null;
    ['nr','stammzahl','alter','hoehe','kroneD','kronenansatz','stammumfang','messhoehe',
     'strasse','hausNr','flurstueck','umfeld','gpsLat','gpsLon','phase','zustand','erwartung',
     'roloff','intervall','befundtext','grenzen','bemerkung'].forEach(function (k) {
      b[k] = feldWert('b_' + k);
    });
    b.intervallMatrix = feldWert('b_intervallMatrix');
    b.intervall = feldWert('b_intervall');
    b.naechsteKontrolle = el('b_naechsteKontrolle').dataset.iso || '';
    b.naechsteKontrolleText = feldWert('b_naechsteKontrolle');
    if (el('pilzKarte').style.display !== 'none') {
      var sel = el('b_pilzName');
      if (sel.value) {
        var teile = sel.value.split('|');
        b.pilz = { name: teile[0], bot: teile[1], faeule: teile[2], lage: feldWert('b_pilzLage') };
      } else b.pilz = null;
    }
    return b;
  }

  function baumSpeichern(weiter) {
    baumLesen();
    sichern();
    S.seitSicherung = (S.seitSicherung || 0) + 1;

    /* Auf der Baustelle geht ein Gerät schneller verloren als gedacht. */
    if (S.seitSicherung >= 10) {
      melde(S.seitSicherung + ' Bäume seit der letzten Sicherung.', 'Jetzt sichern', function () {
        sicherungExport();
      }, 9000);
    } else if (weiter) {
      melde('Gespeichert. Nächster Baum.');
    }

    if (weiter) neuerBaum();
    else { aktuellerBaum = null; zeige('liste'); }
  }

  /* =========================================================================
   * Baumart
   * ====================================================================== */
  function artWahl() {
    var html = '<input id="artSuche" placeholder="Art suchen" style="margin-bottom:10px" ' +
               'oninput="App.artFiltern(this.value)"><div id="artTreffer"></div>';
    blendeAuf('Baumart', html);
    artFiltern('');
    setTimeout(function () { var s = el('artSuche'); if (s) s.focus(); }, 120);
  }

  function artFiltern(text) {
    var t = String(text || '').toLowerCase(),
        treffer = DATA.ARTEN.filter(function (a) {
          return !t || a[0].toLowerCase().indexOf(t) >= 0 || a[1].toLowerCase().indexOf(t) >= 0;
        }).slice(0, 60);
    el('artTreffer').innerHTML = treffer.map(function (a) {
      return '<button class="wahl" onclick="App.artSetzen(' + esc(JSON.stringify(a[0])) +
             ',' + esc(JSON.stringify(a[1])) + ')"><b>' + esc(a[0]) + '</b>' +
             '<span>' + esc(a[1]) + '</span></button>';
    }).join('') + (t ? '<button class="wahl" onclick="App.artSetzen(' +
      esc(JSON.stringify(text)) + ',\'\')"><b>' + esc(text) + '</b>' +
      '<span>als Freitext übernehmen</span></button>' : '');
  }

  function artSetzen(dt, bot) {
    el('b_artDt').textContent = dt;
    el('b_artBot').textContent = bot || '';
    if (aktuellerBaum != null) {
      S.baeume[aktuellerBaum].artDt = dt;
      S.baeume[aktuellerBaum].artBot = bot || '';
    }
    blendeZu();
  }

  /* =========================================================================
   * FLL-Einstufung und Intervall
   * ====================================================================== */
  function intervallRechnen() {
    var phase = feldWert('b_phase'), zustand = feldWert('b_zustand'), erw = feldWert('b_erwartung');
    var vorschlag = DATA.intervall(phase, zustand, erw);
    setzeFeld('b_intervallMatrix', vorschlag);

    var b = aktuellerBaum != null ? S.baeume[aktuellerBaum] : null,
        sel = el('b_intervall');
    if (!b || !b.intervallManuell) sel.value = vorschlag;

    var jahre = DATA.intervallJahre(sel.value),
        basis = S.auftrag.datum || heuteISO(),
        feld = el('b_naechsteKontrolle');
    if (jahre) {
      var iso = plusJahre(basis, jahre);
      feld.value = monatJahr(iso);
      feld.dataset.iso = iso;
    } else {
      feld.value = 'keine gesonderte Regelkontrolle';
      feld.dataset.iso = '';
    }
  }

  function zustandHilfe() {
    var z = feldWert('b_zustand');
    el('zustandHilfe').textContent = DATA.ZUSTAND_HILFE[z] || '';
  }

  /* =========================================================================
   * Symptome
   * ====================================================================== */
  function zeichneSymptome(b) {
    var box = el('symptome'), html = '';
    Object.keys(DATA.SYMPTOME).forEach(function (g) {
      var gruppe = DATA.SYMPTOME[g],
          an = (b.befunde && b.befunde[g]) || [];
      html += '<div class="symgruppe"><h3>' + esc(gruppe.titel) +
              '<span class="anzahl" id="anz' + g + '" style="' +
              (an.length ? '' : 'display:none') + '">' + an.length + '</span></h3>' +
              '<div class="symliste">' +
        gruppe.codes.map(function (bez, i) {
          var code = g + (i + 1), gesetzt = an.indexOf(code) >= 0;
          return '<label class="' + (gesetzt ? 'an' : '') + '" id="lab' + code + '">' +
            '<input type="checkbox" ' + (gesetzt ? 'checked' : '') +
            ' onchange="App.symptomWechsel(\'' + g + '\',\'' + code + '\',this.checked)">' +
            esc(bez) + '</label>';
        }).join('') + '</div></div>';
    });
    box.innerHTML = html;
  }

  function symptomWechsel(gruppe, code, an) {
    var b = S.baeume[aktuellerBaum];
    if (!b) return;
    if (!b.befunde) b.befunde = { K: [], S: [], W: [], Wu: [], V: [] };
    if (!b.befunde[gruppe]) b.befunde[gruppe] = [];
    var liste = b.befunde[gruppe], i = liste.indexOf(code);
    if (an && i < 0) liste.push(code);
    if (!an && i >= 0) liste.splice(i, 1);

    var lab = el('lab' + code);
    if (lab) lab.className = an ? 'an' : '';
    var anz = el('anz' + gruppe);
    if (anz) { anz.textContent = liste.length; anz.style.display = liste.length ? '' : 'none'; }

    zeichnePilz(b);
  }

  /** Pilzkarte erscheint, sobald irgendwo Pilzbefall angekreuzt ist. */
  function zeichnePilz(b) {
    var pilzCodes = { K: 'K11', S: 'S7', W: 'W4', Wu: 'Wu3' },
        befall = Object.keys(pilzCodes).some(function (g) {
          return ((b.befunde && b.befunde[g]) || []).indexOf(pilzCodes[g]) >= 0;
        });
    el('pilzKarte').style.display = befall ? '' : 'none';
    if (!befall) return;

    var sel = el('b_pilzName');
    if (!sel.options.length) {
      var html = '<option value="">– bitte wählen –</option>';
      Object.keys(DATA.PILZE).forEach(function (ort) {
        html += '<optgroup label="' + esc(ort) + '">';
        DATA.PILZE[ort].forEach(function (p) {
          html += '<option value="' + esc(p.join('|')) + '">' + esc(p[0]) + '</option>';
        });
        html += '</optgroup>';
      });
      sel.innerHTML = html;
      sel.onchange = function () {
        var t = this.value.split('|');
        setzeFeld('b_pilzFaeule', t[2] || '');
      };
    }
    if (b.pilz && b.pilz.name) {
      sel.value = [b.pilz.name, b.pilz.bot, b.pilz.faeule].join('|');
      setzeFeld('b_pilzFaeule', b.pilz.faeule);
      setzeFeld('b_pilzLage', b.pilz.lage);
    }
  }

  /* =========================================================================
   * Grenzen der Kontrolle
   * ====================================================================== */
  function zeichneGrenzenWahl() {
    el('grenzenWahl').innerHTML = DATA.GRENZEN.map(function (g) {
      return '<button class="pill" style="border:0" onclick="App.grenzeAnfuegen(' +
             esc(JSON.stringify(g)) + ')">+ ' + esc(g) + '</button>';
    }).join('');
  }

  function grenzeAnfuegen(text) {
    var f = el('b_grenzen'),
        vorhanden = f.value.trim();
    if (vorhanden.indexOf(text) >= 0) return;
    f.value = vorhanden ? vorhanden.replace(/\.?$/, '') + '. ' + text + '.' : text + '.';
  }

  /* =========================================================================
   * Maßnahmen
   * ====================================================================== */
  function zeichneMassnahmen(b) {
    var box = el('massnahmenListe'),
        mn = b.massnahmen || [];
    if (!mn.length) {
      box.innerHTML = '<div class="hinweis" style="margin-bottom:10px">Keine Maßnahmen erfasst.</div>';
      return;
    }
    box.innerHTML = mn.map(function (m, i) {
      return '<div class="mzeile"><div class="kopf"><b>' + esc(m.text || 'Maßnahme') + '</b>' +
        '<button class="weg" onclick="App.massnahmeWeg(' + i + ')">&times;</button></div>' +
        '<div style="margin-bottom:8px"><span class="dring d' + (m.stufe || 5) + '">' +
        esc(dringText(m.stufe)) + '</span>' +
        (m.frist ? '<span class="hinweis" style="display:inline;margin-left:8px">bis ' +
                   esc(deDatum(m.frist)) + '</span>' : '') +
        '<span class="pill" style="float:right;margin:0">' + esc(euro(preisFuer(b, m))) +
        '</span></div>' +
        '<div class="feld" style="margin:0"><label>Begründung</label>' +
        '<input value="' + esc(m.begruendung || '') +
        '" oninput="App.massnahmeFeld(' + i + ',\'begruendung\',this.value)"></div></div>';
    }).join('');
  }

  function dringText(stufe) {
    var d = DATA.DRINGLICHKEIT.filter(function (x) { return x.stufe === (stufe || 5); })[0];
    return d ? d.kurz : '';
  }

  function massnahmeNeu() {
    var html = '<div id="mSchritt1">' + DATA.MASSNAHMEN.map(function (m) {
      return '<button class="wahl" onclick="App.massnahmeStufe(' + esc(JSON.stringify(m)) +
             ')"><b>' + esc(m) + '</b></button>';
    }).join('') + '</div>';
    blendeAuf('Maßnahme wählen', html);
  }

  function massnahmeStufe(text) {
    var html = '<div class="hinweis" style="margin-bottom:12px">' + esc(text) + '</div>' +
      DATA.DRINGLICHKEIT.map(function (d) {
        return '<button class="wahl" onclick="App.massnahmeAnlegen(' + esc(JSON.stringify(text)) +
          ',' + d.stufe + ')"><b><span class="dring d' + d.stufe + '">' + esc(d.kurz) +
          '</span></b><span style="margin-top:4px;display:block">' + esc(d.lang) + '</span></button>';
      }).join('');
    blendeAuf('Dringlichkeit', html);
  }

  function massnahmeAnlegen(text, stufe) {
    var b = S.baeume[aktuellerBaum];
    if (!b) return;
    var d = DATA.DRINGLICHKEIT.filter(function (x) { return x.stufe === stufe; })[0],
        basis = S.auftrag.datum || heuteISO(),
        frist = d.tage == null ? el('b_naechsteKontrolle').dataset.iso : plusTage(basis, d.tage);
    if (!b.massnahmen) b.massnahmen = [];
    b.massnahmen.push({ text: text, stufe: stufe, frist: frist || '', begruendung: '' });
    blendeZu();
    zeichneMassnahmen(b);
    sichern();
  }

  function massnahmeFeld(i, feld, wert) {
    var b = S.baeume[aktuellerBaum];
    if (b && b.massnahmen[i]) b.massnahmen[i][feld] = wert;
  }

  function massnahmeWeg(i) {
    var b = S.baeume[aktuellerBaum];
    if (!b) return;
    b.massnahmen.splice(i, 1);
    zeichneMassnahmen(b);
    sichern();
  }

  /* =========================================================================
   * Fotos
   * ====================================================================== */
  function zeichneFotos(b) {
    var fotos = b.fotos || [];
    el('fotoGitter').innerHTML = fotos.map(function (f, i) {
      return '<div class="f"><img src="' + f + '" alt="">' +
             '<button class="weg" onclick="App.fotoWeg(' + i + ')">&times;</button></div>';
    }).join('') + (fotos.length < 8
      ? '<div class="f neu" onclick="document.getElementById(\'fotoInput\').click()">+</div>' : '');
  }

  function fotoWeg(i) {
    var b = S.baeume[aktuellerBaum];
    b.fotos.splice(i, 1);
    zeichneFotos(b);
    sichern();
  }

  function fotosAufnehmen(dateien) {
    var b = S.baeume[aktuellerBaum];
    if (!b) return;
    if (!b.fotos) b.fotos = [];
    var offen = dateien.length;
    Array.prototype.forEach.call(dateien, function (datei) {
      verkleinern(datei, function (dataURL) {
        if (dataURL && b.fotos.length < 8) b.fotos.push(dataURL);
        if (--offen === 0) { zeichneFotos(b); sichern(); }
      });
    });
  }

  /** Auf 1280 px lange Kante, JPEG 72 % – sonst platzt der Speicher. */
  function verkleinern(datei, fertig) {
    var leser = new FileReader();
    leser.onload = function (e) {
      var bild = new Image();
      bild.onload = function () {
        var max = 1280,
            f = Math.min(1, max / Math.max(bild.width, bild.height)),
            c = document.createElement('canvas');
        c.width = Math.round(bild.width * f);
        c.height = Math.round(bild.height * f);
        c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
        fertig(c.toDataURL('image/jpeg', 0.72));
      };
      bild.onerror = function () { fertig(null); };
      bild.src = e.target.result;
    };
    leser.onerror = function () { fertig(null); };
    leser.readAsDataURL(datei);
  }

  /* =========================================================================
   * GPS
   * ====================================================================== */
  function gps() {
    if (!navigator.geolocation) { melde('Dieses Gerät liefert keine Position.'); return; }
    melde('Position wird ermittelt …');
    navigator.geolocation.getCurrentPosition(function (p) {
      setzeFeld('b_gpsLat', p.coords.latitude.toFixed(5));
      setzeFeld('b_gpsLon', p.coords.longitude.toFixed(5));
      melde('Position übernommen (± ' + Math.round(p.coords.accuracy) + ' m).');
    }, function () {
      melde('Position nicht verfügbar. Standortfreigabe prüfen.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }

  /* =========================================================================
   * Historie
   * ====================================================================== */
  function zeichneHistorie(b) {
    var h = b.historie || [];
    el('historieKarte').style.display = h.length ? '' : 'none';
    if (!h.length) return;
    el('historieTabelle').innerHTML =
      '<tr><th>Datum</th><th>Zustand</th><th>Maßnahmen</th></tr>' +
      h.map(function (e) {
        return '<tr><td>' + esc(deDatum(e.datum)) + '</td><td>' + esc(e.zustand || '') +
               '</td><td>' + esc(e.pflege || '–') + '</td></tr>';
      }).join('');
  }

  /* =========================================================================
   * Einblendung
   * ====================================================================== */
  function blendeAuf(titel, html) {
    el('blendeTitel').textContent = titel;
    el('blendeInhalt').innerHTML = html;
    el('blende').classList.add('an');
    history.pushState({ blende: true }, '', '');
  }

  function blendeZu() { el('blende').classList.remove('an'); }
  function blendeOffen() { return el('blende').classList.contains('an'); }

  /* =========================================================================
   * Ausgabe
   * ====================================================================== */
  function zeichneAusgabe() {
    var alle = [];
    S.baeume.forEach(function (b) {
      (b.massnahmen || []).forEach(function (m) { alle.push({ b: b, m: m }); });
    });
    var sofort = S.baeume.filter(function (b) {
      return (b.massnahmen || []).some(function (m) { return m.stufe === 1; });
    }).length;
    var schwer = S.baeume.filter(function (b) { return b.zustand === 'stärker geschädigt'; }).length;

    var wert = auftragswert();
    el('ausgabeKacheln').innerHTML = [
      [S.baeume.length, 'erfasste Bäume', false],
      [alle.length, 'Maßnahmen', false],
      [schwer, 'stärker geschädigt', schwer > 0],
      [sofort, 'sofort zu handeln', sofort > 0]
    ].map(function (k) {
      return '<div class="kachel"><div class="z' + (k[2] ? ' warn' : '') + '">' + k[0] +
             '</div><div class="t">' + esc(k[1]) + '</div></div>';
    }).join('') +
    '<div class="kachel" style="grid-column:1/-1;background:#f0f5f1;border-color:#c6d8ca">' +
    '<div class="z">' + euro(wert) + '</div>' +
    '<div class="t">Auftragswert netto · ' + euro(wert * (100 + (S.einstellungen.ust || 19)) / 100) +
    ' brutto</div></div>';

    /* Aufteilung nach Dringlichkeit unter dem Angebotsknopf */
    var nachStufe = DATA.DRINGLICHKEIT.map(function (d) {
      var g = posten().filter(function (p) { return p.stufe === d.stufe; });
      if (!g.length) return '';
      return '<tr><td><span class="dring d' + d.stufe + '">' + esc(d.kurz) + '</span></td>' +
             '<td style="text-align:center">' + g.length + '</td>' +
             '<td style="text-align:right;font-weight:700">' +
             euro(g.reduce(function (s, p) { return s + p.preis; }, 0)) + '</td></tr>';
    }).join('');
    var sev = sevPositionen();
    el('sevListe').innerHTML = sev.length
      ? '<table class="mini" style="margin-bottom:12px"><tr><th>Position</th>' +
        '<th style="text-align:center">Menge</th><th style="text-align:right">Einzeln</th>' +
        '<th style="text-align:right">Gesamt</th></tr>' +
        sev.map(function (p) {
          return '<tr><td style="font-size:12.5px">' + esc(p.text) + '</td>' +
                 '<td style="text-align:center">' + p.menge + '</td>' +
                 '<td style="text-align:right">' + esc(zahl(p.einzel)) + '</td>' +
                 '<td style="text-align:right;font-weight:700">' +
                 esc(zahl(p.einzel * p.menge)) + '</td></tr>';
        }).join('') + '</table>'
      : '';

    var ohnePreis = posten().filter(function (p) { return !p.preis; });
    el('angebotSumme').innerHTML = nachStufe
      ? '<table class="mini" style="margin-bottom:12px">' +
        '<tr><th>Dringlichkeit</th><th style="text-align:center">Positionen</th>' +
        '<th style="text-align:right">Netto</th></tr>' + nachStufe + '</table>' +
        (ohnePreis.length ? '<div class="warnkasten">' + ohnePreis.length +
          (ohnePreis.length === 1 ? ' Position hat' : ' Positionen haben') +
          ' keinen Preis in der Liste und erscheinen als „auf Anfrage": ' +
          esc(ohnePreis.map(function (p) { return p.text; })
             .filter(function (v, i, arr) { return arr.indexOf(v) === i; }).join(', ')) +
          '. Preis in den Einstellungen ergänzen, wenn er ins Angebot soll.</div>' : '')
      : '<div class="hinweis" style="margin-bottom:10px">Noch keine Maßnahmen erfasst.</div>';
  }

  function daten() {
    if (ansicht === 'baum') baumLesen();
    var a = JSON.parse(JSON.stringify(S.auftrag));
    a.datum = deDatum(a.datum);
    a.datumBis = deDatum(a.datumBis);
    a.berichtsdatum = deDatum(a.berichtsdatum || heuteISO());
    var baeume = S.baeume.map(function (b) {
      var k = JSON.parse(JSON.stringify(b));
      k.naechsteKontrolle = b.naechsteKontrolleText ||
        (b.naechsteKontrolle ? monatJahr(b.naechsteKontrolle) : '');
      k.massnahmen = (b.massnahmen || []).map(function (m) {
        var n = JSON.parse(JSON.stringify(m));
        n.frist = m.frist ? 'bis ' + deDatum(m.frist) : '';
        return n;
      });
      return k;
    });
    return { auftrag: a, baeume: baeume };
  }

  function pdf(modus) {
    if (!S.baeume.length) { melde('Noch kein Baum erfasst.'); return; }
    PDF.setzeFirma({
      name: S.einstellungen.name, zusatz: S.einstellungen.zusatz,
      anschrift: S.einstellungen.anschrift, kontakt: S.einstellungen.kontakt
    });
    try {
      PDF.speichern(daten(), { modus: modus === 'auto' ? undefined : modus });
      melde('PDF erzeugt.');
    } catch (e) {
      melde('PDF fehlgeschlagen: ' + e.message);
    }
  }

  function excel() {
    if (!S.baeume.length) { melde('Noch kein Baum erfasst.'); return; }
    try { XLS.bestand(daten()); melde('Excel erzeugt.'); }
    catch (e) { melde('Excel fehlgeschlagen: ' + e.message); }
  }

  function excelKalkulation() {
    if (!S.baeume.length) { melde('Noch kein Baum erfasst.'); return; }
    try {
      XLS.kalkulation(daten(), preisliste(), S.einstellungen);
      melde('Kalkulation erzeugt.');
    } catch (e) { melde('Kalkulation fehlgeschlagen: ' + e.message); }
  }

  function preisliste() {
    return S.preise || JSON.parse(JSON.stringify(DATA.PREISE_STANDARD));
  }

  /** Preis einer Maßnahme aus der Höhenklasse des Baumes. */
  function preisFuer(baum, massnahme) {
    var reihe = preisliste()[massnahme.text];
    if (!reihe) return 0;
    return reihe[DATA.hoehenklasse(baum.hoehe)] || 0;
  }

  function euro(n) {
    return (Math.round(n * 100) / 100).toLocaleString('de-DE',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  /** Alle Angebotspositionen über den ganzen Bestand. */
  function posten() {
    var liste = [];
    S.baeume.forEach(function (b) {
      (b.massnahmen || []).forEach(function (m) {
        liste.push({
          nr: b.nr, art: b.artDt, hoehe: b.hoehe,
          standort: [b.strasse, b.hausNr].filter(Boolean).join(' '),
          klasse: DATA.HOEHENKLASSEN[DATA.hoehenklasse(b.hoehe)],
          text: m.text, stufe: m.stufe,
          frist: m.frist ? 'bis ' + deDatum(m.frist) : '',
          preis: preisFuer(b, m)
        });
      });
    });
    return liste;
  }

  function auftragswert() {
    return posten().reduce(function (s, p) { return s + p.preis; }, 0);
  }

  /* =========================================================================
   * sevDesk: Positionsliste
   *
   * sevDesk importiert per CSV nur Kontakte und Produkte, keine Angebote.
   * Die Positionen müssen dort eingetragen werden – also so wenige und so
   * klar wie möglich.
   * ====================================================================== */

  function sevPositionen() {
    var art = feldWert('sevGruppierung') || 'leistung',
        p = posten(),
        raus = [];

    if (art === 'baum') {
      p.forEach(function (x) {
        raus.push({
          text: DATA.leistungstext(x.text) + ' – ' + x.art + ' Nr. ' + x.nr +
                (x.standort ? ', ' + x.standort : ''),
          menge: 1, einzel: x.preis, stufe: x.stufe
        });
      });
    } else {
      var karte = {};
      p.forEach(function (x) {
        var k = x.text + '|' + x.klasse + '|' + x.preis;
        if (!karte[k]) karte[k] = { text: DATA.leistungstext(x.text), klasse: x.klasse,
                                    einzel: x.preis, nummern: [], stufe: x.stufe };
        karte[k].nummern.push(x.nr);
        if (x.stufe < karte[k].stufe) karte[k].stufe = x.stufe;
      });
      Object.keys(karte).forEach(function (k) {
        var g = karte[k];
        raus.push({
          text: g.text + ' – Höhenklasse ' + g.klasse +
                ' (Baum ' + g.nummern.join(', ') + ')',
          menge: g.nummern.length, einzel: g.einzel, stufe: g.stufe
        });
      });
    }
    raus.sort(function (a, b) { return (a.stufe || 9) - (b.stufe || 9); });
    return raus;
  }

  function sevText() {
    var z = sevPositionen();
    return ['Bezeichnung\tMenge\tEinheit\tEinzelpreis\tGesamt'].concat(
      z.map(function (p) {
        return [p.text, p.menge, 'Stück', zahl(p.einzel), zahl(p.einzel * p.menge)].join('\t');
      })
    ).join('\n');
  }

  function zahl(n) {
    return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
  }

  function sevKopieren() {
    var text = sevText();
    if (!text || sevPositionen().length === 0) { melde('Keine Positionen vorhanden.'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        melde(sevPositionen().length + ' Positionen kopiert.');
      }, function () { kopieAlt(text); });
    } else kopieAlt(text);
  }

  /** Fallback, weil die Zwischenablage bei lokal geöffneten Dateien oft blockt. */
  function kopieAlt(text) {
    var f = document.createElement('textarea');
    f.value = text;
    f.style.position = 'fixed';
    f.style.opacity = '0';
    document.body.appendChild(f);
    f.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(f);
    if (ok) melde(sevPositionen().length + ' Positionen kopiert.');
    else blendeAuf('Positionen', '<div class="hinweis" style="margin-bottom:8px">' +
      'Zum Markieren antippen und kopieren.</div><textarea style="min-height:220px;' +
      'font-family:ui-monospace,Menlo,monospace;font-size:12px">' + esc(text) + '</textarea>');
  }

  function csvDatei(name, zeilen) {
    var text = '\ufeff' + zeilen.map(function (z) {
      return z.map(function (f) {
        var s = String(f == null ? '' : f);
        return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(';');
    }).join('\r\n');
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' }),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function sevCsv() {
    var z = sevPositionen();
    if (!z.length) { melde('Keine Positionen vorhanden.'); return; }
    csvDatei('Angebotspositionen_' + (S.auftrag.objekt || 'Baumkontrolle')
        .replace(/[^\wäöüÄÖÜß -]/g, '').trim().replace(/\s+/g, '_') + '.csv',
      [['Bezeichnung', 'Menge', 'Einheit', 'Einzelpreis netto', 'Gesamt netto', 'Dringlichkeit']]
      .concat(z.map(function (p) {
        return [p.text, p.menge, 'Stück', zahl(p.einzel), zahl(p.einzel * p.menge),
                dringText(p.stufe)];
      })));
    melde('CSV mit ' + z.length + ' Positionen abgelegt.');
  }

  /** Preisliste als Artikelstamm – einmal in sevDesk importiert, danach nur noch auswählen. */
  function sevProdukte() {
    var p = preisliste(),
        zeilen = [['Artikelnummer', 'Name', 'Beschreibung', 'Preis', 'Einheit', 'Steuersatz']],
        nr = 0;
    Object.keys(p).forEach(function (leistung) {
      p[leistung].forEach(function (preis, i) {
        if (!preis) return;
        nr++;
        zeilen.push([
          'BP-' + String(nr).padStart(3, '0'),
          DATA.leistungstext(leistung) + ' ' + DATA.HOEHENKLASSEN[i],
          DATA.leistungstext(leistung) + ', Baumhöhe ' + DATA.HOEHENKLASSEN[i] +
            ', nach ZTV-Baumpflege 2017',
          zahl(preis), 'Stück', String(S.einstellungen.ust || 19)
        ]);
      });
    });
    csvDatei('sevDesk_Produkte_Baumpflege.csv', zeilen);
    melde(zeilen.length - 1 + ' Artikel abgelegt. In sevDesk unter Produkte importieren.');
  }

  function angebot() {
    if (!S.baeume.length) { melde('Noch kein Baum erfasst.'); return; }
    var p = posten();
    if (!p.length) { melde('Keine Maßnahmen erfasst – es gibt nichts anzubieten.'); return; }
    PDF.setzeFirma({
      name: S.einstellungen.name, zusatz: S.einstellungen.zusatz,
      anschrift: S.einstellungen.anschrift, kontakt: S.einstellungen.kontakt
    });
    try {
      PDF.speichereAngebot(daten(), p, {
        ust: S.einstellungen.ust, gueltigTage: 60,
        datum: deDatum(heuteISO()), angebotsNr: S.auftrag.auftragsNr
      });
      melde('Angebot erzeugt: ' + euro(auftragswert()) + ' netto.');
    } catch (e) { melde('Angebot fehlgeschlagen: ' + e.message); }
  }

  /* =========================================================================
   * Sicherung, Import, Folgekontrolle
   * ====================================================================== */
  function sicherungExport() {
    if (ansicht === 'baum') baumLesen();
    S.gesichert = new Date().toISOString();
    S.seitSicherung = 0;
    var blob = new Blob([JSON.stringify(S)], { type: 'application/json' }),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
    a.href = url;
    a.download = 'Baumkontrolle_' + (S.auftrag.objekt || 'Sicherung')
      .replace(/[^\wäöüÄÖÜß -]/g, '').trim().replace(/\s+/g, '_') + '_' + heuteISO() + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    melde('Sicherung abgelegt.');
  }

  function sicherungImport(datei) {
    var leser = new FileReader();
    leser.onload = function (e) {
      var d;
      try { d = JSON.parse(e.target.result); }
      catch (err) { melde('Datei konnte nicht gelesen werden.'); return; }
      if (!d || !d.baeume) { melde('Das ist keine Sicherung dieser App.'); return; }

      blendeAuf('Sicherung laden', '<div class="hinweis" style="margin-bottom:14px">' +
        esc(d.auftrag && d.auftrag.objekt || 'Ohne Objekt') + ' · ' + d.baeume.length +
        ' Bäume · Kontrolle vom ' + esc(deDatum(d.auftrag && d.auftrag.datum)) + '</div>' +
        '<button class="wahl" onclick="App.importAusfuehren(true)"><b>Als Folgekontrolle öffnen</b>' +
        '<span>Bäume und Stammdaten bleiben, der alte Stand wandert in die Historie, ' +
        'Befunde, Maßnahmen und Fotos werden geleert.</span></button>' +
        '<button class="wahl" onclick="App.importAusfuehren(false)"><b>Unverändert öffnen</b>' +
        '<span>Alles wird so geladen, wie es gesichert wurde.</span></button>');
      App._import = d;
    };
    leser.readAsText(datei);
  }

  function importAusfuehren(alsFolge) {
    var d = App._import;
    if (!d) return;
    if (alsFolge) {
      d.baeume.forEach(function (b) {
        if (!b.historie) b.historie = [];
        b.historie.unshift({
          datum: (d.auftrag && d.auftrag.datum) || '',
          zustand: b.zustand,
          pflege: (b.massnahmen || []).map(function (m) { return m.text; }).join(', '),
          intervall: b.intervall,
          kuerzel: (d.auftrag && d.auftrag.kontrolleur) || ''
        });
        b.befunde = { K: [], S: [], W: [], Wu: [], V: [] };
        b.massnahmen = []; b.fotos = []; b.befundtext = ''; b.grenzen = ''; b.pilz = null;
      });
      d.auftrag.datum = heuteISO();
      d.auftrag.datumBis = '';
      d.auftrag.berichtsdatum = heuteISO();
      d.auftrag.auftragsNr = '';
    }
    S = d;
    if (!S.papierkorb) S.papierkorb = [];
    if (!S.einstellungen) S.einstellungen = leererZustand().einstellungen;
    App._import = null;
    sichern();
    blendeZu();
    auftragSchreiben();
    zeige('liste');
    melde(alsFolge ? 'Folgekontrolle angelegt. Alle Bäume übernommen.' : 'Sicherung geladen.');
  }

  /* =========================================================================
   * Einstellungen und Papierkorb
   * ====================================================================== */
  function zeichneEinstellungen() {
    var e = S.einstellungen;
    ['name','zusatz','anschrift','kontakt','ust','stundensatz'].forEach(function (k) {
      setzeFeld('e_' + k, e[k]);
    });
    el('versionZeile').textContent = 'Version ' + VERSION;

    var groesse = 0;
    try { groesse = (localStorage.getItem(SCHLUESSEL) || '').length; } catch (x) {}
    var fotos = S.baeume.reduce(function (n, b) { return n + (b.fotos || []).length; }, 0);
    var letzte = S.gesichert ? deDatum(String(S.gesichert).slice(0, 10)) : 'noch nie';
    el('speicherInfo').innerHTML = 'Belegt: <b>' + (groesse / 1048576).toFixed(2) + ' MB</b> · ' +
      S.baeume.length + ' Bäume · ' + fotos + ' Fotos · ' + S.papierkorb.length + ' im Papierkorb' +
      '<br>Letzte Sicherung: <b>' + letzte + '</b>' +
      ((S.seitSicherung || 0) ? ' · ' + S.seitSicherung + ' Bäume seitdem' : '') +
      (speicherFallback ? '<br><span style="color:#b03030">Achtung: Der Browser blockt den ' +
       'Speicher. Bitte jetzt eine Sicherung ablegen.</span>' : '');
  }

  function einstellungenSpeichern() {
    ['name','zusatz','anschrift','kontakt'].forEach(function (k) {
      S.einstellungen[k] = feldWert('e_' + k);
    });
    S.einstellungen.ust = parseFloat(feldWert('e_ust')) || 19;
    S.einstellungen.stundensatz = parseFloat(feldWert('e_stundensatz')) || 85;
    sichern();
    melde('Übernommen.');
  }

  function zeichnePapierkorb() {
    var box = el('papierkorbListe');
    el('papierkorbZahl').textContent = S.papierkorb.length ? '(' + S.papierkorb.length + ')' : '';
    if (!S.papierkorb.length) {
      box.innerHTML = '<div class="leer" style="padding:22px">Papierkorb ist leer.</div>';
      return;
    }
    var heute = new Date(heuteISO());
    box.innerHTML = S.papierkorb.map(function (b, i) {
      var weg = new Date(b.geloescht || heuteISO()),
          rest = PAPIERKORB_TAGE - Math.floor((heute - weg) / 86400000),
          warn = rest <= 5;
      return '<div class="baumzeile">' +
        '<div class="nr">' + esc(b.nr || '?') + '</div>' +
        '<div class="txt"><b>' + esc(b.artDt || 'Ohne Art') + '</b>' +
        '<span>gelöscht ' + esc(deDatum(b.geloescht)) + ' · noch ' +
        '<span style="' + (warn ? 'color:#b03030;font-weight:700' : '') + '">' + Math.max(0, rest) +
        ' Tage</span>' + (b._objekt ? ' · ' + esc(b._objekt) : '') +
        ((b.fotos || []).length ? ' · ' + b.fotos.length + ' Fotos' : '') + '</span></div>' +
        '<button class="btn klein zweit" style="margin:0" onclick="App.papierkorbZurueck(' + i +
        ')">Zurück</button></div>';
    }).join('') +
    '<div style="padding:12px 14px"><button class="btn klein grau" style="color:#fff" ' +
    'onclick="App.papierkorbLeeren()">Papierkorb leeren</button></div>';
  }

  function papierkorbZurueck(i) { wiederherstellen(S.papierkorb[i]); }

  function papierkorbLeeren() {
    S.papierkorb = [];
    sichern();
    zeichnePapierkorb();
    melde('Papierkorb geleert.');
  }

  function allesZuruecksetzen() {
    blendeAuf('Alles zurücksetzen', '<div class="fehlkasten">Der Auftrag wird geleert. ' +
      'Die ' + S.baeume.length + ' Bäume wandern in den Papierkorb und bleiben dort 30 Tage.</div>' +
      '<button class="btn rot" onclick="App.zuruecksetzenAusfuehren()">Ja, zurücksetzen</button>' +
      '<button class="btn zweit" onclick="App.blendeZu()">Abbrechen</button>');
  }

  function zuruecksetzenAusfuehren() {
    S.baeume.forEach(function (b, i) {
      b._position = i; b.geloescht = heuteISO(); b._objekt = S.auftrag.objekt;
      S.papierkorb.push(b);
    });
    var papierkorb = S.papierkorb, einst = S.einstellungen, preise = S.preise;
    S = leererZustand();
    S.papierkorb = papierkorb; S.einstellungen = einst; S.preise = preise;
    aktuellerBaum = null;
    sichern();
    blendeZu();
    auftragSchreiben();
    zeige('liste');
    melde('Zurückgesetzt. Die Bäume liegen im Papierkorb.');
  }

  /* =========================================================================
   * Preisliste
   * ====================================================================== */
  function preislisteBearbeiten() {
    var p = preisliste();
    var html = '<div class="hinweis" style="margin-bottom:10px">Netto in Euro je Baum, ' +
      'gestaffelt nach Höhenklasse.</div><table class="mini"><tr><th>Leistung</th>' +
      DATA.HOEHENKLASSEN.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr>' +
      Object.keys(p).map(function (k) {
        return '<tr><td style="font-size:12.5px">' + esc(k) + '</td>' +
          p[k].map(function (wert, i) {
            return '<td><input type="number" value="' + wert + '" style="padding:6px;min-height:34px;' +
              'font-size:14px" oninput="App.preisSetzen(' + esc(JSON.stringify(k)) + ',' + i +
              ',this.value)"></td>';
          }).join('') + '</tr>';
      }).join('') + '</table>' +
      '<button class="btn" style="margin-top:12px" onclick="App.blendeZu()">Fertig</button>' +
      '<button class="btn zweit" onclick="App.preiseZuruecksetzen()">Auf Standard zurücksetzen</button>';
    blendeAuf('Preisliste', html);
  }

  function preisSetzen(leistung, index, wert) {
    if (!S.preise) S.preise = JSON.parse(JSON.stringify(DATA.PREISE_STANDARD));
    S.preise[leistung][index] = parseFloat(wert) || 0;
    sichern();
  }

  function preiseZuruecksetzen() {
    S.preise = null;
    sichern();
    blendeZu();
    melde('Standardpreise wiederhergestellt.');
  }

  /* =========================================================================
   * Start
   * ====================================================================== */
  function start() {
    laden();
    papierkorbAufraeumen();

    fuelleSelect('a_kontrollart', DATA.KONTROLLART);
    fuelleSelect('a_belaubung', DATA.BELAUBUNG);
    fuelleSelect('a_witterung', DATA.WITTERUNG);
    fuelleSelect('b_umfeld', DATA.UMFELD, '– bitte wählen –');
    fuelleSelect('b_phase', DATA.PHASEN);
    fuelleSelect('b_zustand', DATA.ZUSTAENDE);
    fuelleSelect('b_erwartung', DATA.ERWARTUNG);
    fuelleSelect('b_roloff', DATA.ROLOFF);
    fuelleSelect('b_intervall', ['jährlich', '2 Jahre', '3 Jahre', 'keine gesonderte RK']);

    auftragSchreiben();
    zeichneAuftragKurz();
    zeichneListe();

    ['b_phase','b_zustand','b_erwartung'].forEach(function (id) {
      el(id).addEventListener('change', function () {
        intervallRechnen();
        if (id === 'b_zustand') zustandHilfe();
      });
    });
    el('b_intervall').addEventListener('change', function () {
      if (aktuellerBaum != null && S.baeume[aktuellerBaum]) {
        S.baeume[aktuellerBaum].intervallManuell =
          (this.value !== feldWert('b_intervallMatrix'));
      }
      intervallRechnen();
    });
    el('a_datum').addEventListener('change', function () {
      S.auftrag.datum = this.value;
    });
    ['a_auftraggeber','a_objekt','a_auftragsNr','a_kontrollart','a_datum','a_datumBis',
     'a_belaubung','a_witterung','a_kontrolleur','a_qualifikation','a_zertNr'].forEach(function (id) {
      el(id).addEventListener('change', function () { auftragLesen(); sichern(); });
    });
    el('b_nr').addEventListener('input', function () {
      document.getElementById('titel').textContent = 'Baum ' + this.value;
    });

    el('fotoInput').addEventListener('change', function () {
      if (this.files && this.files.length) fotosAufnehmen(this.files);
      this.value = '';
    });
    el('importInput').addEventListener('change', function () {
      if (this.files && this.files[0]) sicherungImport(this.files[0]);
      this.value = '';
    });

    el('btnZurueck').addEventListener('click', zurueck);
    el('btnAktion').addEventListener('click', function () { baumSpeichern(false); });
    el('blende').addEventListener('click', function (e) {
      if (e.target === this) blendeZu();
    });

    /* Wischgeste und Zurück-Taste: erst Einblendung, dann eine Ebene */
    window.addEventListener('popstate', function () {
      if (blendeOffen()) { blendeZu(); return; }
      if (ansicht !== 'liste') { if (ansicht === 'baum') baumLesen(); zeige('liste', true); }
    });
    history.replaceState({ view: 'liste' }, '', '');

    /* Vor dem Schließen sichern */
    window.addEventListener('beforeunload', function () {
      if (ansicht === 'baum') baumLesen();
      sichern();
    });

    try {
      localStorage.setItem(SCHLUESSEL + '.test', '1');
      localStorage.removeItem(SCHLUESSEL + '.test');
    } catch (e) {
      melde('Der Browser blockt den Speicher. Daten gehen beim Schließen verloren – ' +
            'bitte regelmäßig eine Sicherung ablegen.', null, null, 9000);
    }
  }

  return {
    start: start, zeige: zeige, zurueck: zurueck,
    neuerBaum: neuerBaum, baumOeffnen: baumOeffnen, baumSpeichern: baumSpeichern,
    loeschFrage: loeschFrage, baumLoeschen: baumLoeschen, zeichneListe: zeichneListe,
    artWahl: artWahl, artFiltern: artFiltern, artSetzen: artSetzen,
    symptomWechsel: symptomWechsel, grenzeAnfuegen: grenzeAnfuegen,
    massnahmeNeu: massnahmeNeu, massnahmeStufe: massnahmeStufe, massnahmeAnlegen: massnahmeAnlegen,
    massnahmeFeld: massnahmeFeld, massnahmeWeg: massnahmeWeg,
    fotoWeg: fotoWeg, gps: gps,
    blendeAuf: blendeAuf, blendeZu: blendeZu,
    pdf: pdf, excel: excel, excelKalkulation: excelKalkulation,
    angebot: angebot, auftragswert: auftragswert, posten: posten,
    sevKopieren: sevKopieren, sevCsv: sevCsv, sevProdukte: sevProdukte,
    sevPositionen: sevPositionen, sevText: sevText, zeichneAusgabe: zeichneAusgabe,
    sicherungExport: sicherungExport, importAusfuehren: importAusfuehren,
    einstellungenSpeichern: einstellungenSpeichern,
    papierkorbZurueck: papierkorbZurueck, papierkorbLeeren: papierkorbLeeren,
    allesZuruecksetzen: allesZuruecksetzen, zuruecksetzenAusfuehren: zuruecksetzenAusfuehren,
    preisliste: preislisteBearbeiten, preisSetzen: preisSetzen, preiseZuruecksetzen: preiseZuruecksetzen,
    _zustand: function () { return S; }
  };
})();

document.addEventListener('DOMContentLoaded', App.start);
