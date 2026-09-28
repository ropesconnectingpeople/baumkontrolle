/* Baumart-Eingabe: Suche, Mehrzahl, Tippfehler, Freitext, zuletzt genutzte Arten. */
const { chromium } = require('playwright');
const path = require('path');

const DATEI = 'file://' + path.join(__dirname, 'Baumkontrolle.html');

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 430, height: 932 } })).newPage();

  const fehler = [];
  page.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });

  await page.goto(DATEI);
  await page.waitForTimeout(700);

  /* --- Reine Suchlogik, ohne Oberfläche ------------------------------- */
  const proben = [
    ['Douglasien', 'Douglasie'],          // Mehrzahl, der Fall von der Baustelle
    ['douglasie', 'Douglasie'],
    ['Eichen', 'Stieleiche'],
    ['eiche', 'Stieleiche'],
    ['linden', 'Winterlinde'],
    ['Buche', 'Rotbuche'],
    ['Kastanie', 'Rosskastanie'],
    ['Akazie', 'Robinie'],                // gebräuchlicher Falschname
    ['Ahorn', 'Bergahorn'],
    ['Fichten', 'Fichte'],
    ['quercus', 'Stieleiche'],
    ['Tilia cordata', 'Winterlinde'],
    ['esche', 'Gemeine Esche'],
    ['Thuja', 'Lebensbaum'],
    ['blutbu', 'Blutbuche'],
    ['weissdorn', 'Weißdorn'],            // ohne Umlaut getippt
    ['Vogelbeere', 'Vogelbeere'],
    ['Waldkifer', 'Waldkiefer'],          // vertippt, kam so aus dem Feld zurück
    ['Rotbuchee', 'Rotbuche'],
    ['Fichte ', 'Fichte']                 // die Tastatur hängt gern ein Leerzeichen an
  ];

  for (const [eingabe, erwartet] of proben) {
    const erster = await page.evaluate(t => {
      const r = DATA.artFinden(t, 5);
      return r.length ? r[0].dt : '';
    }, eingabe);
    if (erster !== erwartet) fehler.push(`Suche "${eingabe}": erwartet ${erwartet}, bekam ${erster || '(nichts)'}`);
  }
  console.log('Suchproben geprüft:', proben.length);

  const anzahl = await page.evaluate(() => DATA.ARTEN.length);
  console.log('Arten im Katalog:', anzahl);
  if (anzahl < 150) fehler.push('Katalog zu klein: ' + anzahl);

  /* --- Bedienung im Feld ----------------------------------------------- */
  await page.click('text=+ Baum aufnehmen');
  await page.waitForTimeout(300);

  // Die Liste darf nicht überblenden, sondern muss unter dem Feld stehen
  await page.click('#b_artDt');
  await page.waitForTimeout(250);
  if (!await page.isVisible('#artVorschlaege')) fehler.push('Vorschläge öffnen nicht beim Antippen');
  if (await page.isVisible('.blende.an')) fehler.push('Baumart öffnet noch eine Einblendung');
  // Beide Kästen im selben Augenblick messen: das Antippen scrollt das Feld
  // weich nach oben, zwei getrennte Messungen erwischen es mitten im Weg.
  const [feldKasten, listKasten] = await page.evaluate(() =>
    ['b_artDt', 'artVorschlaege'].map(id => document.getElementById(id).getBoundingClientRect().toJSON()));
  if (listKasten.y < feldKasten.y + feldKasten.height - 2) fehler.push('Vorschlagsliste liegt über dem Feld');

  // Mehrzahl eintippen, ersten Treffer nehmen
  await page.fill('#b_artDt', 'Douglasien');
  await page.waitForTimeout(200);
  const ersteZeile = await page.locator('#artVorschlaege button').first().innerText();
  if (!/Douglasie/.test(ersteZeile)) fehler.push('Douglasien findet die Douglasie nicht: ' + ersteZeile);
  await page.click('#artVorschlaege button:first-child');
  await page.waitForTimeout(300);

  if (await page.isVisible('#artVorschlaege')) fehler.push('Liste bleibt nach der Auswahl offen');
  const wert = await page.inputValue('#b_artDt');
  if (wert !== 'Douglasie') fehler.push('Feldwert nach Auswahl: ' + wert);
  const bot = await page.locator('#b_artBot').innerText();
  if (bot !== 'Pseudotsuga menziesii') fehler.push('Botanischer Name fehlt: ' + bot);
  console.log('Douglasien →', wert, '/', bot);

  // Botanisch getippt wird zum deutschen Namen aufgelöst
  await page.fill('#b_artDt', 'Fagus sylvatica');
  await page.click('#b_hoehe');
  await page.waitForTimeout(350);
  const aufgeloest = await page.inputValue('#b_artDt');
  if (aufgeloest !== 'Rotbuche') fehler.push('Botanisch getippt nicht aufgelöst: ' + aufgeloest);
  console.log('Fagus sylvatica →', aufgeloest);

  // Freitext bleibt möglich, wird aber gekennzeichnet
  await page.fill('#b_artDt', 'Zierstrauch unbestimmt');
  await page.click('#b_hoehe');
  await page.waitForTimeout(350);
  const frei = await page.locator('#b_artBot').innerText();
  if (!/Freitext/.test(frei)) fehler.push('Freitext nicht gekennzeichnet: ' + frei);
  if (!/frei/.test(await page.getAttribute('#b_artBot', 'class'))) fehler.push('Freitext-Klasse fehlt');
  console.log('Freitext:', frei);

  // Gespeichert wird ohne erfundenen botanischen Namen
  await page.fill('#b_artDt', 'Douglasie');
  await page.fill('#b_hoehe', '22');
  await page.click('text=Speichern und nächsten Baum');
  await page.waitForTimeout(400);

  const b1 = await page.evaluate(() => App._zustand().baeume[0]);
  if (b1.artDt !== 'Douglasie' || b1.artBot !== 'Pseudotsuga menziesii') {
    fehler.push('Gespeicherte Art falsch: ' + b1.artDt + ' / ' + b1.artBot);
  }

  /* --- Zuletzt aufgenommen steht oben in der Liste, nicht mehr als
         Knopfreihe über dem Feld ------------------------------------- */
  // artFertig() schliesst die Liste mit kurzer Verzoegerung, deshalb erst
  // abwarten und dann gezielt oeffnen statt auf einen Klick zu hoffen.
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.getElementById('b_artDt').focus(); App.artOeffnen(); });
  await page.waitForTimeout(300);
  if (await page.locator('#artChips').count()) fehler.push('Die alte Knopfreihe steht noch im Formular');
  const kopfzeilen = await page.locator('#artVorschlaege .kopf').allInnerTexts();
  console.log('Gruppen in der Liste:', kopfzeilen.join(' · '));
  if (!kopfzeilen.some(k => /Zuletzt/i.test(k))) fehler.push('Gruppe „Zuletzt aufgenommen" fehlt');
  const ersterVorschlag = await page.locator('#artVorschlaege button').first().innerText();
  if (!/Douglasie/.test(ersterVorschlag)) fehler.push('Zuletzt genutzte Art steht nicht oben: ' + ersterVorschlag);

  // artOeffnen scrollt das Feld unter die Kopfzeile, waehrenddessen wandert der
  // Knopf. Deshalb nicht auf Koordinaten klicken, sondern den Knopf ausloesen.
  await page.evaluate(() => document.querySelector('#artVorschlaege button').click());
  await page.waitForTimeout(300);
  if (await page.inputValue('#b_artDt') !== 'Douglasie') fehler.push('Auswahl aus „Zuletzt" setzt die Art nicht');

  // Neuladen: der Artenspeicher übersteht den Neustart
  await page.fill('#b_artDt', 'Winterlinde');
  await page.click('text=Speichern und zurück');
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForTimeout(900);
  const gemerkt = await page.evaluate(() => App._zustand().artenZuletzt);
  if (!gemerkt || gemerkt.indexOf('Winterlinde') < 0) fehler.push('artenZuletzt nicht gesichert: ' + JSON.stringify(gemerkt));
  console.log('Gemerkte Arten:', (gemerkt || []).join(' · '));

  await browser.close();
  if (fehler.length) { console.error('\nFEHLER:\n' + fehler.map(f => ' - ' + f).join('\n')); process.exit(1); }
  console.log('\nBaumart-Eingabe in Ordnung.');
})();
