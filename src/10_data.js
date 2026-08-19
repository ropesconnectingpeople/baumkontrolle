/* =============================================================================
 * 10_data.js  –  Stammdaten und Kataloge
 * Baumkontrolltool Hundertmark
 *
 * Fachgrundlage: FLL-Baumkontrollrichtlinien, 3. Ausgabe 2020,
 * GALK-Musterdienstanweisung 2021, ZTV-Baumpflege 2017.
 * ========================================================================== */

var DATA = (function () {
  'use strict';

  /* --- Baumarten. Deutsch, botanisch, Lebenserwartung in Jahren ----------- */
  var ARTEN = [
    ['Bergahorn', 'Acer pseudoplatanus', 300], ['Spitzahorn', 'Acer platanoides', 200],
    ['Feldahorn', 'Acer campestre', 150], ['Silberahorn', 'Acer saccharinum', 130],
    ['Eschenahorn', 'Acer negundo', 100], ['Rosskastanie', 'Aesculus hippocastanum', 200],
    ['Rotblühende Rosskastanie', 'Aesculus × carnea', 150],
    ['Schwarzerle', 'Alnus glutinosa', 120], ['Grauerle', 'Alnus incana', 100],
    ['Sandbirke', 'Betula pendula', 100], ['Moorbirke', 'Betula pubescens', 100],
    ['Hainbuche', 'Carpinus betulus', 150], ['Edelkastanie', 'Castanea sativa', 400],
    ['Trompetenbaum', 'Catalpa bignonioides', 100], ['Zürgelbaum', 'Celtis australis', 200],
    ['Blutbuche', 'Fagus sylvatica f. purpurea', 250], ['Rotbuche', 'Fagus sylvatica', 250],
    ['Gemeine Esche', 'Fraxinus excelsior', 250], ['Blumenesche', 'Fraxinus ornus', 100],
    ['Ginkgo', 'Ginkgo biloba', 500], ['Lederhülsenbaum', 'Gleditsia triacanthos', 120],
    ['Walnuss', 'Juglans regia', 150], ['Goldregen', 'Laburnum anagyroides', 60],
    ['Amberbaum', 'Liquidambar styraciflua', 150], ['Tulpenbaum', 'Liriodendron tulipifera', 200],
    ['Apfel', 'Malus domestica', 80], ['Zierapfel', 'Malus spec.', 60],
    ['Maulbeere', 'Morus alba', 150], ['Platane', 'Platanus × hispanica', 300],
    ['Zitterpappel', 'Populus tremula', 80], ['Schwarzpappel', 'Populus nigra', 150],
    ['Silberpappel', 'Populus alba', 120], ['Hybridpappel', 'Populus × canadensis', 80],
    ['Süßkirsche', 'Prunus avium', 100], ['Traubenkirsche', 'Prunus padus', 80],
    ['Blutpflaume', 'Prunus cerasifera Nigra', 60], ['Zierkirsche', 'Prunus serrulata', 60],
    ['Stieleiche', 'Quercus robur', 600], ['Traubeneiche', 'Quercus petraea', 600],
    ['Roteiche', 'Quercus rubra', 250], ['Sumpfeiche', 'Quercus palustris', 200],
    ['Säuleneiche', 'Quercus robur Fastigiata', 300],
    ['Robinie', 'Robinia pseudoacacia', 150], ['Silberweide', 'Salix alba', 100],
    ['Salweide', 'Salix caprea', 60], ['Trauerweide', 'Salix × sepulcralis', 80],
    ['Vogelbeere', 'Sorbus aucuparia', 100], ['Mehlbeere', 'Sorbus aria', 120],
    ['Schwedische Mehlbeere', 'Sorbus intermedia', 100], ['Elsbeere', 'Sorbus torminalis', 200],
    ['Winterlinde', 'Tilia cordata', 800], ['Sommerlinde', 'Tilia platyphyllos', 800],
    ['Silberlinde', 'Tilia tomentosa', 300], ['Krimlinde', 'Tilia × euchlora', 200],
    ['Bergulme', 'Ulmus glabra', 200], ['Feldulme', 'Ulmus minor', 200],
    ['Weißtanne', 'Abies alba', 400], ['Europäische Lärche', 'Larix decidua', 400],
    ['Fichte', 'Picea abies', 300], ['Waldkiefer', 'Pinus sylvestris', 400],
    ['Schwarzkiefer', 'Pinus nigra', 400], ['Douglasie', 'Pseudotsuga menziesii', 400],
    ['Eibe', 'Taxus baccata', 1000], ['Lebensbaum', 'Thuja occidentalis', 150],
    ['Sumpfzypresse', 'Taxodium distichum', 400], ['Mammutbaum', 'Sequoiadendron giganteum', 1000]
  ];

  /* --- FLL-Einstufungen ---------------------------------------------------
   * Die FLL kennt keine „Zerfallsphase" – der Begriff stammt aus der
   * Fachliteratur, nicht aus der Richtlinie.
   * -------------------------------------------------------------------- */
  var PHASEN     = ['Jugendphase', 'Reifephase', 'Alterungsphase'];
  var ZUSTAENDE  = ['gesund', 'leicht geschädigt', 'stärker geschädigt'];
  var ERWARTUNG  = ['geringer', 'höher'];
  var ROLOFF     = ['', '0 – Exploration', '1 – Degeneration', '2 – Stagnation', '3 – Resignation'];
  var KONTROLLART= ['Regelkontrolle', 'Zusatzkontrolle', 'Baumuntersuchung'];
  var BELAUBUNG  = ['belaubt', 'unbelaubt', 'Laubaustrieb', 'Herbstfärbung', 'immergrün'];

  /* Zustandsdefinitionen wörtlich nach FLL, für die Hilfe in der App. */
  var ZUSTAND_HILFE = {
    'gesund': 'Keine Schäden erkennbar.',
    'leicht geschädigt': 'Schäden, die sich voraussichtlich bis zur nächsten Regelkontrolle nicht auf die Verkehrssicherheit auswirken werden.',
    'stärker geschädigt': 'Schäden, die sich voraussichtlich innerhalb eines Jahres nicht auf die Verkehrssicherheit auswirken werden.'
  };

  /* --- Intervallmatrix ----------------------------------------------------
   * Rekonstruiert aus GALK-Musterdienstanweisung 2021. Vor Produktivnutzung
   * gegen Tabelle 1, S. 28 der Originalrichtlinie prüfen.
   * -------------------------------------------------------------------- */
  function intervall(phase, zustand, erwartung) {
    var schwer = (zustand === 'stärker geschädigt');
    if (phase === 'Jugendphase') {
      return schwer ? 'jährlich' : 'keine gesonderte RK';
    }
    if (schwer) return 'jährlich';
    if (phase === 'Reifephase')     return erwartung === 'höher' ? '2 Jahre' : '3 Jahre';
    if (phase === 'Alterungsphase') return erwartung === 'höher' ? 'jährlich' : '2 Jahre';
    return '2 Jahre';
  }

  function intervallJahre(txt) {
    if (/jähr/i.test(txt)) return 1;
    var m = /(\d+)/.exec(txt || '');
    return m ? parseInt(m[1], 10) : 0;
  }

  function intervallGrundlage(txt) {
    if (/jähr/i.test(txt))  return 'stärker geschädigt oder Alterungsphase bei höherer Sicherheitserwartung';
    if (/^2/.test(txt))     return 'Reifephase mit höherer bzw. Alterungsphase mit geringerer Sicherheitserwartung';
    if (/^3/.test(txt))     return 'Reifephase, geringere Sicherheitserwartung';
    return 'Jugendphase bei bedarfsgerechter Jungbaumpflege nach ZTV-Baumpflege';
  }

  /* --- Schadsymptomkatalog, gegliedert nach Baumteilen -------------------- */
  var SYMPTOME = {
    K:  { titel: 'Krone', codes: [
      'Astab-/Astausbrüche', 'Astrisse', 'Astungswunden / -fäulen', 'baumfremder Bewuchs (z. B. Mistel)',
      'auffällige Belaubung', 'Fehlentwicklungen in der Krone', 'Höhlungen', 'Kappungsstellen',
      'vorhandene Kronensicherung', 'Lichtraumprofil', 'Pilzbefall', 'Rindenschäden',
      'Totholzbildung', 'Vergabelungen', 'Wipfeldürre', 'Zwiesel'] },
    S:  { titel: 'Stamm', codes: [
      'Anfahrschäden', 'Astungswunden / Verletzungen', 'baumfremder Bewuchs', 'Fäulen',
      'Gewindestangen / Plomben', 'Höhlungen', 'Pilzbefall', 'Rindenschäden', 'Risse',
      'Schadinsekten (Bohrmehl)', 'Schrägstand nicht kompensiert', 'Stammaustriebe',
      'Wuchsanomalien', 'Zwiesel', 'eingewachsene Drähte / Schnüre'] },
    W:  { titel: 'Stammfuß / Wurzelanlauf', codes: [
      'Adventiv-/Würgewurzeln', 'Bodenaufwölbungen / -risse / -auffüllungen', 'Höhlungen',
      'Pilzbefall', 'Rindenschäden', 'Risse', 'Stammfußverbreiterung', 'Stockaustriebe',
      'Wuchsanomalien'] },
    Wu: { titel: 'Wurzelbereich', codes: ['Bodenaufwölbungen', 'Bodenrisse', 'Pilzbefall'] },
    V:  { titel: 'Baumumfeld', codes: [
      'Baugruben / -gräben', 'Bodenauftrag / -abtrag', 'Bodenverdichtung', 'Bodenversiegelung',
      'Freistellung', 'Grundwasserabsenkung', 'Grundwasseranstau'] }
  };

  /* --- Holzzersetzende Pilze mit Fäuletyp --------------------------------- */
  var PILZE = {
    'Wurzel / Stammfuß': [
      ['Flacher Lackporling', 'Ganoderma applanatum', 'Weißfäule'],
      ['Eschenbaumschwamm', 'Perenniporia fraxinea', 'Weißfäule'],
      ['Hallimasch', 'Armillaria spec.', 'Weißfäule'],
      ['Riesenporling', 'Meripilus giganteus', 'Weißfäule'],
      ['Brandkrustenpilz', 'Kretzschmaria deusta', 'Moderfäule'],
      ['Wurzelschwamm', 'Heterobasidion annosum', 'Weißfäule'],
      ['Sparriger Schüppling', 'Pholiota squarrosa', 'Weißfäule']
    ],
    'Stamm / Krone': [
      ['Schwefelporling', 'Laetiporus sulphureus', 'Braunfäule'],
      ['Zottiger Schillerporling', 'Inonotus hispidus', 'Weißfäule'],
      ['Eichenfeuerschwamm', 'Fomitiporia robusta', 'Weißfäule'],
      ['Schuppiger Porling', 'Cerioporus squamosus', 'Weißfäule'],
      ['Zunderschwamm', 'Fomes fomentarius', 'Weißfäule'],
      ['Birkenporling', 'Fomitopsis betulina', 'Braunfäule'],
      ['Austernseitling', 'Pleurotus ostreatus', 'Weißfäule'],
      ['Schmetterlingstramete', 'Trametes versicolor', 'Weißfäule']
    ]
  };

  /* --- Maßnahmenkatalog nach GALK 4.1 und ZTV-Baumpflege 2017 ------------- */
  var MASSNAHMEN = [
    'Abstimmung mit Fachämtern', 'Eingehende Untersuchung veranlassen', 'Totholzentnahme',
    'Kronenpflege', 'Kronenauslichtung', 'Kroneneinkürzung', 'Kronenteileinkürzung',
    'Entlastungsschnitt', 'Ableitungsschnitt auf Versorgungsast', 'Lichtraumprofilschnitt',
    'Kopfbaum-/Kronenschnitt', 'Jungbaum-/Erziehungsschnitt', 'Kronensicherung einbauen',
    'Wurzelbehandlung', 'Standortsanierung', 'Maßnahmen aus Gründen des Artenschutzes',
    'Fällung', 'Sofortmaßnahme: Absperrung', 'Sofortmaßnahme: Verkehrslenkung',
    'Verkürztes Kontrollintervall', 'Nachkontrolle', 'Steigerkontrolle',
    'Efeu am Stammfuß auf Stock setzen', 'Wurzelbereich vor Verdichtung schützen',
    'Baumscheibe vergrößern', 'Kronensicherung erneuern', 'Kronensicherung nachjustieren',
    'Kronensicherung ergänzen', 'Kronensicherung ausbauen', 'Kronensicherung im Baum prüfen'
  ];

  /** Katalogtexte sind in der Sprache der Richtlinie geschrieben. Fürs Angebot
   *  wird daraus die Leistung, die tatsächlich erbracht und berechnet wird. */
  function leistungstext(txt) {
    return String(txt || '')
      .replace(/ veranlassen$/, '')
      .replace(/^Sofortmaßnahme: /, '')
      .replace(/^Kronensicherung einbauen$/, 'Kronensicherung einbauen (dynamisch, verletzungsfrei)');
  }

  /* --- Dringlichkeitsstufen nach GALK 2021 -------------------------------- */
  var DRINGLICHKEIT = [
    { stufe: 1, kurz: 'unverzüglich',   lang: 'unverzüglich',                    tage: 0 },
    { stufe: 2, kurz: '6 Wochen',       lang: 'innerhalb von 6 Wochen',          tage: 42 },
    { stufe: 3, kurz: '6 Monate',       lang: 'innerhalb von 6 Monaten',         tage: 182 },
    { stufe: 4, kurz: 'nächstes Jahr',  lang: 'innerhalb des nächsten Jahres',   tage: 365 },
    { stufe: 5, kurz: 'bis nächste RK', lang: 'bis zur nächsten Regelkontrolle', tage: null }
  ];

  /* --- Baumumfeld --------------------------------------------------------- */
  var UMFELD = [
    'Rasen-/Grünfläche', 'Baumscheibe befestigt', 'Baumscheibe offen', 'Gehweg',
    'Fahrbahn / Straßenrand', 'Parkplatz / Stellplätze', 'Radweg', 'Spielplatz',
    'Friedhof', 'Park / Grünanlage', 'Wald / Waldrand', 'Gewässerrand',
    'Privatgarten', 'Schul-/Kitagelände', 'Böschung / Hang'
  ];

  /* --- Gründe für Grenzen der Kontrolle nach FLL 5.4 ---------------------- */
  var GRENZEN = [
    'Wurzelanlauf durch Efeubewuchs verdeckt',
    'Wurzelanlauf durch dichten Unterwuchs verdeckt',
    'Stammfuß durch Bodenaufschüttung verdeckt',
    'Krone durch Belaubung nur eingeschränkt einsehbar',
    'Baum nur von einer Seite zugänglich',
    'Hanglage, Wurzelbereich nicht vollständig beurteilbar',
    'Schneelage im Kronen- und Wurzelbereich',
    'Nachbargrundstück nicht betretbar',
    'Fahrzeuge oder Einbauten im Wurzelbereich',
    'Dämmerung / eingeschränkte Sichtverhältnisse'
  ];

  /* --- Witterung ---------------------------------------------------------- */
  var WITTERUNG = ['trocken, sonnig', 'trocken, bedeckt', 'windstill', 'leichter Wind',
                   'starker Wind', 'Regen', 'Nebel', 'Frost', 'Schnee'];

  /* --- Kronensicherung: Jahresfarben --------------------------------------
   * Herstellerübergreifender 8-Jahres-Zyklus. Branchenkonvention, keine Norm.
   * Jahr mod 8: 1 grün · 2 gelb · 3 rot · 4 blau · 5 braun · 6 violett ·
   * 7 orange · 0 grau
   * -------------------------------------------------------------------- */
  var KS_FARBEN = [
    { name: 'grün',    rest: 1, hex: '#3f8b3f' }, { name: 'gelb',    rest: 2, hex: '#e8c520' },
    { name: 'rot',     rest: 3, hex: '#c0392b' }, { name: 'blau',    rest: 4, hex: '#2b6cb0' },
    { name: 'braun',   rest: 5, hex: '#7b4a25' }, { name: 'violett', rest: 6, hex: '#7a3f9d' },
    { name: 'orange',  rest: 7, hex: '#e2861a' }, { name: 'grau',    rest: 0, hex: '#8a8a8a' }
  ];

  function ksJahre(farbe, bisJahr) {
    var f = KS_FARBEN.filter(function (x) { return x.name === farbe; })[0];
    if (!f) return [];
    var ende = bisJahr || new Date().getFullYear(), jahre = [];
    for (var j = ende; j > ende - 32; j--) if (j % 8 === f.rest) jahre.push(j);
    return jahre.slice(0, 4);
  }

  function ksFarbeZuJahr(jahr) {
    var r = jahr % 8;
    return (KS_FARBEN.filter(function (x) { return x.rest === r; })[0] || {}).name || '';
  }

  var KS_HERSTELLER = [
    { name: 'cobra',          dauer: 12 }, { name: 'boa / arboa',   dauer: 12 },
    { name: 'GEFA Fabritz',   dauer: 8  }, { name: 'treeSave',      dauer: 8  },
    { name: 'ArboLine',       dauer: 8  }, { name: 'CrownTex',      dauer: 8  },
    { name: 'Gleistein',      dauer: 8  }, { name: 'System Osnabrück', dauer: 8 },
    { name: 'sonstige',       dauer: 8  }, { name: 'unbekannt',     dauer: 8  }
  ];

  var KS_SYSTEM = ['dynamische Bruchsicherung', 'statische Bruchsicherung',
                   'Trag-/Haltesicherung', 'Stahlseil / Gewindestange (historisch)',
                   'Baum-/Aststütze', 'Abspannung / Erdanker'];
  var KS_BAUART = ['Hohltau', 'Gurtband', 'mehrere Komponenten', 'Stahlseil'];
  var KS_VERBUND = ['Einfach-Verbindung', 'Dreiecks-Verbindung', 'Ring-Verbindung', 'Zentralsicherung'];
  var KS_BEWERTUNG = ['funktionsfähig', 'Mangel', 'auszutauschen', 'nicht bewertbar'];
  var KS_MAENGEL = ['Scheuerstellen', 'UV-Schäden / Versprödung', 'Einschnürung', 'eingewachsen',
                    'zu locker', 'zu straff', 'falsche Position', 'Bruchlast zu gering',
                    'Knoten / unsachgemäße Verbindung', 'Korrosion', 'Beschädigung Ummantelung',
                    'Einsatzdauer überschritten', 'Kennzeichnung fehlt', 'Anzahl unzureichend',
                    'nicht mehr erforderlich'];

  /** Bemessungsvorschlag nach ZTV aus dem Durchmesser an der Astbasis. */
  function ksBemessung(durchmesserCm, statisch) {
    var t = durchmesserCm <= 40 ? 2 : (durchmesserCm <= 60 ? 4 : 8);
    return statisch ? t * 2 : t;
  }

  /* --- Preisliste, Richtwerte nach Höhenklasse ---------------------------- */
  var HOEHENKLASSEN = ['bis 10 m', '10–15 m', '15–20 m', 'über 20 m'];

  function hoehenklasse(h) {
    h = parseFloat(h) || 0;
    if (h <= 10) return 0;
    if (h <= 15) return 1;
    if (h <= 20) return 2;
    return 3;
  }

  var PREISE_STANDARD = {
    'Totholzentnahme':                 [ 95, 160, 240, 340],
    'Kronenpflege':                    [130, 210, 320, 450],
    'Kronenauslichtung':               [140, 230, 350, 480],
    'Kroneneinkürzung':                [180, 290, 430, 620],
    'Kronenteileinkürzung':            [140, 220, 330, 470],
    'Entlastungsschnitt':              [120, 190, 290, 410],
    'Ableitungsschnitt auf Versorgungsast': [130, 200, 300, 420],
    'Lichtraumprofilschnitt':          [ 80, 130, 190, 260],
    'Kopfbaum-/Kronenschnitt':         [110, 170, 250, 340],
    'Jungbaum-/Erziehungsschnitt':     [ 45,  70,   0,   0],
    'Kronensicherung einbauen':        [220, 320, 460, 640],
    'Kronensicherung erneuern':        [200, 300, 430, 600],
    'Kronensicherung nachjustieren':   [ 90, 130, 180, 240],
    'Kronensicherung ergänzen':        [150, 220, 320, 440],
    'Kronensicherung ausbauen':        [110, 160, 230, 310],
    'Kronensicherung im Baum prüfen':  [ 85, 120, 165, 220],
    'Fällung':                         [280, 480, 780, 1250],
    'Wurzelbehandlung':                [180, 180, 180, 180],
    'Standortsanierung':               [350, 350, 350, 350],
    'Eingehende Untersuchung veranlassen': [420, 420, 480, 540],
    'Steigerkontrolle':                [180, 220, 280, 340],
    'Nachkontrolle':                   [ 45,  45,  45,  45],
    'Sofortmaßnahme: Absperrung':      [120, 120, 120, 120],
    'Sofortmaßnahme: Verkehrslenkung': [180, 180, 180, 180],
    'Efeu am Stammfuß auf Stock setzen': [ 55,  55,  65,  75],
    'Baumscheibe vergrößern':          [140, 140, 160, 180]
  };

  return {
    ARTEN: ARTEN, PHASEN: PHASEN, ZUSTAENDE: ZUSTAENDE, ERWARTUNG: ERWARTUNG,
    ROLOFF: ROLOFF, KONTROLLART: KONTROLLART, BELAUBUNG: BELAUBUNG, WITTERUNG: WITTERUNG,
    ZUSTAND_HILFE: ZUSTAND_HILFE, SYMPTOME: SYMPTOME, PILZE: PILZE,
    MASSNAHMEN: MASSNAHMEN, DRINGLICHKEIT: DRINGLICHKEIT, UMFELD: UMFELD, GRENZEN: GRENZEN,
    KS_FARBEN: KS_FARBEN, KS_HERSTELLER: KS_HERSTELLER, KS_SYSTEM: KS_SYSTEM,
    KS_BAUART: KS_BAUART, KS_VERBUND: KS_VERBUND, KS_BEWERTUNG: KS_BEWERTUNG,
    KS_MAENGEL: KS_MAENGEL,
    HOEHENKLASSEN: HOEHENKLASSEN, PREISE_STANDARD: PREISE_STANDARD,
    intervall: intervall, intervallJahre: intervallJahre, intervallGrundlage: intervallGrundlage,
    hoehenklasse: hoehenklasse, leistungstext: leistungstext, ksJahre: ksJahre, ksFarbeZuJahr: ksFarbeZuJahr,
    ksBemessung: ksBemessung
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
