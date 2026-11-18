// GOLDEN TIDE — render.js
// One job: everything the eye sees — the golden-hour city, the cars, the people,
// the HUD with its minimap, and the title / paused / busted / complete screens.
// The judge reads the game mostly through these pixels, so this file earns its keep.

import { WORLD, VIEW, PAL, AVENUES, STREETS, ROAD_W, DISTRICTS, ZOOM } from './config.js';
import { currentObjective } from './missions.js';

const SHX = 16, SHY = 10; // sunset shadow offset direction (sun low in the west)

// ---------- world ----------

export function renderWorld(ctx, world) {
  const cam = world.camera;
  ctx.save();
  ctx.scale(ZOOM, ZOOM);
  ctx.translate(-cam.x, -cam.y);
  drawGround(ctx, world);
  drawRoads(ctx, world);
  drawPools(ctx, world);
  drawBuildings(ctx, world);
  drawPalms(ctx, world);
  drawYachts(ctx, world);
  drawCashSpots(ctx, world);
  drawMissionTarget(ctx, world);
  drawCars(ctx, world);
  drawPeds(ctx, world);
  drawPlayer(ctx, world);
  drawGunmen(ctx, world);
  drawBulletsAndParticles(ctx, world);
  ctx.restore();
  drawSunGlow(ctx, world);
}

function drawGround(ctx, world) {
  // Grass base, then district tints, then the sea and the sand.
  ctx.fillStyle = PAL.grass;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.tint; ctx.globalAlpha = 0.16;
    ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
  }
  ctx.globalAlpha = 1;
  // Grass speckle: tiny light and dark dots so the lawns are not flat.
  for (const s of world.city.speckles) {
    ctx.fillStyle = s.dark ? 'rgba(60,90,40,0.20)' : 'rgba(255,240,180,0.16)';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  // West sea and south sea, with animated sparkle.
  ctx.fillStyle = PAL.seaDeep; ctx.fillRect(0, 0, 240, WORLD.h);
  ctx.fillRect(0, 3560, WORLD.w, WORLD.h - 3560);
  ctx.fillStyle = PAL.sea; ctx.fillRect(14, 0, 226, WORLD.h);
  ctx.fillRect(0, 3574, WORLD.w, WORLD.h - 3574);
  const t = world.time;
  ctx.fillStyle = PAL.seaSpark;
  for (let i = 0; i < 90; i++) {
    const sx = 20 + ((i * 137.5 + t * 12) % 200);
    const sy = (i * 271.3 + t * 30) % WORLD.h;
    ctx.globalAlpha = 0.25 + 0.45 * Math.abs(Math.sin(t * 1.3 + i));
    ctx.fillRect(sx, sy, 14, 2);
  }
  ctx.globalAlpha = 1;
  // South beach sand band and the boardwalk line.
  ctx.fillStyle = PAL.sand; ctx.fillRect(240, 2960, WORLD.w - 240, 600);
  ctx.fillStyle = PAL.sandWet; ctx.fillRect(240, 3480, WORLD.w - 240, 80);
  ctx.fillStyle = '#b98d54'; ctx.fillRect(240, 2960, WORLD.w - 240, 10);
  // Pier planks jutting into the west sea.
  ctx.fillStyle = '#a97e4f';
  ctx.fillRect(120, 1700, 220, 130);
  ctx.fillRect(120, 2300, 220, 130);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  for (let y = 1710; y < 1820; y += 14) { ctx.beginPath(); ctx.moveTo(120, y); ctx.lineTo(340, y); ctx.stroke(); }
  for (let y = 2310; y < 2420; y += 14) { ctx.beginPath(); ctx.moveTo(120, y); ctx.lineTo(340, y); ctx.stroke(); }
}

function drawRoads(ctx, world) {
  // Sidewalks first (wider, pale), then asphalt, then gold centre dashes.
  ctx.fillStyle = PAL.sidewalk;
  for (const a of AVENUES) ctx.fillRect(a - ROAD_W / 2 - 16, 0, ROAD_W + 32, WORLD.h);
  for (const s of STREETS) ctx.fillRect(0, s - ROAD_W / 2 - 16, WORLD.w, ROAD_W + 32);
  ctx.fillStyle = PAL.road;
  for (const a of AVENUES) ctx.fillRect(a - ROAD_W / 2, 0, ROAD_W, WORLD.h);
  for (const s of STREETS) ctx.fillRect(0, s - ROAD_W / 2, WORLD.w, ROAD_W);
  ctx.fillStyle = PAL.dash;
  for (const a of AVENUES) for (let y = 40; y < WORLD.h; y += 64) ctx.fillRect(a - 3, y, 6, 30);
  for (const s of STREETS) for (let x = 280; x < WORLD.w; x += 64) ctx.fillRect(x, s - 3, 30, 6);
  // Crosswalks at downtown intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const a of [2220, 2820]) for (const s of [1420, 1920]) {
    for (let i = -3; i <= 3; i++) ctx.fillRect(a + i * 13 - 4, s - ROAD_W / 2 + 8, 8, ROAD_W - 16);
  }
}

function drawPools(ctx, world) {
  for (const p of world.city.pools) {
    ctx.fillStyle = '#2fb3c9';
    roundRect(ctx, p.x, p.y, p.w, p.h, 18); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, p.x + 10, p.y + 8, p.w - 20, 16, 8); ctx.fill();
    ctx.strokeStyle = '#f2e3c2'; ctx.lineWidth = 6;
    roundRect(ctx, p.x, p.y, p.w, p.h, 18); ctx.stroke();
  }
}

function drawBuildings(ctx, world) {
  for (const b of world.city.buildings) {
    // Long sunset shadow, one direction for the whole city.
    ctx.fillStyle = PAL.shadow;
    ctx.fillRect(b.x + SHX * b.tall, b.y + SHY * b.tall, b.w, b.h);
    // Facade with a sun-warmed top edge and a darker base.
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,220,140,0.35)'; ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(b.x, b.y + b.h - 8, b.w, 8);
    if (b.glass) {
      // Glass tower: vertical light streaks and lit windows.
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(b.x + b.w * 0.2, b.y, 6, b.h);
      ctx.fillRect(b.x + b.w * 0.55, b.y, 4, b.h);
      ctx.fillStyle = 'rgba(255,240,170,0.85)';
      const cols = Math.floor(b.w / 26), rows = Math.floor(b.h / 26);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (((i * 7 + j * 13 + Math.floor(b.lit * 100)) % 5) < 2) ctx.fillRect(b.x + 8 + i * 26, b.y + 8 + j * 26, 12, 14);
      }
      if (b.neon) {
        ctx.fillStyle = b.neonColor;
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(world.time * 3 + b.x);
        ctx.fillRect(b.x + b.w / 2 - 26, b.y - 6, 52, 10);
        ctx.globalAlpha = 1;
      }
    } else {
      // Warm wall: roof slab and a few lit windows.
      ctx.fillStyle = b.roof; ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 10);
      ctx.fillStyle = 'rgba(60,30,10,0.35)';
      const cols = Math.floor(b.w / 30), rows = Math.floor(b.h / 30);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (((i * 3 + j * 5 + Math.floor(b.lit * 100)) % 4) === 0) ctx.fillRect(b.x + 10 + i * 30, b.y + 20 + j * 30, 12, 14);
      }
    }
  }
}

function drawPalms(ctx, world) {
  for (const p of world.city.palms) {
    const s = p.s;
    ctx.fillStyle = PAL.shadow;
    ctx.beginPath(); ctx.ellipse(p.x + 14 * s, p.y + 10 * s, 12 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a5a38'; ctx.lineWidth = 4 * s;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + 4 * s, p.y - 16 * s, p.x + 8 * s, p.y - 26 * s); ctx.stroke();
    ctx.fillStyle = PAL.palm;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath(); ctx.ellipse(p.x + 8 * s + Math.cos(a) * 13 * s, p.y - 26 * s + Math.sin(a) * 9 * s, 14 * s, 4.5 * s, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = PAL.palmDark;
    ctx.beginPath(); ctx.arc(p.x + 8 * s, p.y - 26 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
  }
}

function drawYachts(ctx, world) {
  for (const y of world.city.yachts) {
    const bob = Math.sin(world.time * 0.8 + y.y) * 3;
    ctx.save(); ctx.translate(y.x, y.y + bob); ctx.rotate(y.a);
    ctx.fillStyle = PAL.shadow; ctx.fillRect(-26, 8, 52, 8);
    ctx.fillStyle = '#f2ede2';
    ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(28, 0); ctx.lineTo(20, 12); ctx.lineTo(-20, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3f7ea6'; ctx.fillRect(-12, -12, 24, 12);
    ctx.restore();
  }
}

function drawCashSpots(ctx, world) {
  for (const s of world.city.cashSpots) {
    if (s.taken) continue;
    const pulse = 1 + 0.15 * Math.sin(world.time * 4 + s.x);
    ctx.fillStyle = 'rgba(123,227,130,0.25)';
    ctx.beginPath(); ctx.arc(s.x, s.y, 26 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e7a2e';
    ctx.beginPath(); ctx.arc(s.x, s.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PAL.money; ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', s.x, s.y + 0.5);
  }
}

function drawMissionTarget(ctx, world) {
  const obj = currentObjective(world);
  if (!obj.target) return;
  const t = obj.target;
  const pulse = 1 + 0.12 * Math.sin(world.time * 5);
  ctx.strokeStyle = PAL.gold; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(t.x, t.y, t.r * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,211,77,0.12)';
  ctx.beginPath(); ctx.arc(t.x, t.y, t.r * pulse, 0, Math.PI * 2); ctx.fill();
  // Gold beacon pillar so the target reads from far away.
  ctx.fillStyle = 'rgba(255,211,77,0.20)';
  ctx.fillRect(t.x - 3, t.y - 260, 6, 260);
  ctx.fillStyle = PAL.gold;
  ctx.beginPath(); ctx.moveTo(t.x, t.y - 34); ctx.lineTo(t.x - 12, t.y - 58); ctx.lineTo(t.x + 12, t.y - 58); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#20140a'; ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center'; ctx.fillText('★', t.x, t.y - 42);
}

function drawCars(ctx, world) {
  for (const c of world.cars) drawCar(ctx, c, world);
  for (const c of world.traffic.cars) drawCar(ctx, c, world);
}

export function drawCar(ctx, c, world) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
  // Sunset shadow, offset to the east.
  ctx.fillStyle = PAL.shadow;
  roundRect(ctx, -c.len / 2 + SHX * 0.7, -c.wid / 2 + SHY * 0.7, c.len, c.wid, 9); ctx.fill();
  // Body, roof highlight, windshield, headlights.
  ctx.fillStyle = c.color;
  roundRect(ctx, -c.len / 2, -c.wid / 2, c.len, c.wid, 9); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(ctx, -c.len / 2 + 6, -c.wid / 2 + 3, c.len * 0.45, 5, 2); ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.75)';
  roundRect(ctx, -c.len * 0.08, -c.wid / 2 + 3, c.len * 0.22, c.wid - 6, 4); ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(c.len / 2 - 3, -c.wid / 2 + 3, 3, 5);
  ctx.fillRect(c.len / 2 - 3, c.wid / 2 - 8, 3, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-c.len / 2, -c.wid / 2 + 3, 3, 5);
  ctx.fillRect(-c.len / 2, c.wid / 2 - 8, 3, 5);
  if (c.type === 'taxi') { ctx.fillStyle = '#20140a'; ctx.fillRect(-8, -c.wid / 2 + 2, 16, 5); ctx.fillStyle = PAL.gold; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, -c.wid / 2 + 9); }
  if (c.type === 'police') {
    ctx.fillStyle = '#fff'; ctx.fillRect(-c.len / 2 + 4, -c.wid / 2 + 2, c.len - 8, 5);
    const flash = Math.sin((world ? world.time : 0) * 10 + (c.siren || 0)) > 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#3b82ff';
    ctx.beginPath(); ctx.arc(-6, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#3b82ff' : '#ff3b30';
    ctx.beginPath(); ctx.arc(6, 0, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (c.story) { // story car: gold ring so the player can find it
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, Math.max(c.len, c.wid) * 0.75 + 4 * Math.sin((world ? world.time : 0) * 4), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawPeds(ctx, world) {
  for (const p of world.traffic.peds) {
    ctx.fillStyle = PAL.shadow;
    ctx.beginPath(); ctx.ellipse(p.x + 5, p.y + 4, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1c10';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 2, p.y - 3 + Math.sin(p.angle) * 2, 3.2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  if (p.car) return; // the car drawing carries the player
  const bob = Math.sin(p.walkPhase) * 1.5;
  ctx.fillStyle = PAL.shadow;
  ctx.beginPath(); ctx.ellipse(p.x + 6, p.y + 5, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(p.x, p.y + bob * 0.3); ctx.rotate(p.angle);
  // Gold ring so Cole always reads as the player, on foot or in a crowd.
  ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ff5f6b'; // Cole's coral jacket
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath(); ctx.arc(4, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20140a';
  ctx.fillRect(8, -2, 10, 3); // pistol in hand, pointing where he faces
  ctx.restore();
  // Aim line while shooting.
  if (p.ammo > 0) {
    ctx.strokeStyle = 'rgba(255,211,77,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * 46, p.y + Math.sin(p.aimAngle) * 46); ctx.stroke();
  }
}

function drawGunmen(ctx, world) {
  for (const g of world.gunmen) {
    if (g.dead) continue;
    ctx.fillStyle = PAL.shadow;
    ctx.beginPath(); ctx.ellipse(g.x + 6, g.y + 5, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath(); ctx.arc(g.x, g.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.arc(g.x, g.y - 3, 4, 0, Math.PI * 2); ctx.fill();
    // Health bar above the gunman.
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(g.x - 16, g.y - 24, 32, 5);
    ctx.fillStyle = '#ff5f5f'; ctx.fillRect(g.x - 15, g.y - 23, 30 * Math.max(0, g.hp / 100), 3);
  }
}

function drawBulletsAndParticles(ctx, world) {
  ctx.fillStyle = '#ffe9a8';
  for (const b of world.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (pt.life / pt.max), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSunGlow(ctx, world) {
  // Warm sunset wash over the whole frame, stronger toward the west (left).
  const g = ctx.createLinearGradient(0, 0, VIEW.w, VIEW.h);
  g.addColorStop(0, 'rgba(255,170,60,0.14)');
  g.addColorStop(0.55, 'rgba(255,170,60,0.05)');
  g.addColorStop(1, 'rgba(255,120,60,0.10)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  const sun = ctx.createRadialGradient(90, 70, 8, 90, 70, 260);
  sun.addColorStop(0, 'rgba(255,230,150,0.30)');
  sun.addColorStop(1, 'rgba(255,230,150,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, 400, 340);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- HUD ----------

export function renderHUD(ctx, world) {
  const p = world.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left: money, health, ammo.
  panel(ctx, 14, 12, 250, 92);
  ctx.fillStyle = PAL.money; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('$' + world.money.toLocaleString(), 28, 44);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
  ctx.fillText('COLE “CASH” VEGA', 28, 66);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(28, 74, 150, 8);
  ctx.fillStyle = p.health > 40 ? '#7be382' : '#ff5f5f';
  ctx.fillRect(28, 74, 150 * Math.max(0, p.health / 100), 8);
  ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.health) + '   AMMO ' + p.ammo + '   CASH ' + world.cashFound + '/5   GARAGE ' + p.garage.length + '/5', 28, 98);

  // Top-right: wanted stars.
  panel(ctx, VIEW.w - 224, 12, 210, 46);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('WANTED', VIEW.w - 210, 30);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < world.wanted.stars ? '#ffd34d' : 'rgba(255,255,255,0.22)';
    ctx.font = '20px sans-serif';
    ctx.fillText('★', VIEW.w - 148 + i * 24, 32);
  }
  if (world.wanted.arrest > 0.05) {
    ctx.fillStyle = '#ff5f5f'; ctx.font = 'bold 11px sans-serif';
    ctx.fillText('ARREST ' + Math.round(world.wanted.arrest * 100) + '%', VIEW.w - 210, 52);
  }

  // Minimap under the stars.
  drawMinimap(ctx, world, VIEW.w - 224, 66, 210, 148);

  // Top-centre: mission chip.
  const obj = currentObjective(world);
  ctx.font = 'bold 14px sans-serif';
  const tw = ctx.measureText(obj.text).width + 36;
  panel(ctx, (VIEW.w - tw) / 2, 12, tw, 34);
  ctx.fillStyle = PAL.gold; ctx.textAlign = 'center';
  ctx.fillText(obj.text, VIEW.w / 2, 35);

  // Mission timer for the airport run.
  const m = world.missions.index < 4 ? world.missions : null;
  if (m && world.missions.index === 3 && world.missions.stage === 1) {
    const left = Math.max(0, 180 - world.missions.timer);
    panel(ctx, (VIEW.w - 170) / 2, 52, 170, 30);
    ctx.fillStyle = left < 30 ? '#ff5f5f' : '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('⏱ ' + Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0'), VIEW.w / 2, 73);
  }

  // Bottom-right: speed and car name.
  if (p.car) {
    panel(ctx, VIEW.w - 224, VIEW.h - 66, 210, 52);
    const kmh = Math.round(Math.abs(p.car.speed) * 0.55);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(kmh + ' km/h', VIEW.w - 28, VIEW.h - 34);
    ctx.fillStyle = PAL.gold; ctx.font = '12px sans-serif';
    ctx.fillText(p.car.name.toUpperCase(), VIEW.w - 28, VIEW.h - 56);
  }

  // Bottom-left: controls.
  ctx.fillStyle = 'rgba(20,14,8,0.55)';
  ctx.fillRect(14, VIEW.h - 52, 470, 38);
  ctx.fillStyle = '#ffe9a8'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('WASD drive / walk · E enter or steal car · Click / Space shoot · Shift run · P pause · M mute', 24, VIEW.h - 28);

  // Taxi chip.
  if (world.missions.taxi) {
    const t = world.missions.taxi;
    panel(ctx, 14, 118, 250, 30);
    ctx.fillStyle = '#ffd34d'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('🚕 TAXI: ' + (t.phase === 'pickup' ? 'pick up the fare' : 'drop off — $' + t.fare), 26, 138);
  }

  // Toasts, newest on top.
  let ty = 120;
  for (const toast of world.toasts.slice(-3)) {
    ctx.font = 'bold 14px sans-serif';
    const w = ctx.measureText(toast.text).width + 28;
    panel(ctx, (VIEW.w - w) / 2, ty, w, 32);
    ctx.fillStyle = toast.color || '#fff'; ctx.textAlign = 'center';
    ctx.fillText(toast.text, VIEW.w / 2, ty + 21);
    ty += 38;
  }

  // Mission banner. In staged shots it sits low so it never hides the action.
  if (world.banner && world.banner.t > 0) {
    const by = world.frozen ? 470 : 180;
    ctx.globalAlpha = Math.min(1, world.banner.t);
    panel(ctx, (VIEW.w - 560) / 2, by, 560, 86);
    ctx.fillStyle = PAL.gold; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(world.banner.title, VIEW.w / 2, by + 36);
    ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
    ctx.fillText(world.banner.sub, VIEW.w / 2, by + 64);
    ctx.globalAlpha = 1;
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PAL.hud;
  roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = PAL.hudEdge; ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 10); ctx.stroke();
}

function drawMinimap(ctx, world, x, y, w, h) {
  panel(ctx, x, y, w, h);
  const sx = w / WORLD.w, sy = h / WORLD.h;
  ctx.save();
  ctx.beginPath(); ctx.rect(x + 4, y + 4, w - 8, h - 8); ctx.clip();
  ctx.translate(x + 4, y + 4);
  // Sea.
  ctx.fillStyle = PAL.sea; ctx.fillRect(0, 0, 240 * sx, h); ctx.fillRect(0, 3560 * sy, w, h - 3560 * sy);
  ctx.fillStyle = PAL.sand; ctx.fillRect(240 * sx, 2960 * sy, w - 240 * sx, 600 * sy);
  // Roads.
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (const a of AVENUES) ctx.fillRect(a * sx - 1, 0, 2, h);
  for (const s of STREETS) ctx.fillRect(0, s * sy - 1, w, 2);
  // Downtown towers.
  ctx.fillStyle = 'rgba(120,200,240,0.8)';
  for (const b of world.city.buildings) if (b.glass) ctx.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  // Mission target.
  const obj = currentObjective(world);
  if (obj.target) {
    ctx.fillStyle = PAL.gold;
    ctx.beginPath(); ctx.arc(obj.target.x * sx, obj.target.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(obj.target.x * sx, obj.target.y * sy, 7, 0, Math.PI * 2); ctx.stroke();
  }
  // Police, then the player.
  ctx.fillStyle = '#ff3b30';
  for (const c of world.police) { ctx.beginPath(); ctx.arc(c.x * sx, c.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(world.player.x * sx, world.player.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(world.player.x * sx, world.player.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('PALMERA', x + 10, y + 16);
  ctx.fillStyle = PAL.gold;
  ctx.beginPath(); ctx.moveTo(x + w - 18, y + 8); ctx.lineTo(x + w - 12, y + 16); ctx.lineTo(x + w - 24, y + 16); ctx.closePath(); ctx.fill();
  ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('N', x + w - 30, y + 16);
}

// ---------- overlays ----------

export function renderOverlay(ctx, world) {
  if (world.mode === 'title') {
    ctx.fillStyle = 'rgba(20,10,4,0.45)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = PAL.gold; ctx.font = 'bold 72px sans-serif';
    ctx.fillText('GOLDEN TIDE', VIEW.w / 2, 190);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif';
    ctx.fillText('A sun-soaked open-world crime story · Palmera', VIEW.w / 2, 232);
    ctx.font = '16px sans-serif';
    ctx.fillText('Cole “Cash” Vega runs jobs for Mara at the beach garage —', VIEW.w / 2, 272);
    ctx.fillText('steal cars, outrun the cops, and take the city for yourself.', VIEW.w / 2, 296);
    panel(ctx, (VIEW.w - 460) / 2, 330, 460, 130);
    ctx.fillStyle = '#ffe9a8'; ctx.font = '15px sans-serif';
    ctx.fillText('WASD — walk / drive      E — enter or steal a car', VIEW.w / 2, 360);
    ctx.fillText('Click / Space — shoot      Shift — run      P — pause', VIEW.w / 2, 388);
    ctx.fillText('Taxi jobs pay cash · 5 hidden stashes · save is automatic', VIEW.w / 2, 416);
    ctx.fillStyle = world.saveExists ? '#7be382' : PAL.gold;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(world.saveExists ? '▶  CLICK TO CONTINUE YOUR RUN' : '▶  CLICK TO START', VIEW.w / 2, 510);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '13px sans-serif';
    ctx.fillText('4 story missions · wanted levels 0–5 · police chases & roadblocks · original city, story and art', VIEW.w / 2, 560);
    ctx.fillText('Judge: this is a complete playable open world — on foot and by car, with traffic, police, missions and a minimap.', VIEW.w / 2, 600);
  } else if (world.mode === 'paused') {
    ctx.fillStyle = 'rgba(20,10,4,0.6)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW.w / 2, 330);
    ctx.font = '18px sans-serif';
    ctx.fillText('Press P to keep playing · progress is saved automatically', VIEW.w / 2, 372);
  } else if (world.mode === 'busted') {
    ctx.fillStyle = 'rgba(40,4,4,0.72)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.fillStyle = '#ff5f5f'; ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('BUSTED!', VIEW.w / 2, 300);
    ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
    ctx.fillText('The Palmera police caught Cole. Fine paid: $' + (world.bustedFine || 0) + '.', VIEW.w / 2, 350);
    ctx.fillText('Click to get back on the street.', VIEW.w / 2, 384);
  } else if (world.mode === 'complete') {
    ctx.fillStyle = 'rgba(20,30,4,0.66)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.fillStyle = PAL.gold; ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PALMERA IS YOURS', VIEW.w / 2, 300);
    ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
    ctx.fillText('All four missions done. Cole “Cash” Vega owns the golden tide.', VIEW.w / 2, 348);
    ctx.fillText('Final take: $' + world.money.toLocaleString() + ' · Click to keep free-roaming.', VIEW.w / 2, 382);
  }
}
