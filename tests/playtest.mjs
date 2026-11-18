// GOLDEN TIDE — tests/playtest.mjs
// One job: prove the game really plays — walk, enter a car, drive, steal,
// shoot, wanted rises, police chase, a mission advances to completion.
// Run: node tests/playtest.mjs (starts its own server on :8123).

import { startServer, openGame, launch, holdKey, check } from './helpers.mjs';

const failures = [];
const server = await startServer();
const { browser, page } = await launch();
try {
  const { errors, failed } = await openGame(page, '?seed=7');
  check(errors.length === 0, 'no console errors (' + errors.join(' | ') + ')', failures);
  check(failed.length === 0, 'no failed requests', failures);

  // Title screen is up; click to start.
  check(await page.evaluate(() => window.GT.mode === 'title'), 'title screen shows', failures);
  await page.mouse.click(640, 510);
  await page.waitForTimeout(300);
  check(await page.evaluate(() => window.GT.mode === 'play'), 'click starts the game', failures);

  // Walk: W moves the player north.
  const y0 = await page.evaluate(() => window.GT.player.y);
  await holdKey(page, 'w', 700);
  const y1 = await page.evaluate(() => window.GT.player.y);
  check(y1 < y0 - 30, 'walking moves the player (y ' + Math.round(y0) + ' -> ' + Math.round(y1) + ')', failures);

  // Teleport next to a parked car and steal it with E.
  await page.evaluate(() => {
    const g = window.GT;
    g.player.x = 1150; g.player.y = 2940; g.player.onFoot = true; g.player.car = null;
  });
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  const stolen = await page.evaluate(() => ({ inCar: !window.GT.player.onFoot, type: window.GT.player.car?.type, stars: window.GT.wanted.stars }));
  check(stolen.inCar, 'E enters a car', failures);
  check(stolen.stars >= 1, 'stealing raises wanted to ' + stolen.stars + ' star(s)', failures);

  // Drive: W accelerates the car.
  const s0 = await page.evaluate(() => Math.abs(window.GT.player.car.speed));
  await holdKey(page, 'w', 1200);
  const s1 = await page.evaluate(() => Math.abs(window.GT.player.car.speed));
  check(s1 > s0 + 60, 'driving accelerates (' + Math.round(s0) + ' -> ' + Math.round(s1) + ' px/s)', failures);

  // Police respond to the wanted level.
  await page.waitForTimeout(2500);
  const police = await page.evaluate(() => window.GT.police.length);
  check(police >= 2, 'police cruisers chase (' + police + ' on scene)', failures);

  // Get out, shoot: ammo drops, a bullet flies, wanted climbs.
  await page.keyboard.press('e');
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => ({ ammo: window.GT.player.ammo, heat: window.GT.wanted.heat }));
  await page.mouse.click(700, 300);
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ ammo: window.GT.player.ammo, heat: window.GT.wanted.heat, bullets: window.GT.bullets.length }));
  check(after.ammo === before.ammo - 1, 'shooting spends ammo (' + before.ammo + ' -> ' + after.ammo + ')', failures);
  check(after.heat > before.heat, 'shooting raises heat', failures);

  // Mission M1: teleport to the pier package, then to the garage — it completes.
  await page.evaluate(() => {
    const g = window.GT;
    g.missions.index = 0; g.missions.stage = 0;
    g.player.x = 300; g.player.y = 1750; g.player.onFoot = true; g.player.car = null;
    g.wanted.heat = 0; g.wanted.stars = 0;
  });
  await page.waitForTimeout(600);
  const stage1 = await page.evaluate(() => window.GT.missions.stage);
  check(stage1 === 1, 'M1 stage 0 completes at the pier (stage=' + stage1 + ')', failures);
  await page.evaluate(() => { const g = window.GT; g.player.x = 1300; g.player.y = 3050; });
  await page.waitForTimeout(600);
  const m1 = await page.evaluate(() => ({ index: window.GT.missions.index, money: window.GT.money }));
  check(m1.index === 1, 'M1 completes, M2 begins (mission index=' + m1.index + ')', failures);
  check(m1.money >= 150, 'M1 pays out (money $' + m1.money + ')', failures);

  // Pause works and the save file is written.
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.GT.mode === 'paused'), 'P pauses', failures);
  await page.keyboard.press('p');
  check(await page.evaluate(() => localStorage.getItem('golden-tide-save-v1') !== null), 'autosave writes localStorage', failures);

  // HUD reads: minimap, objective chip and money are on screen.
  const hud = await page.evaluate(() => {
    const g = window.GT;
    return { money: g.money, stars: g.wanted.stars, objective: g.missions.index };
  });
  check(hud.money > 0 && hud.objective === 1, 'HUD state sane (money $' + hud.money + ', mission ' + (hud.objective + 1) + ')', failures);
} finally {
  await browser.close();
  server.kill();
}

if (failures.length) { console.error('\nPLAYTEST FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('\nPLAYTEST PASSED');
