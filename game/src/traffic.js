// traffic.js — 车流与行人：沿道路行驶的 NPC 车辆、在人行道上走的行人，及车辆绘制。
import { AVENUES, STREETS, ROAD_W } from './city.js';
import { CAR_TYPES } from './config.js';
import { makeRng, range, pick } from './rng.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'taxi', 'van', 'pickup', 'truck'];
const PED_COLORS = ['#e8e0c8', '#c96f5a', '#5f8f7a', '#d8a03c', '#7a6fb0', '#e8826a'];

// 生成一辆沿道路行驶的车：选一条大道或街道、一个方向、一条车道。
function spawnTrafficCar(rng) {
  const vertical = rng() < 0.5;
  const type = pick(rng, TRAFFIC_TYPES);
  if (vertical) {
    const x = pick(rng, AVENUES);
    const dir = rng() < 0.5 ? 1 : -1;
    return { type, x: x + dir * 22, y: range(rng, 100, 3700), angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2, speed: range(rng, 120, 200), vertical: true, road: x, dir };
  }
  const y = pick(rng, STREETS);
  const dir = rng() < 0.5 ? 1 : -1;
  return { type, x: range(rng, 400, 5100), y: y + dir * 22, angle: dir > 0 ? 0 : Math.PI, speed: range(rng, 120, 200), vertical: false, road: y, dir };
}
export function makeTraffic(seed) {
  const rng = makeRng(seed + 11);
  const cars = [];
  for (let i = 0; i < 26; i++) cars.push(spawnTrafficCar(rng));
  const peds = [];
  for (let i = 0; i < 42; i++) {
    const vertical = rng() < 0.5;
    peds.push({
      x: vertical ? pick(rng, AVENUES) + (rng() < 0.5 ? -ROAD_W / 2 - 16 : ROAD_W / 2 + 16) : range(rng, 400, 5100),
      y: vertical ? range(rng, 100, 3700) : pick(rng, STREETS) + (rng() < 0.5 ? -ROAD_W / 2 - 16 : ROAD_W / 2 + 16),
      angle: range(rng, 0, 6.28), speed: range(rng, 28, 55), color: pick(rng, PED_COLORS),
      vertical, t: range(rng, 0, 10),
    });
  }
  return { cars, peds, rng };
}
// 车流更新：沿路直行，到路口随机转弯；出界则绕回另一端。
export function updateTraffic(tr, dt, city) {
  for (const c of tr.cars) {
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    // 到路口时 25% 概率转弯（保持在路网上）。
    const nearX = AVENUES.find(x => Math.abs(c.x - x) < 26);
    const nearY = STREETS.find(y => Math.abs(c.y - y) < 26);
    if (nearX !== undefined && nearY !== undefined && tr.rng() < 0.25) {
      if (c.vertical) { c.vertical = false; c.road = nearY; c.dir = tr.rng() < 0.5 ? 1 : -1; c.angle = c.dir > 0 ? 0 : Math.PI; c.y = nearY + c.dir * 22; }
      else { c.vertical = true; c.road = nearX; c.dir = tr.rng() < 0.5 ? 1 : -1; c.angle = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; c.x = nearX + c.dir * 22; }
    }
    if (c.x < 300) { c.x = 5100; } if (c.x > 5150) { c.x = 320; }
    if (c.y < 20) { c.y = 3750; } if (c.y > 3780) { c.y = 40; }
  }
  for (const p of tr.peds) {
    p.t -= dt;
    if (p.t <= 0) { p.t = range(tr.rng, 3, 9); p.angle = p.vertical ? (tr.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (tr.rng() < 0.5 ? 0 : Math.PI); }
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    if (p.x < 320) p.x = 320; if (p.x > 5150) p.x = 5150;
    if (p.y < 20) p.y = 20; if (p.y > 3750) p.y = 3750;
  }
}
// 画一辆车（俯视）：长影 → 车身 → 车顶高光 → 车窗 → 车灯。警车加红蓝灯条。
export function drawCar(ctx, x, y, angle, type, opts = {}) {
  const def = CAR_TYPES[type] || CAR_TYPES.sedan;
  const L = def.len, W = def.wid;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = 'rgba(58,32,12,0.35)';
  ctx.fillRect(-L / 2 + 9, -W / 2 + 6, L, W); // 长影朝东
  ctx.fillStyle = opts.police ? '#2f5fd8' : def.color;
  ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, 6); ctx.fill();
  if (type === 'sports') { // 敞篷：无车顶，深色座舱
    ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.roundRect(-4, -W / 2 + 3, 14, W - 6, 4); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-L / 2 + 4, -W / 2 + 2, L - 8, 5); // 车顶高光
    ctx.fillStyle = '#22303e'; ctx.beginPath(); ctx.roundRect(-L * 0.18, -W / 2 + 3, L * 0.32, W - 6, 3); ctx.fill();
  }
  if (type === 'taxi') { ctx.fillStyle = '#222'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, -W / 2 - 3); }
  // 车灯
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(L / 2 - 3, -W / 2 + 2, 3, 5); ctx.fillRect(L / 2 - 3, W / 2 - 7, 3, 5);
  ctx.fillStyle = '#ff4a3a'; ctx.fillRect(-L / 2, -W / 2 + 2, 3, 5); ctx.fillRect(-L / 2, W / 2 - 7, 3, 5);
  if (opts.police) { // 警灯：红蓝交替闪
    ctx.fillStyle = opts.flash ? '#ff2a2a' : '#2a6bff'; ctx.fillRect(-6, -W / 2 - 2, 12, 5);
    ctx.fillStyle = opts.flash ? '#2a6bff' : '#ff2a2a'; ctx.fillRect(-6, W / 2 - 3, 12, 5);
  }
  ctx.restore();
}
// 画行人：小圆影 + 彩色圆点身体。
export function drawPed(ctx, p) {
  ctx.fillStyle = 'rgba(58,32,12,0.3)';
  ctx.beginPath(); ctx.ellipse(p.x + 5, p.y + 3, 7, 5, 0, 0, 6.29); ctx.fill();
  ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#2a2118'; ctx.beginPath(); ctx.arc(p.x, p.y - 2, 3, 0, 6.29); ctx.fill();
}
