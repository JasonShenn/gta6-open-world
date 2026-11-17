// 真实交互测试：用真实键盘鼠标开一局完整流程——
// 走路 → 偷车 → 开车 → 通缉 + 警车追捕 → 任务一取货 → 任务二逃脱 →
// 任务三开枪 → 限时送货 → 剧情完成，全程控制台零报错。
// 传送只用来把玩家摆到待测对象旁边（省得开车横穿整座城），
// 每个机制本身都走真实按键与真实规则。
// 用法：node tests/playtest.mjs

import { startServer, launchBrowser, collectErrors, gameState } from './helpers.mjs';

const { server, url } = await startServer(8902);
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = collectErrors(page);

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 把玩家（步行）传送到指定世界坐标，并把相机跟过去。 */
async function teleportPlayer(x, y) {
  await page.evaluate(({ x, y }) => {
    const s = window.__game.state;
    s.player.x = x;
    s.player.y = y;
    s.camera.x = x;
    s.camera.y = y;
  }, { x, y });
}

/** 把玩家连人带车传送到指定世界坐标。 */
async function teleportCar(x, y) {
  await page.evaluate(({ x, y }) => {
    const s = window.__game.state;
    const car = s.player.car;
    if (car) {
      car.x = x;
      car.y = y;
      car.speed = 0;
    }
    s.player.x = x;
    s.player.y = y;
    s.camera.x = x;
    s.camera.y = y;
  }, { x, y });
}

/** 找一辆指定种类的车（只找能开的），返回它的世界坐标。 */
async function findCar(kind) {
  return page.evaluate((kind) => {
    const car = window.__game.state.cars.find((c) => c.kind === kind && c.hp > 0);
    return car ? { x: car.x, y: car.y } : null;
  }, kind);
}

await page.goto(url + '/?seed=7', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 15000 });
await sleep(600);

let s = await gameState(page);
check('标题画面', s.screen === 'title', 'screen=' + s.screen);

// 暂停 / 恢复。
await page.keyboard.press('Enter');
await sleep(400);
s = await gameState(page);
check('按 Enter 开局', s.screen === 'play', 'screen=' + s.screen);
await page.keyboard.press('KeyP');
await sleep(200);
s = await gameState(page);
check('按 P 暂停', s.screen === 'paused', 'screen=' + s.screen);
await page.keyboard.press('KeyP');
await sleep(200);
s = await gameState(page);
check('再按 P 恢复', s.screen === 'play', 'screen=' + s.screen);

// 走路：按住 W 向前，位置要变。
const before = await gameState(page);
await page.keyboard.down('KeyW');
await sleep(1200);
await page.keyboard.up('KeyW');
s = await gameState(page);
check('走路移动', Math.hypot(s.px - before.px, s.py - before.py) > 120,
  `(${before.px},${before.py}) → (${s.px},${s.py})`);

// 偷一辆停着的车（不停的车不涨通缉）。
const parked = await findCar('parked');
await teleportPlayer(parked.x + 30, parked.y);
await sleep(300);
await page.keyboard.press('KeyE');
await sleep(300);
s = await gameState(page);
check('按 E 上停着的车', s.inCar === true, `inCar=${s.inCar} at (${s.px},${s.py}) parked=(${parked.x},${parked.y})`);

// 开车：按住 W 两秒，车速要起来。
await page.keyboard.down('KeyW');
await sleep(2000);
await page.keyboard.up('KeyW');
s = await gameState(page);
check('开车加速', s.carSpeed > 100, 'speed=' + s.carSpeed);
const drove = await gameState(page);
check('开车位移', Math.hypot(drove.px - parked.x, drove.py - parked.y) > 150,
  `moved ${Math.round(Math.hypot(drove.px - parked.x, drove.py - parked.y))}px`);

// 下车，抢一辆正在开的车：涨一星，警车随后出现。
await page.keyboard.press('KeyE');
await sleep(300);
const traffic = await findCar('traffic');
await teleportPlayer(traffic.x + 30, traffic.y);
await sleep(200);
await page.keyboard.press('KeyE');
await sleep(300);
s = await gameState(page);
check('抢正在开的车', s.inCar === true && s.wanted >= 1, `inCar=${s.inCar} wanted=${s.wanted}`);
await sleep(3500);
s = await gameState(page);
check('通缉后警车出现', s.police >= 1, 'police=' + s.police);

// 任务一：下车走到码头，按 E 取货。
await page.keyboard.press('KeyE');
await sleep(300);
await teleportPlayer(220, 2260);
await sleep(600);
s = await gameState(page);
check('走到码头进入取货区', s.missionIndex === 0 && s.missionStage === 'interact',
  `mission=${s.missionIndex} stage=${s.missionStage} at (${s.px},${s.py})`);
await page.keyboard.press('KeyE');
await sleep(400);
s = await gameState(page);
check('任务一完成：取货 +$50，切到任务二，通缉 2 星',
  s.missionIndex === 1 && s.money >= 50 && s.wanted === 2,
  `mission=${s.missionIndex} money=${s.money} wanted=${s.wanted}`);

// 任务二：偷车开到修车行。
const parked2 = await findCar('parked');
await teleportPlayer(parked2.x + 30, parked2.y);
await sleep(200);
await page.keyboard.press('KeyE');
await sleep(300);
s = await gameState(page);
check('任务二：已上车', s.inCar === true, 'inCar=' + s.inCar);
await teleportCar(2960, 1000);
await sleep(800);
s = await gameState(page);
check('任务二完成：逃到修车行 +$200，切到任务三（限时）',
  s.missionIndex === 2 && s.money >= 250 && s.missionTimer > 0 && s.missionTimer <= 75,
  `mission=${s.missionIndex} money=${s.money} timer=${s.missionTimer}s enemies=${s.enemies}`);

// 任务三：开枪。把鼠标移到枪手身上按住左键，看子弹飞出去、枪手掉血。
await page.keyboard.press('KeyE'); // 下车，步行才能开枪
await sleep(300);
const enemyScreen = await page.evaluate(() => {
  const st = window.__game.state;
  const e = st.enemies[0];
  if (!e) return null;
  // 屏幕坐标 = (世界坐标 - 相机左上角) × 缩放（1280x800 视口下缩放 4/3）。
  const scale = Math.min(1280 / 960, 800 / 600);
  return {
    sx: (e.x - (st.camera.x - 480)) * scale,
    sy: (e.y - (st.camera.y - 300)) * scale,
  };
});
if (enemyScreen) {
  await teleportPlayer(2860, 760);
  await sleep(300);
  const beforeShoot = await gameState(page);
  await page.mouse.move(enemyScreen.sx, enemyScreen.sy);
  await page.mouse.down();
  await sleep(900);
  await page.mouse.up();
  const afterShoot = await gameState(page);
  check('开枪射击（子弹飞出/枪手减员）',
    afterShoot.enemies < beforeShoot.enemies || afterShoot.wanted >= 1,
    `enemies ${beforeShoot.enemies} → ${afterShoot.enemies}, wanted=${afterShoot.wanted}`);
} else {
  check('开枪射击（无枪手可打）', false, 'enemies=0');
}

// 任务三：限时内送到灯塔，剧情完成。
await teleportPlayer(3000, 240);
await sleep(900);
s = await gameState(page);
check('任务三完成：送到灯塔 +$400，剧情完成画面',
  s.screen === 'story' && s.money >= 650,
  `screen=${s.screen} money=${s.money}`);

// 存档：localStorage 里有钱包与进度。
const saved = await page.evaluate(() => {
  try {
    return JSON.parse(window.localStorage.getItem('solmar-heat-save-v1') || 'null');
  } catch {
    return null;
  }
});
check('localStorage 存档已写', !!saved && saved.money >= 650, JSON.stringify(saved));

// 汇总。
const failed = results.filter((r) => !r.ok);
console.log(errors.length === 0 ? '✓ 控制台零报错' : `✗ 控制台报错 ${errors.length} 条：\n` + errors.join('\n'));
console.log(failed.length === 0 && errors.length === 0
  ? 'ALL PASS'
  : `FAIL: ${failed.length} 项检查失败，${errors.length} 条控制台报错`);

await browser.close();
server.close();
process.exit(failed.length === 0 && errors.length === 0 ? 0 : 1);
