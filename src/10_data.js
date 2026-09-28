/* =============================================================================
 * 10_data.js  –  Stammdaten und Kataloge
 * Baumkontrolltool Hundertmark
 *
 * Fachgrundlage: FLL-Baumkontrollrichtlinien, 3. Ausgabe 2020,
 * GALK-Musterdienstanweisung 2021, ZTV-Baumpflege 2017.
 * ========================================================================== */

var DATA = (function () {
  'use strict';

  /* --- Baumarten ----------------------------------------------------------
   * [ deutsch, botanisch, Lebenserwartung in Jahren, weitere Suchbegriffe ]
   * Das vierte Feld ist reine Sucherleichterung: gebräuchliche Zweitnamen,
   * unter denen im Feld gesucht wird („Akazie" für Robinie). Es steht nirgends
   * im Protokoll. Sortiert wird beim Anzeigen, nicht hier.
   * -------------------------------------------------------------------- */
  var ARTEN = [
    /* --- Ahorn --- */
    ['Bergahorn', 'Acer pseudoplatanus', 300, 'ahorn'],
    ['Spitzahorn', 'Acer platanoides', 200, 'ahorn'],
    ['Feldahorn', 'Acer campestre', 150, 'massholder ahorn'],
    ['Silberahorn', 'Acer saccharinum', 130, 'ahorn'],
    ['Rotahorn', 'Acer rubrum', 150, 'ahorn'],
    ['Zuckerahorn', 'Acer saccharum', 200, 'ahorn'],
    ['Eschenahorn', 'Acer negundo', 100, 'ahorn'],
    ['Fächerahorn', 'Acer palmatum', 100, 'japanischer ahorn'],
    ['Kugelahorn', 'Acer platanoides Globosum', 120, 'ahorn'],
    ['Blutahorn', 'Acer platanoides Crimson King', 150, 'ahorn'],
    ['Französischer Ahorn', 'Acer monspessulanum', 150, 'ahorn'],
    ['Schlangenhaut-Ahorn', 'Acer capillipes', 80, 'ahorn'],
    /* --- Kastanie --- */
    ['Rosskastanie', 'Aesculus hippocastanum', 200, 'kastanie'],
    ['Rotblühende Rosskastanie', 'Aesculus × carnea', 150, 'kastanie'],
    ['Gelbe Rosskastanie', 'Aesculus flava', 150, 'kastanie'],
    ['Edelkastanie', 'Castanea sativa', 400, 'esskastanie marone kastanie'],
    /* --- Erle, Birke, Hainbuche --- */
    ['Schwarzerle', 'Alnus glutinosa', 120, 'erle roterle'],
    ['Grauerle', 'Alnus incana', 100, 'erle'],
    ['Italienische Erle', 'Alnus cordata', 100, 'erle'],
    ['Purpurerle', 'Alnus × spaethii', 100, 'erle'],
    ['Sandbirke', 'Betula pendula', 100, 'birke haengebirke weissbirke'],
    ['Moorbirke', 'Betula pubescens', 100, 'birke'],
    ['Himalaja-Birke', 'Betula utilis', 80, 'birke'],
    ['Schwarzbirke', 'Betula nigra', 100, 'birke'],
    ['Hainbuche', 'Carpinus betulus', 150, 'weissbuche hagebuche'],
    ['Säulenhainbuche', 'Carpinus betulus Fastigiata', 150, 'hainbuche'],
    ['Hopfenbuche', 'Ostrya carpinifolia', 150, ''],
    ['Baumhasel', 'Corylus colurna', 150, 'hasel'],
    ['Haselnuss', 'Corylus avellana', 80, 'hasel'],
    /* --- Buche --- */
    ['Rotbuche', 'Fagus sylvatica', 250, 'buche'],
    ['Blutbuche', 'Fagus sylvatica f. purpurea', 250, 'buche'],
    ['Hängebuche', 'Fagus sylvatica Pendula', 200, 'buche'],
    ['Säulenbuche', 'Fagus sylvatica Dawyck', 200, 'buche'],
    /* --- Esche --- */
    ['Gemeine Esche', 'Fraxinus excelsior', 250, 'esche'],
    ['Blumenesche', 'Fraxinus ornus', 100, 'mannaesche esche'],
    ['Schmalblättrige Esche', 'Fraxinus angustifolia', 150, 'esche'],
    /* --- Eiche --- */
    ['Stieleiche', 'Quercus robur', 600, 'eiche sommereiche'],
    ['Traubeneiche', 'Quercus petraea', 600, 'eiche wintereiche'],
    ['Roteiche', 'Quercus rubra', 250, 'eiche amerikanische eiche'],
    ['Sumpfeiche', 'Quercus palustris', 200, 'eiche'],
    ['Zerreiche', 'Quercus cerris', 250, 'eiche'],
    ['Ungarische Eiche', 'Quercus frainetto', 250, 'eiche'],
    ['Steineiche', 'Quercus ilex', 300, 'eiche'],
    ['Säuleneiche', 'Quercus robur Fastigiata', 300, 'eiche'],
    /* --- Linde --- */
    ['Winterlinde', 'Tilia cordata', 800, 'linde'],
    ['Sommerlinde', 'Tilia platyphyllos', 800, 'linde'],
    ['Silberlinde', 'Tilia tomentosa', 300, 'linde'],
    ['Krimlinde', 'Tilia × euchlora', 200, 'linde'],
    ['Holländische Linde', 'Tilia × europaea', 400, 'linde'],
    /* --- Ulme --- */
    ['Bergulme', 'Ulmus glabra', 200, 'ulme'],
    ['Feldulme', 'Ulmus minor', 200, 'ulme'],
    ['Flatterulme', 'Ulmus laevis', 250, 'ulme'],
    ['Resista-Ulme', 'Ulmus Resista', 150, 'ulme'],
    /* --- Pappel, Weide --- */
    ['Zitterpappel', 'Populus tremula', 80, 'espe aspe pappel'],
    ['Schwarzpappel', 'Populus nigra', 150, 'pappel'],
    ['Pyramidenpappel', 'Populus nigra Italica', 80, 'saeulenpappel pappel'],
    ['Silberpappel', 'Populus alba', 120, 'pappel'],
    ['Graupappel', 'Populus × canescens', 120, 'pappel'],
    ['Hybridpappel', 'Populus × canadensis', 80, 'bastardpappel pappel'],
    ['Balsampappel', 'Populus balsamifera', 80, 'pappel'],
    ['Silberweide', 'Salix alba', 100, 'weide'],
    ['Salweide', 'Salix caprea', 60, 'weide palmweide kaetzchenweide'],
    ['Trauerweide', 'Salix × sepulcralis', 80, 'weide haengeweide'],
    ['Bruchweide', 'Salix fragilis', 80, 'weide'],
    ['Korbweide', 'Salix viminalis', 50, 'weide'],
    /* --- Obst und Rosengewächse --- */
    ['Apfel', 'Malus domestica', 80, 'apfelbaum'],
    ['Zierapfel', 'Malus spec.', 60, 'apfel'],
    ['Birne', 'Pyrus communis', 100, 'birnbaum'],
    ['Stadtbirne', 'Pyrus calleryana Chanticleer', 80, 'chinesische wildbirne birne'],
    ['Süßkirsche', 'Prunus avium', 100, 'vogelkirsche kirsche'],
    ['Sauerkirsche', 'Prunus cerasus', 60, 'kirsche schattenmorelle'],
    ['Zierkirsche', 'Prunus serrulata', 60, 'japanische bluetenkirsche kirsche'],
    ['Traubenkirsche', 'Prunus padus', 80, 'kirsche'],
    ['Späte Traubenkirsche', 'Prunus serotina', 100, 'kirsche'],
    ['Mahagoni-Kirsche', 'Prunus serrula', 60, 'kirsche'],
    ['Pflaume', 'Prunus domestica', 60, 'zwetschge'],
    ['Kirschpflaume', 'Prunus cerasifera', 60, 'myrobalane'],
    ['Blutpflaume', 'Prunus cerasifera Nigra', 60, 'blutpflaume'],
    ['Aprikose', 'Prunus armeniaca', 50, 'marille'],
    ['Pfirsich', 'Prunus persica', 40, ''],
    ['Mandelbäumchen', 'Prunus triloba', 40, 'mandel'],
    ['Kirschlorbeer', 'Prunus laurocerasus', 60, 'lorbeerkirsche'],
    ['Quitte', 'Cydonia oblonga', 60, ''],
    ['Mispel', 'Mespilus germanica', 80, ''],
    ['Felsenbirne', 'Amelanchier lamarckii', 60, ''],
    ['Weißdorn', 'Crataegus monogyna', 100, 'hagedorn'],
    ['Rotdorn', 'Crataegus laevigata Pauls Scarlet', 80, 'weissdorn'],
    ['Apfeldorn', 'Crataegus × lavallei Carrierei', 80, 'weissdorn'],
    ['Vogelbeere', 'Sorbus aucuparia', 100, 'eberesche'],
    ['Mehlbeere', 'Sorbus aria', 120, ''],
    ['Schwedische Mehlbeere', 'Sorbus intermedia', 100, 'mehlbeere'],
    ['Elsbeere', 'Sorbus torminalis', 200, ''],
    ['Speierling', 'Sorbus domestica', 300, ''],
    /* --- Übrige Laubbäume --- */
    ['Platane', 'Platanus × hispanica', 300, 'ahornblaettrige platane'],
    ['Robinie', 'Robinia pseudoacacia', 150, 'scheinakazie akazie falsche akazie'],
    ['Kugelrobinie', 'Robinia pseudoacacia Umbraculifera', 100, 'akazie robinie'],
    ['Walnuss', 'Juglans regia', 150, 'nussbaum'],
    ['Schwarznuss', 'Juglans nigra', 200, 'nussbaum walnuss'],
    ['Kaukasische Flügelnuss', 'Pterocarya fraxinifolia', 150, 'fluegelnuss'],
    ['Schuppenrinden-Hickory', 'Carya ovata', 200, 'hickory'],
    ['Ginkgo', 'Ginkgo biloba', 500, 'faecherblattbaum'],
    ['Lederhülsenbaum', 'Gleditsia triacanthos', 120, 'gleditschie gleditsie'],
    ['Kentucky-Geweihbaum', 'Gymnocladus dioicus', 150, 'geweihbaum'],
    ['Schnurbaum', 'Styphnolobium japonicum', 150, 'sophora honigbaum japanischer schnurbaum'],
    ['Bienenbaum', 'Tetradium daniellii', 100, 'stinkesche'],
    ['Götterbaum', 'Ailanthus altissima', 100, ''],
    ['Trompetenbaum', 'Catalpa bignonioides', 100, 'beamtenbaum katalpe'],
    ['Zürgelbaum', 'Celtis australis', 200, ''],
    ['Zelkove', 'Zelkova serrata', 200, 'japanische zelkove'],
    ['Judasbaum', 'Cercis siliquastrum', 80, ''],
    ['Blasenbaum', 'Koelreuteria paniculata', 100, 'blasenesche'],
    ['Amberbaum', 'Liquidambar styraciflua', 150, ''],
    ['Tulpenbaum', 'Liriodendron tulipifera', 200, ''],
    ['Eisenholzbaum', 'Parrotia persica', 150, 'parrotie'],
    ['Tupelobaum', 'Nyssa sylvatica', 150, ''],
    ['Blauglockenbaum', 'Paulownia tomentosa', 80, 'kiribaum'],
    ['Magnolie', 'Magnolia × soulangeana', 80, 'tulpenmagnolie'],
    ['Sternmagnolie', 'Magnolia stellata', 60, 'magnolie'],
    ['Maulbeere', 'Morus alba', 150, 'weisse maulbeere'],
    ['Schwarze Maulbeere', 'Morus nigra', 200, 'maulbeere'],
    ['Feige', 'Ficus carica', 80, ''],
    ['Ölweide', 'Elaeagnus angustifolia', 60, 'schmalblaettrige oelweide'],
    ['Essigbaum', 'Rhus typhina', 40, 'hirschkolbensumach sumach'],
    ['Goldregen', 'Laburnum anagyroides', 60, ''],
    ['Kornelkirsche', 'Cornus mas', 100, 'hartriegel'],
    ['Japanischer Blütenhartriegel', 'Cornus kousa', 80, 'hartriegel'],
    ['Perückenstrauch', 'Cotinus coggygria', 60, ''],
    ['Holunder', 'Sambucus nigra', 60, 'flieder schwarzer holunder'],
    ['Flieder', 'Syringa vulgaris', 60, ''],
    ['Gemeine Stechpalme', 'Ilex aquifolium', 150, 'ilex huelse'],
    /* --- Nadelbäume --- */
    ['Weißtanne', 'Abies alba', 400, 'tanne'],
    ['Nordmanntanne', 'Abies nordmanniana', 300, 'tanne'],
    ['Nobilistanne', 'Abies procera', 250, 'edeltanne tanne'],
    ['Koreatanne', 'Abies koreana', 150, 'tanne'],
    ['Europäische Lärche', 'Larix decidua', 400, 'laerche'],
    ['Japanische Lärche', 'Larix kaempferi', 250, 'laerche'],
    ['Fichte', 'Picea abies', 300, 'rotfichte gemeine fichte'],
    ['Blaufichte', 'Picea pungens Glauca', 150, 'stechfichte fichte'],
    ['Serbische Fichte', 'Picea omorika', 200, 'omorika fichte'],
    ['Sitkafichte', 'Picea sitchensis', 300, 'fichte'],
    ['Waldkiefer', 'Pinus sylvestris', 400, 'kiefer foehre'],
    ['Schwarzkiefer', 'Pinus nigra', 400, 'kiefer'],
    ['Bergkiefer', 'Pinus mugo', 200, 'latsche krummholzkiefer kiefer'],
    ['Weymouth-Kiefer', 'Pinus strobus', 250, 'kiefer'],
    ['Zirbelkiefer', 'Pinus cembra', 500, 'arve zirbe kiefer'],
    ['Douglasie', 'Pseudotsuga menziesii', 400, 'douglasfichte douglastanne'],
    ['Eibe', 'Taxus baccata', 1000, ''],
    ['Lebensbaum', 'Thuja occidentalis', 150, 'thuja'],
    ['Riesenlebensbaum', 'Thuja plicata', 200, 'thuja'],
    ['Scheinzypresse', 'Chamaecyparis lawsoniana', 150, 'zypresse'],
    ['Leyland-Zypresse', 'Cupressocyparis leylandii', 100, 'zypresse'],
    ['Echte Zypresse', 'Cupressus sempervirens', 300, 'zypresse'],
    ['Wacholder', 'Juniperus communis', 200, ''],
    ['Sumpfzypresse', 'Taxodium distichum', 400, 'zypresse'],
    ['Urweltmammutbaum', 'Metasequoia glyptostroboides', 400, 'metasequoie mammutbaum'],
    ['Bergmammutbaum', 'Sequoiadendron giganteum', 1000, 'mammutbaum riesenmammutbaum'],
    ['Küstenmammutbaum', 'Sequoia sempervirens', 1000, 'mammutbaum'],
    ['Atlaszeder', 'Cedrus atlantica', 300, 'zeder'],
    ['Libanonzeder', 'Cedrus libani', 400, 'zeder'],
    ['Himalaja-Zeder', 'Cedrus deodara', 300, 'zeder'],
    ['Hemlocktanne', 'Tsuga canadensis', 300, 'schierlingstanne'],
    ['Araukarie', 'Araucaria araucana', 300, 'schmucktanne affenschwanzbaum']
  ];

  /* --- Artensuche ---------------------------------------------------------
   * Im Feld wird einhändig getippt, mit Handschuh und mit der Autokorrektur
   * im Nacken. Die Suche muss deshalb Mehrzahl und Beugung verzeihen:
   * „Douglasien" findet die Douglasie. Dafür wird die Eingabe normalisiert
   * (Umlaute aufgelöst, Sonderzeichen weg) und notfalls hinten gekürzt.
   * -------------------------------------------------------------------- */
  function artNorm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* --- Reihenfolge der Treffer --------------------------------------------
   * Wer „Eiche" tippt, meint fast immer die Stieleiche und nicht die
   * Ungarische Eiche. Diese Liste ist die Reihenfolge, in der die Arten im
   * hiesigen Baumbestand tatsächlich vorkommen; sie zieht die Treffer nach
   * vorn. Wer eine seltene Art sucht, tippt ohnehin genauer.
   * -------------------------------------------------------------------- */
  var HAEUFIG = [
    'Rotbuche', 'Stieleiche', 'Winterlinde', 'Bergahorn', 'Spitzahorn', 'Sandbirke',
    'Hainbuche', 'Gemeine Esche', 'Rosskastanie', 'Platane', 'Fichte', 'Waldkiefer',
    'Douglasie', 'Robinie', 'Vogelbeere', 'Süßkirsche', 'Apfel', 'Walnuss',
    'Silberweide', 'Schwarzerle', 'Traubeneiche', 'Sommerlinde', 'Roteiche',
    'Feldahorn', 'Europäische Lärche', 'Weißtanne', 'Eibe', 'Lebensbaum',
    'Trauerweide', 'Salweide', 'Zitterpappel', 'Hybridpappel', 'Blutbuche',
    'Birne', 'Pflaume', 'Zierkirsche', 'Weißdorn', 'Holunder', 'Haselnuss',
    'Blaufichte', 'Scheinzypresse', 'Kirschlorbeer', 'Ginkgo', 'Amberbaum',
    'Feldulme', 'Mehlbeere', 'Zierapfel', 'Trompetenbaum', 'Silberlinde',
    'Krimlinde', 'Lederhülsenbaum', 'Blutpflaume', 'Goldregen', 'Magnolie',
    'Schwarzkiefer', 'Silberahorn', 'Eschenahorn'
  ];
  var RANG = {};
  HAEUFIG.forEach(function (dt, i) { RANG[artNorm(dt)] = i; });

  /* Jede Art einmal vorbereiten statt bei jedem Tastendruck neu. */
  var ARTEN_INDEX = ARTEN.map(function (a, i) {
    var nDt = artNorm(a[0]), r = RANG[nDt];
    return {
      i: i, dt: a[0], bot: a[1], leben: a[2],
      nDt: nDt,
      heu: artNorm(a[0] + ' ' + a[1] + ' ' + (a[3] || '')),
      bonus: r === undefined ? 0 : -(120 - r * 2)
    };
  });

  /** Findet ein Wort im Heuhaufen, notfalls um bis zu zwei Zeichen gekürzt. */
  function wortTrifft(heu, wort) {
    for (var k = 0; k < 3 && wort.length - k >= 3; k++) {
      var p = heu.indexOf(wort.slice(0, wort.length - k));
      if (p >= 0) return { pos: p, genau: k === 0 };
    }
    return wort.length < 3 ? (heu.indexOf(wort) >= 0 ? { pos: heu.indexOf(wort), genau: true } : null) : null;
  }

  /**
   * @param {string} text  Eingabe des Kontrolleurs
   * @param {number} max   Höchstzahl der Treffer
   * @returns {Array} Arten in der Reihenfolge ihrer Passgenauigkeit
   */
  /* Zum Blättern ohne Suchbegriff: alphabetisch, nicht in Datenreihenfolge. */
  var ARTEN_AZ = ARTEN_INDEX.slice().sort(function (x, y) {
    return x.nDt < y.nDt ? -1 : (x.nDt > y.nDt ? 1 : 0);
  });

  function artFinden(text, max) {
    var n = artNorm(text);
    if (!n) return ARTEN_AZ.slice(0, max || ARTEN_AZ.length);
    var worte = n.split(' '), treffer = [];

    ARTEN_INDEX.forEach(function (a) {
      var punkte = 0, alleDa = true;
      for (var w = 0; w < worte.length; w++) {
        var t = wortTrifft(a.heu, worte[w]);
        if (!t) { alleDa = false; break; }
        punkte += t.genau ? 0 : 12;                     /* gekürzt getroffen zählt schwächer */
        punkte += Math.min(t.pos, 30);                  /* je weiter hinten, desto schwächer */
        if (a.nDt.indexOf(worte[w]) === 0) punkte -= 40; /* deutscher Name fängt so an */
      }
      if (!alleDa) return;
      punkte += a.bonus;                                 /* häufige Arten nach vorn */
      punkte += a.dt.length / 20;                        /* sonst kurze Namen zuerst */
      treffer.push({ p: punkte, a: a });
    });

    treffer.sort(function (x, y) { return x.p - y.p || x.a.i - y.a.i; });
    if (treffer.length) {
      return treffer.slice(0, max || treffer.length).map(function (t) { return t.a; });
    }
    return vertipper(n, max);           /* gar nichts? dann Tippfehler annehmen */
  }

  /**
   * Zweiter Anlauf für vertippte Eingaben – „Waldkifer" soll die Waldkiefer
   * finden. Erlaubt ist ein Fehler je acht Zeichen, mindestens einer.
   * Läuft nur, wenn die normale Suche leer ausgeht, kostet also nichts.
   */
  function vertipper(n, max) {
    var grenze = Math.max(1, Math.floor(n.length / 8)), gefunden = [];
    ARTEN_INDEX.forEach(function (a) {
      var d = abstand(n, a.nDt, grenze);
      if (d <= grenze) gefunden.push({ d: d, a: a });
    });
    gefunden.sort(function (x, y) { return x.d - y.d || x.a.i - y.a.i; });
    return gefunden.slice(0, max || gefunden.length).map(function (g) { return g.a; });
  }

  /** Levenshtein, abgebrochen sobald die Grenze gerissen ist. */
  function abstand(a, b, grenze) {
    if (Math.abs(a.length - b.length) > grenze) return grenze + 1;
    var vor = [], jetzt = [], i, j;
    for (j = 0; j <= b.length; j++) vor[j] = j;
    for (i = 1; i <= a.length; i++) {
      jetzt[0] = i;
      var beste = i;
      for (j = 1; j <= b.length; j++) {
        jetzt[j] = Math.min(vor[j] + 1, jetzt[j - 1] + 1,
                            vor[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        if (jetzt[j] < beste) beste = jetzt[j];
      }
      if (beste > grenze) return grenze + 1;
      vor = jetzt.slice();
    }
    return vor[b.length];
  }

  /** Exakte Auflösung: gibt die Art zurück, wenn der Text genau passt. */
  function artGenau(text) {
    var n = artNorm(text);
    if (!n) return null;
    for (var i = 0; i < ARTEN_INDEX.length; i++) {
      if (ARTEN_INDEX[i].nDt === n || artNorm(ARTEN_INDEX[i].bot) === n) return ARTEN_INDEX[i];
    }
    return null;
  }

  /* --- Qualifikation des Kontrolleurs -------------------------------------
   * Es gibt keine gesetzliche Regelung, wer Baumkontrollen durchführen darf;
   * „Baumkontrolleur" ist keine geschützte Bezeichnung. Maßstab ist die
   * Fachkunde, und die wird objektiv gemessen (OLG Hamm). Allgemeine
   * Berufserfahrung genügt nicht. FLL 5.2.5 verlangt entsprechende
   * Fachkunde, die fortlaufend zu erhalten ist.
   * -------------------------------------------------------------------- */
  var QUALIFIKATIONEN = [
    'FLL-zertifizierter Baumkontrolleur',
    'Fachagrarwirt Baumpflege und Baumsanierung',
    'European Tree Technician (ETT)',
    'European Tree Worker (ETW)',
    'B.Sc. Arboristik',
    'M.Sc. Arboristik',
    'Öffentlich bestellter und vereidigter Sachverständiger für Baumpflege und Verkehrssicherheit von Bäumen',
    'Staatlich geprüfter Techniker Garten- und Landschaftsbau',
    'Baumkontrolleur (Lehrgang)'
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

  /** Intervall in Monaten. Die FLL rechnet in Jahren; „halbjährlich" ist kein
   *  Wert der Matrix, sondern eine bewusst verkürzte Festlegung des
   *  Kontrolleurs – zum Beispiel bei einem Beobachtungsfall. */
  function intervallMonate(txt) {
    if (/halbjähr/i.test(txt)) return 6;
    if (/vierteljähr/i.test(txt)) return 3;
    if (/jähr/i.test(txt)) return 12;
    var m = /(\d+)/.exec(txt || '');
    return m ? parseInt(m[1], 10) * 12 : 0;
  }

  function intervallJahre(txt) {
    return intervallMonate(txt) / 12;
  }

  function intervallGrundlage(txt) {
    if (/halbjähr/i.test(txt)) return 'verkürztes Intervall, vom Kontrolleur festgelegt (Beobachtungsfall)';
    if (/jähr/i.test(txt))  return 'stärker geschädigt oder Alterungsphase bei höherer Sicherheitserwartung';
    if (/^2/.test(txt))     return 'Reifephase mit höherer bzw. Alterungsphase mit geringerer Sicherheitserwartung';
    if (/^3/.test(txt))     return 'Reifephase, geringere Sicherheitserwartung';
    return 'Jugendphase bei bedarfsgerechter Jungbaumpflege nach ZTV-Baumpflege';
  }

  /* --- Schadsymptomkatalog, gegliedert nach Baumteilen -------------------- */
  var SYMPTOME = {
    K:  { titel: 'Krone', kurz: 'Krone', codes: [
      'Astab-/Astausbrüche', 'Astrisse', 'Astungswunden / -fäulen', 'baumfremder Bewuchs (z. B. Mistel)',
      'auffällige Belaubung', 'Fehlentwicklungen in der Krone', 'Höhlungen', 'Kappungsstellen',
      'vorhandene Kronensicherung', 'Lichtraumprofil', 'Pilzbefall', 'Rindenschäden',
      'Totholzbildung', 'Vergabelungen', 'Wipfeldürre', 'Zwiesel'] },
    S:  { titel: 'Stamm', kurz: 'Stamm', codes: [
      'Anfahrschäden', 'Astungswunden / Verletzungen', 'baumfremder Bewuchs', 'Fäulen',
      'Gewindestangen / Plomben', 'Höhlungen', 'Pilzbefall', 'Rindenschäden', 'Risse',
      'Schadinsekten (Bohrmehl)', 'Schrägstand nicht kompensiert', 'Stammaustriebe',
      'Wuchsanomalien', 'Zwiesel', 'eingewachsene Drähte / Schnüre'] },
    W:  { titel: 'Stammfuß / Wurzelanlauf', kurz: 'Stammfuß', codes: [
      'Adventiv-/Würgewurzeln', 'Bodenaufwölbungen / -risse / -auffüllungen', 'Höhlungen',
      'Pilzbefall', 'Rindenschäden', 'Risse', 'Stammfußverbreiterung', 'Stockaustriebe',
      'Wuchsanomalien'] },
    Wu: { titel: 'Wurzelbereich', kurz: 'Wurzel', codes: ['Bodenaufwölbungen', 'Bodenrisse', 'Pilzbefall'] },
    V:  { titel: 'Baumumfeld', kurz: 'Umfeld', codes: [
      'Baugruben / -gräben', 'Bodenauftrag / -abtrag', 'Bodenverdichtung', 'Bodenversiegelung',
      'Freistellung', 'Grundwasserabsenkung', 'Grundwasseranstau',
      /* V8 und V9 nachgetragen – Codes werden angehängt, damit ältere
         Erfassungen ihre Zuordnung behalten. */
      'Bodenvernässung', 'Wurzelverletzungen'] }
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
    ARTEN: ARTEN, QUALIFIKATIONEN: QUALIFIKATIONEN, PHASEN: PHASEN, ZUSTAENDE: ZUSTAENDE, ERWARTUNG: ERWARTUNG,
    ROLOFF: ROLOFF, KONTROLLART: KONTROLLART, BELAUBUNG: BELAUBUNG, WITTERUNG: WITTERUNG,
    ZUSTAND_HILFE: ZUSTAND_HILFE, SYMPTOME: SYMPTOME, PILZE: PILZE,
    MASSNAHMEN: MASSNAHMEN, DRINGLICHKEIT: DRINGLICHKEIT, UMFELD: UMFELD, GRENZEN: GRENZEN,
    KS_FARBEN: KS_FARBEN, KS_HERSTELLER: KS_HERSTELLER, KS_SYSTEM: KS_SYSTEM,
    KS_BAUART: KS_BAUART, KS_VERBUND: KS_VERBUND, KS_BEWERTUNG: KS_BEWERTUNG,
    KS_MAENGEL: KS_MAENGEL,
    HOEHENKLASSEN: HOEHENKLASSEN, PREISE_STANDARD: PREISE_STANDARD,
    intervall: intervall, intervallJahre: intervallJahre, intervallMonate: intervallMonate, intervallGrundlage: intervallGrundlage,
    hoehenklasse: hoehenklasse, leistungstext: leistungstext, ksJahre: ksJahre, ksFarbeZuJahr: ksFarbeZuJahr,
    ksBemessung: ksBemessung,
    artFinden: artFinden, artGenau: artGenau, artNorm: artNorm
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
