/* Fotos im Bericht: Seitenverhältnis, Größe, kein leerer Kasten.
 *
 * Geprüft wird am fertigen PDF, nicht an der Rechnung dahinter: Die Seite
 * wird gerendert und die Bildkante im Pixelbild gesucht. Nur so fällt auf,
 * wenn ein Hochformat wieder in die Breite gezogen wird.
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const AUS = path.join(__dirname, 'testausgabe');

/** Sucht im gerenderten PNG den Kasten der Testfarbe und gibt mm zurück. */
function kasten(png) {
  const py = `
from PIL import Image
im = Image.open(${JSON.stringify(png)}).convert('RGB')
W, H = im.size
px = im.load()
x0, y0, x1, y1 = W, H, -1, -1
for y in range(H):
    for x in range(W):
        r, g, b = px[x, y]
        if r > 180 and b > 180 and g < 90:          # Magenta
            if x < x0: x0 = x
            if x > x1: x1 = x
            if y < y0: y0 = y
            if y > y1: y1 = y
print(0 if x1 < 0 else (x1 - x0 + 1) * 210.0 / W, (0 if y1 < 0 else (y1 - y0 + 1) * 297.0 / H))
`;
  const aus = execFileSync('python3', ['-c', py]).toString().trim().split(' ');
  return { b: parseFloat(aus[0]), h: parseFloat(aus[1]) };
}

(async () => {
  fs.mkdirSync(AUS, { recursive: true });
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));

  await page.goto('file://' + path.join(__dirname, 'Baumkontrolle.html'));
  await page.waitForTimeout(700);

  async function bericht(mase, datei) {
    const b64 = await page.evaluate((mase) => {
      /* Einfarbiges Testbild in den gewünschten Pixelmaßen. */
      const fotos = mase.map(function (m) {
        const c = document.createElement('canvas');
        c.width = m[0]; c.height = m[1];
        const g = c.getContext('2d');
        g.fillStyle = '#e01ec8';
        g.fillRect(0, 0, m[0], m[1]);
        return c.toDataURL('image/jpeg', 0.9);
      });
      const doc = PDF.erzeugen({
        auftrag: { objekt: 'Fototest', kontrolleur: 'Test', datum: '19.08.2026' },
        baeume: [{
          nr: '001', artDt: 'Douglasie', artBot: 'Pseudotsuga menziesii',
          hoehe: '20', phase: 'Reifephase', zustand: 'gesund', erwartung: 'höher',
          befunde: { K: [], S: [], W: [], Wu: [], V: [] },
          massnahmen: [], ks: [], fotos: fotos, historie: []
        }]
      }, { modus: 'einzel' });
      return doc.output('datauristring').split(',')[1];
    }, mase);
    const ziel = path.join(AUS, datei);
    fs.writeFileSync(ziel, Buffer.from(b64, 'base64'));
    execFileSync('pdftoppm', ['-r', '100', '-f', '2', '-l', '2', '-png', ziel, ziel.replace(/\.pdf$/, '')]);
    return kasten(ziel.replace(/\.pdf$/, '-2.png'));
  }

  /* --- ein Hochformat, wie es vom Telefon kommt ------------------------- */
  const hoch = await bericht([[960, 1280]], 'foto_hoch.pdf');
  const vHoch = hoch.b / hoch.h;
  console.log(`Hochformat 3:4  →  ${hoch.b.toFixed(1)} × ${hoch.h.toFixed(1)} mm, Verhältnis ${vHoch.toFixed(3)}`);
  if (Math.abs(vHoch - 0.75) > 0.03) fehler.push('Hochformat verzerrt: ' + vHoch.toFixed(3) + ' statt 0,75');
  if (hoch.h < 60) fehler.push('Hochformat zu klein: ' + hoch.h.toFixed(1) + ' mm');

  /* --- ein Querformat --------------------------------------------------- */
  const quer = await bericht([[1280, 960]], 'foto_quer.pdf');
  const vQuer = quer.b / quer.h;
  console.log(`Querformat 4:3  →  ${quer.b.toFixed(1)} × ${quer.h.toFixed(1)} mm, Verhältnis ${vQuer.toFixed(3)}`);
  if (Math.abs(vQuer - 4 / 3) > 0.05) fehler.push('Querformat verzerrt: ' + vQuer.toFixed(3) + ' statt 1,333');

  /* --- vier Bilder müssen nebeneinander auf die Seite passen ------------- */
  const vier = await bericht([[960, 1280], [960, 1280], [960, 1280], [960, 1280]], 'foto_vier.pdf');
  console.log(`Vier Hochformate →  Reihe ${vier.b.toFixed(1)} mm breit, ${vier.h.toFixed(1)} mm hoch`);
  if (vier.b > 187) fehler.push('Vier Fotos laufen über den Satzspiegel: ' + vier.b.toFixed(1) + ' mm');
  if (Math.abs(vier.h * 0.75 * 4 + 6 - vier.b) > 3) fehler.push('Vier Fotos nicht gleich hoch oder falsch verteilt');

  /* --- ohne Fotos kein leerer Kasten ------------------------------------ */
  const ohne = await page.evaluate(() => {
    const doc = PDF.erzeugen({
      auftrag: { objekt: 'Fototest' },
      baeume: [{ nr: '002', artDt: 'Fichte', befunde: { K: [], S: [], W: [], Wu: [], V: [] },
                 massnahmen: [], ks: [], fotos: [], historie: [] }]
    }, { modus: 'einzel' });
    return doc.output('datauristring').split(',')[1];
  });
  fs.writeFileSync(path.join(AUS, 'foto_ohne.pdf'), Buffer.from(ohne, 'base64'));
  const text = execFileSync('pdftotext', [path.join(AUS, 'foto_ohne.pdf'), '-']).toString();
  if (/FOTODOKUMENTATION/i.test(text)) fehler.push('Ohne Fotos wird trotzdem ein Fotoblock gezeichnet');
  else console.log('Ohne Fotos: kein Block, kein leerer Kasten');

  await browser.close();
  if (fehler.length) { console.error('\nFEHLER:\n' + fehler.map(f => ' - ' + f).join('\n')); process.exit(1); }
  console.log('\nFotos sitzen richtig.');
})();
