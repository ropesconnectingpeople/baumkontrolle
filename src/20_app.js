/* =============================================================================
 * 20_app.js  –  Erfassung, Liste, Speicherung, Navigation
 * Baumkontrolltool Hundertmark
 * ========================================================================== */

var App = (function () {
  'use strict';

  var VERSION = '2.0';
  var SCHLUESSEL = 'baumkontrolle.v2';      // alter Einzelplatz, nur noch zur Übernahme
  var GEMEINSAM  = 'baumkontrolle.gemeinsam'; // Firmendaten, Preise, Artenspeicher
  var AKTUELL    = 'baumkontrolle.aktuell';   // Kennung des offenen Auftrags
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
      id: '',                     // Kennung des Auftrags in der Ablage
      kundeId: '',                // zugehöriger Kunde
      auftrag: {
        auftraggeber: '', objekt: '', auftragsNr: '', kontrollart: 'Regelkontrolle',
        datum: heuteISO(), datumBis: '', belaubung: 'belaubt', witterung: 'trocken, bedeckt',
        erfassungsrichtung: '',
        kontrolleur: '', qualifikation: 'FLL-zertifizierter Baumkontrolleur',
        qualifikationFrei: '',
        berichtsdatum: heuteISO()
      },
      baeume: [],
      papierkorb: [],
      artenZuletzt: [],           // Schnellwahl im Baumart-Feld
      einstellungen: {
        name: 'Baumpflege Hundertmark',
        zusatz: 'Fachbetrieb für Baumpflege · Baumkontrolle · Verkehrssicherheit',
        anschrift: '', kontakt: '', ust: 19, stundensatz: 85,
        mehrBaum: false, mehrOrt: false
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

  function plusMonate(iso, monate) {
    if (!iso || !monate) return '';
    var d = new Date(iso);
    d.setMonth(d.getMonth() + monate);
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
   *
   * Die Aufträge liegen einzeln in IndexedDB, damit mehrere nebeneinander
   * laufen können und die Fotos nicht mehr an der Grenze von localStorage
   * scheitern. In localStorage bleibt nur, was klein ist und sofort beim
   * Start gebraucht wird: Firmendaten, Preisliste, zuletzt genutzte Arten
   * und die Kennung des offenen Auftrags.
   * ====================================================================== */

  function neueId() {
    return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /** Name des Auftrags in der Umschaltliste. */
  function auftragName(a) {
    a = a || S.auftrag;
    return a.objekt || a.auftraggeber || 'Ohne Namen';
  }

  function satz() {
    return {
      id: S.id,
      kundeId: S.kundeId || '',
      name: auftragName(),
      geaendert: new Date().toISOString(),
      baeume: S.baeume.length,
      daten: {
        version: VERSION, auftrag: S.auftrag, baeume: S.baeume,
        papierkorb: S.papierkorb, seitSicherung: S.seitSicherung,
        gesichert: S.gesichert
      }
    };
  }

  function gemeinsamSichern() {
    try {
      localStorage.setItem(GEMEINSAM, JSON.stringify({
        einstellungen: S.einstellungen,
        preise: S.preise,
        artenZuletzt: S.artenZuletzt
      }));
      if (S.id) localStorage.setItem(AKTUELL, S.id);
    } catch (e) { /* voll oder blockiert, das ist hier nicht kritisch */ }
  }

  function gemeinsamLaden() {
    try {
      var g = JSON.parse(localStorage.getItem(GEMEINSAM) || '{}');
      if (g.einstellungen) S.einstellungen = g.einstellungen;
      if (g.preise) S.preise = g.preise;
      if (g.artenZuletzt) S.artenZuletzt = g.artenZuletzt;
    } catch (e) { /* dann eben Standardwerte */ }
  }

  function sichern() {
    gemeinsamSichern();
    if (!S.id) S.id = neueId();
    if (!DB.nutzbar()) return notSichern();
    DB.schreiben(satz(), function (fehler) {
      if (fehler) notSichern();
      else speicherFallback = null;
    });
    return true;
  }

  /**
   * Rückfall, wenn IndexedDB nicht will, etwa im privaten Modus.
   * Dann gilt wieder die alte Enge, und der Kontrolleur muss es wissen.
   */
  function notSichern() {
    try {
      localStorage.setItem(SCHLUESSEL, JSON.stringify(S));
      speicherFallback = null;
      return true;
    } catch (e) {
      speicherFallback = S;
      melde('Speicher voll. Bitte jetzt eine Sicherung ablegen.', 'Sicherung', function () { zeige('einstellungen'); });
      return false;
    }
  }

  /** Einen Auftragssatz in den laufenden Zustand übernehmen. */
  function satzUebernehmen(rec) {
    var leer = leererZustand();
    S.id = rec.id;
    S.kundeId = rec.kundeId || '';
    S.auftrag = rec.daten.auftrag || leer.auftrag;
    S.baeume = rec.daten.baeume || [];
    S.papierkorb = rec.daten.papierkorb || [];
    S.seitSicherung = rec.daten.seitSicherung || 0;
    S.gesichert = rec.daten.gesichert;
  }

  /**
   * Beim ersten Start nach der Umstellung liegt der bisherige Auftrag noch
   * im alten localStorage-Platz. Der wird einmalig übernommen und der alte
   * Platz geräumt, damit die 4 MB wieder frei sind.
   */
  function altenBestandUebernehmen(fertig) {
    var roh = null;
    try { roh = localStorage.getItem(SCHLUESSEL); } catch (e) {}
    if (!roh) return fertig(null);
    var d;
    try { d = JSON.parse(roh); } catch (e) { return fertig(null); }
    if (!d || !d.baeume) return fertig(null);

    var rec = {
      id: neueId(), name: d.auftrag && (d.auftrag.objekt || d.auftrag.auftraggeber) || 'Übernommen',
      geaendert: new Date().toISOString(), baeume: d.baeume.length,
      daten: { version: VERSION, auftrag: d.auftrag, baeume: d.baeume,
               papierkorb: d.papierkorb || [], seitSicherung: d.seitSicherung || 0,
               gesichert: d.gesichert }
    };
    DB.schreiben(rec, function (fehler) {
      if (fehler) return fertig(null);
      try { localStorage.removeItem(SCHLUESSEL); } catch (e) {}
      fertig(rec);
    });
  }

  function laden() {
    /* nur noch der Rückfallweg, wenn IndexedDB nicht zur Verfügung steht */
    try {
      var roh = localStorage.getItem(SCHLUESSEL);
      if (!roh) return;
      var d = JSON.parse(roh);
      if (d && d.baeume) {
        S = d;
        if (!S.papierkorb) S.papierkorb = [];
        if (!S.einstellungen) S.einstellungen = leererZustand().einstellungen;
        if (!S.artenZuletzt) S.artenZuletzt = [];
      }
    } catch (e) {
      melde('Gespeicherte Daten konnten nicht gelesen werden.');
    }
  }

  /* =========================================================================
   * Mehrere Aufträge nebeneinander
   *
   * Der Kontrolleur hat an einem Tag oft zwei Objekte offen. Bisher hielt die
   * App genau einen Auftrag; für den zweiten musste man sichern, zurücksetzen
   * und am Ende beides wieder zusammensuchen. Jetzt liegen sie nebeneinander
   * und man schaltet um.
   * ====================================================================== */

  function auftragStarten() {
    if (!DB.nutzbar()) { laden(); auftragFertig(); return; }

    var gewuenscht = '';
    try { gewuenscht = localStorage.getItem(AKTUELL) || ''; } catch (e) {}

    DB.alle(function (fehler, liste) {
      if (fehler) { laden(); auftragFertig(); return; }
      liste = liste || [];

      if (!liste.length) {
        return altenBestandUebernehmen(function (rec) {
          if (rec) satzUebernehmen(rec);
          auftragFertig();
        });
      }
      kundenUebernehmen(liste, function () {});
      var rec = null;
      liste.forEach(function (r) { if (r.id === gewuenscht) rec = r; });
      if (!rec) {
        liste.sort(function (a, b) { return (b.geaendert || '').localeCompare(a.geaendert || ''); });
        rec = liste[0];
      }
      satzUebernehmen(rec);
      auftragFertig();
    });
  }

  function auftragFertig() {
    if (!S.id) S.id = neueId();
    papierkorbAufraeumen();
    auftragSchreiben();
    richtungZeigen();
    objektGpsAnzeige();
    zeichneAuftragKurz();
    zeichneListe();
    gemeinsamSichern();
  }

  /** Umschaltliste. Zeigt jeden Auftrag mit Objekt, Bäumen und Datum. */
  function auftragWechsel() {
    blendeAuf('Aufträge', '<div class="hinweis">Wird geladen …</div>');
    if (ansicht === 'baum') baumLesen();
    sichern();
    DB.alle(function (fehler, liste) {
      if (fehler || !liste) {
        el('blendeInhalt').innerHTML =
          '<div class="fehlkasten">Die Auftragsablage ist auf diesem Gerät nicht verfügbar. ' +
          'Es bleibt bei einem Auftrag.</div>';
        return;
      }
      liste.sort(function (a, b) { return (b.geaendert || '').localeCompare(a.geaendert || ''); });
      el('blendeInhalt').innerHTML = liste.map(function (r) {
        var offen = r.id === S.id;
        return '<button class="wahl' + (offen ? ' an' : '') + '" onclick="App.auftragOeffnen(' +
          esc(JSON.stringify(r.id)) + ')"><b>' + esc(r.name || 'Ohne Namen') +
          (offen ? ' · offen' : '') + '</b><span>' +
          (r.baeume || 0) + (r.baeume === 1 ? ' Baum' : ' Bäume') +
          ' · zuletzt ' + esc(deDatum((r.geaendert || '').slice(0, 10))) + '</span></button>';
      }).join('') +
      '<div class="trenner"></div>' +
      '<button class="btn" onclick="App.auftragNeu()">+ Neuer Auftrag</button>' +
      (liste.length > 1
        ? '<button class="btn zweit" onclick="App.auftragWegFrage()">Diesen Auftrag löschen</button>'
        : '');
    });
  }

  function auftragOeffnen(id) {
    if (id === S.id) return blendeZu();
    DB.lesen(id, function (fehler, rec) {
      if (fehler || !rec) return melde('Der Auftrag lässt sich nicht öffnen.');
      satzUebernehmen(rec);
      aktuellerBaum = null;
      gemeinsamSichern();
      blendeZu();
      auftragFertig();
      zeige('liste');
      melde('Offen: ' + auftragName());
    });
  }

  function auftragNeu(kundeId) {
    var leer = leererZustand();
    S.id = neueId();
    S.auftrag = leer.auftrag;
    S.baeume = [];
    S.papierkorb = [];
    S.seitSicherung = 0;
    S.gesichert = null;
    S.kundeId = kundeId || '';
    aktuellerBaum = null;
    sichern();
    blendeZu();
    auftragFertig();
    zeige('auftrag');
    melde('Neuer Auftrag. Die Firmendaten und die Preisliste gelten weiter.');
  }

  function auftragWegFrage() {
    blendeAuf('Auftrag löschen', '<div class="warnkasten">„' + esc(auftragName()) +
      '" mit ' + S.baeume.length + (S.baeume.length === 1 ? ' Baum' : ' Bäumen') +
      ' wird endgültig gelöscht. Das lässt sich nicht rückgängig machen. ' +
      'Lege vorher eine Sicherung ab, wenn du die Daten noch brauchst.</div>' +
      '<button class="btn rot" onclick="App.auftragWeg()">Endgültig löschen</button>' +
      '<button class="btn zweit" onclick="App.blendeZu()">Abbrechen</button>');
  }

  function auftragWeg() {
    var weg = S.id;
    DB.loeschen(weg, function () {
      DB.alle(function (fehler, liste) {
        liste = (liste || []).filter(function (r) { return r.id !== weg; });
        if (liste.length) {
          liste.sort(function (a, b) { return (b.geaendert || '').localeCompare(a.geaendert || ''); });
          satzUebernehmen(liste[0]);
        } else {
          var leer = leererZustand();
          S.id = neueId(); S.auftrag = leer.auftrag; S.baeume = [];
          S.papierkorb = []; S.seitSicherung = 0; S.gesichert = null;
        }
        aktuellerBaum = null;
        gemeinsamSichern();
        blendeZu();
        auftragFertig();
        zeige('liste');
        melde('Auftrag gelöscht.');
      });
    });
  }

  /* =========================================================================
   * Kunden
   *
   * Flach gehalten: ein Kunde, darunter seine Kontrollen. Keine Objekte als
   * eigene Ebene, denn eine Kontrolle gilt immer einem Grundstück. Für große
   * Liegenschaften mit Kartenpflege ist ohnehin ImmoSpector Tree vorgesehen.
   * ====================================================================== */

  var kundenZwischen = [];      // zuletzt gelesene Kundenliste, für die Anzeige

  function kundenLesen(fertig) {
    if (!DB.nutzbar()) return fertig([]);
    DB.kunden.alle(function (fehler, liste) {
      kundenZwischen = (fehler || !liste) ? [] : liste;
      kundenZwischen.sort(function (a, b) {
        return (a.name || '').localeCompare(b.name || '', 'de');
      });
      fertig(kundenZwischen);
    });
  }

  function zeichneKunden() {
    kundenLesen(function (kunden) {
      DB.alle(function (f2, auftraege) {
        auftraege = auftraege || [];
        var zahl = {};
        auftraege.forEach(function (a) {
          if (a.kundeId) zahl[a.kundeId] = (zahl[a.kundeId] || 0) + 1;
        });
        el('kundenZahl').textContent = kunden.length ? '(' + kunden.length + ')' : '';
        el('kundenListe').innerHTML = kunden.length
          ? kunden.map(function (k) {
              var n = zahl[k.id] || 0;
              return '<div class="baumzeile z-grau" onclick="App.kundeOeffnen(' +
                esc(JSON.stringify(k.id)) + ')">' +
                '<div class="txt"><b>' + esc(k.name) + '</b><span>' +
                esc([k.anschrift, n ? n + (n === 1 ? ' Kontrolle' : ' Kontrollen') : 'noch keine Kontrolle']
                    .filter(Boolean).join(' · ')) + '</span></div></div>';
            }).join('')
          : '<div class="leer"><div class="zeichen">&#9635;</div>Noch kein Kunde angelegt.</div>';
      });
    });
  }

  function kundeNeu(id) {
    var k = id ? kundenZwischen.filter(function (x) { return x.id === id; })[0] : null;
    k = k || { id: '', name: '', anschrift: '', kontakt: '', notiz: '' };
    blendeAuf(id ? 'Kunde bearbeiten' : 'Kunde anlegen',
      '<div class="feld"><label>Name oder Firma</label>' +
      '<input id="k_name" value="' + esc(k.name) + '"></div>' +
      '<div class="feld"><label>Anschrift</label>' +
      '<input id="k_anschrift" value="' + esc(k.anschrift) + '" placeholder="Straße, PLZ Ort"></div>' +
      '<div class="feld"><label>Kontakt</label>' +
      '<input id="k_kontakt" value="' + esc(k.kontakt) + '" placeholder="Telefon oder E-Mail"></div>' +
      '<div class="feld"><label>Notiz</label>' +
      '<textarea id="k_notiz">' + esc(k.notiz) + '</textarea></div>' +
      '<button class="btn" onclick="App.kundeSpeichern(' + esc(JSON.stringify(k.id)) + ')">Speichern</button>');
    setTimeout(function () { var f = el('k_name'); if (f) f.focus(); }, 150);
  }

  function kundeSpeichern(id) {
    var name = (feldWert('k_name') || '').trim();
    if (!name) return melde('Ohne Namen geht es nicht.');
    var k = {
      id: id || neueId(),
      name: name,
      anschrift: (feldWert('k_anschrift') || '').trim(),
      kontakt: (feldWert('k_kontakt') || '').trim(),
      notiz: (feldWert('k_notiz') || '').trim(),
      angelegt: id ? undefined : new Date().toISOString()
    };
    DB.kunden.schreiben(k, function (fehler) {
      if (fehler) return melde('Der Kunde ließ sich nicht speichern.');
      blendeZu();
      zeichneKunden();
      melde(id ? 'Kunde geändert.' : 'Kunde angelegt.');
    });
  }

  /** Kunde mit seinen Kontrollen. Von hier aus wird eine Kontrolle geöffnet. */
  function kundeOeffnen(id) {
    var k = kundenZwischen.filter(function (x) { return x.id === id; })[0];
    if (!k) return;
    DB.alle(function (fehler, auftraege) {
      var meine = (auftraege || []).filter(function (a) { return a.kundeId === id; });
      meine.sort(function (a, b) { return (b.geaendert || '').localeCompare(a.geaendert || ''); });
      blendeAuf(k.name,
        (k.anschrift || k.kontakt
          ? '<div class="hinweis" style="margin-bottom:12px">' +
            esc([k.anschrift, k.kontakt].filter(Boolean).join(' · ')) + '</div>' : '') +
        (meine.length
          ? meine.map(function (a) {
              return '<button class="wahl' + (a.id === S.id ? ' an' : '') +
                '" onclick="App.auftragOeffnen(' + esc(JSON.stringify(a.id)) + ')"><b>' +
                esc(a.name || 'Ohne Namen') + (a.id === S.id ? ' · offen' : '') +
                '</b><span>' + (a.baeume || 0) + (a.baeume === 1 ? ' Baum' : ' Bäume') +
                ' · ' + esc(deDatum((a.geaendert || '').slice(0, 10))) + '</span></button>';
            }).join('')
          : '<div class="hinweis">Noch keine Kontrolle für diesen Kunden.</div>') +
        '<div class="trenner"></div>' +
        '<button class="btn" onclick="App.auftragNeu(' + esc(JSON.stringify(id)) + ')">+ Kontrolle für diesen Kunden</button>' +
        '<button class="btn zweit" onclick="App.kundeNeu(' + esc(JSON.stringify(id)) + ')">Kundendaten bearbeiten</button>');
    });
  }

  /**
   * Bestehende Aufträge kennen nur den Freitext „Auftraggeber". Daraus wird
   * einmalig je eindeutigem Namen ein Kunde gebaut und verknüpft.
   */
  function kundenUebernehmen(auftraege, fertig) {
    var ohne = auftraege.filter(function (a) {
      return !a.kundeId && a.daten && a.daten.auftrag && a.daten.auftrag.auftraggeber;
    });
    if (!ohne.length) return fertig();

    kundenLesen(function (kunden) {
      var nachName = {};
      kunden.forEach(function (k) { nachName[k.name.toLowerCase()] = k; });
      var offen = ohne.length;
      function fertigEiner() { if (--offen === 0) fertig(); }

      ohne.forEach(function (a) {
        var name = a.daten.auftrag.auftraggeber.trim(),
            k = nachName[name.toLowerCase()];
        if (!k) {
          k = { id: neueId(), name: name, anschrift: '', kontakt: '', notiz: '',
                angelegt: new Date().toISOString() };
          nachName[name.toLowerCase()] = k;
          DB.kunden.schreiben(k);
        }
        a.kundeId = k.id;
        DB.schreiben(a, fertigEiner);
      });
    });
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
    ergebnisse: 'Ergebnisse', angebote: 'Angebote', kunden: 'Kunden',
    kunde: 'Kunde', einstellungen: 'Einstellungen'
  };

  /* Welcher Reiter oben leuchtet, wenn eine Ansicht offen ist. */
  var REITER = {
    liste: 'rtKontrolle', auftrag: 'rtKontrolle', baum: 'rtKontrolle',
    ergebnisse: 'rtKontrolle', angebote: 'rtAngebote',
    kunden: 'rtKunden', kunde: 'rtKunden'
  };

  function zeige(name, ohneHistorie) {
    var alt = document.querySelector('.view.aktiv');
    if (alt) alt.classList.remove('aktiv');
    var neu = document.getElementById('view-' + name);
    if (neu) neu.classList.add('aktiv');
    ansicht = name;

    document.getElementById('titel').textContent =
      name === 'baum' ? ('Baum ' + (feldWert('b_nr') || '')) : TITEL[name];
    /* Zurück gibt es nur in Unteransichten. Die drei Reiter sind gleichrangig,
       dort wäre ein Zurück-Knopf irreführend. */
    var reiterAnsicht = (name === 'liste' || name === 'angebote' || name === 'kunden');
    document.getElementById('btnZurueck').style.display = reiterAnsicht ? 'none' : '';
    var akt = document.getElementById('btnAktion');
    akt.style.display = name === 'baum' ? '' : 'none';

    if (name === 'liste')         { zeichneListe(); zeichneAuftragKurz(); }
    if (name === 'ergebnisse' || name === 'angebote') zeichneAusgabe();
    if (name === 'kunden')        zeichneKunden();
    if (name === 'einstellungen') { zeichneEinstellungen(); zeichnePapierkorb(); }

    /* Reiterleiste im Baum-Detail und im Auftrag ausblenden, dort sitzen die
       Speichern-Knöpfe am Seitenende und der Platz wird gebraucht. */
    var mitReitern = !(name === 'baum' || name === 'auftrag');
    el('reiter').className = 'reiter' + (mitReitern ? '' : ' aus');
    el('btnZahnrad').style.display = mitReitern ? '' : 'none';
    ['rtKontrolle', 'rtAngebote', 'rtKunden'].forEach(function (id) {
      var k = el(id);
      if (k) k.className = (REITER[name] === id) ? 'aktiv' : '';
    });

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
     'witterung','kontrolleur','qualifikation','qualifikationFrei'].forEach(function (k) {
      a[k] = feldWert('a_' + k);
    });
    a.berichtsdatum = a.berichtsdatum || heuteISO();
  }

  function auftragSchreiben() {
    var a = S.auftrag;
    ['auftraggeber','objekt','auftragsNr','kontrollart','datum','datumBis','belaubung',
     'witterung','kontrolleur','qualifikation','qualifikationFrei'].forEach(function (k) {
      setzeFeld('a_' + k, a[k]);
    });
    qualFreitext();
  }

  /** Bei „sonstige" darf die Bezeichnung frei eingetragen werden. */
  function qualFreitext() {
    var frei = feldWert('a_qualifikation') === 'sonstige';
    el('qualFreitextFeld').style.display = frei ? '' : 'none';
  }

  /** Erfassungsrichtung – gilt fürs ganze Objekt, nicht für den einzelnen Baum. */
  function richtung(wert) {
    S.auftrag.erfassungsrichtung = (S.auftrag.erfassungsrichtung === wert) ? '' : wert;
    richtungZeigen();
    sichern();
  }

  function richtungZeigen() {
    var wert = S.auftrag.erfassungsrichtung || '';
    [['richtungMit', 'im Uhrzeigersinn'], ['richtungGegen', 'gegen den Uhrzeigersinn']]
      .forEach(function (p) {
        var lab = el(p[0]);
        if (!lab) return;
        lab.className = (wert === p[1]) ? 'an' : '';
        lab.querySelector('input').checked = (wert === p[1]);
      });
  }

  /** Klappblock „Weitere Angaben". Der Zustand bleibt erhalten – wer die
   *  Felder braucht, klappt einmal auf und hat beim nächsten Baum Ruhe. */
  function mehr(welcher, nurSetzen) {
    var schluessel = 'mehr' + welcher,
        block = el('mehr' + welcher),
        knopf = el('knopf' + welcher);
    if (!block || !knopf) return;
    if (!nurSetzen) {
      S.einstellungen[schluessel] = !S.einstellungen[schluessel];
      sichern();
    }
    var offen = !!S.einstellungen[schluessel];
    block.hidden = !offen;
    knopf.className = 'mehrknopf' + (offen ? ' offen' : '');
    knopf.querySelector('.text').textContent = offen ? 'Weniger anzeigen' : 'Weitere Angaben';
  }

  /** So steht die Qualifikation auf dem Protokoll. */
  function qualifikationText(a) {
    return a.qualifikation === 'sonstige' ? (a.qualifikationFrei || '') : (a.qualifikation || '');
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
          /* Die Farbe der Zeile zeigt den Zustand, nicht die Maßnahmen. Beim
             Durchscrollen soll man den Bestand sehen, nicht die Arbeitsliste. */
          ampel = b.zustand === 'stärker geschädigt' ? 'z-rot'
                : (b.zustand === 'leicht geschädigt' ? 'z-gelb'
                : (b.zustand === 'gesund' ? 'z-gruen' : 'z-grau')),
          fakten = [b.hoehe ? b.hoehe + ' m' : '',
                    b.stammumfang ? b.stammumfang + ' cm' : '',
                    b.lage || b.hausNr || ''].filter(Boolean).join(' · ');
      return '<div class="baumzeile ' + ampel + '" id="bz' + i + '">' +
        '<div class="nr">' + esc(b.nr || (i + 1)) + '</div>' +
        '<div class="txt" onclick="App.baumOeffnen(' + i + ')">' +
          '<b>' + esc(b.artDt || 'Ohne Art') + '</b>' +
          '<span>' + esc(fakten || 'noch nichts gemessen') + '</span></div>' +
        '<div class="marken">' +
          (b.zustand ? '<span class="zmark">' + esc(kurzZustand(b.zustand)) + '</span>' : '') +
          (stufe ? '<span class="dring d' + stufe + '">' + esc(DATA.DRINGLICHKEIT[stufe].kurz) + '</span>' : '') +
        '</div>' +
        '<button class="weg" onclick="App.loeschFrage(' + i + ')">&#128465;</button></div>';
    }).join('');
  }

  /** „stärker geschädigt" passt nicht in eine Marke, „stärker" schon. */
  function kurzZustand(z) {
    if (z === 'stärker geschädigt') return 'stärker gesch.';
    if (z === 'leicht geschädigt') return 'leicht gesch.';
    return z;
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
      lage: S.baeume.length ? (S.baeume[S.baeume.length - 1].lage || '') : '',
      hausNr: '', flurstueck: '', umfeld: '', gpsLat: '', gpsLon: '',
      phase: 'Reifephase', zustand: 'gesund', erwartung: 'höher', roloff: '',
      intervallMatrix: '', intervall: '', intervallManuell: false, naechsteKontrolle: '',
      befunde: { K: [], S: [], W: [], Wu: [], V: [] },
      pilz: null, grenzen: '', bemerkung: '', befundtext: '',
      massnahmen: [], ks: [], fotos: [], historie: []
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

    ['nr','artDt','stammzahl','alter','hoehe','kroneD','kronenansatz','stammumfang','messhoehe',
     'lage','hausNr','flurstueck','umfeld','gpsLat','gpsLon','phase','zustand','erwartung',
     'roloff','intervall','befundtext','grenzen','bemerkung'].forEach(function (k) {
      setzeFeld('b_' + k, b[k]);
    });
    if (!b.lage && b.strasse) setzeFeld('b_lage', b.strasse);   /* aus früheren Fassungen */
    artStand();
    artZu();

    symGruppe = 'K';
    mehr('Baum', true);
    mehr('Ort', true);
    gpsAnzeige();
    zeichneSymptome(b);
    zeichnePilz(b);
    zeichneGrenzenWahl();
    zeichneMassnahmen(b);
    zeichneKS(b);
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
    ['nr','artDt','stammzahl','alter','hoehe','kroneD','kronenansatz','stammumfang','messhoehe',
     'lage','hausNr','flurstueck','umfeld','gpsLat','gpsLon','phase','zustand','erwartung',
     'roloff','intervall','befundtext','grenzen','bemerkung'].forEach(function (k) {
      b[k] = feldWert('b_' + k);
    });
    delete b.strasse;

    /* Der botanische Name wird immer aus dem deutschen abgeleitet, nie getippt.
       So kann im Protokoll keine Kombination stehen, die es nicht gibt. */
    b.artDt = String(b.artDt || '').trim();     /* die Tastatur hängt gern ein Leerzeichen an */
    var art = DATA.artGenau(b.artDt);
    b.artBot = art ? art.bot : '';
    artMerken(b.artDt);
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

  /**
   * Der Service Worker hat eine neuere Fassung in den Cache gelegt.
   * Neu geladen wird nur auf Zuruf und nur, wenn gerade kein Baum offen ist –
   * ein Neustart mitten in der Erfassung würde die ungespeicherten Felder
   * des laufenden Baums kosten.
   */
  function neueFassung() {
    if (aktuellerBaum != null) {
      melde('Neue Fassung geladen. Sie wird beim nächsten Start aktiv.', null, null, 7000);
    } else {
      melde('Neue Fassung geladen.', 'Jetzt neu starten', function () {
        location.reload();
      }, 12000);
    }
  }

  /* =========================================================================
   * Baumart
   *
   * Getippt wird direkt im Feld, die Treffer stehen unmittelbar darunter.
   * Bewusst kein Überblenden: auf dem Telefon liegt die Tastatur sonst genau
   * auf der Liste, und man tippt blind. Die Liste schiebt den Rest der Karte
   * nach unten, statt ihn zu verdecken.
   *
   * Der botanische Name wird nicht getippt, sondern aus dem deutschen Namen
   * abgeleitet (DATA.artGenau). Was sich nicht zuordnen lässt, bleibt Freitext
   * und wird als solcher gekennzeichnet – im Protokoll steht dann nur der
   * deutsche Name, aber nie ein falscher botanischer.
   * ====================================================================== */

  /** Zeile unter dem Feld: botanischer Name oder Freitext-Hinweis. */
  function artStand() {
    var text = feldWert('b_artDt'), zeile = el('b_artBot'), g = DATA.artGenau(text);
    if (!text) { zeile.textContent = ''; zeile.className = 'artbot'; return null; }
    if (g) { zeile.textContent = g.bot; zeile.className = 'artbot'; }
    else { zeile.textContent = 'Freitext – keine botanische Zuordnung'; zeile.className = 'artbot frei'; }
    return g;
  }

  function artOeffnen() {
    artListe(feldWert('b_artDt'));
    /* Erst nach der Tastaturanimation: Feld unter die Kopfzeile ziehen,
       damit Eingabe und Treffer zusammen im sichtbaren Rest stehen. */
    setTimeout(artInsBild, 280);
  }

  function artTippen() {
    artStand();
    artListe(feldWert('b_artDt'));
  }

  function artListe(text) {
    var box = el('artVorschlaege'), treffer = DATA.artFinden(text, 40);
    if (!treffer.length) {
      box.innerHTML = '<div class="nix">Keine Art gefunden. „' + esc(text) +
                      '" wird als Freitext übernommen.</div>';
    } else {
      box.innerHTML = (text ? '' : zuletztBlock() + '<div class="kopf">Alle Arten A–Z</div>') +
        treffer.map(function (a) {
          return '<button type="button" onclick="App.artSetzen(' + a.i + ')"><b>' +
                 esc(a.dt) + '</b><span>' + esc(a.bot) + '</span></button>';
        }).join('');
    }
    box.hidden = false;
    artHoehe();
  }

  /**
   * Die zuletzt aufgenommenen Arten, ganz oben in der Vorschlagsliste.
   * In einem Garten wiederholen sich die Arten, das spart bei jedem zweiten
   * Baum die Tipperei. Früher stand das als Knopfreihe dauerhaft über dem
   * Feld und hat nur Platz gekostet; jetzt erscheint es mit der Liste.
   */
  function zuletztBlock() {
    var gesehen = {}, liste = [];
    function rein(dt) {
      var k = DATA.artNorm(dt);
      if (!k || gesehen[k] || liste.length >= 6) return;
      gesehen[k] = 1;
      liste.push(dt);
    }
    for (var i = S.baeume.length - 1; i >= 0; i--) rein(S.baeume[i].artDt);
    (S.artenZuletzt || []).forEach(rein);
    if (!liste.length) return '';
    return '<div class="kopf">Zuletzt aufgenommen</div>' + liste.map(function (dt) {
      var g = DATA.artGenau(dt);
      return '<button type="button" onclick="App.artChip(' + esc(JSON.stringify(dt)) +
             ')"><b>' + esc(dt) + '</b><span>' + esc(g ? g.bot : 'Freitext') + '</span></button>';
    }).join('');
  }

  function artInsBild() {
    var f = el('b_artDt');
    if (!f || el('artVorschlaege').hidden) return;
    var feld = f.parentNode,
        kopf = document.querySelector('header'),
        hoch = kopf ? kopf.getBoundingClientRect().height : 0,
        weg = feld.getBoundingClientRect().top - hoch - 6;
    if (Math.abs(weg) > 6) window.scrollBy(0, weg);
    artHoehe();
  }

  /**
   * Die Liste darf nur den Platz nehmen, der über der Tastatur wirklich frei
   * ist. vh rechnet auf dem Telefon mit dem ganzen Fenster und damit falsch;
   * visualViewport kennt die tatsächlich sichtbare Höhe.
   */
  function artHoehe() {
    var box = el('artVorschlaege');
    if (!box || box.hidden) return;
    var sicht = window.visualViewport ? window.visualViewport.height : window.innerHeight,
        oben = box.getBoundingClientRect().top;
    box.style.maxHeight = Math.max(132, sicht - oben - 10) + 'px';
  }

  function artZu() { el('artVorschlaege').hidden = true; }

  function artSetzen(i) {
    var a = DATA.ARTEN[i];
    if (!a) return;
    artUebernehmen(a[0]);
  }

  function artChip(dt) { artUebernehmen(dt); }

  function artUebernehmen(dt) {
    setzeFeld('b_artDt', dt);
    artStand();
    artZu();
    var f = el('b_artDt');
    if (f) f.blur();          /* Tastatur zu, damit die ganze Karte wieder sichtbar ist */
  }

  /** Beim Verlassen des Feldes die Schreibweise auf den Katalog ziehen. */
  function artFertig() {
    setTimeout(function () {
      var g = DATA.artGenau(feldWert('b_artDt'));
      if (g) setzeFeld('b_artDt', g.dt);   /* auch botanisch getippt → deutscher Name */
      artStand();
      artZu();
    }, 150);
  }

  function artMerken(dt) {
    if (!dt) return;
    var k = DATA.artNorm(dt);
    S.artenZuletzt = (S.artenZuletzt || []).filter(function (x) { return DATA.artNorm(x) !== k; });
    S.artenZuletzt.unshift(dt);
    S.artenZuletzt = S.artenZuletzt.slice(0, 12);
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

    var monate = DATA.intervallMonate(sel.value),
        basis = S.auftrag.datum || heuteISO(),
        feld = el('b_naechsteKontrolle');
    if (monate) {
      var iso = plusMonate(basis, monate);
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
  var symGruppe = 'K';

  /** Die fünf Baumteile liegen hinter Reitern – ein Tipp statt 60 Zeilen Scrollen.
   *  Die Zahl auf dem Reiter zeigt, wo schon Kreuze sitzen. */
  function zeichneSymptome(b) {
    var box = el('symptome'),
        befunde = b.befunde || {},
        reiter = Object.keys(DATA.SYMPTOME).map(function (g) {
          var an = (befunde[g] || []).length;
          return '<button class="' + (g === symGruppe ? 'aktiv' : '') +
            '" onclick="App.symGruppe(\'' + g + '\')">' + esc(DATA.SYMPTOME[g].kurz || g) +
            (an ? '<span class="anzahl">' + an + '</span>' : '') + '</button>';
        }).join(''),
        gruppe = DATA.SYMPTOME[symGruppe],
        an = befunde[symGruppe] || [];

    box.innerHTML = '<div class="symreiter">' + reiter + '</div>' +
      '<div class="symgruppe"><div class="symliste">' +
      gruppe.codes.map(function (bez, i) {
        var code = symGruppe + (i + 1), gesetzt = an.indexOf(code) >= 0;
        return '<label class="' + (gesetzt ? 'an' : '') + '" id="lab' + code + '">' +
          '<input type="checkbox" ' + (gesetzt ? 'checked' : '') +
          ' onchange="App.symptomWechsel(\'' + symGruppe + '\',\'' + code + '\',this.checked)">' +
          esc(bez) + '</label>';
      }).join('') + '</div></div>';
  }

  function symGruppeWechsel(g) {
    symGruppe = g;
    zeichneSymptome(S.baeume[aktuellerBaum] || {});
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
    zeichneSymptome(b);      /* aktualisiert die Zahlen auf den Reitern */
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
   * Kronensicherung
   *
   * Der Kontrolleur steht unterm Baum, sieht eine Farbe und weiß nicht, von
   * wann sie ist. Der Zyklus ist acht Jahre lang – genauso lang wie die
   * ZTV-Mindesteinsatzdauer. Gelb heißt deshalb entweder „dieses Jahr
   * eingebaut" oder „vor acht Jahren eingebaut und fällig". Die App zeigt
   * darum immer alle plausiblen Jahre mit Ampel, statt eines zu raten.
   * ====================================================================== */

  function jetztJahr() { return new Date().getFullYear(); }

  function ksEinsatzdauer(hersteller) {
    var h = DATA.KS_HERSTELLER.filter(function (x) { return x.name === hersteller; })[0];
    return h ? h.dauer : 8;
  }

  /** Ampel aus Einbaujahr und Einsatzdauer. */
  function ksAmpel(einbaujahr, dauer) {
    if (!einbaujahr) return { klasse: 'a-grau', text: 'Einbaujahr unbekannt', rest: null };
    var austausch = parseInt(einbaujahr, 10) + (parseInt(dauer, 10) || 8),
        rest = austausch - jetztJahr();
    if (rest < 0)  return { klasse: 'a-rot',    text: 'überschritten seit ' + austausch, rest: rest };
    if (rest === 0) return { klasse: 'a-orange', text: 'Austausch fällig ' + austausch, rest: rest };
    if (rest <= 2) return { klasse: 'a-gelb',   text: 'noch ' + rest + (rest === 1 ? ' Jahr' : ' Jahre'), rest: rest };
    return { klasse: 'a-gruen', text: 'noch ' + rest + ' Jahre', rest: rest };
  }

  function ksFarbHex(name) {
    var f = DATA.KS_FARBEN.filter(function (x) { return x.name === name; })[0];
    return f ? f.hex : '#bbb';
  }

  /* --- Liste am Baum --- */
  function zeichneKS(b) {
    var liste = b.ks || [], box = el('ksListe');
    if (!liste.length) {
      box.innerHTML = '<div class="hinweis" style="margin-bottom:10px">' +
        'Keine Kronensicherung erfasst.</div>';
      return;
    }
    box.innerHTML = liste.map(function (k, i) {
      var dauer = k.einsatzdauer || ksEinsatzdauer(k.hersteller),
          a = ksAmpel(k.einbaujahr, dauer),
          maengel = (k.maengel || []).length;
      return '<div class="kszeile">' +
        '<div class="kopf"><span class="farbpunkt" style="background:' + ksFarbHex(k.farbe) + '"></span>' +
        '<b>' + esc(k.bezeichnung || k.system || 'Kronensicherung') + '</b>' +
        '<span class="ampel ' + a.klasse + '">' + esc(a.text) + '</span>' +
        '<button class="weg" onclick="App.ksWeg(' + i + ')">&times;</button></div>' +
        '<div class="zeile2">' +
        [k.einbaujahr ? 'Einbau ' + k.einbaujahr : 'Einbaujahr unbekannt',
         k.farbe ? 'Farbe ' + k.farbe : '',
         k.hersteller, k.bauart,
         k.bruchlast ? k.bruchlast + ' t' : '',
         k.anzahl ? k.anzahl + '×' : ''].filter(Boolean).map(esc).join(' · ') +
        (maengel ? '<br><span style="color:#b03030;font-weight:600">' + maengel +
          (maengel === 1 ? ' Mangel' : ' Mängel') + '</span>' : '') +
        (k.bewertung ? ' · ' + esc(k.bewertung) : '') +
        '</div>' +
        '<div style="margin-top:8px"><button class="btn klein zweit" style="margin:0" ' +
        'onclick="App.ksBearbeiten(' + i + ')">Bearbeiten</button></div></div>';
    }).join('');
  }

  /* --- Neue Kronensicherung: erst die Farbe --- */
  function ksNeu() {
    ksIndex = null;
    farbWahl(function (farbe, jahr) {
      var b = S.baeume[aktuellerBaum];
      if (!b.ks) b.ks = [];
      b.ks.push({
        farbe: farbe, einbaujahr: jahr, bezeichnung: '', system: DATA.KS_SYSTEM[0],
        bauart: '', verbund: '', hersteller: 'unbekannt', bruchlast: '', anzahl: 1,
        einsatzdauer: '', einbauhoehe: '', astbasis: '', maengel: [],
        bewertung: 'funktionsfähig', bemerkung: ''
      });
      /* Befund K9 „vorhandene Kronensicherung" gehört dann zwingend gesetzt. */
      if (!b.befunde) b.befunde = { K: [], S: [], W: [], Wu: [], V: [] };
      if (b.befunde.K.indexOf('K9') < 0) b.befunde.K.push('K9');
      zeichneSymptome(b);
      sichern();
      ksBearbeiten(b.ks.length - 1);
    });
  }

  var ksIndex = null;

  /** Farbauswahl mit anschließender Jahreswahl. */
  function farbWahl(fertig) {
    var html = '<div class="hinweis" style="margin-bottom:12px">Welche Farbe hat die Kennung ' +
      'am Seil, der Endkappe oder dem Kennring?</div><div class="farbgitter">' +
      DATA.KS_FARBEN.map(function (f) {
        return '<div class="farbkachel" style="background:' + f.hex +
          (f.name === 'gelb' ? ';color:#3a2f00' : '') +
          '" onclick="App.farbJahre(' + esc(JSON.stringify(f.name)) + ')">' + esc(f.name) + '</div>';
      }).join('') + '</div>' +
      '<button class="btn zweit" onclick="App.farbJahre(\'\')">Farbe unbekannt</button>';
    ksFertig = fertig;
    blendeAuf('Jahresfarbe', html);
  }

  var ksFertig = null;

  /** Die vier plausiblen Einbaujahre mit Alter, Restlaufzeit und Ampel. */
  function farbJahre(farbe) {
    if (!farbe) { blendeZu(); if (ksFertig) ksFertig('', ''); return; }
    var jahre = DATA.ksJahre(farbe, jetztJahr()),
        html = '<div class="hinweis" style="margin-bottom:12px">' +
          'Der Farbzyklus wiederholt sich alle acht Jahre – genauso lang wie die ' +
          'Mindesteinsatzdauer nach ZTV. Deshalb sind mehrere Jahre möglich. ' +
          '<b>Aufgedruckte Jahreszahl gegenlesen, wenn vorhanden.</b></div>';

    html += jahre.map(function (j) {
      var alter = jetztJahr() - j,
          a = ksAmpel(j, 8);
      return '<button class="jahrzeile" onclick="App.farbJahrSetzen(' +
        esc(JSON.stringify(farbe)) + ',' + j + ')">' +
        '<span class="farbpunkt" style="background:' + ksFarbHex(farbe) + '"></span>' +
        '<b>' + j + '</b><span class="info">' +
        (alter === 0 ? 'dieses Jahr eingebaut' : 'vor ' + alter + (alter === 1 ? ' Jahr' : ' Jahren') + ' eingebaut') +
        '<br>bei 8 Jahren Einsatzdauer: ' + a.text + '</span>' +
        '<span class="ampel ' + a.klasse + '">' + (a.rest > 2 ? 'ok' : (a.rest >= 0 ? 'bald' : 'fällig')) +
        '</span></button>';
    }).join('');

    html += '<div class="feld" style="margin-top:12px"><label>Oder Jahr direkt eintragen</label>' +
      '<input type="number" id="ksJahrFrei" placeholder="' + jetztJahr() + '" inputmode="numeric"></div>' +
      '<button class="btn" onclick="App.farbJahrSetzen(' + esc(JSON.stringify(farbe)) +
      ', document.getElementById(\'ksJahrFrei\').value)">Übernehmen</button>';

    blendeAuf('Farbe ' + farbe + ' – mögliche Einbaujahre', html);
  }

  function farbJahrSetzen(farbe, jahr) {
    blendeZu();
    if (ksFertig) { var f = ksFertig; ksFertig = null; f(farbe, jahr ? String(jahr) : ''); }
  }

  /** Nachschlagewerk ohne Baumbezug. */
  function farbNachschlag() {
    farbWahl(function () { /* nur nachsehen, nichts übernehmen */ });
  }

  /* --- Erfassungsmaske --- */
  function ksBearbeiten(i) {
    ksIndex = i;
    var b = S.baeume[aktuellerBaum], k = b.ks[i];
    if (!k) return;
    var dauer = k.einsatzdauer || ksEinsatzdauer(k.hersteller),
        a = ksAmpel(k.einbaujahr, dauer),
        bem = k.astbasis ? DATA.ksBemessung(parseFloat(k.astbasis),
              /statisch/i.test(k.system || '')) : null;

    var html =
      '<div class="kszeile" style="margin-bottom:12px"><div class="kopf">' +
      '<span class="farbpunkt" style="background:' + ksFarbHex(k.farbe) + '"></span>' +
      '<b>' + (k.farbe ? 'Farbe ' + esc(k.farbe) : 'Farbe unbekannt') +
      (k.einbaujahr ? ', Einbau ' + esc(k.einbaujahr) : '') + '</b>' +
      '<span class="ampel ' + a.klasse + '">' + esc(a.text) + '</span></div>' +
      '<button class="btn klein zweit" style="margin:8px 0 0" onclick="App.ksFarbeAendern()">' +
      'Farbe oder Jahr ändern</button></div>' +

      '<div class="feld"><label>Bezeichnung</label><input id="ks_bezeichnung" value="' +
        esc(k.bezeichnung || '') + '" placeholder="z. B. Süd-Zwiesel"></div>' +
      '<div class="feld"><label>Systemtyp</label><select id="ks_system">' +
        opt(DATA.KS_SYSTEM, k.system) + '</select></div>' +
      '<div class="zeile"><div class="feld"><label>Bauart nach ZTV</label><select id="ks_bauart">' +
        opt(DATA.KS_BAUART, k.bauart, true) + '</select></div>' +
      '<div class="feld"><label>Verbundform</label><select id="ks_verbund">' +
        opt(DATA.KS_VERBUND, k.verbund, true) + '</select></div></div>' +
      '<div class="zeile"><div class="feld"><label>Hersteller</label><select id="ks_hersteller" ' +
        'onchange="App.ksHersteller()">' +
        opt(DATA.KS_HERSTELLER.map(function (h) { return h.name; }), k.hersteller) + '</select></div>' +
      '<div class="feld"><label>Einsatzdauer (Jahre)</label><input type="number" id="ks_einsatzdauer" ' +
        'value="' + esc(dauer) + '"></div></div>' +
      '<div class="zeile drei"><div class="feld"><label>Bruchlast (t)</label>' +
        '<input type="number" id="ks_bruchlast" step="0.1" value="' + esc(k.bruchlast || '') + '"></div>' +
      '<div class="feld"><label>Anzahl</label><input type="number" id="ks_anzahl" min="1" value="' +
        esc(k.anzahl || 1) + '"></div>' +
      '<div class="feld"><label>Einbauhöhe (m)</label><input type="number" id="ks_einbauhoehe" value="' +
        esc(k.einbauhoehe || '') + '"></div></div>' +
      '<div class="feld"><label>Ø an der Astbasis (cm)</label><input type="number" id="ks_astbasis" ' +
        'value="' + esc(k.astbasis || '') + '" oninput="App.ksBemessung(this.value)"></div>' +
      '<div class="hinweis" id="ksBemessung" style="margin:-6px 0 12px">' +
        (bem ? bemessungText(bem, k.bruchlast) : 'Aus dem Durchmesser leitet die App den ' +
         'Bemessungsvorschlag nach ZTV ab.') + '</div>' +

      '<div class="feld"><label>Mängel</label><div class="symliste" style="border:1px solid var(--rand);' +
        'border-radius:9px;padding:2px 0">' +
        DATA.KS_MAENGEL.map(function (m, mi) {
          var an = (k.maengel || []).indexOf(m) >= 0;
          return '<label class="' + (an ? 'an' : '') + '"><input type="checkbox" value="' + esc(m) + '"' +
            (an ? ' checked' : '') + ' onchange="App.ksMangel(this)">' + esc(m) + '</label>';
        }).join('') + '</div></div>' +

      '<div class="feld"><label>Bewertung</label><select id="ks_bewertung">' +
        opt(DATA.KS_BEWERTUNG, k.bewertung) + '</select></div>' +
      '<div class="feld"><label>Bemerkung</label><textarea id="ks_bemerkung">' +
        esc(k.bemerkung || '') + '</textarea></div>' +
      '<button class="btn" onclick="App.ksSpeichern()">Übernehmen</button>';

    blendeAuf('Kronensicherung', html);
  }

  function opt(werte, gewaehlt, leer) {
    return (leer ? '<option value="">– keine Angabe –</option>' : '') +
      werte.map(function (w) {
        return '<option value="' + esc(w) + '"' + (w === gewaehlt ? ' selected' : '') + '>' +
          esc(w) + '</option>';
      }).join('');
  }

  function bemessungText(vorschlag, eingebaut) {
    var t = 'Bemessungsvorschlag nach ZTV: <b>' + vorschlag + ' t</b>';
    var e = parseFloat(eingebaut);
    if (e && e < vorschlag) t += ' – die eingetragene Bruchlast von ' + e + ' t liegt darunter.';
    return t;
  }

  function ksBemessungAnzeige(wert) {
    var d = parseFloat(wert), f = el('ksBemessung');
    if (!f) return;
    if (!d) { f.textContent = 'Aus dem Durchmesser leitet die App den Bemessungsvorschlag nach ZTV ab.'; return; }
    var statisch = /statisch/i.test(feldWert('ks_system') || '');
    f.innerHTML = bemessungText(DATA.ksBemessung(d, statisch), feldWert('ks_bruchlast'));
  }

  function ksHersteller() {
    var dauer = ksEinsatzdauer(feldWert('ks_hersteller'));
    setzeFeld('ks_einsatzdauer', dauer);
  }

  function ksMangel(box) {
    box.parentNode.className = box.checked ? 'an' : '';
  }

  function ksFarbeAendern() {
    var i = ksIndex;
    farbWahl(function (farbe, jahr) {
      var k = S.baeume[aktuellerBaum].ks[i];
      k.farbe = farbe; k.einbaujahr = jahr;
      sichern();
      ksBearbeiten(i);
    });
  }

  function ksSpeichern() {
    var b = S.baeume[aktuellerBaum], k = b.ks[ksIndex];
    if (!k) { blendeZu(); return; }
    ['bezeichnung','system','bauart','verbund','hersteller','einsatzdauer','bruchlast',
     'anzahl','einbauhoehe','astbasis','bewertung','bemerkung'].forEach(function (f) {
      k[f] = feldWert('ks_' + f);
    });
    k.maengel = [];
    Array.prototype.forEach.call(
      document.querySelectorAll('.blende .symliste input:checked'),
      function (i) { k.maengel.push(i.value); });
    blendeZu();
    zeichneKS(b);
    sichern();
  }

  function ksWeg(i) {
    var b = S.baeume[aktuellerBaum];
    b.ks.splice(i, 1);
    zeichneKS(b);
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
  /** Objektstandort – hilft beim Wiederfinden der Anlage, nicht des Baumes. */
  function gpsObjekt() {
    if (!navigator.geolocation) { melde('Dieses Gerät liefert keine Position.'); return; }
    melde('Position wird ermittelt …');
    navigator.geolocation.getCurrentPosition(function (p) {
      S.auftrag.gpsLat = p.coords.latitude.toFixed(5);
      S.auftrag.gpsLon = p.coords.longitude.toFixed(5);
      objektGpsAnzeige();
      sichern();
      melde('Objektstandort übernommen (± ' + Math.round(p.coords.accuracy) + ' m).');
    }, function () {
      melde('Position nicht verfügbar. Standortfreigabe prüfen.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }

  function objektGpsAnzeige() {
    var f = el('objektGps'), a = S.auftrag;
    if (!f) return;
    f.innerHTML = (a.gpsLat && a.gpsLon)
      ? 'Erfasst: ' + esc(a.gpsLat) + ' N · ' + esc(a.gpsLon) + ' E' +
        ' <button class="btn klein zweit" style="margin-left:6px;padding:4px 9px;min-height:30px" ' +
        'onclick="App.gpsObjektWeg()">entfernen</button>'
      : 'Noch kein Objektstandort erfasst.';
  }

  function gpsObjektWeg() {
    S.auftrag.gpsLat = ''; S.auftrag.gpsLon = '';
    objektGpsAnzeige(); sichern();
  }

  function gpsAnzeige() {
    var lat = feldWert('b_gpsLat'), lon = feldWert('b_gpsLon'), f = el('gpsAnzeige');
    if (f) f.textContent = (lat && lon) ? ('Erfasst: ' + lat + ' N · ' + lon + ' E') : '';
  }

  function gps() {
    if (!navigator.geolocation) { melde('Dieses Gerät liefert keine Position.'); return; }
    melde('Position wird ermittelt …');
    navigator.geolocation.getCurrentPosition(function (p) {
      setzeFeld('b_gpsLat', p.coords.latitude.toFixed(5));
      setzeFeld('b_gpsLon', p.coords.longitude.toFixed(5));
      gpsAnzeige();
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

  function blendeZu() {
    el('blende').classList.remove('an');
    /* Inhalt kurz danach leeren – sonst hängen alte Felder im DOM und
       Selektoren greifen auf Reste einer geschlossenen Einblendung zu. */
    setTimeout(function () {
      if (!blendeOffen()) el('blendeInhalt').innerHTML = '';
    }, 250);
  }
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
    a.qualifikationVoll = qualifikationText(S.auftrag);
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
          standort: [b.lage || b.strasse, b.hausNr].filter(Boolean).join(' '),
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
    richtungZeigen();
    objektGpsAnzeige();
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
    gemeinsamLaden();

    fuelleSelect('a_qualifikation', DATA.QUALIFIKATIONEN.concat(['sonstige']));
    fuelleSelect('a_kontrollart', DATA.KONTROLLART);
    fuelleSelect('a_belaubung', DATA.BELAUBUNG);
    fuelleSelect('a_witterung', DATA.WITTERUNG);
    fuelleSelect('b_umfeld', DATA.UMFELD, '– bitte wählen –');
    fuelleSelect('b_phase', DATA.PHASEN);
    fuelleSelect('b_zustand', DATA.ZUSTAENDE);
    fuelleSelect('b_erwartung', DATA.ERWARTUNG);
    fuelleSelect('b_roloff', DATA.ROLOFF);
    fuelleSelect('b_intervall', ['halbjährlich', 'jährlich', '2 Jahre', '3 Jahre',
                                 'keine gesonderte RK']);

    /* Die Aufträge liegen in IndexedDB, das Lesen läuft asynchron.
       Erst danach steht fest, was gezeichnet wird. */
    auftragStarten();

    /* Tastatur auf oder zu: die Vorschlagsliste neu einpassen. */
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () {
        if (!el('artVorschlaege').hidden) { artHoehe(); artInsBild(); }
      });
    }

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
     'a_belaubung','a_witterung','a_kontrolleur','a_qualifikation',
     'a_qualifikationFrei'].forEach(function (id) {
      el(id).addEventListener('change', function () { auftragLesen(); sichern(); });
    });
    el('a_qualifikation').addEventListener('change', qualFreitext);
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
    artOeffnen: artOeffnen, artTippen: artTippen, artSetzen: artSetzen,
    artChip: artChip, artFertig: artFertig, neueFassung: neueFassung,
    symptomWechsel: symptomWechsel, symGruppe: symGruppeWechsel,
    grenzeAnfuegen: grenzeAnfuegen,
    massnahmeNeu: massnahmeNeu, massnahmeStufe: massnahmeStufe, massnahmeAnlegen: massnahmeAnlegen,
    massnahmeFeld: massnahmeFeld, massnahmeWeg: massnahmeWeg,
    fotoWeg: fotoWeg, gps: gps, gpsObjekt: gpsObjekt, gpsObjektWeg: gpsObjektWeg,
    mehr: mehr, richtung: richtung,
    ksNeu: ksNeu, ksBearbeiten: ksBearbeiten, ksSpeichern: ksSpeichern, ksWeg: ksWeg,
    ksHersteller: ksHersteller, ksMangel: ksMangel, ksFarbeAendern: ksFarbeAendern,
    ksBemessung: ksBemessungAnzeige, farbNachschlag: farbNachschlag,
    farbJahre: farbJahre, farbJahrSetzen: farbJahrSetzen,
    blendeAuf: blendeAuf, blendeZu: blendeZu,
    pdf: pdf, excel: excel, excelKalkulation: excelKalkulation,
    angebot: angebot, auftragswert: auftragswert, posten: posten,
    sevKopieren: sevKopieren, sevCsv: sevCsv, sevProdukte: sevProdukte,
    sevPositionen: sevPositionen, sevText: sevText, zeichneAusgabe: zeichneAusgabe,
    zeichneKunden: zeichneKunden, kundeNeu: kundeNeu, kundeSpeichern: kundeSpeichern,
    kundeOeffnen: kundeOeffnen,
    auftragWechsel: auftragWechsel, auftragOeffnen: auftragOeffnen, auftragNeu: auftragNeu,
    auftragWegFrage: auftragWegFrage, auftragWeg: auftragWeg,
    sicherungExport: sicherungExport, importAusfuehren: importAusfuehren,
    einstellungenSpeichern: einstellungenSpeichern,
    papierkorbZurueck: papierkorbZurueck, papierkorbLeeren: papierkorbLeeren,
    allesZuruecksetzen: allesZuruecksetzen, zuruecksetzenAusfuehren: zuruecksetzenAusfuehren,
    preisliste: preislisteBearbeiten, preisSetzen: preisSetzen, preiseZuruecksetzen: preiseZuruecksetzen,
    _zustand: function () { return S; }
  };
})();

document.addEventListener('DOMContentLoaded', App.start);
