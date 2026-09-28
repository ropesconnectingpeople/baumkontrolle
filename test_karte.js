/* Karte und Tablet-Layout.
 *
 * Kachelanfragen werden abgefangen, im Testlauf gibt es kein Netz. Genau so
 * sieht es draußen im Funkloch aus: graue Fläche, Marken stehen trotzdem.
 * Wenn die Karte das nicht aushält, taugt sie für die Baustelle nicht.
 */
const { chromium } = require('/home/claude/node_modules/playwright');
const path = require('path');

const DATEI = 'file://' + path.join(__dirname, 'Baumkontrolle.html');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  await ctx.route('**arcgisonline.com**', r => r.abort());
  await ctx.route('**tile.openstreetmap.org**', r => r.abort());

  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
  /* Die abgefangenen Kachelanfragen melden sich als Netzfehler. Genau die
     sollen hier ja auftreten, deshalb zählen sie nicht. */
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) {
      fehler.push('CONSOLE: ' + m.text());
    }
  });

  await page.goto(DATEI);
  await page.waitForTimeout(900);

  /** Füllt das offene Baumformular aus. „Speichern und nächsten Baum" legt den
   *  nächsten gleich an, deshalb wird der Knopf nur einmal gebraucht. */
  async function baum(art, hoehe, zustand, lat, lon, letzter) {
    await page.fill('#b_artDt', art);
    await page.fill('#b_hoehe', String(hoehe));
    await page.selectOption('#b_zustand', zustand);
    if (lat !== null) {
      if (!await page.isVisible('#mehrOrt')) await page.evaluate(() => App.mehr('Ort'));
      await page.waitForTimeout(150);
      await page.fill('#b_gpsLat', String(lat));
      await page.fill('#b_gpsLon', String(lon));
    }
    await page.click(letzter ? 'text=Speichern und zurück' : 'text=Speichern und nächsten Baum');
    await page.waitForTimeout(400);
  }

  await page.click('text=+ Baum aufnehmen');
  await page.waitForTimeout(350);
  await baum('Rotbuche', 22, 'gesund', 49.6760, 9.0030, false);
  await baum('Stieleiche', 18, 'stärker geschädigt', 49.6764, 9.0037, false);
  await baum('Winterlinde', 14, 'leicht geschädigt', null, null, true);

  const anzahl = await page.evaluate(() => App._zustand().baeume.length);
  if (anzahl !== 3) fehler.push('Drei Bäume erwartet, gefunden: ' + anzahl);

  /* --- Telefon: eins von beiden, nie beides --------------------------- */
  if (await page.isVisible('#kartenBlock')) fehler.push('Karte steht auf dem Telefon neben der Liste');
  if (!await page.isVisible('.umschalt')) fehler.push('Umschalter Liste/Karte fehlt');

  await page.click('#umKarte');
  await page.waitForTimeout(800);
  if (await page.isVisible('#listeBlock')) fehler.push('Liste bleibt auf dem Telefon neben der Karte stehen');
  if (!await page.locator('.leaflet-container').count()) fehler.push('Leaflet ist nicht angesprungen');
  console.log('Umschalten Liste/Karte: in Ordnung');

  /* --- Marken: eine je verortetem Baum, Farbe nach Zustand ------------ */
  let marken = await page.locator('.baummarke').count();
  if (marken !== 2) fehler.push('Zwei Marken erwartet, gezeichnet: ' + marken);
  const beschriftung = await page.locator('.baummarke').allInnerTexts();
  if (beschriftung.join(',') !== '001,002') fehler.push('Marken tragen die falschen Nummern: ' + beschriftung.join(','));
  if (!await page.locator('.baummarke.m-gruen').count()) fehler.push('Gesunder Baum ist nicht grün');
  if (!await page.locator('.baummarke.m-rot').count()) fehler.push('Stärker geschädigter Baum ist nicht rot');
  console.log('Marken:', beschriftung.join(' · '), '– Farben stimmen');

  const kopf = await page.locator('#kartenZahl').innerText();
  if (kopf !== '(2/3)') fehler.push('Zählerstand falsch: ' + kopf);
  let fuss = await page.locator('#kartenfuss').innerText();
  if (!/1 Baum ohne Standort/.test(fuss)) fehler.push('Fußzeile nennt den fehlenden Standort nicht: ' + fuss);

  /* --- Namensschild: Art und Höhe stehen neben der Marke -------------- */
  const schilder = await page.locator('.baumschild').allInnerTexts();
  if (schilder.length !== 2) fehler.push('Zwei Namensschilder erwartet, gezeichnet: ' + schilder.length);
  if (!/Rotbuche/.test(schilder[0]) || !/22 m/.test(schilder[0]))
    fehler.push('Schild ohne Art oder Höhe: ' + schilder[0]);
  if (!await page.locator('.baumschild').first().isVisible()) fehler.push('Schild ist unsichtbar');
  console.log('Schilder:', schilder.map(s => s.replace(/\s+/g, ' ')).join(' · '));

  // Weit herausgezoomt würden die Schilder übereinander kleben
  await page.evaluate(() => Karte._karte().setZoom(14));
  await page.waitForTimeout(500);
  if (await page.locator('.baumschild').first().isVisible())
    fehler.push('Schilder bleiben bei Zoom 14 stehen');
  await page.evaluate(() => Karte._karte().setZoom(19));
  await page.waitForTimeout(500);
  if (!await page.locator('.baumschild').first().isVisible())
    fehler.push('Schilder kommen beim Hineinzoomen nicht zurück');

  // Von Hand abschaltbar
  await page.click('#kartenfuss >> text=Namen aus');
  await page.waitForTimeout(250);
  if (await page.locator('.baumschild').first().isVisible()) fehler.push('„Namen aus" schaltet nicht ab');
  await page.click('#kartenfuss >> text=Namen an');
  await page.waitForTimeout(250);
  if (!await page.locator('.baumschild').first().isVisible()) fehler.push('„Namen an" schaltet nicht ein');
  console.log('Namensschilder: schaltbar und zoomabhängig');

  /* --- Baum auf der Karte setzen -------------------------------------- */
  await page.click('#kartenfuss >> text=Baum 003 setzen');
  await page.waitForTimeout(250);
  fuss = await page.locator('#kartenfuss').innerText();
  if (!/Auf die Stelle tippen/.test(fuss)) fehler.push('Kein Hinweis zum Setzen: ' + fuss);

  const kasten = await page.locator('#kartenbox').boundingBox();
  await page.mouse.click(kasten.x + kasten.width * 0.4, kasten.y + kasten.height * 0.6);
  await page.waitForTimeout(500);

  marken = await page.locator('.baummarke').count();
  if (marken !== 3) fehler.push('Nach dem Setzen drei Marken erwartet, gezeichnet: ' + marken);
  const dritter = await page.evaluate(() => App._zustand().baeume[2]);
  if (!dritter.gpsLat || !dritter.gpsLon) fehler.push('Der gesetzte Baum hat keine Koordinaten');
  fuss = await page.locator('#kartenfuss').innerText();
  if (!/Alle Bäume verortet/.test(fuss)) fehler.push('Fußzeile meldet nicht, dass alles verortet ist: ' + fuss);
  console.log('Baum 003 gesetzt auf', dritter.gpsLat, '/', dritter.gpsLon);

  /* --- Marke verschieben ---------------------------------------------- */
  const vorher = await page.evaluate(() => App._zustand().baeume[0].gpsLat);
  const m1 = await page.locator('.baummarke').first().boundingBox();
  await page.mouse.move(m1.x + 15, m1.y + 15);
  await page.mouse.down();
  await page.mouse.move(m1.x + 15, m1.y + 95, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const nachher = await page.evaluate(() => App._zustand().baeume[0].gpsLat);
  if (vorher === nachher) fehler.push('Verschieben ändert die Koordinaten nicht: ' + vorher);
  if (parseFloat(nachher) >= parseFloat(vorher)) fehler.push('Nach unten gezogen, aber die Breite wuchs: ' + vorher + ' auf ' + nachher);
  console.log('Marke verschoben:', vorher, '→', nachher);

  /* --- Marke antippen öffnet den Baum --------------------------------- */
  await page.locator('.baummarke').first().click();
  await page.waitForTimeout(350);
  if (!await page.locator('.leaflet-popup').count()) fehler.push('Kein Steckbrief beim Antippen');
  await page.click('.leaflet-popup >> text=Baum öffnen');
  await page.waitForTimeout(450);
  if (!await page.isVisible('#view-baum')) fehler.push('Der Steckbrief öffnet den Baum nicht');
  const offen = await page.inputValue('#b_artDt');
  if (offen !== 'Rotbuche') fehler.push('Es öffnet der falsche Baum: ' + offen);
  console.log('Steckbrief öffnet:', offen);

  /* --- Aus dem Baumformular heraus auf der Karte setzen ----------------- */
  const vorSetzen = await page.evaluate(() => App._zustand().baeume[0].gpsLon);
  await page.click('text=Auf der Karte setzen');
  await page.waitForTimeout(700);
  if (!await page.isVisible('#view-liste')) fehler.push('„Auf der Karte setzen" wechselt nicht zur Liste');
  if (!await page.isVisible('#kartenBlock')) fehler.push('„Auf der Karte setzen" öffnet die Karte nicht');
  fuss = await page.locator('#kartenfuss').innerText();
  if (!/Baum 001 steht/.test(fuss)) fehler.push('Es wartet der falsche Baum: ' + fuss);
  const k2 = await page.locator('#kartenbox').boundingBox();
  await page.mouse.click(k2.x + k2.width * 0.7, k2.y + k2.height * 0.3);
  await page.waitForTimeout(500);
  const nachSetzen = await page.evaluate(() => App._zustand().baeume[0].gpsLon);
  if (vorSetzen === nachSetzen) fehler.push('Der Baum wurde nicht neu gesetzt: ' + vorSetzen);
  if (await page.locator('.baummarke').count() !== 3) fehler.push('Nach dem Neusetzen stimmt die Zahl der Marken nicht');
  console.log('Aus dem Formular gesetzt:', vorSetzen, '→', nachSetzen);

  await page.click('#umListe');
  await page.waitForTimeout(300);

  /* --- Nummer in der Liste führt zum Baum auf der Karte ---------------- */
  // Baum 002 liegt nordöstlich von 001, die Karte muss dorthin wandern
  const vorMitte = await page.evaluate(() => {
    const c = Karte._karte().getCenter(); return [c.lat, c.lng];
  });
  await page.click('#bz1 .nr');
  await page.waitForTimeout(900);
  if (!await page.isVisible('#kartenBlock')) fehler.push('Die Nummer wechselt nicht zur Karte');
  const nachMitte = await page.evaluate(() => {
    const c = Karte._karte().getCenter(); return [c.lat, c.lng];
  });
  if (vorMitte[0] === nachMitte[0] && vorMitte[1] === nachMitte[1])
    fehler.push('Die Karte wandert nicht zum Baum');
  const baum2 = await page.evaluate(() => App._zustand().baeume[1]);
  if (Math.abs(nachMitte[0] - parseFloat(baum2.gpsLat)) > 0.0002)
    fehler.push('Die Karte steht nicht über Baum 002: ' + nachMitte[0] + ' statt ' + baum2.gpsLat);
  const wach = await page.locator('.leaflet-marker-icon.wach .baummarke').innerText();
  if (wach !== '002') fehler.push('Die falsche Marke leuchtet: ' + wach);
  console.log('Nummer 002 angetippt → Karte steht über', nachMitte[0].toFixed(5));

  // Die Hervorhebung erlischt wieder von selbst
  await page.waitForTimeout(3000);
  if (await page.locator('.leaflet-marker-icon.wach').count())
    fehler.push('Die Hervorhebung bleibt für immer stehen');


  /* --- Baum ohne Standort: die Nummer bietet das Setzen an ------------- */
  await page.click('#umListe');
  await page.waitForTimeout(300);
  const ohne = await page.evaluate(() => {
    App._zustand().baeume[2].gpsLat = ''; App._zustand().baeume[2].gpsLon = '';
    App.zeichneListe();
    return document.querySelector('#bz2 .nr').className;
  });
  if (!/ohneort/.test(ohne)) fehler.push('Baum ohne Standort ist in der Liste nicht gekennzeichnet');
  await page.click('#bz2 .nr');
  await page.waitForTimeout(800);
  fuss = await page.locator('#kartenfuss').innerText();
  if (!/Baum 003 steht/.test(fuss)) fehler.push('Die Nummer bietet das Setzen nicht an: ' + fuss);
  await page.click('#kartenfuss >> text=Abbrechen');
  await page.waitForTimeout(250);
  console.log('Baum ohne Standort: Nummer startet das Setzen');

  await page.click('#umListe');
  await page.waitForTimeout(300);

  /* --- Auf dem Tablet stehen Liste und Karte nebeneinander ------------ */
  await page.setViewportSize({ width: 1194, height: 834 });
  await page.waitForTimeout(600);
  if (await page.isVisible('.umschalt')) fehler.push('Der Umschalter steht auf dem Tablet noch da');
  if (!await page.isVisible('#listeBlock')) fehler.push('Liste fehlt auf dem Tablet');
  if (!await page.isVisible('#kartenBlock')) fehler.push('Karte fehlt auf dem Tablet');

  /* Zeiger über der Listenzeile lässt die zugehörige Marke aufleuchten.
     Das ergibt nur hier Sinn, wo Liste und Karte gleichzeitig zu sehen sind. */
  await page.hover('#bz0');
  await page.waitForTimeout(300);
  const gehovert = await page.locator('.leaflet-marker-icon.wach .baummarke').allInnerTexts();
  if (gehovert.join(',') !== '001') fehler.push('Zeiger über Zeile 001 hebt hervor: ' + gehovert.join(','));
  await page.hover('#kartenfuss');
  await page.waitForTimeout(300);
  if (await page.locator('.leaflet-marker-icon.wach').count())
    fehler.push('Die Hervorhebung bleibt nach dem Verlassen der Zeile stehen');
  console.log('Zeiger über der Liste hebt die Marke hervor');

  const sp1 = await page.locator('#view-liste .sp1').boundingBox();
  const sp2 = await page.locator('#view-liste .sp2').boundingBox();
  if (sp2.x <= sp1.x + 40) fehler.push('Die Baumliste steht nicht neben dem Auftrag');
  if (Math.abs(sp1.y - sp2.y) > 30) fehler.push('Die Spalten beginnen nicht auf gleicher Höhe');
  console.log('Tablet: Auftrag ' + Math.round(sp1.width) + ' px, Bäume und Karte ' + Math.round(sp2.width) + ' px');

  /* Baumformular zweispaltig */
  await page.click('text=+ Baum aufnehmen');
  await page.waitForTimeout(400);
  const bs1 = await page.locator('#view-baum .sp1').boundingBox();
  const bs2 = await page.locator('#view-baum .sp2').boundingBox();
  if (bs2.x <= bs1.x + 40) fehler.push('Das Baumformular ist auf dem Tablet nicht zweispaltig');
  const knopf = await page.locator('#view-baum .breit').boundingBox();
  if (knopf.width < bs1.width + bs2.width) fehler.push('Die Speichern-Knöpfe laufen nicht über die volle Breite');
  console.log('Baumformular: Stammdaten ' + Math.round(bs1.width) + ' px, Befunde ' + Math.round(bs2.width) + ' px');

  /* Nichts darf über den rechten Rand hinauslaufen */
  const ueber = await page.evaluate(() => {
    const b = document.documentElement.clientWidth;
    return [].slice.call(document.querySelectorAll('#view-baum input, #view-baum select, #view-baum .btn'))
      .filter(e => e.getBoundingClientRect().right > b + 1).length;
  });
  if (ueber) fehler.push(ueber + ' Felder laufen über den rechten Rand');

  await browser.close();
  if (fehler.length) { console.error('\nFEHLER:\n' + fehler.map(f => ' - ' + f).join('\n')); process.exit(1); }
  console.log('\nKarte und Tablet-Layout in Ordnung.');
})();
