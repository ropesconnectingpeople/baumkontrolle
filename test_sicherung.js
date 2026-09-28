/* Sicherung laden: kommt als eigener Auftrag daneben, der offene bleibt unangetastet. */
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

  async function baeumeDazu(arten) {
    for (const a of arten) {
      await page.evaluate((art) => {
        App.neuerBaum();
        document.getElementById('b_artDt').value = art;
        App.baumSpeichern(false);
      }, a);
      await page.waitForTimeout(80);
    }
  }

  // Laufender Auftrag mit zwei Bäumen
  await page.evaluate(() => {
    App.zeige('auftrag');
    const f = document.getElementById('a_objekt');
    f.value = 'Pfarrgarten Michelstadt';
    f.dispatchEvent(new Event('change'));
    App.zeige('liste');
  });
  await baeumeDazu(['Stieleiche', 'Hainbuche']);
  await page.waitForTimeout(300);

  // Sicherung genau so, wie sicherungExport sie schreibt. Firmenname darin
  // absichtlich anders: der des Geräts muss bleiben.
  const sicherung = await page.evaluate(() => {
    const s = JSON.parse(JSON.stringify(App._zustand()));
    s.einstellungen.name = 'Fremdfirma aus der Sicherung';
    s.baeume[0].massnahmen = [{ text: 'Totholz entfernen', stufe: 3, frist: '', begruendung: '' }];
    return JSON.stringify(s);
  });
  const offenId = await page.evaluate(() => App._zustand().id);
  const firma = await page.evaluate(() => App._zustand().einstellungen.name);

  // Nach der Sicherung geht die Arbeit weiter: dritter Baum
  await baeumeDazu(['Spitzahorn']);
  await page.waitForTimeout(300);

  async function laden(knopf) {
    await page.setInputFiles('#importInput', {
      name: 'Baumkontrolle_Pfarrgarten.json', mimeType: 'application/json',
      buffer: Buffer.from(sicherung)
    });
    await page.waitForTimeout(400);
    await page.click('.blende .wahl:has-text("' + knopf + '")');
    await page.waitForTimeout(600);
  }

  async function auftraege() {
    return page.evaluate(() => new Promise(fertig => {
      const r = indexedDB.open('baumkontrolle');
      r.onsuccess = () => {
        const q = r.result.transaction('auftraege').objectStore('auftraege').getAll();
        q.onsuccess = () => fertig(q.result.map(a => ({ id: a.id, name: a.name, baeume: a.baeume })));
      };
    }));
  }

  // 1. Unverändert öffnen
  await laden('Unverändert öffnen');
  let z = await page.evaluate(() => ({ id: App._zustand().id, n: App._zustand().baeume.length,
    firma: App._zustand().einstellungen.name }));
  if (z.id === offenId) fehler.push('Unverändert: Sicherung hat die Kennung des offenen Auftrags übernommen');
  if (z.n !== 2) fehler.push('Unverändert: erwartet 2 Bäume, gezählt ' + z.n);
  if (z.firma !== firma) fehler.push('Unverändert: Firmenname aus der Sicherung übernommen: ' + z.firma);
  let liste = await auftraege();
  if (liste.length !== 2) fehler.push('Nach dem ersten Laden: erwartet 2 Aufträge, gefunden ' + liste.length);
  let alt = liste.find(a => a.id === offenId);
  if (!alt || alt.baeume !== 3) fehler.push('Offener Auftrag verändert: ' + JSON.stringify(alt));

  // 2. Als Folgekontrolle
  await laden('Als Folgekontrolle öffnen');
  z = await page.evaluate(() => {
    const s = App._zustand();
    return { n: s.baeume.length, datum: s.auftrag.datum, massn: s.baeume[0].massnahmen.length,
             hist: (s.baeume[0].historie || []).length, pflege: (s.baeume[0].historie || [{}])[0].pflege };
  });
  const heute = new Date().toISOString().slice(0, 10);
  if (z.n !== 2) fehler.push('Folgekontrolle: erwartet 2 Bäume, gezählt ' + z.n);
  if (z.datum !== heute) fehler.push('Folgekontrolle: Datum ' + z.datum + ' statt ' + heute);
  if (z.massn !== 0) fehler.push('Folgekontrolle: Maßnahmen nicht geleert');
  if (z.hist !== 1 || z.pflege !== 'Totholz entfernen') fehler.push('Folgekontrolle: Historie fehlt oder falsch');
  liste = await auftraege();
  if (liste.length !== 3) fehler.push('Nach der Folgekontrolle: erwartet 3 Aufträge, gefunden ' + liste.length);

  // Umschaltliste zeigt alle drei
  await page.click('text=Aufträge wechseln');
  await page.waitForTimeout(600);
  const eintraege = await page.locator('.blende .wahl').allInnerTexts();
  console.log('Aufträge in der Liste:', eintraege.length);
  eintraege.forEach(e => console.log('  ·', e.replace(/\s+/g, ' ').trim()));
  if (eintraege.length !== 3) fehler.push('Umschaltliste: erwartet 3 Einträge, gefunden ' + eintraege.length);

  // Neuladen: alle drei noch da, der ursprüngliche weiter mit drei Bäumen
  await page.reload();
  await page.waitForTimeout(900);
  liste = await auftraege();
  alt = liste.find(a => a.id === offenId);
  console.log('Nach Neuladen:', liste.length, 'Aufträge, ursprünglicher mit', alt && alt.baeume, 'Bäumen');
  if (liste.length !== 3) fehler.push('Nach Neuladen: erwartet 3 Aufträge, gefunden ' + liste.length);
  if (!alt || alt.baeume !== 3) fehler.push('Nach Neuladen: ursprünglicher Auftrag verändert');

  await browser.close();
  if (fehler.length) { console.error('\nFEHLER:\n' + fehler.map(f => ' - ' + f).join('\n')); process.exit(1); }
  console.log('\nSicherung laden legt eigenen Auftrag an: läuft.');
})();
