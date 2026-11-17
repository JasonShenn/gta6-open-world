// Solmar Heat — full real-interaction playtest, run in headless Chrome
// over the real game. Every system is driven through the keyboard and
// mouse (plus the debug handle for teleports), and the run fails on any
// console error or any non-local network request.
//
//   node tests/playtest.mjs
// Exit code 0 = everything passed.

import { startServer, launchBrowser, newGamePage, state, holdKey, pressKey, waitForState } from './helpers.mjs';

let passed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log(`  PASS ${name}`); }
  else { console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); process.exitCode = 1; }
}

const { server, port } = await startServer();
const browser = await launchBrowser();
const { page, errors, requests } = await newGamePage(browser, port);

console.log('== Solmar Heat playtest ==');
console.log('serving game/ on 127.0.0.1:' + port);

// 1. Title screen loads, game boots, no errors yet.
check('title screen visible', await page.isVisible('#start-screen'));
check('start button present', await page.isVisible('#btn-start'));

// 2. Start a new game.
await page.click('#btn-start');
await page.waitForTimeout(400);
let s = await state(page);
check('game starts playing', s.state === 'playing', JSON.stringify(s));
check('mission 1 active on start', s.mission === 0 && s.missionActive === true, JSON.stringify(s));
check('objective shown', (await page.textContent('#hud-objective')).length > 5);

// 3. Walk: stand on a clear stretch of road, hold W, the player must move.
await page.evaluate(() => window.__solmar.teleport(980, 880));
await page.waitForTimeout(200);
const before = await state(page);
await holdKey(page, 'KeyW', 900);
s = await state(page);
const walked = Math.hypot(s.x - before.x, s.y - before.y);
check('walking moves the player', walked > 60, `moved ${Math.round(walked)}px`);

// 4. Sprint is faster than walking.
const s0 = await state(page);
await holdKey(page, 'KeyW', 500);
const s1 = await state(page);
const dWalk = Math.hypot(s1.x - s0.x, s1.y - s0.y);
await page.keyboard.down('ShiftLeft');
await holdKey(page, 'KeyW', 500);
await page.keyboard.up('ShiftLeft');
const s2 = await state(page);
const dSprint = Math.hypot(s2.x - s1.x, s2.y - s1.y);
check('sprint beats walking', dSprint > dWalk * 1.15, `walk ${Math.round(dWalk)} vs sprint ${Math.round(dSprint)}`);

// 5. Steal a car: teleport next to the nearest parked car, press E.
const car = await page.evaluate(() => window.__solmar.nearestParkedCar());
await page.evaluate((c) => window.__solmar.teleport(c.x, c.y), car);
await page.waitForTimeout(200);
await pressKey(page, 'KeyE');
s = await waitForState(page, (st) => st.inCar === true, 5000, 'entering car');
check('E steals the car', s.inCar === true, JSON.stringify(s));
check('stealing raises wanted to 1+', s.wanted >= 1, `wanted=${s.wanted}`);

// 6. Drive: hold W, speed must climb and the car must travel.
// Sample the peak speed: a cop ram or a bump can dip the final reading.
await page.keyboard.down('KeyW');
let peakSpeed = 0;
for (let i = 0; i < 9; i++) {
  await page.waitForTimeout(200);
  const sp = (await state(page)).speed;
  if (sp > peakSpeed) peakSpeed = sp;
}
await page.keyboard.up('KeyW');
s = await state(page);
check('driving accelerates', peakSpeed > 300, `peak speed=${peakSpeed}`);
const drove = Math.hypot(s.x - car.x, s.y - car.y);
check('car actually travels', drove > 250, `travelled ${Math.round(drove)}px`);
check('speedometer visible while driving', await page.isVisible('#hud-speed'));

// 7. Steering changes heading.
const headingBefore = await page.evaluate(() => window.__solmar.game.car.angle);
await page.keyboard.down('KeyW');
await holdKey(page, 'KeyA', 700);
await page.keyboard.up('KeyW');
const headingAfter = await page.evaluate(() => window.__solmar.game.car.angle);
check('steering turns the car', Math.abs(headingAfter - headingBefore) > 0.4,
  `angle ${headingBefore.toFixed(2)} -> ${headingAfter.toFixed(2)}`);

// 8. Get out with E.
await pressKey(page, 'KeyE');
s = await waitForState(page, (st) => st.inCar === false, 5000, 'exiting car');
check('E steps out of the car', s.inCar === false, JSON.stringify(s));

// 9. Shooting: on an open intersection, spawn a thug, shoot it until it drops.
await page.evaluate(() => window.__solmar.teleport(1600, 880));
await page.waitForTimeout(200);
await page.evaluate(() => {
  const g = window.__solmar.game;
  g.spawnEnemy(g.player.x + 170, g.player.y);
});
await page.waitForTimeout(200);
const moneyBefore = (await state(page)).money;
for (let i = 0; i < 4; i++) {
  const e = await page.evaluate(() => {
    const g = window.__solmar.game;
    const en = g.enemies[0];
    return en ? { x: en.x, y: en.y } : null;
  });
  if (!e) break;
  await page.evaluate((p) => window.__solmar.shootAt(p.x, p.y), e);
  await page.waitForTimeout(450);
}
s = await waitForState(page, (st) => st.enemies === 0, 8000, 'thug killed');
check('shooting kills the thug', s.enemies === 0, JSON.stringify(s));
check('kill pays $50', s.money === moneyBefore + 50, `$${moneyBefore} -> $${s.money}`);

// 10. Wanted + police: 2 stars must bring cruisers.
await page.evaluate(() => window.__solmar.setWanted(2));
s = await waitForState(page, (st) => st.cops >= 2, 8000, 'cops spawn');
check('2 stars spawn 2 cruisers', s.cops >= 2, JSON.stringify(s));
check('siren HUD shows stars', (await page.textContent('#hud-stars')).includes('★'));

// 11. Mission 1 — The Pickup, full flow through keyboard + teleports.
await page.evaluate(() => window.__solmar.setWanted(0));
await page.evaluate(() => window.__solmar.startMission(0));
await page.evaluate(() => window.__solmar.teleport(2450, 2030)); // Sunset Pier
await page.waitForTimeout(300);
check('pier prompt shows', (await page.textContent('#hud-prompt')).includes('Press E'), await page.textContent('#hud-prompt'));
await pressKey(page, 'KeyE');
await page.waitForTimeout(300);
s = await state(page);
check('pickup advances the mission', s.missionStep === 1, JSON.stringify(s));
await page.evaluate(() => window.__solmar.teleport(500, 620)); // Vera's Garage forecourt
await page.waitForTimeout(300);
await pressKey(page, 'KeyE');
s = await waitForState(page, (st) => st.completed === 1, 5000, 'mission 1 completes');
check('mission 1 completes, +$300', s.money >= moneyBefore + 50 + 300, `money=$${s.money}`);

// 12. Mission 2 — Hot Wheels: steal the gold coupe, deliver it.
await waitForState(page, (st) => st.mission === 1 && st.missionActive, 12000, 'mission 2 call');
const gold = await page.evaluate(() => window.__solmar.targetCar());
check('gold coupe is on the map', !!gold, JSON.stringify(gold));
await page.evaluate((g) => window.__solmar.teleport(g.x, g.y), gold);
await page.waitForTimeout(200);
await pressKey(page, 'KeyE');
s = await waitForState(page, (st) => st.inCar === true, 5000, 'stealing gold coupe');
check('gold coupe stolen', s.inCar === true, JSON.stringify(s));
await page.evaluate(() => window.__solmar.teleport(2960, 1780)); // Rust & Bolt Yard
s = await waitForState(page, (st) => st.completed === 2, 5000, 'mission 2 completes');
check('mission 2 completes, +$500', s.completed === 2, JSON.stringify(s));

// 13. Mission 3 — Deadline Run, timed, full flow.
// Step out of the coupe first: E while driving exits the car, and the
// pickup needs the player on foot.
await pressKey(page, 'KeyE');
await waitForState(page, (st) => st.inCar === false, 5000, 'out of coupe');
await waitForState(page, (st) => st.mission === 2 && st.missionActive, 12000, 'mission 3 call');
await page.evaluate(() => window.__solmar.teleport(2246, 1830)); // Harbor Market, west road side
await page.waitForTimeout(300);
await pressKey(page, 'KeyE');
await page.waitForTimeout(300);
s = await state(page);
check('crate picked up, timer running', s.missionStep === 1 && (await page.isVisible('#hud-timer')), JSON.stringify(s));
await page.evaluate(() => window.__solmar.teleport(2620, 450)); // Lumen Tower forecourt
await page.waitForTimeout(300);
await pressKey(page, 'KeyE');
s = await waitForState(page, (st) => st.completed === 3, 5000, 'mission 3 completes');
check('mission 3 completes, story done', s.completed === 3 && s.mission === -1, JSON.stringify(s));

// 14. Busted: stand next to a cruiser until the arrest lands.
// Keep re-planting the player on the cruiser so the arrest timer
// accumulates instead of the cruiser circling past.
await page.evaluate(() => window.__solmar.setWanted(1));
await waitForState(page, (st) => st.cops >= 1, 8000, 'cruiser for arrest');
let bustedAt = null;
for (let i = 0; i < 40; i++) {
  await page.evaluate(() => {
    const g = window.__solmar.game;
    const cop = g.cops[0];
    if (cop) { g.player.x = cop.x + 15; g.player.y = cop.y; }
  });
  await page.waitForTimeout(400);
  const st = await state(page);
  if (st.state === 'busted') { bustedAt = st; break; }
}
check('standing by a cruiser gets you busted', !!bustedAt, JSON.stringify(bustedAt));
check('busted screen shows', await page.isVisible('#busted-screen'));
s = await waitForState(page, (st) => st.state === 'playing' && st.wanted === 0, 8000, 'respawn after busted');
check('respawn at garage, heat cleared', s.state === 'playing' && s.wanted === 0, JSON.stringify(s));

// 15. Pause works.
await pressKey(page, 'Escape');
await page.waitForTimeout(200);
s = await state(page);
check('Esc pauses', s.state === 'paused', JSON.stringify(s));
await pressKey(page, 'Escape');
await page.waitForTimeout(200);
s = await state(page);
check('Esc resumes', s.state === 'playing', JSON.stringify(s));

// 16. Save: localStorage holds progress; reload offers Continue.
const saveRaw = await page.evaluate(() => localStorage.getItem('solmar-heat-save-v1'));
check('save written to localStorage', !!saveRaw && JSON.parse(saveRaw).money > 0, saveRaw);
const savedMoney = JSON.parse(saveRaw).money;
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__solmar, null, { timeout: 10000 });
check('Continue offered after reload', await page.isVisible('#btn-continue'));
await page.click('#btn-continue');
await page.waitForTimeout(400);
s = await state(page);
check('Continue restores money + state', s.state === 'playing' && s.money === savedMoney,
  `money=${s.money} saved=${savedMoney}`);

// 17. No console errors, no page errors, no non-local requests.
check('zero console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const external = requests.filter((u) => !u.startsWith('http://127.0.0.1') && !u.startsWith('data:'));
check('zero external network requests', external.length === 0, external.slice(0, 3).join(' | '));

await browser.close();
server.close();
console.log(`\n${passed} checks passed, exit ${process.exitCode || 0}`);
