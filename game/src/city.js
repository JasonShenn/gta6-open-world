// city.js — Palmera 的生成与静态预渲染。
// 城市只生成一次、画进一张离屏大画布，游戏每帧只贴图（静态重画会把帧率拖到几 fps）。
// 密度打磨：市中心 2×2 塔楼群、中层街区停车带、公园小路池塘、沙滩棕榈、码头长椅路灯货箱，
// 每个街区都有东西，没有大片空绿地。

import { WORLD, ROADS_X, ROADS_Y, ROAD_W, SEA_X, BEACH_Y, AIRPORT_X, CASH_SPOTS, PLACES } from './config.js';
import { makeRng, range, pick, int } from './rng.js';

// 楼体配色：暖黄昏下的奶油、砖红、蓝灰、粉橙。
const BUILDING_COLORS = ['#e8c98f', '#d98a5f', '#7fa3c4', '#e59a7a', '#c9b083', '#8fb0a0', '#d9b36c'];
const TOWER_COLORS = ['#e8c98f', '#7fa3c4', '#e59a7a', '#d9b36c'];
const NEON_SIGNS = [
  { text: 'TIDE', color: '#37e6d4' },
  { text: 'PIER 9', color: '#ffb347' },
  { text: 'GOLD', color: '#ffd94a' },
  { text: 'VEGA', color: '#ff7ab8' },
];

// 码头木板区：水面上唯一可行走的矩形。
export const PIER = { x0: 55, y0: 1000, x1: 300, y1: 1255 };

// 生成整座城市：楼、树、棕榈、长椅、货箱、路灯、停着的车、地标建筑。
export function buildCity(seed) {
  const rng = makeRng(seed);
  const city = {
    seed,
    buildings: [], trees: [], palms: [], benches: [], crates: [], lamps: [],
    parkedCars: [], plazas: [],
    park: { x: 700, y: 1300, w: 400, h: 350, pond: { x: 900, y: 1475, rx: 95, ry: 55 } },
    beach: { x: 300, y: BEACH_Y, w: WORLD.w - 300, h: WORLD.h - BEACH_Y },
    runway: { x: 3200, y: 1680, w: 150, h: 640 },
    garage: { x: 1280, y: 620, w: 150, h: 110 },
    chopShop: { x: 2430, y: 2020, w: 150, h: 110 },
  };

  // —— 市中心 2×2 塔楼群（带霓虹招牌），在地图中北部。
  const towerSpots = [
    { x: 1560, y: 640, neon: NEON_SIGNS[0] },
    { x: 1900, y: 640, neon: NEON_SIGNS[1] },
    { x: 1560, y: 1010, neon: NEON_SIGNS[2] },
    { x: 1900, y: 1010, neon: NEON_SIGNS[3] },
  ];
  for (const t of towerSpots) {
    city.buildings.push({
      x: t.x, y: t.y, w: 250, h: 210, tower: true,
      fill: TOWER_COLORS[city.buildings.length % TOWER_COLORS.length],
      neon: t.neon, seed: int(rng, 1, 99999),
    });
  }

  // —— 地标小楼：修车铺与 Chop Shop（任务终点，有招牌）。
  city.buildings.push({ x: city.garage.x, y: city.garage.y, w: 150, h: 110, fill: '#c97e4a', neon: { text: "MARA'S", color: '#ffd94a' }, seed: 11 });
  city.buildings.push({ x: city.chopShop.x, y: city.chopShop.y, w: 150, h: 110, fill: '#5f6b7a', neon: { text: 'CHOP', color: '#ff7ab8' }, seed: 22 });
  // 机场机库与塔台。
  city.buildings.push({ x: 3180, y: 1500, w: 130, h: 90, fill: '#8a94a6', neon: null, seed: 33 });
  city.buildings.push({ x: 3180, y: 2400, w: 90, h: 90, fill: '#aab4c4', neon: { text: 'AIR', color: '#37e6d4' }, seed: 44 });

  // —— 其余街区：一格一栋或两栋楼，沿街加停车带（停着的车）与行道树。
  // 街区由相邻两条路围出来；跳过海洋、公园、沙滩、机场、市中心塔楼区。
  for (let xi = 0; xi < ROADS_X.length - 1; xi++) {
    for (let yi = 0; yi < ROADS_Y.length - 1; yi++) {
      const x0 = ROADS_X[xi] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[xi + 1] - ROAD_W / 2 - 14;
      const y0 = ROADS_Y[yi] + ROAD_W / 2 + 14;
      const y1 = ROADS_Y[yi + 1] - ROAD_W / 2 - 14;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (x1 < SEA_X + 40) continue; // 海里不盖楼
      if (x0 > AIRPORT_X - 60) continue; // 机场不盖楼
      if (y0 > BEACH_Y - 40) continue; // 沙滩不盖楼
      if (cx > 700 && cx < 1100 && cy > 1300 && cy < 1650) continue; // 公园
      if (cx > 1500 && cx < 2200 && cy > 600 && cy < 1300) continue; // 市中心塔楼区
      // 修车铺 / Chop Shop 所在的街区不另盖楼，避免压住地标。
      if (x0 < city.garage.x + city.garage.w && x1 > city.garage.x && y0 < city.garage.y + city.garage.h && y1 > city.garage.y) continue;
      if (x0 < city.chopShop.x + city.chopShop.w && x1 > city.chopShop.x && y0 < city.chopShop.y + city.chopShop.h && y1 > city.chopShop.y) continue;
      const bw = x1 - x0, bh = y1 - y0;
      if (bw < 90 || bh < 90) continue;
      // 一栋主楼，占街区六成左右。
      const lw = Math.min(bw * 0.62, 240);
      const lh = Math.min(bh * 0.62, 190);
      city.buildings.push({
        x: x0 + range(rng, 4, Math.max(5, bw - lw - 4)),
        y: y0 + range(rng, 4, Math.max(5, bh - lh - 4)),
        w: lw, h: lh, fill: pick(rng, BUILDING_COLORS), neon: null,
        seed: int(rng, 1, 99999),
      });
      // 停车带：沿街区南缘、贴着路边停 2–3 辆车（可偷），车头沿路朝东，起步就在路上不撞墙。
      const parkN = int(rng, 2, 4);
      for (let p = 0; p < parkN; p++) {
        const px = x0 + 30 + p * 62 + range(rng, -6, 6);
        const py = y1 + 32;
        if (px > x1 - 30) break;
        city.parkedCars.push({
          x: px, y: py, angle: 0, type: pick(rng, ['sedan', 'sedan', 'pickup', 'van', 'sports']),
          color: pick(rng, ['#e8e4da', '#c0392b', '#7fb3d5', '#3a6ea5', '#d9a441', '#5b7d4f']),
          parked: true, taken: false,
        });
      }
      // 行道树 2–4 棵，街角再补一棵。
      const treeN = int(rng, 2, 5);
      for (let t = 0; t < treeN; t++) {
        city.trees.push({ x: range(rng, x0 + 16, x1 - 16), y: range(rng, y0 + 16, y1 - 16), r: range(rng, 13, 20) });
      }
    }
  }

  // —— 橙色敞篷车（M2 目标）：固定停在中层街区路边，绝不随机。
  city.parkedCars.push({
    x: PLACES.convertibleSpot.x, y: PLACES.convertibleSpot.y, angle: Math.PI / 2,
    type: 'convertible', color: '#ff8c1a', parked: true, taken: false, missionCar: true,
  });

  // —— 公园：小路、池塘、长椅、密树（树多到盖住草地）。
  const park = city.park;
  for (let i = 0; i < 26; i++) {
    city.trees.push({
      x: range(rng, park.x + 18, park.x + park.w - 18),
      y: range(rng, park.y + 18, park.y + park.h - 18),
      r: range(rng, 13, 22),
    });
  }
  city.benches.push({ x: 760, y: 1380, angle: 0 }, { x: 1020, y: 1380, angle: 0 });
  city.benches.push({ x: 760, y: 1580, angle: 0 }, { x: 1020, y: 1580, angle: Math.PI });
  city.lamps.push({ x: 900, y: 1340 }, { x: 900, y: 1610 });

  // —— 沙滩：两排棕榈 + 遮阳伞，沿着南岸种满。
  for (let x = 420; x < 3050; x += 95) {
    city.palms.push({ x: x + range(rng, -14, 14), y: range(rng, 2420, 2480), r: 16 });
    if (rng() < 0.6) city.palms.push({ x: x + 48, y: range(rng, 2500, 2560), r: 15 });
  }
  // 街边也种棕榈（大道两侧）。
  for (const rx of [700, 1500, 2300]) {
    for (let y = 320; y < 2300; y += 340) {
      city.palms.push({ x: rx - 78, y, r: 14 });
    }
  }

  // —— 码头：长椅、路灯、货箱、游艇边的木桩；码头东岸补两棵棕榈。
  city.benches.push({ x: 120, y: 1040, angle: Math.PI / 2 }, { x: 120, y: 1200, angle: Math.PI / 2 });
  city.palms.push({ x: 345, y: 1050, r: 14 }, { x: 345, y: 1270, r: 15 });
  city.lamps.push({ x: 90, y: 1080 }, { x: 90, y: 1180 }, { x: 270, y: 1125 });
  city.crates.push({ x: 240, y: 1030, s: 26 }, { x: 245, y: 1062, s: 22 }, { x: 210, y: 1210, s: 24 });
  city.crates.push({ x: 90, y: 1230, s: 20 });

  // —— 隐藏现金点周围放一点标记物（小灌木），让玩家找得到。
  for (const c of CASH_SPOTS) {
    city.trees.push({ x: c.x + 34, y: c.y - 20, r: 12 });
  }
  return city;
}

// —— 碰撞：楼、机库、水（码头木板除外）都挡路；沙滩与跑道可走。
export function collidesCircle(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  if (isWaterAt(x, y) && !onPierDeck(x, y)) return true;
  return false;
}

export function isWaterAt(x, y) {
  return x < SEA_X && !(x >= PIER.x0 && x <= PIER.x1 && y >= PIER.y0 && y <= PIER.y1);
}

export function onPierDeck(x, y) {
  return x >= PIER.x0 && x <= PIER.x1 && y >= PIER.y0 && y <= PIER.y1;
}

// 离某点最近的、还没被开走的停着的车。
export function nearestParkedCar(city, x, y, maxDist) {
  let best = null, bestD = maxDist;
  for (const c of city.parkedCars) {
    if (c.taken) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// —— 静态预渲染：整座城市画进一张离屏画布，只画一次。
export function prerenderCity(city) {
  const cv = document.createElement('canvas');
  cv.width = WORLD.w;
  cv.height = WORLD.h;
  const g = cv.getContext('2d');
  const rng = makeRng(city.seed + 77);

  // 暖色地面：金色黄昏下的草地与土路底色。
  g.fillStyle = '#b3945a';
  g.fillRect(0, 0, WORLD.w, WORLD.h);
  // 地面杂色斑点（很淡，只为不平板）。
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rng() < 0.5 ? 'rgba(120,90,40,0.05)' : 'rgba(230,200,120,0.05)';
    g.fillRect(rng() * WORLD.w, rng() * WORLD.h, range(rng, 6, 26), range(rng, 4, 14));
  }

  // 海洋：西侧深蓝到浅青的渐变。
  const sea = g.createLinearGradient(0, 0, SEA_X, 0);
  sea.addColorStop(0, '#1d5f7a');
  sea.addColorStop(1, '#3f8ea8');
  g.fillStyle = sea;
  g.fillRect(0, 0, SEA_X, WORLD.h);
  // 海面碎光底色：静态的亮点，动态闪烁由每帧另画。
  for (let i = 0; i < 130; i++) {
    g.fillStyle = 'rgba(255,230,160,0.20)';
    g.fillRect(range(rng, 6, SEA_X - 12), rng() * WORLD.h, range(rng, 3, 9), 2);
  }
  // 沙滩：南侧暖沙色。
  g.fillStyle = '#e0c184';
  g.fillRect(300, BEACH_Y, WORLD.w - 300, WORLD.h - BEACH_Y);
  g.fillStyle = 'rgba(255,240,200,0.35)';
  g.fillRect(300, BEACH_Y, WORLD.w - 300, 10);

  // 机场跑道：深灰长条 + 白色虚线。
  g.fillStyle = '#4a4a52';
  g.fillRect(city.runway.x, city.runway.y, city.runway.w, city.runway.h);
  g.fillStyle = '#f2f2f2';
  for (let y = city.runway.y + 20; y < city.runway.y + city.runway.h - 20; y += 46) {
    g.fillRect(city.runway.x + city.runway.w / 2 - 3, y, 6, 26);
  }

  // 公园草地：比周围更绿的草皮 + 小路 + 池塘。
  const park = city.park;
  g.fillStyle = '#7da95c';
  g.fillRect(park.x, park.y, park.w, park.h);
  g.strokeStyle = '#d9c48f';
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(park.x, park.y + park.h / 2);
  g.lineTo(park.x + park.w, park.y + park.h / 2);
  g.moveTo(park.x + park.w / 2, park.y);
  g.lineTo(park.x + park.w / 2, park.y + park.h);
  g.stroke();
  g.fillStyle = '#4d8fb5';
  g.beginPath();
  g.ellipse(park.pond.x, park.pond.y, park.pond.rx, park.pond.ry, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.beginPath();
  g.ellipse(park.pond.x - 22, park.pond.y - 12, 34, 12, -0.3, 0, Math.PI * 2);
  g.fill();

  // 道路：暖褐沥青 + 浅色人行道边 + 中央虚线 + 路口斑马线。
  for (const x of ROADS_X) {
    g.fillStyle = '#c9b083';
    g.fillRect(x - ROAD_W / 2 - 10, 0, ROAD_W + 20, WORLD.h);
    g.fillStyle = '#6b5847';
    g.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD.h);
  }
  for (const y of ROADS_Y) {
    g.fillStyle = '#c9b083';
    g.fillRect(0, y - ROAD_W / 2 - 10, WORLD.w, ROAD_W + 20);
    g.fillStyle = '#6b5847';
    g.fillRect(0, y - ROAD_W / 2, WORLD.w, ROAD_W);
  }
  g.fillStyle = '#e8d9a0';
  for (const x of ROADS_X) {
    for (let y = 40; y < WORLD.h; y += 90) {
      let onCross = false;
      for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W) onCross = true;
      if (!onCross) g.fillRect(x - 3, y, 6, 42);
    }
  }
  for (const y of ROADS_Y) {
    for (let x = 320; x < WORLD.w; x += 90) {
      let onCross = false;
      for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W) onCross = true;
      if (!onCross) g.fillRect(x, y - 3, 42, 6);
    }
  }
  // 斑马线：每个路口四条。
  g.fillStyle = 'rgba(240,235,220,0.85)';
  for (const x of ROADS_X) {
    for (const y of ROADS_Y) {
      for (let i = -3; i <= 3; i++) {
        g.fillRect(x + i * 16 - 5, y - ROAD_W / 2 - 4, 10, 8);
        g.fillRect(x + i * 16 - 5, y + ROAD_W / 2 - 4, 10, 8);
      }
    }
  }

  // 码头木板：横向木纹 + 边缘桩。
  g.fillStyle = '#8a6a42';
  g.fillRect(PIER.x0, PIER.y0, PIER.x1 - PIER.x0, PIER.y1 - PIER.y0);
  g.strokeStyle = 'rgba(60,40,20,0.5)';
  g.lineWidth = 2;
  for (let y = PIER.y0 + 14; y < PIER.y1; y += 18) {
    g.beginPath(); g.moveTo(PIER.x0, y); g.lineTo(PIER.x1, y); g.stroke();
  }
  g.fillStyle = '#5d4426';
  for (let x = PIER.x0 + 12; x < PIER.x1; x += 40) {
    g.fillRect(x, PIER.y0 - 4, 8, 10);
    g.fillRect(x, PIER.y1 - 6, 8, 10);
  }

  // 楼：同向长影（太阳在西边，影子向东偏南拉长）+ 楼体 + 暖色亮窗。
  for (const b of city.buildings) {
    // 长影。
    g.fillStyle = 'rgba(40,20,5,0.28)';
    g.fillRect(b.x + 20, b.y + 14, b.w, b.h);
    // 楼体与屋顶边。
    g.fillStyle = b.fill;
    g.fillRect(b.x, b.y, b.w, b.h);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 3;
    g.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
    // 窗户：暖黄亮窗与深色窗交错，塔楼窗户更密。
    const brng = makeRng(b.seed);
    const cols = Math.max(2, Math.floor(b.w / (b.tower ? 34 : 44)));
    const rows = Math.max(2, Math.floor(b.h / (b.tower ? 34 : 44)));
    const cw = b.w / cols, ch = b.h / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const lit = brng() < 0.62;
        g.fillStyle = lit ? '#ffd98a' : '#4a3a2e';
        g.fillRect(b.x + i * cw + cw * 0.22, b.y + j * ch + ch * 0.24, cw * 0.56, ch * 0.52);
      }
    }
    // 霓虹招牌：画在楼体中下部（避开顶部任务横幅的区域），带光晕。
    if (b.neon) {
      g.save();
      g.font = `bold ${b.tower ? 44 : 30}px Arial, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = b.neon.color;
      g.shadowBlur = 22;
      g.fillStyle = b.neon.color;
      g.fillText(b.neon.text, b.x + b.w / 2, b.y + b.h * 0.62);
      g.restore();
    }
  }

  // 树与棕榈：同向小影 + 树冠；公园里的树画得更密更大。
  for (const t of city.trees) {
    g.fillStyle = 'rgba(40,20,5,0.22)';
    g.beginPath(); g.ellipse(t.x + 10, t.y + 7, t.r, t.r * 0.55, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4e8a3f';
    g.beginPath(); g.arc(t.x, t.y, t.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6fb054';
    g.beginPath(); g.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.55, 0, Math.PI * 2); g.fill();
  }
  for (const p of city.palms) {
    g.fillStyle = 'rgba(40,20,5,0.22)';
    g.beginPath(); g.ellipse(p.x + 12, p.y + 8, p.r, p.r * 0.5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#7a5a34';
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(p.x, p.y + 6); g.lineTo(p.x + 3, p.y - 12); g.stroke();
    g.fillStyle = '#3f8a4f';
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * Math.PI * 2;
      g.beginPath();
      g.ellipse(p.x + Math.cos(a) * p.r * 0.7, p.y - 12 + Math.sin(a) * p.r * 0.55, p.r * 0.75, p.r * 0.28, a, 0, Math.PI * 2);
      g.fill();
    }
  }

  // 长椅、货箱、路灯：小道具，码头与公园才有。
  for (const b of city.benches) {
    g.save();
    g.translate(b.x, b.y);
    g.rotate(b.angle);
    g.fillStyle = '#7a5230';
    g.fillRect(-18, -6, 36, 12);
    g.fillStyle = '#5d3d22';
    g.fillRect(-18, -10, 36, 4);
    g.restore();
  }
  for (const c of city.crates) {
    g.fillStyle = '#a9803e';
    g.fillRect(c.x, c.y, c.s, c.s);
    g.strokeStyle = '#6e4f1e';
    g.lineWidth = 2;
    g.strokeRect(c.x, c.y, c.s, c.s);
    g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(c.x + c.s, c.y + c.s); g.stroke();
  }
  for (const l of city.lamps) {
    g.fillStyle = 'rgba(40,20,5,0.25)';
    g.beginPath(); g.ellipse(l.x + 8, l.y + 5, 10, 5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a3a3a';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(l.x, l.y + 8); g.lineTo(l.x, l.y - 16); g.stroke();
    g.fillStyle = '#ffe9a8';
    g.beginPath(); g.arc(l.x, l.y - 18, 6, 0, Math.PI * 2); g.fill();
  }

  // 游艇：停在码头边的白色船体（靠南放，2-pier 截图上沿能看到它）。
  g.fillStyle = '#f2f0e8';
  g.beginPath(); g.ellipse(120, 985, 62, 22, 0.15, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c9d6de';
  g.fillRect(95, 957, 50, 22);
  g.fillStyle = '#2e6fd8';
  g.fillRect(108, 943, 26, 14);

  return cv;
}
