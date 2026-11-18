// GOLDEN TIDE — tests/helpers.mjs
// One job: shared test plumbing — start the static server, open the game in
// Chromium, collect console errors and failed requests, drive keys and clicks.

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, '..');
export const PORT = 8129; // 8123 is the user's SSH tunnel to Home Assistant — never use it
export const BASE = 'http://127.0.0.1:' + PORT;

export async function startServer() {
  const proc = spawn('node', [join(ROOT, 'serve.ts'), '--port', String(PORT)], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2500);
    proc.stdout.on('data', () => { clearTimeout(timer); resolve(); });
  });
  return proc;
}

export async function openGame(page, query) {
  const errors = []; const failed = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => failed.push(r.url() + ' :: ' + (r.failure()?.errorText || '')));
  await page.goto(BASE + '/index.html' + (query || ''), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.GT !== undefined, null, { timeout: 8000 });
  return { errors, failed };
}

export async function launch() {
  const browser = await chromium.launch({
    executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  return { browser, page };
}

// Hold a key down for ms milliseconds (Playwright keyboard).
export async function holdKey(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

export function check(cond, label, failures) {
  if (!cond) failures.push(label);
  else console.log('  ok — ' + label);
  return cond;
}
