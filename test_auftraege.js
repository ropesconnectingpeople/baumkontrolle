/* Mehrere Auftraege nebeneinander: anlegen, umschalten, ueberleben Neuladen. */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, 'Baumkontrolle.html'));
  await page.waitForTimeout(700);

  async function auftragFuellen(objekt, arten) {
    await page.evaluate(async (o) => {
      App.zeige('auftrag');
      const f = document.getElementById('a_objekt');
      f.value = o;
      f.dispatchEvent(new Event('change'));   // wie beim Verlassen des Feldes
      App.zeige('liste');
    }, objekt);
    for (const a of arten) {
      await page.evaluate((art) => {
        App.neuerBaum();
        document.getElementById('b_artDt').value = art;
        App.baumSpeichern(false);
      }, a);
      await page.waitForTimeout(80);
    }
  }

  await auftragFuellen('Fürstenauer Forst 14', ['Fichte', 'Douglasie']);
  await page.waitForTimeout(400);

  // Zweiter Auftrag
  await page.click('text=Aufträge wechseln');
  await page.waitForTimeout(500);
  await page.click('.blende button:has-text("Neuer Auftrag")');
  await page.waitForTimeout(400);
  await auftragFuellen('Schulhof Erbach', ['Rotbuche', 'Winterlinde', 'Bergahorn']);
  await page.waitForTimeout(500);

  let zahl = await page.evaluate(() => App._zustand().baeume.length);
  if (zahl !== 3) fehler.push('Zweiter Auftrag: erwartet 3 Bäume, gezählt ' + zahl);

  // Umschalten zurueck
  await page.click('text=Aufträge wechseln');
  await page.waitForTimeout(600);
  const eintraege = await page.locator('.blende .wahl').allInnerTexts();
  console.log('Aufträge in der Liste:', eintraege.length);
  eintraege.forEach(e => console.log('  ·', e.replace(/\s+/g, ' ').trim()));
  if (eintraege.length !== 2) fehler.push('Erwartet 2 Aufträge, gefunden ' + eintraege.length);

  await page.click('.blende .wahl:has-text("Fürstenauer")');
  await page.waitForTimeout(600);
  zahl = await page.evaluate(() => App._zustand().baeume.length);
  const objekt = await page.evaluate(() => App._zustand().auftrag.objekt);
  console.log('Nach dem Umschalten:', objekt, '|', zahl, 'Bäume');
  if (zahl !== 2) fehler.push('Nach Umschalten: erwartet 2 Bäume, gezählt ' + zahl);

  // Neuladen: derselbe Auftrag muss wieder offen sein
  await page.reload();
  await page.waitForTimeout(900);
  const nachher = await page.evaluate(() => ({
    objekt: App._zustand().auftrag.objekt, baeume: App._zustand().baeume.length
  }));
  console.log('Nach Neuladen:', nachher.objekt, '|', nachher.baeume, 'Bäume');
  if (nachher.baeume !== 2) fehler.push('Nach Neuladen: erwartet 2 Bäume, gezählt ' + nachher.baeume);
  if (!/Fürstenauer/.test(nachher.objekt || '')) fehler.push('Nach Neuladen falscher Auftrag: ' + nachher.objekt);

  await browser.close();
  if (fehler.length) { console.error('\nFEHLER:\n' + fehler.map(f => ' - ' + f).join('\n')); process.exit(1); }
  console.log('\nZwei Aufträge nebeneinander: läuft.');
})();
