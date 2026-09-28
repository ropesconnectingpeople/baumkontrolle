/* =============================================================================
 * 05_db.js  –  Ablage der Aufträge in IndexedDB
 * Baumkontrolltool Hundertmark
 *
 * Warum nicht localStorage, wie bisher alles andere:
 * localStorage fasst rund 4 MB. Ein Foto wiegt als Base64 etwa 600 KB, also
 * ist nach sechs, sieben Bäumen Schluss. Die Kontrolle Fürstenauer Forst mit
 * 17 Bäumen kam auf 14,1 MB. Ab der Grenze hat die App nichts mehr
 * weggeschrieben und die Erfassung lebte nur noch im Arbeitsspeicher.
 *
 * IndexedDB hat diese Grenze nicht, auf dem Gerät stehen dort mehrere hundert
 * MB zur Verfügung. Der Preis ist, dass alles asynchron läuft.
 *
 * Bewusst klein gehalten: ein Speicher, vier Zugriffe, keine Bibliothek.
 * ========================================================================== */

var DB = (function () {
  'use strict';

  var NAME = 'baumkontrolle', LAGER = ['auftraege', 'kunden'], FASSUNG = 2;
  var db = null, kaputt = false, wartend = null;

  function oeffnen(fertig) {
    if (db) return fertig(db);
    if (kaputt || !window.indexedDB) return fertig(null);
    /* Mehrere Zugriffe kurz nach dem Start dürfen nicht jeweils ihre eigene
       Verbindung aufmachen, sonst kommen sie sich gegenseitig in die Quere. */
    if (wartend) { wartend.push(fertig); return; }
    wartend = [fertig];

    function alleBenachrichtigen(d) {
      var w = wartend;
      wartend = null;
      w.forEach(function (f) { f(d); });
    }

    var a;
    try { a = window.indexedDB.open(NAME, FASSUNG); }
    catch (e) { kaputt = true; return alleBenachrichtigen(null); }

    a.onupgradeneeded = function (e) {
      var d = e.target.result;
      LAGER.forEach(function (n) {
        if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: 'id' });
      });
    };
    a.onsuccess = function () { db = a.result; alleBenachrichtigen(db); };
    /* Im privaten Modus mancher Browser wirft das Öffnen. Dann fällt die App
       auf localStorage zurück, statt gar nicht zu starten. */
    a.onerror = a.onblocked = function () { kaputt = true; alleBenachrichtigen(null); };
  }

  /** Eine Transaktion, ein Zugriff, ein Rückruf mit (fehler, ergebnis). */
  function zugriff(lager, art, arbeit, fertig) {
    fertig = fertig || function () {};
    oeffnen(function (d) {
      if (!d) return fertig(new Error('IndexedDB nicht verfügbar'), null);
      var t, anfrage, ergebnis = null;
      try {
        t = d.transaction(lager, art);
        anfrage = arbeit(t.objectStore(lager));
      } catch (e) { return fertig(e, null); }
      if (anfrage) anfrage.onsuccess = function () { ergebnis = anfrage.result; };
      t.oncomplete = function () { fertig(null, ergebnis); };
      t.onerror = t.onabort = function () { fertig(t.error || new Error('Schreibfehler'), null); };
    });
  }

  /** Ein Zugriffspaket je Lager, damit die App nicht überall den Namen mitschleppt. */
  function lager(n) {
    return {
      lesen:     function (id, f)  { zugriff(n, 'readonly',  function (s) { return s.get(id); }, f); },
      alle:      function (f)      { zugriff(n, 'readonly',  function (s) { return s.getAll(); }, f); },
      schreiben: function (rec, f) { zugriff(n, 'readwrite', function (s) { return s.put(rec); }, f); },
      loeschen:  function (id, f)  { zugriff(n, 'readwrite', function (s) { return s['delete'](id); }, f); }
    };
  }

  var auftraege = lager('auftraege');

  return {
    /* Die Auftragszugriffe bleiben direkt erreichbar, das spart Umbau im Bestand. */
    lesen: auftraege.lesen, alle: auftraege.alle,
    schreiben: auftraege.schreiben, loeschen: auftraege.loeschen,
    kunden:  lager('kunden'),
    nutzbar: function () { return !!window.indexedDB && !kaputt; }
  };
})();
