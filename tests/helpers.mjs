// Solmar Heat — shared Playwright harness for the tests and the
// screenshot script: a tiny static server plus browser helpers.
// No network is ever touched: the game is served from localhost.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const GAME_DIR = fileURLToPath(new URL('../game/', import.meta.url));
export const CHROME = process.env.CHROME_PATH ||
  `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

export function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = join(GAME_DIR, path === '/' ? 'index.html' : path);
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch (e) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

export async function launchBrowser() {
  return chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  });
}

// Opens the game, collects console errors / page errors / failed
// requests, and records every network request URL for the no-network check.
export async function newGamePage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  const requests = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  page.on('requestfailed', (req) => errors.push('requestfailed: ' + req.url()));
  page.on('request', (req) => requests.push(req.url()));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__solmar, null, { timeout: 10000 });
  return { page, errors, requests };
}

export async function state(page) {
  return page.evaluate(() => window.__solmar.state());
}

export async function holdKey(page, code, ms) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}

export async function pressKey(page, code) {
  await page.keyboard.press(code);
  await page.waitForTimeout(120);
}

// Wait until a state predicate holds, polling the debug handle.
export async function waitForState(page, pred, timeout = 10000, label = 'state') {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const s = await state(page);
    if (pred(s)) return s;
    await page.waitForTimeout(150);
  }
  throw new Error('timeout waiting for ' + label + '; last state: ' + JSON.stringify(await state(page)));
}
