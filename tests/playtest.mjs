// playtest.mjs — GOLDEN TIDE v4 的玩法测试：Playwright 真实浏览器跑 16 项。
// 跑法：node tests/playtest.mjs（自动起 serve.ts 8129 端口，跑完关掉）。

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const PORT = 8129;

// 找到本机 Playwright 的 Chromium 可执行文件。
function findChrome() {
  const base = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(base)) return undefined;
  for (const d of readdirSync(base)) {
    if (!d.startsWith('chromium-')) continue;
    for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const p = join(base, d, sub);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: repo, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let browser;
try {
  await sleep(1200);
  browser = await chromium.launch({
    executablePath: findChrome(),
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('requestfailed', (r) => failedRequests.push(r.url()));

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 15000 });
  await sleep(800);

  const state = () => page.evaluate(() => window.__game.state());
  const shot = () => page.evaluate(() => window.__game.state());

  // 1. 标题画面出现。
  {
    const visible = await page.isVisible('#overlay-title');
    const title = await page.textContent('#overlay-title');
    check('title screen shows', visible && title.includes('GOLDEN TIDE'));
  }

  // 2. 点 New Game 进入游玩。
  {
    await page.click('#overlay-buttons button[data-act="new"]');
    await sleep(600);
    const s = await state();
    check('new game starts play mode', s.mode === 'play', `mode=${s.mode}`);
  }

  // 3. 走路：按住 W，位置移动。
  {
    const a = await state();
    await page.keyboard.down('KeyW');
    await sleep(1200);
    await page.keyboard.up('KeyW');
    const b = await state();
    const moved = Math.hypot(b.x - a.x, b.y - a.y);
    check('walk moves player', moved > 40, `moved ${Math.round(moved)}px`);
  }

  // 4. 开枪耗弹药（步行，鼠标朝右按住一会儿）。
  {
    const a = await state();
    await page.mouse.move(900, 360);
    await page.mouse.down();
    await sleep(500);
    await page.mouse.up();
    const b = await state();
    check('shooting consumes ammo', b.ammo < a.ammo, `ammo ${a.ammo} → ${b.ammo}`);
  }

  // 5. 隐藏现金点拾取（第 1 处，路边）。
  {
    await page.evaluate(() => window.__game.teleport(700, 470));
    await sleep(600);
    const s = await state();
    check('hidden cash pickup', s.cashFound >= 1 && s.money >= 270, `cash ${s.cashFound}/5 money $${s.money}`);
  }

  // 6. 上车：瞬移到一辆停着的车边按 E。
  {
    const spot = await page.evaluate(() => {
      const c = window.__game.world.city.parkedCars.find((x) => !x.taken);
      return c ? { x: c.x, y: c.y } : null;
    });
    await page.evaluate((s) => window.__game.teleport(s.x + 30, s.y), spot);
    await sleep(300);
    await page.keyboard.press('KeyE');
    await sleep(500);
    const s = await state();
    check('enter parked car', s.inCar === true, `inCar=${s.inCar} car=${s.carType}`);
  }

  // 7. 偷车涨通缉到 2 星。
  {
    const s = await state();
    check('stealing raises wanted to 2', s.wanted >= 2, `wanted=${s.wanted}`);
  }

  // 8. 驾驶加速：按住 W，车速上来。
  {
    await page.keyboard.down('KeyW');
    await sleep(2500);
    await page.keyboard.up('KeyW');
    const s = await state();
    check('driving accelerates', s.speedKmh > 50, `${s.speedKmh} km/h`);
  }

  // 9. 警车追捕：设 3 星，出警车。
  {
    await page.evaluate(() => window.__game.setWanted(3));
    await sleep(1500);
    const s = await state();
    check('police chase spawns cars', s.policeCars >= 2, `${s.policeCars} police cars`);
    await page.evaluate(() => window.__game.setWanted(0));
  }

  // 10. M1 完成并付 $150：先去码头取包，再去修车铺。
  {
    // 先下车（否则开车撞不进目标点也行，但步行更稳）。
    await page.keyboard.press('KeyE');
    await sleep(400);
    const before = await state();
    await page.evaluate(() => window.__game.teleport(175, 1125));
    await sleep(700);
    const mid = await state();
    await page.evaluate(() => window.__game.teleport(1500, 620));
    await sleep(700);
    const after = await state();
    check('M1 completes and pays $150', after.missionIndex === 1 && after.money === before.money + 150,
      `mission ${mid.missionIndex}→${after.missionIndex}, $${before.money}→$${after.money}`);
  }

  // 11. P 暂停 / 再按恢复。
  {
    await page.keyboard.press('KeyP');
    await sleep(400);
    const paused = await state();
    await page.keyboard.press('KeyP');
    await sleep(400);
    const resumed = await state();
    check('pause and resume with P', paused.mode === 'paused' && resumed.mode === 'play',
      `${paused.mode} → ${resumed.mode}`);
  }

  // 12. 自动存档写 localStorage。
  {
    await page.evaluate(() => window.__game.save());
    await sleep(300);
    const s = await state();
    check('autosave writes localStorage', s.saveExists === true);
  }

  // 13. HUD 齐全：金钱、血条、通缉星、小地图、车速框（开车时）/ 提示。
  {
    const hud = await page.evaluate(() => ({
      money: document.getElementById('hud-money').textContent,
      stars: document.getElementById('wanted-stars').textContent,
      minimap: !!document.getElementById('minimap'),
      hint: document.getElementById('hint').textContent.length > 10,
      banner: document.getElementById('banner').textContent,
    }));
    check('HUD complete', hud.money.startsWith('$') && hud.stars.length === 5 && hud.minimap && hud.hint,
      `money=${hud.money} banner="${hud.banner}"`);
  }

  // 14. M 静音切换，SOUND 按钮文字跟着变。
  {
    await page.keyboard.press('KeyM');
    await sleep(400);
    const mutedText = await page.textContent('#sound-btn');
    await page.keyboard.press('KeyM');
    await sleep(400);
    const onText = await page.textContent('#sound-btn');
    check('mute toggle with M', mutedText.includes('MUTED') && onText.includes('SOUND'),
      `"${mutedText}" → "${onText}"`);
  }

  // 15. 重载后标题画面显示 Continue（有存档）。
  {
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 15000 });
    await sleep(600);
    const hasContinue = await page.$('#overlay-buttons button[data-act="continue"]') !== null;
    check('reload shows Continue', hasContinue);
    // 点 Continue 回到游戏，保证存档能读。
    if (hasContinue) {
      await page.click('#overlay-buttons button[data-act="continue"]');
      await sleep(500);
      const s = await state();
      check('continue resumes play', s.mode === 'play', `mode=${s.mode}`);
    } else {
      check('continue resumes play', false, 'no continue button');
    }
  }

  // 16. 全程无 console 报错、无 failed request。
  {
    check('no console errors or failed requests',
      consoleErrors.length === 0 && failedRequests.length === 0,
      `console: ${consoleErrors.slice(0, 2).join(' | ') || 'none'}; failed: ${failedRequests.slice(0, 2).join(' | ') || 'none'}`);
  }

  await browser.close();
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
