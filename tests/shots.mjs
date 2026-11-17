// Solmar Heat — screenshot script: stages four real gameplay scenes in
// headless Chrome and saves them as 1280x720 JPEGs under screenshots/.
// The first file by name (1-chase.jpg) is the cover.
//
//   node tests/shots.mjs
// Exit code 0 = all four shots written, each <= 256 KiB.

import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, launchBrowser, newGamePage, state, holdKey, pressKey, waitForState } from './helpers.mjs';

const SHOTS_DIR = fileURLToPath(new URL('../screenshots/', import.meta.url));
mkdirSync(SHOTS_DIR, { recursive: true });

const { server, port } = await startServer();
const browser = await launchBrowser();
const { page, errors } = await newGamePage(browser, port);

async function shot(name) {
  const file = join(SHOTS_DIR, name);
  await page.screenshot({ path: file, type: 'jpeg', quality: 80 });
  const size = statSync(file).size;
  console.log(`  ${name}: ${(size / 1024).toFixed(0)} KiB`);
  if (size > 262144) { console.error(`  FAIL ${name} exceeds 256 KiB`); process.exitCode = 1; }
  return file;
}

async function startFresh() {
  await page.evaluate(() => localStorage.clear());
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__solmar, null, { timeout: 10000 });
  await page.click('#btn-start');
  await page.waitForTimeout(500);
}

console.log('== Solmar Heat screenshots ==');

// 1 — CHASE (cover): driving the gold coupe at speed with 3 stars and
// cruisers closing in, mission marker and minimap on the HUD.
await startFresh();
await page.evaluate(() => window.__solmar.startMission(1));
const gold = await page.evaluate(() => window.__solmar.targetCar());
await page.evaluate((g) => window.__solmar.teleport(g.x, g.y), gold);
await pressKey(page, 'KeyE');
await waitForState(page, (s) => s.inCar, 5000, 'in gold coupe');
await page.evaluate(() => window.__solmar.setWanted(3));
await page.keyboard.down('KeyW');
await page.waitForTimeout(2600); // let the cruisers close in
await shot('1-chase.jpg');
await page.keyboard.up('KeyW');

// 2 — PICKUP: on foot at Sunset Pier, mission marker over the marina,
// package prompt showing.
await startFresh();
await page.evaluate(() => window.__solmar.startMission(0));
await page.evaluate(() => window.__solmar.teleport(2450, 2190));
await page.waitForTimeout(600);
await shot('2-pickup.jpg');

// 3 — SHOOTOUT: on foot at Solmar Plaza, three thugs with health bars,
// muzzle flash from the player's pistol.
await startFresh();
await page.evaluate(() => window.__solmar.startMission(1));
await page.evaluate(() => {
  const g = window.__solmar.game;
  g.player.x = 1910; g.player.y = 700;
  g.spawnEnemy(1980, 640);
  g.spawnEnemy(1840, 660);
  g.spawnEnemy(1960, 780);
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  const g = window.__solmar.game;
  window.__solmar.shootAt(1980, 640);
});
await page.waitForTimeout(120);
await shot('3-shootout.jpg');

// 4 — TITLE: the start screen over the live city (garage district).
await page.evaluate(() => localStorage.clear());
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__solmar, null, { timeout: 10000 });
await page.waitForTimeout(1500); // camera settles on the garage district
await shot('4-title.jpg');

if (errors.length) {
  console.error('console/page errors during shots:', errors.slice(0, 5).join(' | '));
  process.exitCode = 1;
} else {
  console.log('  no console errors');
}
await browser.close();
server.close();
console.log('done, exit ' + (process.exitCode || 0));
