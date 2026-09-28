/* Vollerfassung: Auftrag, zwei Bäume, PDF und Excel. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DATEI = 'file://' + path.join(__dirname, 'Baumkontrolle.html');
const AUS = path.join(__dirname, 'testausgabe');

(async () => {
  fs.mkdirSync(AUS, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 430, height: 932 } });
  const page = await ctx.newPage();

  const fehler = [];
  page.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });

  await page.goto(DATEI);
  await page.waitForTimeout(400);

  // ---------- Auftrag ----------
  await page.click('#view-liste .btnreihe button:has-text("Bearbeiten")');
  await page.fill('#a_auftraggeber', 'Wohnungsgesellschaft Muster mbH');
  await page.fill('#a_objekt', 'Wohnanlage Prehnsweg 12–18');
  await page.fill('#a_auftragsNr', '2026-0147');
  await page.fill('#a_datum', '2026-08-04');
  await page.fill('#a_kontrolleur', 'Josua Hundertmark');
  await page.selectOption('#a_qualifikation', 'FLL-zertifizierter Baumkontrolleur');
  await page.selectOption('#a_witterung', 'trocken, bedeckt');
  await page.click('#view-auftrag .btn >> text="Übernehmen"');
  await page.waitForTimeout(200);

  // ---------- Baum 1 ----------
  await page.click('text=+ Baum aufnehmen');
  await page.waitForTimeout(200);
  await page.fill('#b_artDt', 'Stieleiche');
  await page.waitForTimeout(150);
  await page.click('#artVorschlaege button:first-child');
  await page.waitForTimeout(100);
  await page.fill('#b_hoehe', '18');
  await page.fill('#b_kroneD', '14');
  await page.fill('#b_stammumfang', '312');
  // Weitere Angaben aufklappen, dort liegen Kronenansatz und Alter
  if (!await page.isVisible('#b_kronenansatz')) {
    await page.click('#knopfBaum');
    await page.waitForTimeout(200);
  }
  await page.fill('#b_kronenansatz', '4.5');
  await page.fill('#b_alter', 'ca. 120');
  await page.fill('#b_lage', 'Prehnsweg');
  await page.fill('#b_hausNr', '14');
  if (!await page.isVisible('#b_flurstueck')) {
    await page.click('#knopfOrt');
    await page.waitForTimeout(200);
  }
  await page.fill('#b_flurstueck', 'Flur 3, Flst. 218/4');
  await page.selectOption('#b_umfeld', 'Rasen-/Grünfläche');
  await page.fill('#b_gpsLat', '53.55214');
  await page.fill('#b_gpsLon', '9.99342');
  await page.selectOption('#b_phase', 'Alterungsphase');
  await page.selectOption('#b_zustand', 'stärker geschädigt');
  await page.selectOption('#b_erwartung', 'höher');
  await page.selectOption('#b_roloff', '2 – Stagnation');
  await page.waitForTimeout(150);

  const vorschlag = await page.inputValue('#b_intervallMatrix');
  const naechste = await page.inputValue('#b_naechsteKontrolle');
  console.log('Intervallvorschlag:', vorschlag, '| nächste Kontrolle:', naechste);
  if (vorschlag !== 'jährlich') fehler.push('FLL-Matrix falsch: erwartet jährlich, bekam ' + vorschlag);

  // Symptome
  // Die Symptome liegen seit Fassung 2.1 in Reitergruppen, nur die aktive
  // Gruppe steht im DOM. Vor jedem Klick auf die passende Gruppe schalten.
  for (const code of ['K2', 'K13', 'K15', 'S3', 'W4', 'V3']) {
    const gruppe = code.replace(/[0-9]+$/, '');
    await page.evaluate(g => App.symGruppe(g), gruppe);
    await page.waitForTimeout(80);
    await page.click(`#lab${code} input`);
  }
  await page.waitForTimeout(200);
  const pilzSichtbar = await page.isVisible('#pilzKarte');
  if (!pilzSichtbar) fehler.push('Pilzkarte erscheint nicht bei W4');
  await page.selectOption('#b_pilzName', { label: 'Riesenporling' });
  await page.fill('#b_pilzLage', 'Wurzelanlauf SW');
  const faeule = await page.inputValue('#b_pilzFaeule');
  if (faeule !== 'Weißfäule') fehler.push('Fäuletyp nicht automatisch gesetzt: ' + faeule);

  await page.fill('#b_befundtext',
    'Am südwestlichen Wurzelanlauf mehrere Fruchtkörper des Riesenporlings. Der Pilz verursacht ' +
    'eine Weißfäule im Wurzel- und Stammfußbereich und beeinträchtigt die Standsicherheit. ' +
    'In der Krone Totholz bis ca. 12 cm über Gehweg und Stellplätzen, im Süden ein Starkast mit ' +
    'aufgehendem Längsriss an der Astbasis.');
  await page.click('text=+ Wurzelanlauf durch Efeubewuchs verdeckt');
  await page.fill('#b_bemerkung', 'Eigentümer am Kontrolltag mündlich informiert.');

  // Maßnahmen
  await page.click('text=+ Maßnahme');
  await page.waitForTimeout(150);
  await page.click('.blende button:has-text("Eingehende Untersuchung veranlassen")');
  await page.waitForTimeout(150);
  await page.click('.blende .wahl:has-text("6 Wochen")');
  await page.waitForTimeout(200);

  await page.click('text=+ Maßnahme');
  await page.waitForTimeout(150);
  await page.click('.blende button:has-text("Totholzentnahme")');
  await page.waitForTimeout(150);
  await page.click('.blende .wahl:has-text("6 Wochen")');
  await page.waitForTimeout(200);

  await page.click('text=+ Maßnahme');
  await page.waitForTimeout(150);
  await page.click('.blende button:has-text("Entlastungsschnitt")');
  await page.waitForTimeout(150);
  await page.click('.blende .wahl:has-text("6 Monate")');
  await page.waitForTimeout(200);

  const mZahl = await page.locator('.mzeile').count();
  if (mZahl !== 3) fehler.push('Maßnahmen: erwartet 3, gezählt ' + mZahl);

  await page.click('text=Speichern und nächsten Baum');
  await page.waitForTimeout(300);

  // ---------- Baum 2 ----------
  await page.fill('#b_artDt', 'Winterlinde');
  await page.waitForTimeout(150);
  await page.click('#artVorschlaege button:first-child');
  await page.waitForTimeout(100);
  await page.fill('#b_hoehe', '14');
  await page.fill('#b_kroneD', '9');
  await page.fill('#b_stammumfang', '186');
  await page.fill('#b_lage', 'Prehnsweg');
  await page.fill('#b_hausNr', '16');
  await page.selectOption('#b_phase', 'Reifephase');
  await page.selectOption('#b_zustand', 'gesund');
  await page.selectOption('#b_erwartung', 'höher');
  await page.waitForTimeout(150);
  const v2 = await page.inputValue('#b_intervallMatrix');
  if (v2 !== '2 Jahre') fehler.push('FLL-Matrix Reife/höher: erwartet 2 Jahre, bekam ' + v2);
  await page.click('text=Speichern und zurück');
  await page.waitForTimeout(300);

  // ---------- Baum 3: gleiche Leistung, gleiche Höhenklasse wie Baum 1 ----------
  await page.click('text=+ Baum aufnehmen');
  await page.waitForTimeout(200);
  await page.fill('#b_artDt', 'Rotbuche');
  await page.waitForTimeout(150);
  await page.click('#artVorschlaege button:first-child');
  await page.waitForTimeout(100);
  await page.fill('#b_hoehe', '17');
  await page.fill('#b_lage', 'Prehnsweg');
  await page.fill('#b_hausNr', '18');
  await page.selectOption('#b_phase', 'Alterungsphase');
  await page.selectOption('#b_zustand', 'leicht geschädigt');
  await page.click('text=+ Maßnahme');
  await page.waitForTimeout(150);
  await page.click('.blende button:has-text("Totholzentnahme")');
  await page.waitForTimeout(150);
  await page.click('.blende .wahl:has-text("6 Wochen")');
  await page.waitForTimeout(200);
  await page.click('text=Speichern und zurück');
  await page.waitForTimeout(300);

  const zeilen = await page.locator('.baumzeile').count();
  console.log('Bäume in der Liste:', zeilen);
  if (zeilen !== 3) fehler.push('Baumliste: erwartet 3 Zeilen, gezählt ' + zeilen);

  // ---------- PDF ----------
  await page.evaluate(() => App.zeige('ergebnisse'));
  await page.waitForTimeout(250);
  const dl = page.waitForEvent('download', { timeout: 30000 });
  await page.click('text=PDF erzeugen');
  const download = await dl;
  const pdfPfad = path.join(AUS, 'bericht.pdf');
  await download.saveAs(pdfPfad);
  console.log('PDF:', download.suggestedFilename(), (fs.statSync(pdfPfad).size / 1024).toFixed(0) + ' KB');

  // ---------- Excel ----------
  const dl2 = page.waitForEvent('download', { timeout: 30000 });
  await page.click('text=Excel-Bestandsliste');
  const d2 = await dl2;
  await d2.saveAs(path.join(AUS, 'bestand.xlsx'));
  console.log('Excel:', d2.suggestedFilename());

  // ---------- Neuladen: bleiben die Daten? ----------
  await page.reload();
  await page.waitForTimeout(500);
  const nachher = await page.locator('.baumzeile').count();
  if (nachher !== 3) fehler.push('Nach Neuladen: erwartet 3 Bäume, gezählt ' + nachher);
  else console.log('Speicherung nach Neuladen: ok');

  await browser.close();

  if (fehler.length) {
    console.log('\nFEHLER:');
    fehler.forEach(f => console.log(' - ' + f));
    process.exit(1);
  }
  console.log('\nAlles durchgelaufen.');
})();
