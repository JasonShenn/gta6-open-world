// 截图脚本：按 shots.json 的 4 个场景逐个打开 ?shot= 页面，
// 等 window.__shotReady，再存成 screenshots/<name>（JPEG，质量 82）。
// 校验：每张 ≤256 KiB，长边 ≤1280、短边 ≥480。
// 用法：node tests/shots.mjs（需先 npm i playwright-core）

import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, launchBrowser, collectErrors } from './helpers.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const shots = JSON.parse(await readFile(join(repoRoot, 'shots.json'), 'utf-8'));

const { server, url } = await startServer(8901);
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = collectErrors(page);

let failed = false;
for (const shot of shots) {
  const shotUrl = url + '/' + shot.query;
  await page.goto(shotUrl, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
  } catch {
    console.error(`✗ ${shot.name}: __shotReady 超时 (${shotUrl})`);
    failed = true;
    continue;
  }
  const file = join(repoRoot, 'screenshots', shot.name);
  await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
  const info = await stat(file);
  const dims = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const longSide = Math.max(dims.w, dims.h);
  const shortSide = Math.min(dims.w, dims.h);
  const ok = info.size <= 262144 && longSide <= 1280 && shortSide >= 480;
  console.log(`${ok ? '✓' : '✗'} ${shot.name}: ${(info.size / 1024).toFixed(1)} KiB, ${dims.w}x${dims.h}${ok ? '' : ' —— 超限！'}`);
  if (!ok) failed = true;
}

console.log(errors.length === 0 ? '✓ 控制台零报错' : `✗ 控制台报错 ${errors.length} 条：\n` + errors.join('\n'));
if (errors.length > 0) failed = true;

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
