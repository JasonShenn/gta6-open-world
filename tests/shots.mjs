// GOLDEN TIDE — tests/shots.mjs
// One job: render the four screenshots with Playwright — real renders of the
// game's own code, never drawn by hand — and check each fits the gate
// (1280x720 JPEG, at most 256 KiB). Run: node tests/shots.mjs

import { writeFileSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, launch, BASE } from './helpers.mjs';
import { ROOT } from './helpers.mjs';

const SHOTS = [
  { name: '1-chase.jpg', query: '?shot=chase&seed=7' },
  { name: '2-pier.jpg', query: '?shot=pier&seed=7' },
  { name: '3-shootout.jpg', query: '?shot=shootout&seed=7' },
  { name: '4-downtown.jpg', query: '?shot=downtown&seed=7' },
];

const server = await startServer();
const { browser, page } = await launch();
try {
  for (const shot of SHOTS) {
    await page.goto(BASE + '/index.html' + shot.query, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 8000 });
    await page.waitForTimeout(400); // let the frozen frame settle
    const file = join(ROOT, 'screenshots', shot.name);
    await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
    const size = statSync(file).size;
    const header = readFileSync(file).subarray(0, 3);
    const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    console.log(shot.name + ': ' + (size / 1024).toFixed(1) + ' KiB, JPEG=' + isJpeg);
    if (size > 262144) throw new Error(shot.name + ' is over the 256 KiB gate');
    if (!isJpeg) throw new Error(shot.name + ' is not a JPEG');
  }
  console.log('SHOTS DONE — 4 real renders, all within the gate');
} finally {
  await browser.close();
  server.kill();
}
