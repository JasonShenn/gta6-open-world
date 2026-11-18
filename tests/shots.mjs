// tests/shots.mjs — 渲染 4 张确定性截图：1280×720 JPEG、各 ≤256 KiB。
// 用 Playwright Chromium（swiftshader），服务由本脚本在 8129 端口拉起（8123 是用户 HA 隧道，绝不用）。
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { statSync, existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';

const SHOTS = JSON.parse(readFileSync(new URL('../shots.json', import.meta.url), 'utf8'));
const CHROME = process.env.CHROME_PATH || `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;
const PORT = 8129;

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

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
try {
  await waitForServer(`http://127.0.0.1:${PORT}/index.html`);
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  let fail = false;
  for (const s of SHOTS) {
    const out = new URL(`../screenshots/${s.name}`, import.meta.url).pathname;
    await page.goto(`http://127.0.0.1:${PORT}/index.html${s.query}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500); // 等布景定格、警灯闪一轮
    let quality = 82;
    await page.screenshot({ path: out, type: 'jpeg', quality });
    let size = statSync(out).size;
    if (size > 262144) { // 超 256 KiB 就降画质重拍
      quality = 68;
      await page.screenshot({ path: out, type: 'jpeg', quality });
      size = statSync(out).size;
    }
    console.log(`${s.name}: ${size} bytes (quality ${quality}) ${size <= 262144 ? 'OK' : 'OVER LIMIT'}`);
    if (size > 262144) fail = true;
  }
  await browser.close();
  if (fail) process.exit(1);
  console.log('shots: all 4 within 256 KiB');
} finally {
  server.kill();
}
