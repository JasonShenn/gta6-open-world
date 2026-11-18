// police.js — 通缉与警察：星级决定出警数量，警车追捕、包抄、撞击；
// 3 星起在主干道设路障；步行时被警车贴住 1.5 秒即被捕。

import { WORLD, ROADS_X, ROADS_Y, WANTED_MAX, ROADBLOCK_FROM } from './config.js';
import { makeRng, range, pick } from './rng.js';
import { collidesCircle } from './city.js';
import { sfx } from './audio.js';

export function createPolice(seed) {
  return {
    wanted: 0, heat: 0, // heat 是 0–100 的热度条，涨满升一星
    cars: [], // 警车：{x,y,angle,speed}
    roadblocks: [], // 路障：{x,y,angle}
    bustTimer: 0, // 被贴住的累计时间
    decayTimer: 0, // 躲藏计时：没警车在附近就慢慢降星
    rng: makeRng(seed + 2000),
    sirenTimer: 0,
  };
}

// 涨热度：偷车、开枪、撞警车都会调这个；满 100 升一星。
export function addHeat(police, amount) {
  police.heat += amount;
  while (police.heat >= 100 && police.wanted < WANTED_MAX) {
    police.heat -= 100;
    police.wanted += 1;
  }
  police.heat = Math.min(police.heat, 99);
}

// 直接设星级（偷车至少 2 星、任务脚本用）。
export function setWanted(police, level) {
  police.wanted = Math.max(0, Math.min(WANTED_MAX, level));
  police.heat = 0;
}

// 每帧：按星级补警车、追捕、路障、降星。
export function updatePolice(dt, police, player, city) {
  const want = police.wanted;
  // 警车数量 = 星级（最多 5 辆），不够就从屏幕外生成。
  while (police.cars.length < want) {
    const a = range(police.rng, 0, Math.PI * 2);
    const d = range(police.rng, 620, 900);
    police.cars.push({
      x: Math.max(40, Math.min(WORLD.w - 40, player.x + Math.cos(a) * d)),
      y: Math.max(40, Math.min(WORLD.h - 40, player.y + Math.sin(a) * d)),
      angle: 0, speed: 0,
    });
  }
  while (police.cars.length > want) police.cars.pop();
  // 3 星起设路障：2 个，放在玩家前方的干道上。
  const wantBlocks = want >= ROADBLOCK_FROM ? 2 : 0;
  while (police.roadblocks.length < wantBlocks) {
    const road = pick(police.rng, ROADS_X);
    police.roadblocks.push({
      x: road, y: Math.max(120, Math.min(WORLD.h - 120, player.y + pick(police.rng, [-420, 420]))),
      angle: 0,
    });
  }
  while (police.roadblocks.length > wantBlocks) police.roadblocks.pop();

  // 追捕：朝玩家开，速度略快于普通车流；撞到玩家就扣血 / 撞停。
  let nearest = Infinity;
  for (const c of police.cars) {
    const dx = player.x - c.x, dy = player.y - c.y;
    const dist = Math.hypot(dx, dy);
    nearest = Math.min(nearest, dist);
    const target = Math.atan2(dy, dx);
    let diff = target - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const top = 330;
    c.speed = Math.min(top, c.speed + 260 * dt);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (!collidesCircle(city, nx, ny, 22)) { c.x = nx; c.y = ny; }
    // 撞到玩家。
    if (dist < 46) {
      if (player.inCar) {
        player.speed *= 0.55; // 被撞得减速
        if (Math.abs(player.speed) > 60) sfx('crash');
      } else if (player.invuln <= 0) {
        player.hp = Math.max(0, player.hp - 12);
        player.invuln = 0.6;
        sfx('hit');
      }
    }
  }
  // 被捕判定：步行、通缉 >0、最近警车贴住 1.5 秒。
  if (!player.inCar && want > 0 && nearest < 40) {
    police.bustTimer += dt;
  } else {
    police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
  }
  // 躲藏降星：10 秒没警车靠近就降一星。
  if (want > 0 && nearest > 700) {
    police.decayTimer += dt;
    if (police.decayTimer > 10) { police.wanted -= 1; police.decayTimer = 0; police.heat = 0; }
  } else {
    police.decayTimer = 0;
  }
  // 警笛每 4 秒响一声（有警车时）。
  if (want > 0) {
    police.sirenTimer -= dt;
    if (police.sirenTimer <= 0) { sfx('siren'); police.sirenTimer = 4; }
  }
  return police.bustTimer >= 1.5;
}

// 路障撞击：玩家车撞上路障会猛减速；返回是否撞上了。
export function hitRoadblock(police, player) {
  if (!player.inCar) return false;
  for (const b of police.roadblocks) {
    if (Math.hypot(b.x - player.x, b.y - player.y) < 44) {
      player.speed *= -0.3;
      sfx('crash');
      return true;
    }
  }
  return false;
}
