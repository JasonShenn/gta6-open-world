// render.js — 渲染主循环：镜头跟随（步行 2.1× / 开车 1.35×）、世界绘制、
// 金色黄昏罩层、HUD（金钱/血条/弹药/通缉星/小地图/任务横幅/车速/提示/toast/暂停/结局）。
import { WORLD, CAR_TYPES } from './config.js';
import { drawGlints } from './city.js';
import { drawCar, drawPed } from './traffic.js';
import { drawPlayer } from './player.js';
import { drawPolice } from './police.js';
import { drawMissionMarks, currentObjective, currentTarget } from './missions.js';

const $ = id => document.getElementById(id);
let glowGrad = null, vigGrad = null; // 黄昏罩层渐变只建一次，不每帧新建

// 镜头：步行放大（玩家约 36px），开车拉远（约 1.35×），平滑过渡。
function updateCamera(S) {
  const target = S.player.car ? 1.35 : 2.1;
  S.zoom += (target - S.zoom) * 0.06;
  const vw = 1280 / S.zoom, vh = 720 / S.zoom;
  let cx = S.player.x - vw / 2, cy = S.player.y - vh / 2;
  cx = Math.max(-40, Math.min(WORLD.w - vw + 40, cx));
  cy = Math.max(-40, Math.min(WORLD.h - vh + 40, cy));
  S.cam = { x: cx, y: cy, w: vw, h: vh };
  if (S.shake > 0) {
    S.cam.x += (Math.random() - 0.5) * S.shake;
    S.cam.y += (Math.random() - 0.5) * S.shake;
    S.shake *= 0.85; if (S.shake < 0.3) S.shake = 0;
  }
}

export function render(S) {
  const ctx = S.ctx;
  updateCamera(S);
  const v = { x0: S.cam.x, y0: S.cam.y, x1: S.cam.x + S.cam.w, y1: S.cam.y + S.cam.h };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1a1210'; ctx.fillRect(0, 0, 1280, 720);
  // 静态城市：直接贴预渲染图的可见区域（一张 drawImage 代替几千次画图）。
  const sc = S.city.staticCanvas;
  if (sc) ctx.drawImage(sc, S.cam.x, S.cam.y, S.cam.w, S.cam.h, 0, 0, 1280, 720);
  ctx.setTransform(S.zoom, 0, 0, S.zoom, -S.cam.x * S.zoom, -S.cam.y * S.zoom);
  drawGlints(ctx, S.city, S.time);
  // 停着的车（可偷）与已开过的车
  for (const c of S.cars) drawCar(ctx, c.x, c.y, c.angle, c.type);
  for (const c of S.owned) if (c !== S.player.car) drawCar(ctx, c.x, c.y, c.angle, c.type);
  if (S.player.car) drawCar(ctx, S.player.car.x, S.player.car.y, S.player.car.angle, S.player.car.type);
  // 车流与行人（只画视野内的）
  for (const c of S.traffic.cars)
    if (c.x > v.x0 - 80 && c.x < v.x1 + 80 && c.y > v.y0 - 80 && c.y < v.y1 + 80) drawCar(ctx, c.x, c.y, c.angle, c.type);
  for (const p of S.traffic.peds)
    if (p.x > v.x0 - 40 && p.x < v.x1 + 40 && p.y > v.y0 - 40 && p.y < v.y1 + 40) drawPed(ctx, p);
  drawPolice(ctx, S);
  drawPlayer(ctx, S);
  drawMissionMarks(ctx, S);
  // 子弹与粒子
  ctx.fillStyle = '#ffe9a8';
  for (const b of S.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 6.29); ctx.fill(); }
  for (const pt of S.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, 6.29); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // —— 金色黄昏罩层：西边夕阳光晕 + 整体暖色 + 暗角（渐变只建一次） ——
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!glowGrad) {
    glowGrad = ctx.createRadialGradient(60, 360, 40, 60, 360, 900);
    glowGrad.addColorStop(0, 'rgba(255,170,60,0.20)');
    glowGrad.addColorStop(0.5, 'rgba(255,140,60,0.07)');
    glowGrad.addColorStop(1, 'rgba(255,140,60,0)');
    vigGrad = ctx.createRadialGradient(640, 360, 300, 640, 360, 800);
    vigGrad.addColorStop(0, 'rgba(40,10,40,0)'); vigGrad.addColorStop(1, 'rgba(40,10,40,0.22)');
  }
  ctx.fillStyle = glowGrad; ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = 'rgba(255,120,40,0.05)'; ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = vigGrad; ctx.fillRect(0, 0, 1280, 720);
  // HUD 与小地图节流到每 3 帧一次（DOM 写操作省着点）。
  S.hudTick = (S.hudTick || 0) + 1;
  if (S.hudTick % 3 === 1) { updateHud(S); drawMinimap(S); }
}

// —— HUD（DOM）——
function starStr(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }
function updateHud(S) {
  const p = S.player;
  $('hud-money').textContent = '$' + Math.floor(S.money).toLocaleString('en-US');
  $('hud-hp').style.width = Math.max(0, p.hp) + '%';
  $('hud-hptext').textContent = 'HP ' + Math.max(0, Math.ceil(p.hp));
  $('hud-ammo').textContent = 'AMMO ' + p.ammo;
  $('hud-cash').textContent = 'CASH ' + S.cashFound + '/5';
  $('hud-garage').textContent = 'GARAGE ' + S.garage.length + '/5';
  $('hud-wanted').innerHTML = 'WANTED <span class="stars">' + starStr(S.wanted) + '</span>';
  $('hud-objective').textContent = (S.mission ? S.mission.id + ' · ' + S.missionTitle() + ' — ' : '') + currentObjective(S);
  if (S.mission) $('hud-objective').textContent = `${S.mission.id} · ${S.missionTitle()} — ${currentObjective(S)}`;
  if (p.car) {
    const def = CAR_TYPES[p.car.type];
    $('hud-speed').textContent = Math.round(Math.abs(p.car.speed) * 0.45) + ' km/h';
    $('hud-carname').textContent = def.name;
    $('hud-speedbox').style.display = 'block';
  } else $('hud-speedbox').style.display = 'none';
  if (S.m4Timer > 0 && S.mission?.id === 'M4') {
    $('hud-timer').textContent = '⏱ ' + Math.ceil(S.m4Timer) + 's';
    $('hud-timer').style.display = 'block';
  } else $('hud-timer').style.display = 'none';
  $('hud-mute').textContent = S.sfx.muted ? '🔇 MUTED' : '🔊 SOUND';
  // 横幅（置顶，不遮画面中央）
  if (S.banner && S.banner.t > 0) {
    $('hud-banner').style.display = 'block';
    $('hud-banner-title').textContent = S.banner.title;
    $('hud-banner-sub').textContent = S.banner.sub;
  } else $('hud-banner').style.display = 'none';
  // toast（最新 3 条）
  const box = $('hud-toasts');
  box.innerHTML = '';
  for (const t of S.toasts.slice(-3)) {
    const d = document.createElement('div');
    d.className = 'toast'; d.textContent = t.text;
    box.appendChild(d);
  }
  $('hud-pause').style.display = S.paused ? 'flex' : 'none';
  if (S.over) {
    $('hud-over').style.display = 'flex';
    $('hud-over-title').textContent = S.over === 'win' ? 'PALMERA IS YOURS' : 'BUSTED!';
    $('hud-over-sub').textContent = S.over === 'win'
      ? `All four jobs done. You took the city, Cash. Final take: $${Math.floor(S.money).toLocaleString('en-US')}.`
      : 'The Palmera PD caught you. Press R to start over.';
  } else $('hud-over').style.display = 'none';
}

// —— 小地图：路网 + 楼点 + 玩家箭头 + 目标标记 + N 指示 ——
function drawMinimap(S) {
  const mc = $('minimap');
  if (!mc) return;
  const m = mc.getContext('2d');
  const sx = 200 / WORLD.w, sy = 140 / WORLD.h;
  m.fillStyle = '#20241c'; m.fillRect(0, 0, 200, 140);
  m.fillStyle = '#2f7f8c'; m.fillRect(0, 0, 150 * sx, 140); // 西边海
  m.fillStyle = '#eac98f'; m.fillRect(150 * sx, 0, 150 * sx, 140); // 沙滩
  m.fillStyle = '#6e5b52';
  for (const x of [420, 1020, 1620, 2220, 2820, 3420, 4020, 4620]) m.fillRect(x * sx - 2, 0, 4, 140);
  for (const y of [380, 880, 1380, 1880, 2380, 2880, 3380]) m.fillRect(0, y * sy - 2, 200, 4);
  m.fillStyle = '#c2b26a';
  for (const b of S.city.buildings) m.fillRect(b.x * sx, b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  // 目标标记（脉冲金点）
  const t = currentTarget(S);
  if (t && !S.over) {
    const r = 4 + 1.5 * Math.sin(S.time * 4);
    m.fillStyle = '#ffd25a'; m.beginPath(); m.arc(t.x * sx, t.y * sy, r, 0, 6.29); m.fill();
    m.strokeStyle = '#fff'; m.lineWidth = 1; m.beginPath(); m.arc(t.x * sx, t.y * sy, r + 2, 0, 6.29); m.stroke();
  }
  // 玩家箭头
  const px = S.player.x * sx, py = S.player.y * sy;
  m.save(); m.translate(px, py); m.rotate(S.player.aim || 0);
  m.fillStyle = '#fff'; m.beginPath(); m.moveTo(6, 0); m.lineTo(-4, -4); m.lineTo(-4, 4); m.closePath(); m.fill();
  m.restore();
  // N 指示 + 地名
  m.fillStyle = 'rgba(255,255,255,0.9)'; m.font = 'bold 11px sans-serif'; m.textAlign = 'left';
  m.fillText('PALMERA', 6, 13);
  m.fillText('N ↑', 176, 13);
}
