// shots.mjs — 截图：按 shots.json 的 4 个布景各拍一张 1280×720 JPEG。
// 跑法：node tests/shots.mjs（自动起 serve.ts 8130 端口，写进 screenshots/）。

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, readdirSync, readFileSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const PORT = 8130;
const shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: repo, stdio: 'ignore' });

try {
  await sleep(1200);
  const browser = await chromium.launch({
    executablePath: findChrome(),
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGE ERROR:', String(e)));
  mkdirSync(join(repo, 'screenshots'), { recursive: true });
  for (const shot of shots) {
    await page.goto(`http://127.0.0.1:${PORT}/${shot.query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game && window.__game.world.shotReady, null, { timeout: 15000 });
    await sleep(1500); // 让相机、火光、警车就位
    const file = join(repo, 'screenshots', shot.name);
    await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
    const size = statSync(file).size;
    console.log(`${shot.name}: ${size} bytes ${size <= 262144 ? 'OK' : 'TOO BIG'}`);
    if (size > 262144) process.exitCode = 1;
  }
  await browser.close();
} finally {
  server.kill();
}
console.log('shots done');
