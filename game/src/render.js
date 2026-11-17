// 只管画画：世界状态 + 当前界面进来，像素出去。
// 视口固定 960x600 个世界单位，等比缩放到窗口；HUD 用屏幕坐标画在最上层。
// 小地图、通缉星、任务目标、血条金钱都在这里。

import { PALETTE, PLAYER_MAX_HP, ROAD_SPACING, ROAD_W, WORLD_H, WORLD_W } from './config.js';
import { roadXs, roadYs } from './city.js';
import { missionObjective, missionTarget, MISSIONS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_STORY = 'story';

const VIEW_W = 960;
const VIEW_H = 600;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MINIMAP_W = 200;
const MINIMAP_H = 150;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    canvas.width = Math.round(cssW * ratio);
    canvas.height = Math.round(cssH * ratio);
    view.scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    view.x = (canvas.width - VIEW_W * view.scale) / 2;
    view.y = (canvas.height - VIEW_H * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = weight + size;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  /** 屏幕像素 → 世界坐标（鼠标瞄准用）。 */
  function screenToWorld(sx, sy) {
    const rect = canvas.getBoundingClientRect();
    const px = (sx - rect.left) * (canvas.width / rect.width);
    const py = (sy - rect.top) * (canvas.height / rect.height);
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  /** 画布 CSS 尺寸（测试脚本算鼠标位置用）。 */
  function cssSize() {
    return { w: window.innerWidth, h: window.innerHeight };
  }

  // —— 城市地面 ——
  function drawGround(state) {
    const city = state.city;
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD_W, WORLD_H);
    // 南边是海：沙滩 + 海水带。
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, WORLD_H - 90, WORLD_W, 34);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, WORLD_H - 56, WORLD_W, 56);
    context.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = 0; x < WORLD_W; x += 90) {
      context.fillRect(x + ((state.time * 30) % 90), WORLD_H - 52, 40, 3);
    }
    // 公园绿地 + 树。
    for (const park of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
    }
    for (const tree of city.trees) {
      context.fillStyle = '#3d7a34';
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#5da244';
      context.beginPath();
      context.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
      context.fill();
    }
    // 人行道：街区边缘一圈浅色带。
    context.fillStyle = PALETTE.sidewalk;
    for (let bx = 0; bx < 7; bx += 1) {
      for (let by = 0; by < 5; by += 1) {
        const x0 = bx * ROAD_SPACING + ROAD_SPACING / 2 + ROAD_W / 2;
        const y0 = by * ROAD_SPACING + ROAD_SPACING / 2 + ROAD_W / 2;
        const x1 = (bx + 1) * ROAD_SPACING + ROAD_SPACING / 2 - ROAD_W / 2;
        const y1 = (by + 1) * ROAD_SPACING + ROAD_SPACING / 2 - ROAD_W / 2;
        context.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
    // 道路：深色沥青 + 黄色虚线。
    context.fillStyle = PALETTE.road;
    for (const rx of roadXs()) context.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
    for (const ry of roadYs()) context.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
    context.fillStyle = PALETTE.roadLine;
    for (const rx of roadXs()) {
      for (let y = 0; y < WORLD_H; y += 48) context.fillRect(rx - 2, y, 4, 24);
    }
    for (const ry of roadYs()) {
      for (let x = 0; x < WORLD_W; x += 48) context.fillRect(x, ry - 2, 24, 4);
    }
    // 建筑：阴影 + 彩色屋顶 + 屋顶窗。
    for (const b of city.buildings) {
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.fillRect(b.x, b.y, b.w, 10);
      context.fillStyle = 'rgba(0,0,0,0.2)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          context.fillRect(b.x + 10 + cx * 34, b.y + 16 + cy * 34, 16, 12);
        }
      }
    }
    // 路灯：小圆点 + 夜色光晕（白天也淡淡一圈，好看）。
    for (const lamp of city.lamps) {
      context.fillStyle = '#2c2c2c';
      context.beginPath();
      context.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,240,180,0.12)';
      context.beginPath();
      context.arc(lamp.x, lamp.y, 14, 0, Math.PI * 2);
      context.fill();
    }
    // 地标：码头木栈道、修车行、灯塔。
    const lm = city.landmarks;
    context.fillStyle = '#8a6a45';
    context.fillRect(lm.pier.x - 60, lm.pier.y - 16, 120, 32);
    context.fillStyle = '#6a4f33';
    for (let x = lm.pier.x - 56; x < lm.pier.x + 60; x += 14) context.fillRect(x, lm.pier.y - 16, 2, 32);
    context.fillStyle = '#d9a05b';
    context.fillRect(lm.garage.x - 46, lm.garage.y - 34, 92, 68);
    context.fillStyle = '#3a3f4a';
    context.fillRect(lm.garage.x - 46, lm.garage.y - 34, 92, 12);
    text('GARAGE', lm.garage.x, lm.garage.y + 6, 13, '#fff', 'center', 'bold');
    context.fillStyle = '#e8e8e8';
    context.beginPath();
    context.arc(lm.lighthouse.x, lm.lighthouse.y, 16, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#d94f3d';
    context.fillRect(lm.lighthouse.x - 16, lm.lighthouse.y - 6, 32, 12);
    context.fillStyle = 'rgba(255,240,180,0.35)';
    context.beginPath();
    context.arc(lm.lighthouse.x, lm.lighthouse.y, 26 + Math.sin(state.time * 2) * 4, 0, Math.PI * 2);
    context.fill();
  }

  // —— 车辆：车身 + 车窗 + 车灯，警车黑白配色加爆闪灯 ——
  function drawCar(car, flash) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(-24, -10, 52, 30);
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-26, -13, 52, 26, 7);
    context.fill();
    context.fillStyle = 'rgba(180,220,255,0.85)';
    context.fillRect(-6, -10, 14, 20);
    context.fillStyle = 'rgba(255,255,200,0.9)';
    context.fillRect(22, -11, 4, 6);
    context.fillRect(22, 5, 4, 6);
    if (car.kind === 'police') {
      // 警灯：红蓝交替爆闪。
      context.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
      context.fillRect(-4, -8, 8, 7);
      context.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
      context.fillRect(-4, 1, 8, 7);
      context.fillStyle = '#fff';
      text('PD', -14, 4, 9, '#fff', 'center', 'bold');
    }
    context.restore();
  }

  function drawPerson(x, y, angle, color, down, enemy, hp, maxHp) {
    context.save();
    context.translate(x, y);
    if (down) {
      // 倒地：横着躺。
      context.rotate(angle + Math.PI / 2);
      context.fillStyle = color;
      context.beginPath();
      context.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
      context.fill();
    } else {
      context.rotate(angle);
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.beginPath();
      context.ellipse(2, 3, 10, 8, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = color;
      context.beginPath();
      context.arc(0, 0, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f2c89b';
      context.beginPath();
      context.arc(7, 0, 5, 0, Math.PI * 2);
      context.fill();
      // 枪口方向的小枪。
      if (enemy) {
        context.fillStyle = '#222';
        context.fillRect(10, -2, 10, 4);
      }
    }
    context.restore();
    if (enemy && hp < maxHp) {
      context.fillStyle = '#222';
      context.fillRect(x - 16, y - 26, 32, 5);
      context.fillStyle = '#e5534b';
      context.fillRect(x - 15, y - 25, 30 * (hp / maxHp), 3);
    }
  }

  function drawWorld(state) {
    drawGround(state);
    const cam = state.camera;
    const flash = Math.floor(state.time * 4) % 2 === 0;

    // 任务目标：地上一个脉动光圈 + 黄色标记柱。
    const target = missionTarget(state.mission, state.city.landmarks);
    if (target) {
      const pulse = 26 + Math.sin(state.time * 4) * 6;
      context.strokeStyle = '#ffd94a';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(target.x, target.y, pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = 'rgba(255,217,74,0.25)';
      context.beginPath();
      context.arc(target.x, target.y, pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd94a';
      context.beginPath();
      context.moveTo(target.x, target.y - 58);
      context.lineTo(target.x - 10, target.y - 38);
      context.lineTo(target.x + 10, target.y - 38);
      context.closePath();
      context.fill();
    }

    // 行人、敌人、车辆、子弹、粒子、飘字。
    for (const ped of state.peds) {
      if (Math.abs(ped.x - cam.x) > VIEW_W || Math.abs(ped.y - cam.y) > VIEW_H) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.state === 'down', false);
    }
    for (const e of state.enemies) {
      drawPerson(e.x, e.y, e.angle, '#8a2f2f', false, true, e.hp, 3);
    }
    for (const car of state.cars) {
      if (Math.abs(car.x - cam.x) > VIEW_W || Math.abs(car.y - cam.y) > VIEW_H) continue;
      drawCar(car, flash);
    }
    for (const car of state.police) drawCar(car, flash);

    // 玩家：步行是黄夹克小人，开车就是那辆车（已画过，补一个白色描边）。
    const p = state.player;
    if (p.car) {
      context.save();
      context.translate(p.car.x, p.car.y);
      context.rotate(p.car.angle);
      context.strokeStyle = '#fff';
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(-28, -15, 56, 30, 8);
      context.stroke();
      context.restore();
      // 车况条。
      if (p.car.hp < 100) {
        context.fillStyle = '#222';
        context.fillRect(p.car.x - 26, p.car.y - 34, 52, 6);
        context.fillStyle = p.car.hp > 40 ? '#4fae62' : '#e5534b';
        context.fillRect(p.car.x - 25, p.car.y - 33, 50 * (p.car.hp / 100), 4);
      }
    } else {
      drawPerson(p.x, p.y, p.angle, '#ffd94a', false, false);
      context.fillStyle = '#222';
      context.fillRect(p.x + 8, p.y - 4, 12, 4);
    }

    // 子弹：黄色曳光短线。
    context.strokeStyle = '#ffd94a';
    context.lineWidth = 3;
    for (const b of state.bullets) {
      context.beginPath();
      context.moveTo(b.x, b.y);
      context.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.stroke();
    }
    // 粒子。
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // 飘字。
    for (const t of state.texts) {
      context.globalAlpha = Math.min(1, t.life);
      text(t.text, t.x, t.y, 16, t.color, 'center', 'bold');
    }
    context.globalAlpha = 1;

    // 目标在屏幕外：屏幕边缘给一个黄色方向箭头。
    if (target) {
      const sx = target.x - (cam.x - VIEW_W / 2);
      const sy = target.y - (cam.y - VIEW_H / 2);
      if (sx < 20 || sx > VIEW_W - 20 || sy < 20 || sy > VIEW_H - 20) {
        const cx = Math.max(30, Math.min(VIEW_W - 30, sx));
        const cy = Math.max(30, Math.min(VIEW_H - 30, sy));
        const a = Math.atan2(sy - VIEW_H / 2, sx - VIEW_W / 2);
        context.save();
        context.translate(cam.x - VIEW_W / 2 + cx, cam.y - VIEW_H / 2 + cy);
        context.rotate(a);
        context.fillStyle = '#ffd94a';
        context.beginPath();
        context.moveTo(14, 0);
        context.lineTo(-8, -9);
        context.lineTo(-8, 9);
        context.closePath();
        context.fill();
        context.restore();
      }
    }
  }

  // —— HUD ——
  function drawHud(state, save) {
    const p = state.player;
    const m = state.mission;
    // 左上：金钱 + 生命条 + 任务目标。
    context.fillStyle = 'rgba(10,14,20,0.72)';
    context.beginPath();
    context.roundRect(12, 12, 300, 96, 10);
    context.fill();
    text('$' + p.money, 26, 42, 26, '#4fae62', 'left', 'bold');
    context.fillStyle = '#222';
    context.fillRect(26, 52, 160, 12);
    context.fillStyle = p.hp > 40 ? '#4fae62' : '#e5534b';
    context.fillRect(27, 53, 158 * (p.hp / PLAYER_MAX_HP), 10);
    text('HP ' + Math.ceil(p.hp), 192, 64, 14, '#eef1f5');
    text(missionObjective(m), 26, 92, 15, '#ffd94a', 'left', 'bold');
    if (m.index === 2 && m.timer > 0) {
      text('⏱ ' + Math.ceil(m.timer) + 's', 26, 116, 18, m.timer < 15 ? '#e5534b' : '#eef1f5', 'left', 'bold');
    }
    // 通缉星：右上小地图下方。
    const starY = 12 + MINIMAP_H + 18;
    text('通缉', VIEW_W - MINIMAP_W - 12, starY + 16, 15, '#eef1f5', 'left', 'bold');
    for (let i = 0; i < 5; i += 1) {
      context.fillStyle = i < p.wanted ? '#ffd94a' : 'rgba(255,255,255,0.25)';
      const sx = VIEW_W - MINIMAP_W + 52 + i * 26;
      const sy = starY + 10;
      context.save();
      context.translate(sx, sy);
      context.beginPath();
      for (let k = 0; k < 5; k += 1) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
        const a2 = a + Math.PI / 5;
        context.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
        context.lineTo(Math.cos(a2) * 4.5, Math.sin(a2) * 4.5);
      }
      context.closePath();
      context.fill();
      context.restore();
    }
    // 驾驶时右下显示车速。
    if (p.car) {
      const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
      text(kmh + ' km/h', VIEW_W - 24, VIEW_H - 24, 22, '#eef1f5', 'right', 'bold');
      text(p.car.hp < 100 ? '车况 ' + Math.ceil(p.car.hp) : '', VIEW_W - 24, VIEW_H - 48, 14, '#e8c33a', 'right');
    }
    // 底部操作提示。
    text('WASD 移动 · E 上车/偷车/下车 · 鼠标瞄准 点击开枪 · P 暂停 · M 静音', 12, VIEW_H - 12, 13, 'rgba(238,241,245,0.75)');
    // 中央横幅（任务标题 / 完成提示）。
    if (m.bannerTimer > 0) {
      context.globalAlpha = Math.min(1, m.bannerTimer);
      text(m.banner, VIEW_W / 2, 150, 26, '#ffd94a', 'center', 'bold');
      context.globalAlpha = 1;
    }
    // 被捕读条。
    if (p.bustedTimer > 0) {
      text('警察正在抓你……', VIEW_W / 2, VIEW_H / 2 - 60, 22, '#ff6b5e', 'center', 'bold');
      context.fillStyle = '#222';
      context.fillRect(VIEW_W / 2 - 80, VIEW_H / 2 - 44, 160, 10);
      context.fillStyle = '#e5534b';
      context.fillRect(VIEW_W / 2 - 79, VIEW_H / 2 - 43, 158 * (p.bustedTimer / 1.2), 8);
    }
  }

  // —— 小地图：整座城缩略图 + 玩家/目标/警车/敌人 ——
  function drawMinimap(state) {
    const x0 = VIEW_W - MINIMAP_W - 12;
    const y0 = 12;
    const sx = MINIMAP_W / WORLD_W;
    const sy = MINIMAP_H / WORLD_H;
    context.fillStyle = 'rgba(10,14,20,0.78)';
    context.beginPath();
    context.roundRect(x0 - 4, y0 - 4, MINIMAP_W + 8, MINIMAP_H + 8, 8);
    context.fill();
    context.save();
    context.beginPath();
    context.rect(x0, y0, MINIMAP_W, MINIMAP_H);
    context.clip();
    context.fillStyle = '#5d7a45';
    context.fillRect(x0, y0, MINIMAP_W, MINIMAP_H);
    context.fillStyle = '#3a3f4a';
    for (const rx of roadXs()) context.fillRect(x0 + rx * sx - 2, y0, 4, MINIMAP_H);
    for (const ry of roadYs()) context.fillRect(x0, y0 + ry * sy, MINIMAP_W, 4);
    context.fillStyle = '#3f8fb5';
    context.fillRect(x0, y0 + (WORLD_H - 56) * sy, MINIMAP_W, 56 * sy);
    const target = missionTarget(state.mission, state.city.landmarks);
    if (target) {
      const pulse = 3 + Math.sin(state.time * 4) * 1.5;
      context.fillStyle = '#ffd94a';
      context.beginPath();
      context.arc(x0 + target.x * sx, y0 + target.y * sy, pulse + 2, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.police) {
      context.fillStyle = '#2d6bff';
      context.beginPath();
      context.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const e of state.enemies) {
      context.fillStyle = '#e5534b';
      context.beginPath();
      context.arc(x0 + e.x * sx, y0 + e.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    const p = state.player;
    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(x0 + p.x * sx, y0 + p.y * sy, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffd94a';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x0 + p.x * sx, y0 + p.y * sy, 6, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function drawPanel(title, lines, prompt) {
    context.fillStyle = 'rgba(8,10,16,0.62)';
    context.fillRect(0, 0, VIEW_W, VIEW_H);
    const width = 640;
    const height = 150 + lines.length * 30;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    context.fillStyle = '#1c2230';
    context.beginPath();
    context.roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = '#ffd94a';
    context.lineWidth = 2;
    context.stroke();
    text(title, VIEW_W / 2, y + 62, 44, '#ffd94a', 'center', 'bold');
    lines.forEach((line, i) => text(line, VIEW_W / 2, y + 108 + i * 30, 18, '#eef1f5', 'center'));
    text(prompt, VIEW_W / 2, y + height - 26, 18, '#4fae62', 'center', 'bold');
  }

  /** 画一帧：世界 + HUD + 当前界面的遮罩。 */
  function draw(state, screen, save) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b0e14';
    context.fillRect(0, 0, canvas.width, canvas.height);
    // 相机：以玩家为中心的世界视口。
    const cam = state.camera;
    const ox = cam.x - VIEW_W / 2;
    const oy = cam.y - VIEW_H / 2;
    context.setTransform(view.scale, 0, 0, view.scale, view.x - ox * view.scale, view.y - oy * view.scale);
    drawWorld(state);
    // HUD 用屏幕坐标画。
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      const lines = [
        '索尔玛湾，阳光、海风，和一点不太合法的生意。',
        '跑腿司机 Rook 接了中间人 Mara Voss 的三单活：',
        '码头取货 → 偷车甩掉条子 → 限时送货到灯塔。',
        'WASD 走路开车 · E 偷车上下车 · 鼠标瞄准点击开枪',
        '偷车、撞人、开枪都会涨通缉，警车会追着你跑。',
        save && save.missionIndex > 0 ? '存档：已做到第 ' + (save.missionIndex + 1) + ' 单，钱包 $' + save.money : '',
        save && save.best > 0 ? '历史最高钱包：$' + save.best : '',
      ].filter(Boolean);
      drawPanel('SOLMAR HEAT', lines, '按 Enter 或点击开始 · 索尔玛热浪');
      return;
    }
    drawHud(state, save);
    drawMinimap(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('暂停', ['车停好了，条子也等着。', '进度已自动保存。'], '按 P 继续');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('被捕了！', ['警察把你按在引擎盖上，罚了 $' + BUST_FINE + '。', '货还在，任务重开。'], '按 Enter 再来一次');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('你被干掉了', ['Rival 帮的人下手不留情。', '罚了 $' + BUST_FINE + '，任务重开。'], '按 Enter 再来一次');
    } else if (screen === SCREEN_STORY) {
      drawPanel('剧情完成！', ['三单全做完了，Mara Voss 很满意。', '钱包：$' + state.player.money + '，继续在索尔玛湾自由探索吧。'], '按 Enter 继续自由模式');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld, cssSize, VIEW_W, VIEW_H };
}
