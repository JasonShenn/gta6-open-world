// GOLDEN TIDE — traffic.js
// One job: the living street — traffic cars that drive the avenues and streets,
// and pedestrians who stroll the sidewalks. Spawns, steering and avoidance live
// here; drawing lives in render.js.

import { WORLD, AVENUES, STREETS, CAR_TYPES } from './config.js';
import { makeRng } from './rng.js';
import { nearestRoadPoint } from './city.js';

const TRAFFIC_COLORS = ['#d8d3c8', '#c94f42', '#4a7fb5', '#e8b64c', '#5fb8a6', '#8a6a9e', '#3f7d44'];
const PED_COLORS = ['#ff8a7a', '#7ab8ff', '#ffd34d', '#c98aff', '#7be382', '#ff9ecf', '#e8e0d0'];

export function createTraffic(city, seed) {
  const rng = makeRng(seed + 77);
  const cars = [];
  for (let i = 0; i < 26; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(AVENUES) : rng.pick(STREETS);
    const along = rng.range(300, vertical ? WORLD.h - 300 : WORLD.w - 300);
    const type = rng.pick(['sedan', 'sedan', 'taxi', 'truck', 'sports']);
    cars.push({
      id: 't' + i, type, x: vertical ? road + rng.range(-20, 20) : along,
      y: vertical ? along : road + rng.range(-20, 20),
      angle: vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
      speed: rng.range(70, 130), vertical, dir: rng.chance(0.5) ? 1 : -1,
      color: type === 'taxi' ? CAR_TYPES.taxi.color : rng.pick(TRAFFIC_COLORS),
      npc: true, stopped: 0,
    });
  }
  const peds = [];
  for (let i = 0; i < 34; i++) {
    const p = nearestRoadPoint(rng.range(300, WORLD.w - 300), rng.range(300, WORLD.h - 300), rng);
    peds.push({
      x: p.x + rng.range(-70, 70), y: p.y + rng.range(-70, 70),
      angle: rng.range(0, Math.PI * 2), speed: rng.range(18, 42),
      color: rng.pick(PED_COLORS), walk: rng.range(0, 6), pause: 0,
    });
  }
  return { cars, peds };
}

// Traffic drives straight along its road, slows for the car ahead, and wraps
// around the far edge of the city so the streets never empty out.
export function updateTraffic(world, dt) {
  const { cars, peds } = world.traffic;
  for (const c of cars) {
    if (c.stopped > 0) { c.stopped -= dt; continue; }
    let ahead = null, aheadD = 1e9;
    for (const o of cars) {
      if (o === c || o.vertical !== c.vertical) continue;
      const along = c.vertical ? (o.y - c.y) * c.dir : (o.x - c.x) * c.dir;
      const across = c.vertical ? Math.abs(o.x - c.x) : Math.abs(o.y - c.y);
      if (along > 0 && along < aheadD && across < 34) { aheadD = along; ahead = o; }
    }
    const p = world.player;
    if (p.car && p.car.npc !== true) {
      const along = c.vertical ? (p.car.y - c.y) * c.dir : (p.car.x - c.x) * c.dir;
      const across = c.vertical ? Math.abs(p.car.x - c.x) : Math.abs(p.car.y - c.y);
      if (along > 0 && along < aheadD && across < 40) { aheadD = along; ahead = p.car; }
    }
    const want = ahead && aheadD < 90 ? 0 : (c.vertical ? 95 : 105);
    c.speed += (want - c.speed) * Math.min(1, dt * 1.5);
    if (c.vertical) { c.y += c.dir * c.speed * dt; if (c.y < 260) c.y = WORLD.h - 280; if (c.y > WORLD.h - 260) c.y = 280; }
    else { c.x += c.dir * c.speed * dt; if (c.x < 280) c.x = WORLD.w - 300; if (c.x > WORLD.w - 280) c.x = 300; }
    c.angle = c.vertical ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
  }
  for (const p of peds) {
    p.walk += dt;
    if (p.pause > 0) { p.pause -= dt; continue; }
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    if (p.x < 260 || p.x > WORLD.w - 60 || p.y < 60 || p.y > WORLD.h - 60 || Math.random() < dt * 0.05) {
      p.angle = Math.random() * Math.PI * 2;
      if (Math.random() < 0.3) p.pause = 1 + Math.random() * 2;
    }
    // Pedestrians scatter from a speeding car.
    const pl = world.player;
    const threat = pl.car || null;
    if (threat && Math.hypot(p.x - threat.x, p.y - threat.y) < 70 && Math.abs(threat.speed) > 120) {
      p.angle = Math.atan2(p.y - threat.y, p.x - threat.x);
      p.x += Math.cos(p.angle) * 90 * dt; p.y += Math.sin(p.angle) * 90 * dt;
    }
  }
}
