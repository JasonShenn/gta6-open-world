// render.js — 画面：相机、世界贴图、实体、枪口火光、黄昏滤镜与小地图。
// 步行变焦 2.1×、开车 1.35×；玩家步行约 36px 高，红夹克 + 手枪 + 金圈。

import { WORLD, ZOOM_FOOT, ZOOM_CAR, SEA_X } from './config.js';

// 相机：跟随玩家，变焦向目标值平滑过渡， clamp 在世界内。
export function updateCamera(world, dt) {
  const cam = world.cam;
  const targetZoom = world.player.inCar ? ZOOM_CAR : ZOOM_FOOT;
  cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 3);
  const vw = world.canvas.width / cam.zoom;
  const vh = world.canvas.height / cam.zoom;
  cam.x += (world.player.x - cam.x) * Math.min(1, dt * 6);
  cam.y += (world.player.y - cam.y) * Math.min(1, dt * 6);
  cam.x = Math.max(vw / 2 - 120, Math.min(WORLD.w - vw / 2 + 120, cam.x));
  cam.y = Math.max(vh / 2 - 120, Math.min(WORLD.h - vh / 2 + 120, cam.y));
}

// 世界坐标 → 屏幕坐标。
export function worldToScreen(world, x, y) {
  const cam = world.cam;
  return {
    x: (x - cam.x) * cam.zoom + world.canvas.width / 2,
    y: (y - cam.y) * cam.zoom + world.canvas.height / 2,
  };
}
export function screenToWorld(world, sx, sy) {
  const cam = world.cam;
  return {
    x: (sx - world.canvas.width / 2) / cam.zoom + cam.x,
    y: (sy - world.canvas.height / 2) / cam.zoom + cam.y,
  };
}

// —— 主绘制。
export function drawGame(world) {
  const ctx = world.ctx;
  const cv = world.canvas;
  const cam = world.cam;
  ctx.clearRect(0, 0, cv.width, cv.height);
  // 背景兜底（世界贴图外的边角）。
  ctx.fillStyle = '#8a6f3e';
  ctx.fillRect(0, 0, cv.width, cv.height);

  // 贴静态城市：只画相机看到的那块。
  const vw = cv.width / cam.zoom, vh = cv.height / cam.zoom;
  const sx = Math.max(0, cam.x - vw / 2), sy = Math.max(0, cam.y - vh / 2);
  const sw = Math.min(WORLD.w - sx, vw), sh = Math.min(WORLD.h - sy, vh);
  const dx = (sx - (cam.x - vw / 2)) * cam.zoom;
  const dy = (sy - (cam.y - vh / 2)) * cam.zoom;
  ctx.drawImage(world.staticCanvas, sx, sy, sw, sh, dx, dy, sw * cam.zoom, sh * cam.zoom);

  // 海面阳光碎光：每帧在水面上闪的亮点（位置随时间漂）。
  drawSeaGlints(world);

  // 目标金环（脉冲）。
  const target = world.targetPos;
  if (target && world.mode === 'play') {
    const p = worldToScreen(world, target.x, target.y);
    const pulse = 1 + Math.sin(world.time * 3) * 0.12;
    ctx.strokeStyle = 'rgba(255,215,80,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 34 * pulse * cam.zoom * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,80,0.9)';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 26 * cam.zoom * 0.6, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 隐藏现金点（未拾取的画成小绿袋）。
  world.missions.cashFound.size;
  for (let i = 0; i < 5; i++) {
    if (world.missions.cashFound.has(i)) continue;
    const c = world.cashSpots[i];
    const p = worldToScreen(world, c.x, c.y);
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath(); ctx.arc(p.x, p.y, 9 * cam.zoom * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(10, 11 * cam.zoom * 0.5)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', p.x, p.y);
  }
  // M3 现金袋。
  if (world.missions.cashBag) {
    const p = worldToScreen(world, world.missions.cashBag.x, world.missions.cashBag.y);
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(p.x - 12, p.y - 9, 24, 18);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', p.x, p.y);
  }

  // 停着的车、车流、警车、路障、行人、枪手、子弹、粒子。
  for (const c of world.city.parkedCars) if (!c.taken) drawCar(world, c);
  for (const c of world.traffic.cars) if (c.driver !== 'player') drawCar(world, c);
  for (const c of world.police.cars) drawPoliceCar(world, c);
  for (const b of world.police.roadblocks) drawRoadblock(world, b);
  for (const p of world.traffic.peds) drawPed(world, p);
  for (const g of world.missions.gunmen) drawGunman(world, g);
  for (const b of world.bullets) drawBullet(world, b);
  for (const pt of world.particles) drawParticle(world, pt);

  // 玩家：开车画车，步行画大号小人。
  if (world.player.inCar) {
    drawCar(world, world.player.inCar);
  } else {
    drawPlayerOnFoot(world);
  }

  // 黄昏滤镜：西边暖光 + 夕阳光晕 + 暗角（屏幕空间）。
  drawDusk(world);
}

function drawSeaGlints(world) {
  const ctx = world.ctx;
  const t = world.time;
  for (let i = 0; i < 46; i++) {
    const wx = 20 + ((i * 53 + Math.floor(t * 24) * 7) % 210);
    const wy = (i * 173) % 2600;
    const p = worldToScreen(world, wx, wy);
    if (p.x < -20 || p.x > world.canvas.width + 20 || p.y < -20 || p.y > world.canvas.height + 20) continue;
    const a = 0.10 + 0.14 * Math.abs(Math.sin(t * 1.7 + i));
    ctx.fillStyle = `rgba(255,225,150,${a.toFixed(2)})`;
    ctx.fillRect(p.x, p.y, 10, 2.5);
  }
}

// 一辆车：车身、车窗、车灯、车轮；出租车顶灯写 TAXI，警车红蓝灯。
export function drawCar(world, car) {
  const ctx = world.ctx;
  const p = worldToScreen(world, car.x, car.y);
  const z = world.cam.zoom;
  const L = 46 * z, W = 22 * z; // 车长/车宽（世界单位 × 变焦 = 屏幕像素）
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  ctx.fillStyle = car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  roundRect(ctx, -L * 0.18, -W * 0.38, L * 0.34, W * 0.76, 3);
  ctx.fill();
  // 车灯。
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(L / 2 - 2, -W / 2 + 2, 3, 5);
  ctx.fillRect(L / 2 - 2, W / 2 - 7, 3, 5);
  ctx.fillStyle = '#e33';
  ctx.fillRect(-L / 2 - 1, -W / 2 + 2, 3, 5);
  ctx.fillRect(-L / 2 - 1, W / 2 - 7, 3, 5);
  if (car.type === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.font = `bold ${Math.max(8, 9 * z * 0.5)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 1);
  }
  ctx.restore();
}

function drawPoliceCar(world, car) {
  drawCar(world, { ...car, type: 'police', color: '#2e6fd8' });
  const ctx = world.ctx;
  const p = worldToScreen(world, car.x, car.y);
  const blink = Math.sin(world.time * 10) > 0;
  ctx.fillStyle = blink ? '#ff2e2e' : '#2e7bff';
  ctx.beginPath(); ctx.arc(p.x, p.y - 6, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = blink ? '#2e7bff' : '#ff2e2e';
  ctx.beginPath(); ctx.arc(p.x, p.y + 6, 5, 0, Math.PI * 2); ctx.fill();
}

function drawRoadblock(world, b) {
  const ctx = world.ctx;
  const p = worldToScreen(world, b.x, b.y);
  const z = world.cam.zoom;
  ctx.fillStyle = '#e67e22';
  ctx.fillRect(p.x - 26 * z * 0.5, p.y - 8 * z * 0.5, 52 * z * 0.5, 16 * z * 0.5);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) ctx.fillRect(p.x - 22 * z * 0.5 + i * 13 * z * 0.5, p.y - 8 * z * 0.5, 6 * z * 0.5, 16 * z * 0.5);
}

function drawPed(world, p) {
  const ctx = world.ctx;
  const s = worldToScreen(world, p.x, p.y);
  const z = world.cam.zoom;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(s.x + 3, s.y + 8 * z * 0.5, 7 * z * 0.5, 3.5 * z * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(s.x, s.y, 6 * z * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(s.x, s.y - 7 * z * 0.5, 3.4 * z * 0.5, 0, Math.PI * 2); ctx.fill();
}

// 步行玩家：约 36px 高（世界单位），红夹克、可见手枪、金圈；枪口火光是星形。
function drawPlayerOnFoot(world) {
  const ctx = world.ctx;
  const pl = world.player;
  const s = worldToScreen(world, pl.x, pl.y);
  // 比例尺：人物本体约 20 世界单位高，步行变焦 2.1× 时屏幕上约 40px（v3 同款尺寸）。
  const u = world.cam.zoom * 0.5;
  const H = 36; // 屏幕目标高度（约数，见上）
  // 金圈（比人物大一圈，码头上远远就能认出玩家）。
  ctx.strokeStyle = 'rgba(255,215,80,0.95)';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(s.x, s.y + 8 * u, 30 * u, 14 * u, 0, 0, Math.PI * 2); ctx.stroke();
  // 影子。
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(s.x + 4 * u, s.y + 10 * u, 11 * u, 5 * u, 0, 0, Math.PI * 2); ctx.fill();
  // 腿（深色裤）。
  ctx.fillStyle = '#232a33';
  ctx.fillRect(s.x - 6 * u, s.y + 2 * u, 5 * u, 12 * u);
  ctx.fillRect(s.x + 1 * u, s.y + 2 * u, 5 * u, 12 * u);
  // 红夹克身子。
  ctx.fillStyle = '#d92323';
  roundRect(ctx, s.x - 8 * u, s.y - 14 * u, 16 * u, 17 * u, 4 * u);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(s.x - 8 * u, s.y - 14 * u, 16 * u, 4 * u);
  // 头 + 金发。
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(s.x, s.y - 19 * u, 6.5 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c15a';
  ctx.beginPath(); ctx.arc(s.x, s.y - 21 * u, 6.5 * u, Math.PI, Math.PI * 2); ctx.fill();
  // 手枪：沿瞄准方向伸出。
  const ga = pl.angle;
  const gx = s.x + Math.cos(ga) * 12 * u;
  const gy = s.y - 6 * u + Math.sin(ga) * 12 * u;
  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 3.4 * u;
  ctx.beginPath(); ctx.moveTo(s.x, s.y - 6 * u); ctx.lineTo(gx, gy); ctx.stroke();
  // 枪口火光：大而亮的星形（开火后 0.09 秒内可见）。
  if (pl.muzzle > 0) {
    const fx = gx + Math.cos(ga) * 10 * u;
    const fy = gy + Math.sin(ga) * 10 * u;
    drawStar(ctx, fx, fy, 22 * u, 9 * u, 5);
  }
}

// 枪手：与玩家同尺寸，深色衣服，头顶红血条。
function drawGunman(world, g) {
  const ctx = world.ctx;
  const s = worldToScreen(world, g.x, g.y);
  const u = world.cam.zoom * 0.5; // 与玩家同尺寸
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(s.x + 4 * u, s.y + 10 * u, 11 * u, 5 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b2b33';
  roundRect(ctx, s.x - 8 * u, s.y - 14 * u, 16 * u, 17 * u, 4 * u);
  ctx.fill();
  ctx.fillStyle = '#c9a186';
  ctx.beginPath(); ctx.arc(s.x, s.y - 19 * u, 6.5 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(s.x, s.y - 21 * u, 6.5 * u, Math.PI, Math.PI * 2); ctx.fill();
  // 血条（比人物略宽，缩略图下也看得见）。
  const w = 44 * u;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(s.x - w / 2, s.y - 32 * u, w, 5 * u);
  ctx.fillStyle = '#e33';
  ctx.fillRect(s.x - w / 2, s.y - 32 * u, w * Math.max(0, g.hp / 40), 5 * u);
}

function drawBullet(world, b) {
  const ctx = world.ctx;
  const s = worldToScreen(world, b.x, b.y);
  ctx.fillStyle = b.from === 'player' ? '#ffe066' : '#ff6b5e';
  ctx.beginPath(); ctx.arc(s.x, s.y, 3.4 * world.cam.zoom * 0.5, 0, Math.PI * 2); ctx.fill();
}

function drawParticle(world, pt) {
  const ctx = world.ctx;
  const s = worldToScreen(world, pt.x, pt.y);
  ctx.globalAlpha = Math.max(0, pt.life / pt.max);
  ctx.fillStyle = pt.color;
  ctx.beginPath(); ctx.arc(s.x, s.y, pt.size * world.cam.zoom * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

// 黄昏滤镜：西边暖光渐变 + 夕阳光晕 + 暗角。
function drawDusk(world) {
  const ctx = world.ctx;
  const cv = world.canvas;
  const grad = ctx.createLinearGradient(0, 0, cv.width, 0);
  grad.addColorStop(0, 'rgba(255,150,50,0.16)');
  grad.addColorStop(0.45, 'rgba(255,170,80,0.05)');
  grad.addColorStop(1, 'rgba(40,20,80,0.06)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cv.width, cv.height);
  // 西边夕阳光晕（屏幕左缘中部）。
  const sun = ctx.createRadialGradient(40, cv.height * 0.42, 10, 40, cv.height * 0.42, 260);
  sun.addColorStop(0, 'rgba(255,200,110,0.30)');
  sun.addColorStop(1, 'rgba(255,200,110,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, cv.width, cv.height);
  // 暗角。
  const vg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.42, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(20,8,0,0.30)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, cv.width, cv.height);
}

// —— 小地图：200×150，画道路、楼块、海、玩家箭头、目标标记、警车点。
export function drawMinimap(world, mini) {
  const ctx = mini.getContext('2d');
  const W = mini.width, H = mini.height;
  const sx = W / WORLD.w, sy = H / WORLD.h;
  ctx.fillStyle = '#3d3222';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1d5f7a';
  ctx.fillRect(0, 0, SEA_X * sx, H);
  ctx.fillStyle = '#e0c184';
  ctx.fillRect(300 * sx, 2380 * sy, (WORLD.w - 300) * sx, (WORLD.h - 2380) * sy);
  ctx.fillStyle = '#6b5847';
  for (const x of [300, 700, 1100, 1500, 1900, 2300, 2700, 3100]) ctx.fillRect(x * sx - 2, 0, 4, H);
  for (const y of [250, 600, 950, 1300, 1650, 2000, 2350]) ctx.fillRect(0, y * sy - 2, W, 4);
  ctx.fillStyle = '#d9c48f';
  for (const b of world.city.buildings) ctx.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  // 目标标记（金色圆）。
  if (world.targetPos) {
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath(); ctx.arc(world.targetPos.x * sx, world.targetPos.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  // 警车（红点）。
  ctx.fillStyle = '#ff3b30';
  for (const c of world.police.cars) {
    ctx.beginPath(); ctx.arc(c.x * sx, c.y * sy, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  // 玩家（白色三角箭头）。
  const px = world.player.x * sx, py = world.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(world.player.angle + Math.PI / 2);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.4, 5); ctx.lineTo(-4.4, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // 北向 N。
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('N', W - 5, 12);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('PALMERA', 5, 12);
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

// 星形（枪口火光用）：外半径 R、内半径 r、n 个角。
function drawStar(ctx, x, y, R, r, n) {
  ctx.save();
  ctx.fillStyle = '#ffd94a';
  ctx.shadowColor = '#ff9d00';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff6c9';
  ctx.beginPath(); ctx.arc(x, y, R * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
