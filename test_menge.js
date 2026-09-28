/* Haelt die Ablage eine Kontrolle mit vielen Fotos aus? Frueher war bei 4 MB Schluss. */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + require('path').join(__dirname, 'Baumkontrolle.html'));
  await page.waitForTimeout(700);

  const mb = await page.evaluate(async () => {
    // Foto in der Groesse, die vom Telefon kommt: 960 x 1280
    const c = document.createElement('canvas');
    c.width = 960; c.height = 1280;
    const g = c.getContext('2d');
    // Echtes Pixelrauschen, sonst komprimiert JPEG das Bild auf ein Zehntel
    const bild = g.createImageData(960, 1280);
    for (let i = 0; i < bild.data.length; i += 4) {
      bild.data[i] = Math.random() * 255;
      bild.data[i + 1] = Math.random() * 255;
      bild.data[i + 2] = Math.random() * 255;
      bild.data[i + 3] = 255;
    }
    g.putImageData(bild, 0, 0);
    const foto = c.toDataURL('image/jpeg', 0.72);

    for (let i = 0; i < 18; i++) {
      App.neuerBaum();
      document.getElementById('b_artDt').value = 'Fichte';
      App._zustand().baeume[App._zustand().baeume.length - 1].fotos = [foto];
      App.baumSpeichern(false);
    }
    await new Promise(r => setTimeout(r, 1500));
    return JSON.stringify(App._zustand()).length / 1024 / 1024;
  });
  console.log('Auftrag im Speicher:', mb.toFixed(1), 'MB');

  await page.reload();
  await page.waitForTimeout(1500);
  const nachher = await page.evaluate(() => {
    const S = App._zustand();
    return { baeume: S.baeume.length, fotos: S.baeume.filter(b => (b.fotos || []).length).length };
  });
  console.log('Nach Neuladen:', nachher.baeume, 'Bäume,', nachher.fotos, 'davon mit Foto');
  if (nachher.baeume !== 18) fehler.push('Bäume verloren: ' + nachher.baeume + ' statt 18');
  if (nachher.fotos !== 18) fehler.push('Fotos verloren: ' + nachher.fotos + ' statt 18');

  await browser.close();
  if (fehler.length) { console.error('\nFEHLER:\n' + fehler.map(f => ' - ' + f).join('\n')); process.exit(1); }
  console.log('\nDie Menge hält.');
})();
