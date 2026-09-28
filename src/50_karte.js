/* =============================================================================
 * Karte – die Bäume eines Auftrags auf Luftbild oder Stadtplan.
 *
 * Die Karte ist Zugabe, nie Voraussetzung. Die Aufnahme läuft ohne sie
 * vollständig durch. Kacheln kommen über SIM oder Hotspot aus dem Netz. Ohne
 * Netz bleibt die Fläche grau, die Marken stehen trotzdem richtig zueinander
 * und lassen sich verschieben. Gespeichert wird in den Baum, nicht in die
 * Karte, deshalb geht auch bei grauer Fläche nichts verloren.
 *
 * Zwei Wege zum Standort:
 *   1. am Baum stehend „Standort per GPS übernehmen" im Baumformular
 *   2. hinterher auf der Karte: Baum wählen, auf die Stelle tippen
 * Der zweite Weg ist der schnellere, wenn man einen Bestand erst aufnimmt und
 * danach im Auto verortet.
 * ========================================================================== */
var Karte = (function () {
  'use strict';

  var EBENEN = {
    luftbild: {
      name: 'Luftbild',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      dank: 'Luftbild: Esri, Maxar, Earthstar Geographics',
      maxZoom: 21, maxNativeZoom: 19
    },
    strasse: {
      name: 'Stadtplan',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      dank: '&copy; OpenStreetMap-Mitwirkende',
      maxZoom: 20, maxNativeZoom: 19
    }
  };

  var SPEICHER = 'baumkontrolle.karte';

  var NAMEN_AB = 17;       /* darunter kleben die Schilder übereinander */

  var karte = null,        /* die Leaflet-Instanz, erst bei Sichtbarkeit */
      kachel = null,
      marken = [],         /* {i, marker} je verortetem Baum */
      ortMarke = null,     /* die eigene Position */
      ebeneName = 'luftbild',
      setzZiel = null,     /* Index des Baums, der gerade gesetzt wird */
      namenAn = true,
      wachAus = null,
      schonGerahmt = false;

  function el(id) { return document.getElementById(id); }

  function baeume() {
    try { return App._zustand().baeume || []; } catch (e) { return []; }
  }

  function zahl(w) {
    var n = parseFloat(String(w == null ? '' : w).replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  /** Bäume mit brauchbaren Koordinaten, mit ihrem Index in der Liste. */
  function verortet() {
    var raus = [];
    baeume().forEach(function (b, i) {
      var lat = zahl(b.gpsLat), lon = zahl(b.gpsLon);
      if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        raus.push({ i: i, b: b, lat: lat, lon: lon });
      }
    });
    return raus;
  }

  function ohneOrt() {
    var raus = [];
    baeume().forEach(function (b, i) {
      if (zahl(b.gpsLat) === null || zahl(b.gpsLon) === null) raus.push({ i: i, b: b });
    });
    return raus;
  }

  function farbe(b) {
    if (b.zustand === 'stärker geschädigt') return 'm-rot';
    if (b.zustand === 'leicht geschädigt') return 'm-gelb';
    if (b.zustand === 'gesund') return 'm-gruen';
    return '';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------------------------------------------------------------------------
   * Aufbau
   * ---------------------------------------------------------------------- */
  function gemerkteEbene() {
    try {
      var w = localStorage.getItem(SPEICHER);
      if (w && EBENEN[w]) ebeneName = w;
      namenAn = localStorage.getItem(SPEICHER + '.namen') !== '0';
    } catch (e) { /* Speicher gesperrt, dann eben Luftbild mit Namen */ }
  }

  function erzeugen() {
    var box = el('kartenbox');
    if (!box || typeof L === 'undefined') return null;
    /* In einem unsichtbaren Kasten misst Leaflet 0 und rechnet danach falsch.
       Deshalb erst bauen, wenn der Kasten wirklich auf dem Schirm steht. */
    if (!box.offsetWidth) return null;

    gemerkteEbene();
    karte = L.map(box, {
      zoomControl: true,
      attributionControl: true,
      tap: true,
      /* Fingerzoom ja, Doppeltipp-Zoom nein: beim Setzen eines Baums tippt man
         schnell zweimal und würde sonst ungewollt hineinzoomen. */
      doubleClickZoom: false
    }).setView([49.676, 9.003], 16);   /* Michelstadt, bis etwas Besseres da ist */

    kachelSetzen();
    karte.on('click', aufKarteGetippt);
    karte.on('zoomend', namenPruefen);
    namenPruefen();
    return karte;
  }

  /** Namensschilder nur, wo sie sich nicht gegenseitig zudecken. */
  function namenPruefen() {
    if (!karte) return;
    var aus = !namenAn || karte.getZoom() < NAMEN_AB;
    karte.getContainer().classList.toggle('ohne-namen', aus);
  }

  function namen() {
    namenAn = !namenAn;
    try { localStorage.setItem(SPEICHER + '.namen', namenAn ? '1' : '0'); } catch (e) { /* egal */ }
    namenPruefen();
    fussZeichnen();
  }

  function kachelSetzen() {
    var e = EBENEN[ebeneName];
    if (kachel) karte.removeLayer(kachel);
    kachel = L.tileLayer(e.url, {
      maxZoom: e.maxZoom, maxNativeZoom: e.maxNativeZoom, attribution: e.dank
    });
    kachel.addTo(karte);
  }

  function ebene(name) {
    if (!EBENEN[name] || name === ebeneName) return;
    ebeneName = name;
    try { localStorage.setItem(SPEICHER, name); } catch (e) { /* egal */ }
    if (karte) kachelSetzen();
    fussZeichnen();
  }

  /* -------------------------------------------------------------------------
   * Marken
   * ---------------------------------------------------------------------- */
  function marke(eintrag) {
    var b = eintrag.b,
        /* Die Marke trägt die Nummer, das Schild daneben die Art und die Höhe.
           Zusammen liest man den Bestand von der Karte ab, ohne jeden Punkt
           einzeln antippen zu müssen. */
        schild = '<div class="baumschild">' + esc(b.artDt || 'ohne Art') +
                 (b.hoehe ? '<span class="h">' + esc(b.hoehe) + ' m</span>' : '') + '</div>',
        m = L.marker([eintrag.lat, eintrag.lon], {
          draggable: true,
          autoPan: true,
          icon: L.divIcon({
            className: '',
            html: '<div class="baummarke ' + farbe(b) + '">' +
                  esc(b.nr || (eintrag.i + 1)) + '</div>' + schild,
            iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14]
          })
        });

    m.bindPopup(steckbrief(eintrag));
    m.on('dragend', function () {
      var p = m.getLatLng();
      ortSpeichern(eintrag.i, p.lat, p.lng);
      melde('Baum ' + (b.nr || (eintrag.i + 1)) + ' verschoben.');
    });
    return m;
  }

  function steckbrief(eintrag) {
    var b = eintrag.b,
        fakten = [b.hoehe ? b.hoehe + ' m' : '', b.stammumfang ? b.stammumfang + ' cm' : '',
                  b.zustand || ''].filter(Boolean).join(' · ');
    return '<b>' + esc(b.nr || (eintrag.i + 1)) + ' · ' + esc(b.artDt || 'ohne Art') + '</b>' +
      esc(fakten || 'noch nichts erfasst') +
      '<br><button onclick="Karte.oeffnen(' + eintrag.i + ')">Baum öffnen</button>';
  }

  function oeffnen(i) {
    if (karte) karte.closePopup();
    App.baumOeffnen(i);
  }

  /** Alles neu setzen. Billig genug: ein Auftrag hat selten mehr als hundert
   *  Bäume, und nach jedem Speichern kann sich Nummer, Zustand und Ort ändern. */
  function zeichne() {
    if (!karte) return;
    marken.forEach(function (m) { karte.removeLayer(m.marker); });
    marken = [];
    verortet().forEach(function (eintrag) {
      var m = marke(eintrag);
      m.addTo(karte);
      marken.push({ i: eintrag.i, marker: m });
    });
    fussZeichnen();
    if (!schonGerahmt && marken.length) { rahmen(); schonGerahmt = true; }
  }

  /* -------------------------------------------------------------------------
   * Einen bestimmten Baum zeigen
   *
   * Der Weg von der Liste zur Karte. Auf dem Tablet fehlt der Mauszeiger,
   * deshalb ist das Antippen der Nummer in der Liste die eigentliche
   * Verbindung zwischen beiden Ansichten.
   * ---------------------------------------------------------------------- */
  function hin(i) {
    sichtbar();
    if (!karte) return;
    var ziel = null;
    verortet().forEach(function (e) { if (e.i === i) ziel = e; });
    if (!ziel) return;
    karte.setView([ziel.lat, ziel.lon], Math.max(karte.getZoom(), 19), { animate: true });
    wach(i, true);
  }

  /** Eine Marke hervorheben. Mit `kurz` erlischt sie von selbst wieder,
   *  das ist der Fall nach dem Antippen. Beim Zeiger bleibt sie, solange
   *  er darauf steht. */
  function wach(i, kurz) {
    if (wachAus) { clearTimeout(wachAus); wachAus = null; }
    marken.forEach(function (m) {
      var e = m.marker.getElement();
      if (e) e.classList.toggle('wach', m.i === i);
    });
    if (kurz) wachAus = setTimeout(function () { wach(null); }, 2800);
  }

  /** Kartenausschnitt über alle Bäume. */
  function rahmen() {
    var liste = verortet();
    if (!karte || !liste.length) return;
    if (liste.length === 1) { karte.setView([liste[0].lat, liste[0].lon], 19); return; }
    karte.fitBounds(liste.map(function (e) { return [e.lat, e.lon]; }), { padding: [40, 40], maxZoom: 20 });
  }

  /* -------------------------------------------------------------------------
   * Fußzeile: Zählerstand und die zwei Knöpfe, die man draußen braucht
   * ---------------------------------------------------------------------- */
  function fussZeichnen() {
    var f = el('kartenfuss');
    if (!f) return;
    var mit = verortet().length, fehlt = ohneOrt(), teile = [];

    var zaehler = el('kartenZahl');
    if (zaehler) zaehler.textContent = baeume().length ? '(' + mit + '/' + baeume().length + ')' : '';

    if (setzZiel !== null) {
      var b = baeume()[setzZiel];
      f.innerHTML = '<span class="wartet">Auf die Stelle tippen, wo Baum ' +
        esc(b ? (b.nr || (setzZiel + 1)) : '?') + ' steht.</span>' +
        '<button onclick="Karte.abbrechen()">Abbrechen</button>';
      return;
    }

    teile.push('<button onclick="Karte.ebene(\'' +
      (ebeneName === 'luftbild' ? 'strasse' : 'luftbild') + '\')">' +
      (ebeneName === 'luftbild' ? 'Stadtplan' : 'Luftbild') + '</button>');
    teile.push('<button onclick="Karte.aufMich()">Mein Standort</button>');
    if (mit) teile.push('<button onclick="Karte.rahmen()">Alle zeigen</button>');
    if (mit) teile.push('<button onclick="Karte.namen()">Namen ' +
      (namenAn ? 'aus' : 'an') + '</button>');

    if (fehlt.length) {
      teile.push('<button onclick="Karte.setzen()">Baum ' +
        esc(fehlt[0].b.nr || (fehlt[0].i + 1)) + ' setzen</button>');
      teile.push('<span>' + fehlt.length +
        (fehlt.length === 1 ? ' Baum ohne Standort' : ' Bäume ohne Standort') + '</span>');
    } else if (mit) {
      teile.push('<span>Alle Bäume verortet.</span>');
    }
    f.innerHTML = teile.join('');
  }

  /* -------------------------------------------------------------------------
   * Baum verorten
   * ---------------------------------------------------------------------- */
  function setzen(i) {
    /* Kommt der Ruf aus dem Baumformular, steht die Karte vielleicht noch gar
       nicht. Erst bauen lassen, dann scharf schalten. */
    sichtbar();
    var offen = ohneOrt();
    setzZiel = (i === undefined || i === null) ? (offen.length ? offen[0].i : null) : i;
    if (setzZiel === null) { melde('Alle Bäume haben einen Standort.'); return; }
    fussZeichnen();
  }

  function abbrechen() { setzZiel = null; fussZeichnen(); }

  function aufKarteGetippt(e) {
    if (setzZiel === null) return;
    var i = setzZiel, b = baeume()[i];
    ortSpeichern(i, e.latlng.lat, e.latlng.lng);
    melde('Baum ' + (b ? (b.nr || (i + 1)) : '') + ' gesetzt.');
    /* Gleich mit dem nächsten weitermachen. Wer einen Bestand nachträglich
       verortet, will nicht nach jedem Baum neu auf einen Knopf tippen. */
    var offen = ohneOrt();
    setzZiel = offen.length ? offen[0].i : null;
    zeichne();
  }

  function ortSpeichern(i, lat, lon) {
    if (typeof App.baumOrt === 'function') App.baumOrt(i, lat.toFixed(6), lon.toFixed(6));
  }

  /* -------------------------------------------------------------------------
   * Eigener Standort
   * ---------------------------------------------------------------------- */
  function aufMich() {
    if (!karte) return;
    if (!navigator.geolocation) { melde('Dieses Gerät liefert keine Position.'); return; }
    melde('Position wird ermittelt …');
    navigator.geolocation.getCurrentPosition(function (p) {
      var ll = [p.coords.latitude, p.coords.longitude];
      if (ortMarke) karte.removeLayer(ortMarke);
      ortMarke = L.marker(ll, {
        icon: L.divIcon({ className: '', html: '<div class="meinort"></div>',
                          iconSize: [14, 14], iconAnchor: [7, 7] }),
        interactive: false, zIndexOffset: -100
      }).addTo(karte);
      karte.setView(ll, Math.max(karte.getZoom(), 18));
      melde('Standort ± ' + Math.round(p.coords.accuracy) + ' m.');
    }, function () {
      melde('Position nicht verfügbar. Standortfreigabe prüfen.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000 });
  }

  function melde(text) {
    if (window.App && typeof App.melde === 'function') App.melde(text);
  }

  /* -------------------------------------------------------------------------
   * Von der App gerufen
   * ---------------------------------------------------------------------- */

  /** Der Kasten ist jetzt sichtbar. Beim ersten Mal wird die Karte gebaut,
   *  danach muss Leaflet nur neu messen. */
  function sichtbar() {
    var box = el('kartenbox');
    /* Auf dem Telefon steht statt der Karte die Liste, dann hat der Kasten
       keine Breite. Nichts tun ist hier richtig, nicht blind neu messen. */
    if (!box || !box.offsetWidth) return;
    if (!karte) {
      if (!erzeugen()) return;
      zeichne();
      if (!marken.length) starthilfe();
      return;
    }
    karte.invalidateSize();
    zeichne();
  }

  /** Ohne einen einzigen verorteten Baum weiß die Karte nicht, wohin. Dann
   *  zählt der Objektstandort aus dem Auftrag, sonst die eigene Position. */
  function starthilfe() {
    var a = {};
    try { a = App._zustand().auftrag || {}; } catch (e) { /* noch kein Auftrag */ }
    var lat = zahl(a.gpsLat), lon = zahl(a.gpsLon);
    if (lat !== null && lon !== null) { karte.setView([lat, lon], 18); return; }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (p) {
      if (karte && !verortet().length) karte.setView([p.coords.latitude, p.coords.longitude], 18);
    }, function () { /* kein Standort, dann bleibt der Voreinstellung */ },
       { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 });
  }

  /** Auftragswechsel: Ausschnitt darf neu bestimmt werden. */
  function zuruecksetzen() { schonGerahmt = false; setzZiel = null; }

  return {
    sichtbar: sichtbar, zeichne: zeichne, rahmen: rahmen, ebene: ebene,
    aufMich: aufMich, setzen: setzen, abbrechen: abbrechen, oeffnen: oeffnen,
    zuruecksetzen: zuruecksetzen, hin: hin, wach: wach, namen: namen,
    _da: function () { return !!karte; },
    _karte: function () { return karte; }   /* nur fuer die Testlaeufe */
  };
})();
