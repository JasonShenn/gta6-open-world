// tests/playtest.mjs — 16 项玩法检查（Playwright 真实浏览器操作）。
// 覆盖：无 console 报错、无 failed request、走路、上车、偷车涨通缉到 2 星、驾驶加速、
// 4 辆警车追捕、开枪耗弹药涨热度、M1 两段推进到完成并付 $150、P 暂停、自动存档、HUD、
// 现金点、M 静音、标题画面 Continue。全部通过才算过。
// 等待一律用 waitForFunction 等状态达成（不依赖固定时长，帧率低也不 flaky）。
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME_PATH || `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;
const PORT = 8129;
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
function waitForServer(url, tries = 40) {
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try { const r = await fetch(url); if (r.ok) return resolve(); } catch {}
      if (--tries <= 0) return reject(new Error('server did not start'));
      setTimeout(tick, 250);
    };
    tick();
  });
}
// 等某个页面状态为真（超时返回 false，不抛错，由 check 判 FAIL）。
async function waitState(page, fn, timeout = 12000, arg = undefined) {
  try { await page.waitForFunction(fn, arg, { timeout }); return true; }
  catch { return false; }
}

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
let browser;
try {
  await waitForServer(`http://127.0.0.1:${PORT}/index.html`);
  browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], failedReqs = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('requestfailed', r => failedReqs.push(r.url()));

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // 1–2. 干净启动
  check('1. no console errors', errors.length === 0, errors.join(' | ').slice(0, 200));
  check('2. no failed requests', failedReqs.length === 0, failedReqs.join(' | ').slice(0, 200));
  // 3. 开始游戏并走路
  await page.click('#btn-start');
  await page.waitForTimeout(300);
  const p0 = await page.evaluate(() => ({ x: window.GT.state.player.x, y: window.GT.state.player.y }));
  await page.keyboard.down('KeyW');
  const walked = await waitState(page, ([x, y]) => {
    const p = window.GT.state.player;
    return Math.hypot(p.x - x, p.y - y) > 20;
  }, 12000, [p0.x, p0.y]);
  await page.keyboard.up('KeyW');
  const p1 = await page.evaluate(() => ({ x: window.GT.state.player.x, y: window.GT.state.player.y }));
  check('3. walk moves player', walked, `moved ${Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y))}u`);
  // 4–5. 上车偷车（轿车在出生点旁）
  await page.evaluate(() => window.GT.teleport(670, 1860));
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  const inCar = await waitState(page, () => !!window.GT.state.player.car);
  check('4. enter car with E', inCar);
  const wanted = await page.evaluate(() => window.GT.state.wanted);
  check('5. stealing raises wanted to 2', wanted === 2, `wanted=${wanted}`);
  // 6. 驾驶加速
  await page.keyboard.down('KeyW');
  const fast = await waitState(page, () => Math.abs(window.GT.state.player.car?.speed || 0) > 100);
  await page.keyboard.up('KeyW');
  const speed = await page.evaluate(() => Math.abs(window.GT.state.player.car?.speed || 0));
  check('6. driving accelerates', fast && speed > 50, `speed=${Math.round(speed)}`);
  // 7. 4 辆警车追捕（通缉 4 星）
  await page.evaluate(() => window.GT.setWanted(4));
  const cops = await waitState(page, () => window.GT.state.police.length >= 4, 20000);
  const copN = await page.evaluate(() => window.GT.state.police.length);
  check('7. four police chase at 4 stars', cops, `police=${copN}`);
  // 8–9. 下车开枪：耗弹药、涨热度
  await page.keyboard.press('KeyE'); // 下车
  await waitState(page, () => !window.GT.state.player.car);
  await page.evaluate(() => window.GT.setWanted(0));
  const ammo0 = await page.evaluate(() => window.GT.state.player.ammo);
  await page.mouse.move(900, 300);
  await page.mouse.down();
  const shot = await waitState(page, a => window.GT.state.player.ammo < a, 8000, ammo0);
  await page.mouse.up();
  const ammo1 = await page.evaluate(() => window.GT.state.player.ammo);
  const wanted2 = await page.evaluate(() => window.GT.state.wanted);
  check('8. shooting consumes ammo', shot && ammo1 < ammo0, `${ammo0} -> ${ammo1}`);
  check('9. shooting raises wanted', wanted2 >= 1, `wanted=${wanted2}`);
  // 清场：甩掉警车并回满血，后续测试不再被追捕打死（BUSTED 会停掉 update）。
  await page.evaluate(() => { window.GT.clearCops(); window.GT.heal(); });
  // 10. M1 两段推进：取包 → 送 Mara → 完成付 $150
  const money0 = await page.evaluate(() => window.GT.state.money);
  await page.evaluate(() => {
    window.GT.startMission('M1');
    const sp = window.GT.state.city.spots;
    window.GT.teleport(sp.pierPickup.x, sp.pierPickup.y);
  });
  const stage1 = await waitState(page, () => window.GT.state.mission?.stage === 1);
  await page.evaluate(() => {
    const sp = window.GT.state.city.spots;
    window.GT.teleport(sp.mara.x, sp.mara.y);
  });
  const m1done = await waitState(page, () => window.GT.state.done.includes('M1'));
  const m1 = await page.evaluate(() => ({ done: window.GT.state.done, money: window.GT.state.money }));
  check('10. M1 advances stages, completes and pays $150', stage1 && m1done && m1.money >= money0 + 150, `stage1=${stage1} money ${money0} -> ${m1.money}`);
  // 11. P 暂停：时间冻结
  await page.keyboard.press('KeyP');
  const pausedOk = await waitState(page, () => window.GT.state.paused);
  const t0 = await page.evaluate(() => window.GT.state.time);
  await page.waitForTimeout(800);
  const t1 = await page.evaluate(() => window.GT.state.time);
  check('11. P pauses the game', pausedOk && t1 === t0, `paused=${pausedOk} time ${t0} -> ${t1}`);
  await page.keyboard.press('KeyP');
  await waitState(page, () => !window.GT.state.paused);
  // 12. 自动存档写 localStorage
  const saved = await waitState(page, () => !!localStorage.getItem('golden-tide-save-v3'), 15000);
  check('12. autosave writes localStorage', saved);
  // 13. HUD 正常
  const hud = await page.evaluate(() => ({
    money: document.getElementById('hud-money').textContent,
    wanted: document.getElementById('hud-wanted').textContent,
    obj: document.getElementById('hud-objective').textContent,
    map: !!document.getElementById('minimap'),
  }));
  check('13. HUD shows money/stars/objective/minimap', hud.money.startsWith('$') && hud.wanted.includes('WANTED') && hud.obj.length > 5 && hud.map, JSON.stringify(hud).slice(0, 120));
  // 14. 隐藏现金点拾取
  const cash0 = await page.evaluate(() => window.GT.state.cashFound);
  await page.evaluate(() => {
    const s = window.GT.state.stashes[0];
    window.GT.teleport(s.x, s.y);
  });
  const cashGot = await waitState(page, c => window.GT.state.cashFound > c, 8000, cash0);
  const cash1 = await page.evaluate(() => window.GT.state.cashFound);
  check('14. hidden cash stash collected', cashGot, `${cash0} -> ${cash1}`);
  // 15. M 静音开关
  await page.keyboard.press('KeyM');
  const muted = await waitState(page, () => window.GT.state.sfx.muted);
  await page.keyboard.press('KeyM');
  check('15. M toggles mute', muted, `muted=${muted}`);
  // 16. 重载后标题画面显示 Continue
  await page.reload({ waitUntil: 'networkidle' });
  const contVisible = await waitState(page, () => getComputedStyle(document.getElementById('btn-continue')).display !== 'none', 8000);
  check('16. title shows Continue after save', contVisible);

  const failed = results.filter(r => !r.ok);
  console.log(`\nplaytest: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
} finally {
  if (browser) await browser.close();
  server.kill();
}
