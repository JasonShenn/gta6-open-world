// traffic.js — 车流与行人：沿道路网格行驶的 NPC 车，以及在人行道上散步的行人。
// 车只沿一条大道或街道走，车道靠右；走到地图边缘就绕回另一头。

import { WORLD, ROADS_X, ROADS_Y, ROAD_W, CAR_TYPES } from './config.js';
import { makeRng, range, pick, int } from './rng.js';

const TRAFFIC_COLORS = ['#e8e4da', '#c0392b', '#3a6ea5', '#d9a441', '#5b7d4f', '#8e6bbf', '#d97b2f'];

// 生成车流与行人：16 辆车 + 22 个行人。
export function createTraffic(seed) {
  const rng = makeRng(seed + 1000);
  const cars = [];
  const types = ['sedan', 'sedan', 'taxi', 'van', 'pickup', 'sports'];
  for (let i = 0; i < 16; i++) {
    const vertical = rng() < 0.5;
    const type = pick(rng, types);
    if (vertical) {
      const x = pick(rng, ROADS_X) + (rng() < 0.5 ? -26 : 26);
      cars.push({
        x, y: range(rng, 100, WORLD.h - 100), angle: rng() < 0.5 ? -Math.PI / 2 : Math.PI / 2,
        speed: range(rng, 60, 120), type, color: pick(rng, TRAFFIC_COLORS),
        vertical: true, lane: x, driver: 'traffic', parked: false,
      });
    } else {
      const y = pick(rng, ROADS_Y) + (rng() < 0.5 ? -26 : 26);
      cars.push({
        x: range(rng, 350, WORLD.w - 100), y, angle: rng() < 0.5 ? 0 : Math.PI,
        speed: range(rng, 60, 120), type, color: pick(rng, TRAFFIC_COLORS),
        vertical: false, lane: y, driver: 'traffic', parked: false,
      });
    }
  }
  const peds = [];
  for (let i = 0; i < 22; i++) {
    peds.push({
      x: range(rng, 350, WORLD.w - 100), y: range(rng, 100, WORLD.h - 100),
      angle: range(rng, 0, Math.PI * 2), speed: range(rng, 18, 42),
      color: pick(rng, ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22']),
      timer: range(rng, 1, 4),
    });
  }
  return { cars, peds, rng };
}

// 车流每帧：沿车道前进，前面有车就减速，走到头绕回。
export function updateTraffic(dt, traffic, city) {
  for (const c of traffic.cars) {
    if (c.driver === 'player') continue; // 玩家开的车不在这里动
    // 前方 70px 内有车就刹车。
    let blocked = false;
    for (const o of traffic.cars) {
      if (o === c || o.driver === 'player') continue;
      const dx = o.x - c.x, dy = o.y - c.y;
      const along = c.vertical ? dy * Math.sin(c.angle) : dx * Math.cos(c.angle);
      const side = c.vertical ? Math.abs(dx) : Math.abs(dy);
      if (along > 0 && along < 78 && side < 30) { blocked = true; break; }
    }
    const target = blocked ? 0 : c.cruise || (c.cruise = c.speed);
    c.speed += (target - c.speed) * Math.min(1, dt * 2);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    // 出界绕回另一头。
    if (c.vertical) {
      if (c.y < 40) c.y = WORLD.h - 40;
      if (c.y > WORLD.h - 40) c.y = 40;
    } else {
      if (c.x < 320) c.x = WORLD.w - 60;
      if (c.x > WORLD.w - 60) c.x = 320;
    }
  }
  // 行人：慢慢走，定时换方向，撞楼就掉头。
  for (const p of traffic.peds) {
    p.timer -= dt;
    if (p.timer <= 0) {
      p.angle = range(traffic.rng, 0, Math.PI * 2);
      p.timer = range(traffic.rng, 2, 6);
    }
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    if (nx > 300 && nx < WORLD.w - 20 && ny > 20 && ny < WORLD.h - 20) {
      p.x = nx; p.y = ny;
    } else {
      p.angle += Math.PI;
    }
  }
}

// 离某点最近的车流车辆（玩家按 E 抢车用）。
export function nearestTrafficCar(traffic, x, y, maxDist) {
  let best = null, bestD = maxDist;
  for (const c of traffic.cars) {
    if (c.driver === 'player') continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
