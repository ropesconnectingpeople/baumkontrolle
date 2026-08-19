/* Prüft die gehostete Fassung: Offline-Start, Speicher, Installierbarkeit. */
const { chromium } = require('/home/claude/node_modules/playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const DOCS = path.join(__dirname, 'docs');
const PORT = 8099;

const TYPEN = { '.html': 'text/html', '.js': 'text/javascript',
                '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const datei = path.join(DOCS, p);
  if (!fs.existsSync(datei)) { res.writeHead(404); res.end('weg'); return; }
  res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
  fs.createReadStream(datei).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));

  const URL = `http://localhost:${PORT}/`;
  await page.goto(URL);
  await page.waitForTimeout(1200);

  // Manifest vorhanden und gültig
  const manifest = await page.evaluate(async () => {
    const l = document.querySelector('link[rel=manifest]');
    if (!l) return null;
    const r = await fetch(l.href);
    return r.ok ? await r.json() : null;
  });
  if (!manifest) fehler.push('Manifest fehlt oder ist ungültig');
  else console.log('Manifest:', manifest.short_name, '·', manifest.display, '·',
                   manifest.icons.length, 'Icons');

  // Service Worker registriert?
  const sw = await page.evaluate(() => Promise.race([
    navigator.serviceWorker.getRegistration().then(r => !!(r && (r.active || r.installing || r.waiting))),
    new Promise(r => setTimeout(() => r(false), 4000))
  ]));
  if (!sw) fehler.push('Service Worker nicht registriert');
  else console.log('Service Worker: registriert');

  // Daten anlegen
  await page.evaluate(() => {
    App.zeige('auftrag');
    document.getElementById('a_objekt').value = 'Baustelle Testweg';
    document.getElementById('a_objekt').dispatchEvent(new Event('change'));
    App.neuerBaum();
    document.getElementById('b_nr').value = '001';
    document.getElementById('b_hoehe').value = '12';
    App.baumSpeichern(false);
  });
  await page.waitForTimeout(400);

  // Warten, bis der Service Worker die Seite kontrolliert
  await page.evaluate(() => Promise.race([
    navigator.serviceWorker.ready,
    new Promise(r => setTimeout(r, 4000))
  ]));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(800);

  // Jetzt Netz kappen und neu laden – die App muss trotzdem starten
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(e => fehler.push('Offline-Reload: ' + e.message));
  await page.waitForTimeout(1000);

  const offlineStart = await page.evaluate(() =>
    !!document.getElementById('view-liste') && typeof App !== 'undefined');
  if (!offlineStart) fehler.push('App startet offline nicht');
  else console.log('Offline-Start: ok');

  const baeume = await page.evaluate(() => App._zustand().baeume.length);
  console.log('Bäume nach Offline-Neustart:', baeume);
  if (baeume !== 1) fehler.push('Daten nach Offline-Neustart verloren: ' + baeume);

  // PDF auch offline
  await ctx.setOffline(true);
  const pdfOk = await page.evaluate(() => {
    try { return !!PDF.erzeugen({ auftrag: { objekt: 'Test' },
      baeume: App._zustand().baeume }, { modus: 'einzel' }); }
    catch (e) { return 'FEHLER: ' + e.message; }
  });
  if (pdfOk !== true) fehler.push('PDF offline: ' + pdfOk);
  else console.log('PDF offline: ok');

  await ctx.setOffline(false);
  await browser.close();
  server.close();

  if (fehler.length) {
    console.log('\nFEHLER:');
    fehler.forEach(f => console.log(' - ' + f));
    process.exit(1);
  }
  console.log('\nGehostete Fassung läuft offline.');
})();
