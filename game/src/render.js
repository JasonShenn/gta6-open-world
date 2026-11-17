// Solmar Heat — canvas rendering: the city, its people and cars, the
// player, effects, and the minimap. All art is drawn in code; there
// are no image assets.

import { WORLD, ROAD_W, SIDEWALK, V_ROADS, H_ROADS, PARK, BEACH, MARINA, PAL, CAR, PLAYER } from './config.js';
import { LANDMARKS } from './city.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, x, y, angle, color, opts) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -22 + 3, -11 + 4, 46, 24, 8);
  ctx.fill();
  // Body.
  ctx.fillStyle = color;
  roundRect(ctx, -23, -12, 46, 24, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Windshield + rear window.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  roundRect(ctx, 4, -9, 10, 18, 3);
  ctx.fill();
  roundRect(ctx, -15, -9, 8, 18, 3);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#fff8c8';
  ctx.fillRect(21, -9, 3, 5);
  ctx.fillRect(21, 4, 3, 5);
  if (opts && opts.gold) {
    ctx.strokeStyle = '#fff3a0';
    ctx.lineWidth = 2;
    roundRect(ctx, -23, -12, 46, 24, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, opts) {
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(1, 3, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(angle);
  // Body (a walking figure seen from above: shoulders + head).
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(4, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  if (opts && opts.down) {
    ctx.rotate(-angle);
    ctx.fillStyle = 'rgba(217,79,61,0.8)';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✕', 0, -16);
  }
  ctx.restore();
}

export function renderWorld(game) {
  const ctx = game.ctx;
  const cam = game.cam;
  const city = game.city;
  const vw = cam.w, vh = cam.h;
  ctx.clearRect(0, 0, vw, vh);
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

  // --- Ground -----------------------------------------------------------------
  ctx.fillStyle = PAL.grass;
  ctx.fillRect(cam.x - 10, cam.y - 10, vw + 20, vh + 20);
  // Subtle mowing stripes so the grass is not flat.
  ctx.fillStyle = PAL.grassDark;
  const stripe = 160;
  const x0 = Math.floor(cam.x / stripe) * stripe;
  for (let x = x0; x < cam.x + vw; x += stripe * 2) {
    ctx.fillRect(x, cam.y - 10, stripe, vh + 20);
  }

  // --- Beach and marina --------------------------------------------------------
  ctx.fillStyle = PAL.sand;
  ctx.fillRect(BEACH.x, BEACH.y, BEACH.w, BEACH.h);
  ctx.fillStyle = PAL.water;
  ctx.fillRect(MARINA.x, MARINA.y, MARINA.w, MARINA.h);
  ctx.fillStyle = PAL.waterDeep;
  for (let i = 0; i < 6; i++) {
    const wy = MARINA.y + 40 + i * 52;
    ctx.fillRect(MARINA.x + 20, wy, MARINA.w - 40, 6);
  }
  // Docks.
  ctx.fillStyle = '#8a6b48';
  for (const dy of [2140, 2240, 2340]) ctx.fillRect(1980, dy - 6, 900, 12);
  // Moored boats.
  for (const b of city.boats) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = b.color;
    roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,45,0.7)';
    ctx.fillRect(-6, -4, 12, 8);
    ctx.restore();
  }

  // --- Park ----------------------------------------------------------------------
  ctx.fillStyle = PAL.park;
  ctx.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);
  ctx.fillStyle = '#7cc0d8';
  ctx.beginPath();
  ctx.ellipse(city.pondRect.x + 65, city.pondRect.y + 45, 65, 45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8dcc0';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(PARK.x, PARK.y + PARK.h / 2);
  ctx.lineTo(PARK.x + PARK.w, PARK.y + PARK.h / 2);
  ctx.moveTo(PARK.x + PARK.w / 2, PARK.y);
  ctx.lineTo(PARK.x + PARK.w / 2, PARK.y + PARK.h);
  ctx.stroke();
  for (const t of city.trees) {
    ctx.fillStyle = '#3f7d33';
    ctx.beginPath(); ctx.arc(t.x, t.y, 13 * (t.s || 1), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#57a047';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, 8 * (t.s || 1), 0, Math.PI * 2); ctx.fill();
  }

  // --- Plaza ----------------------------------------------------------------------
  ctx.fillStyle = PAL.plaza;
  ctx.fillRect(city.plaza.x, city.plaza.y, city.plaza.w, city.plaza.h);
  ctx.fillStyle = '#7cc0d8';
  ctx.beginPath(); ctx.arc(1915, 635, 26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b8ab8d';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(1915, 635, 32, 0, Math.PI * 2); ctx.stroke();

  // --- Roads -----------------------------------------------------------------------
  ctx.fillStyle = PAL.sidewalk;
  for (const vx of V_ROADS) ctx.fillRect(vx - ROAD_W / 2 - SIDEWALK, 0, ROAD_W + SIDEWALK * 2, WORLD.h);
  for (const hy of H_ROADS) ctx.fillRect(0, hy - ROAD_W / 2 - SIDEWALK, WORLD.w, ROAD_W + SIDEWALK * 2);
  ctx.fillStyle = PAL.road;
  for (const vx of V_ROADS) ctx.fillRect(vx - ROAD_W / 2, 0, ROAD_W, WORLD.h);
  for (const hy of H_ROADS) ctx.fillRect(0, hy - ROAD_W / 2, WORLD.w, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = PAL.roadLine;
  for (const vx of V_ROADS) {
    for (let y = 40; y < WORLD.h; y += 64) ctx.fillRect(vx - 3, y, 6, 32);
  }
  for (const hy of H_ROADS) {
    for (let x = 40; x < WORLD.w; x += 64) ctx.fillRect(x, hy - 3, 32, 6);
  }

  // --- Buildings --------------------------------------------------------------------
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PAL.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Rooftop detail: a lighter inset + skylight dots.
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    ctx.fillStyle = 'rgba(20,30,45,0.55)';
    const cols = Math.max(2, Math.floor(b.w / 34));
    const rows = Math.max(2, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 14 + i * 34, b.y + 14 + j * 34, 14, 10);
      }
    }
    if (b.landmark === 'tower') {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 10, b.y + 10, 18, b.h - 20);
    }
    if (b.landmark === 'garage') {
      ctx.fillStyle = '#f2f2f2';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("VERA'S", b.x + b.w / 2, b.y + b.h / 2 - 4);
      ctx.fillText('GARAGE', b.x + b.w / 2, b.y + b.h / 2 + 14);
    }
  }

  // Beach palms.
  for (const p of city.palms) {
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 6, p.y - 22 * p.s); ctx.stroke();
    ctx.fillStyle = '#3f9d4e';
    ctx.beginPath(); ctx.arc(p.x + 6, p.y - 24 * p.s, 12 * p.s, 0, Math.PI * 2); ctx.fill();
  }

  // --- Mission marker ---------------------------------------------------------------
  const marker = game.missions.marker();
  if (marker && game.state === 'playing') {
    const pulse = 1 + Math.sin(game.time * 4) * 0.12;
    ctx.strokeStyle = PAL.markerGold;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(marker.x, marker.y, marker.r * 0.55 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,62,0.16)';
    ctx.beginPath(); ctx.arc(marker.x, marker.y, marker.r * 0.55 * pulse, 0, Math.PI * 2); ctx.fill();
    // Bouncing pin.
    const bob = Math.sin(game.time * 5) * 6;
    ctx.fillStyle = PAL.markerGold;
    ctx.beginPath(); ctx.arc(marker.x, marker.y - 34 + bob, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(marker.x - 8, marker.y - 26 + bob);
    ctx.lineTo(marker.x + 8, marker.y - 26 + bob);
    ctx.lineTo(marker.x, marker.y - 12 + bob);
    ctx.closePath(); ctx.fill();
  }

  // --- Parked cars ---------------------------------------------------------------------
  for (const c of game.parkedCars) {
    drawCarShape(ctx, c.x, c.y, c.angle, c.color, { gold: !!c.targetCar });
  }
  // --- Traffic ---------------------------------------------------------------------------
  for (const t of game.traffic) drawCarShape(ctx, t.x, t.y, t.angle, t.color);
  // --- Police ------------------------------------------------------------------------------
  for (const cop of game.cops) {
    drawCarShape(ctx, cop.x, cop.y, cop.angle, '#1c2a4a');
    // Light bar, alternating red/blue.
    const red = Math.sin(cop.sirenPhase) > 0;
    ctx.fillStyle = red ? '#ff2d2d' : '#2d6bff';
    ctx.fillRect(cop.x - 8, cop.y - 14, 16, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', cop.x, cop.y + 4);
  }
  // --- Player's car ---------------------------------------------------------------------------
  if (game.inCar && game.car) {
    drawCarShape(ctx, game.car.x, game.car.y, game.car.angle, game.car.color, { gold: !!game.car.targetCar });
  }
  // --- Pedestrians ------------------------------------------------------------------------------
  for (const p of game.peds) {
    drawPerson(ctx, p.x, p.y, p.angle, p.shirt, { down: p.state === 'down' });
  }
  // --- Enemies --------------------------------------------------------------------------------------
  for (const e of game.enemies) {
    drawPerson(ctx, e.x, e.y, e.angle, '#3a3a3a');
    // Gun.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x + Math.cos(e.angle) * 12, e.y + Math.sin(e.angle) * 12);
    ctx.lineTo(e.x + Math.cos(e.angle) * 26, e.y + Math.sin(e.angle) * 26);
    ctx.stroke();
    // Health bar.
    const w = 36;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(e.x - w / 2, e.y - 30, w, 6);
    ctx.fillStyle = e.hp > 50 ? '#57d977' : e.hp > 25 ? '#ffd23e' : '#ff4d4d';
    ctx.fillRect(e.x - w / 2, e.y - 30, w * Math.max(0, e.hp / e.maxHp), 6);
    if (e.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(e.x, e.y, 14, 0, Math.PI * 2); ctx.fill();
    }
  }
  // --- Player ------------------------------------------------------------------------------------------
  if (!game.inCar) {
    const p = game.player;
    const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
    drawPerson(ctx, p.x, p.y + bob * 0.2, p.angle, '#ff8c42');
    // Pistol in hand when aiming.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
    ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
    ctx.stroke();
    // Direction tick.
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // --- Bullets ----------------------------------------------------------------------------------------------
  ctx.fillStyle = '#ffe98a';
  for (const b of game.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // --- Particles --------------------------------------------------------------------------------------------------
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // --- Arrest warning ----------------------------------------------------------------------------------------------
  if (game.cops.some((c) => c.arrestTimer > 0.4)) {
    ctx.fillStyle = 'rgba(255,45,45,0.9)';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THEY ARE GRABBING YOU — DRIVE!', cam.x + vw / 2, cam.y + 120);
  }

  ctx.restore();

  // --- Vignette + sun tint --------------------------------------------------------------------------------------------
  const grad = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  grad.addColorStop(0, 'rgba(255,220,140,0)');
  grad.addColorStop(1, 'rgba(30,20,0,0.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
}

// --- Minimap -----------------------------------------------------------------------------------------------------------------
export function renderMinimap(game) {
  const ctx = game.minimapCtx;
  const mm = game.minimap;
  const W = mm.width, H = mm.height;
  const sx = W / WORLD.w, sy = H / WORLD.h;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#6d9c55';
  ctx.fillRect(0, 0, W, H);
  // Water + sand.
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(MARINA.x * sx, MARINA.y * sy, MARINA.w * sx, MARINA.h * sy);
  ctx.fillStyle = '#e8d39a';
  ctx.fillRect(BEACH.x * sx, BEACH.y * sy, BEACH.w * sx, BEACH.h * sy);
  // Park.
  ctx.fillStyle = '#4f8f3e';
  ctx.fillRect(PARK.x * sx, PARK.y * sy, PARK.w * sx, PARK.h * sy);
  // Roads.
  ctx.fillStyle = '#3d3f45';
  for (const vx of V_ROADS) ctx.fillRect((vx - ROAD_W / 2) * sx, 0, ROAD_W * sx, H);
  for (const hy of H_ROADS) ctx.fillRect(0, (hy - ROAD_W / 2) * sy, W, ROAD_W * sy);
  // Buildings.
  ctx.fillStyle = 'rgba(40,40,40,0.75)';
  for (const b of game.city.buildings) ctx.fillRect(b.x * sx, b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  // Mission marker.
  const marker = game.missions.marker();
  if (marker) {
    const pulse = 3 + Math.sin(game.time * 5) * 1.5;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(marker.x * sx, marker.y * sy, pulse + 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Cops (blue dots), enemies (red), player (white arrow).
  ctx.fillStyle = '#2d6bff';
  for (const c of game.cops) {
    ctx.beginPath(); ctx.arc(c.x * sx, c.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ff2d2d';
  for (const e of game.enemies) {
    ctx.beginPath(); ctx.arc(e.x * sx, e.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  const px = game.player.x * sx, py = game.player.y * sy;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, py - 6);
  ctx.lineTo(px + 5, py + 5);
  ctx.lineTo(px - 5, py + 5);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // North label.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', 4, 11);
}
