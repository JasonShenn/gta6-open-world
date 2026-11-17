// 测试共用：静态服务器（只 serving game/）+ Chromium 启动。
// 用法：import { startServer, launchBrowser } from './helpers.mjs';

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** 起一个只 serving game/ 的静态服务器，返回 { server, port, url }。 */
export async function startServer(port) {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      const file = join(repoRoot, 'game', urlPath === '/' ? 'index.html' : urlPath);
      if (!file.startsWith(join(repoRoot, 'game')) || !existsSync(file)) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(500);
      res.end('error');
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { server, port, url: `http://127.0.0.1:${port}` };
}

/** 用已缓存的 Chromium 启动 headless 浏览器（2D canvas，不用 WebGL）。 */
export async function launchBrowser() {
  return chromium.launch({
    executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
}

/** 收集一页的控制台报错与未捕获异常，返回数组。 */
export function collectErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console: ' + msg.text());
  });
  page.on('pageerror', (err) => errors.push('pageerror: ' + String(err)));
  return errors;
}

/** 读游戏状态（window.__game），测试用调试口。 */
export async function gameState(page) {
  return page.evaluate(() => {
    const g = window.__game;
    if (!g) return null;
    const s = g.state;
    const p = s.player;
    return {
      screen: g.screen,
      px: Math.round(p.x), py: Math.round(p.y),
      hp: Math.round(p.hp), money: p.money, wanted: p.wanted,
      inCar: !!p.car, carSpeed: p.car ? Math.round(p.car.speed) : 0,
      missionIndex: s.mission.index, missionStage: s.mission.stage,
      missionTimer: Math.round(s.mission.timer * 10) / 10,
      police: s.police.length, enemies: s.enemies.length,
      bullets: s.bullets.length, peds: s.peds.length, cars: s.cars.length,
    };
  });
}
