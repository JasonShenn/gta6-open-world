// city.js — Palmera 城市生成与静态绘制：道路网、街区、楼群、公园、海滩码头。
// v3 重点：加密密度——空地全部填满楼/树/停车场/公园细节，不留大片空绿地。
import { WORLD, PALETTE, SUN } from './config.js';
import { makeRng, range, pick, int } from './rng.js';

export const AVENUES = [420, 1020, 1620, 2220, 2820, 3420, 4020, 4620]; // 纵向大道中心线
export const STREETS = [380, 880, 1380, 1880, 2380, 2880, 3380];       // 横向街道中心线
export const ROAD_W = 96;
const ROOFS = [PALETTE.roofCream, PALETTE.roofCoral, PALETTE.roofTeal, PALETTE.roofTerra, PALETTE.roofPink, PALETTE.roofWhite];
const NEON_TEXT = ['PALMERA', 'HOTEL', 'CASINO', 'TIDE', 'SUNSET', 'PIER 9', 'BAR', '24H TACOS'];

// 街区划分：道路之间的矩形地块。
function blockRects() {
  const xs = [300, ...AVENUES.flatMap(x => [x + ROAD_W / 2]), 5200];
  // 更直观：用道路中心线切出地块区间
  const xBounds = [300];
  for (const x of AVENUES) { xBounds.push(x - ROAD_W / 2, x + ROAD_W / 2); }
  xBounds.push(5200);
  const yBounds = [0];
  for (const y of STREETS) { yBounds.push(y - ROAD_W / 2, y + ROAD_W / 2); }
  yBounds.push(3800);
  const blocks = [];
  for (let i = 0; i < xBounds.length - 1; i += 2)
    for (let j = 0; j < yBounds.length - 1; j += 2)
      blocks.push({ x0: xBounds[i], y0: yBounds[j], x1: xBounds[i + 1], y1: yBounds[j + 1] });
  return blocks;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const city = {
    buildings: [], trees: [], lamps: [], billboards: [], benches: [], bushes: [],
    parked: [], pools: [], signs: [], yachts: [], containers: [], speckles: [], glints: [],
    spots: {},
  };
  // 草地斑点纹理（确定性，供绘制时点缀地面）。
  for (let i = 0; i < 900; i++)
    city.speckles.push({ x: range(rng, 300, 5200), y: range(rng, 0, 3800), r: range(rng, 2, 6), c: rng() < 0.5 ? PALETTE.grassDark : PALETTE.grassLight });
  // 海面阳光碎光点（动画闪烁用）。
  for (let i = 0; i < 70; i++)
    city.glints.push({ x: range(rng, 0, 150), y: range(rng, 0, 3800), p: range(rng, 0, 6.28), s: range(rng, 2, 5) });

  const blocks = blockRects();
  const parkIdx = new Set([21, 30, 43, 53]); // 固定几块地做公园（按街区序号）
  let bi = 0;
  for (const b of blocks) {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const w = b.x1 - b.x0, h = b.y1 - b.y0;
    // 海滩与首条大道之间的窄条只种树，不盖楼。
    if (w < 150 || h < 150) { scatterTrees(city, rng, b, 4, 0.7); bi++; continue; }
    const downtown = cx > 2700 && cx < 4750 && cy < 1450;
    const airport = cx > 4600 && cy > 3400;
    const docks = cx > 4600 && cy > 1400 && cy < 2900;
    const beachSide = cx < 1100 && cy > 2850;
    if (airport) { buildAirport(city, rng, b); bi++; continue; }
    if (parkIdx.has(bi)) { buildPark(city, rng, b); bi++; continue; }
    if (docks) { buildDocks(city, rng, b); bi++; continue; }
    if (downtown) { buildDowntownBlock(city, rng, b); bi++; continue; }
    if (beachSide) { buildBeachBlock(city, rng, b); bi++; continue; }
    buildMidBlock(city, rng, b);
    bi++;
  }

  // 码头：木栈道伸进海里（西边），游艇停在水面；栈道上摆长椅、路灯、货箱。
  city.pier = { x0: 55, y0: 1480, x1: 420, y1: 1660 };
  city.benches.push({ x: 120, y: 1510, a: 0 }, { x: 120, y: 1630, a: Math.PI }, { x: 380, y: 1500, a: Math.PI / 2 });
  city.lamps.push({ x: 90, y: 1500 }, { x: 90, y: 1640 }, { x: 400, y: 1570 });
  city.containers.push({ x: 360, y: 1500, w: 44, h: 34, c: '#a97e4f' }, { x: 360, y: 1600, w: 44, h: 34, c: '#8a6a42' });
  // 沙滩带种满棕榈（码头以南海滩不再空）。
  for (let i = 0; i < 16; i++)
    city.trees.push({ x: range(rng, 170, 290), y: range(rng, 120, 3700), r: range(rng, 10, 15), palm: true });
  for (let i = 0; i < 5; i++)
    city.yachts.push({ x: range(rng, 30, 120), y: 300 + i * 620 + range(rng, -40, 40), a: range(rng, -0.3, 0.3) });
  // 路灯沿每条大道/街道两侧每 190 单位一盏。
  for (const x of AVENUES) for (let y = 60; y < 3800; y += 190) {
    city.lamps.push({ x: x - ROAD_W / 2 - 12, y }); city.lamps.push({ x: x + ROAD_W / 2 + 12, y: y + 95 });
  }
  for (const y of STREETS) for (let x = 360; x < 5200; x += 190) {
    city.lamps.push({ x, y: y - ROAD_W / 2 - 12 }); city.lamps.push({ x: x + 95, y: y + ROAD_W / 2 + 12 });
  }
  // 广告牌立在主要路口。
  const bbSpots = [[1020, 880], [2220, 1380], [3420, 880], [2820, 2380], [1620, 2880], [4020, 1880]];
  for (const [x, y] of bbSpots)
    city.billboards.push({ x: x + 90, y: y - 90, text: pick(rng, NEON_TEXT), color: pick(rng, [PALETTE.neonPink, PALETTE.neonCyan, '#ffb347']) });

  // 关键地点坐标（任务与玩法共用）。
  city.spots = {
    pierPickup: { x: 200, y: 1570 },                 // M1 取包点（码头）
    mara: { x: 720, y: 3100 },                       // Mara 修车铺（南滩）
    chop: { x: 4850, y: 2100 },                      // Chop Shop（东码头）
    airport: { x: 4780, y: 3620 },                   // M4 机场终点
    convertible: { x: 770, y: 1900, angle: 0 },      // M2 橙色敞篷车（码头旁街道）
    vanSpawn: { x: 1020, y: 2100 },                 // M4 逃逸厢车（大道上）
    playerStart: { x: 520, y: 1900 },               // 玩家出生点（码头旁街道）
    startSedan: { x: 660, y: 1900, angle: Math.PI }, // 出生点旁的轿车
    taxiStand: { x: 1020, y: 1250 },
    stashes: [                                       // 5 个隐藏现金点
      { x: 500, y: 420 }, { x: 2500, y: 900 }, { x: 3300, y: 2600 },
      { x: 1200, y: 3200 }, { x: 4400, y: 1500 },
    ],
  };
  // 出生点旁与码头停车场停几辆车（可偷）。
  city.parked.push(
    { x: 670, y: 1900, angle: Math.PI, type: 'sedan' },
    { x: 770, y: 1900, angle: 0, type: 'sports' },
    { x: 870, y: 1900, angle: 0, type: 'taxi' },
    { x: 1020, y: 2100, angle: Math.PI / 2, type: 'van' },
    { x: 580, y: 1900, angle: -Math.PI / 2, type: 'pickup' },
  );
  // 关键点若落在建筑里，向东逐格挪到空地（保证任务点永远可达）。
  for (const k of ['mara', 'chop', 'airport', 'playerStart']) {
    const s = city.spots[k];
    const f = findFreeSpot(city, s.x, s.y);
    s.x = f.x; s.y = f.y;
  }
  for (const s of city.spots.stashes) {
    const f = findFreeSpot(city, s.x, s.y);
    s.x = f.x; s.y = f.y;
  }
  return city;
}

// 从 (x,y) 出发螺旋找最近的可站空地（步行/任务点用）。
export function findFreeSpot(city, x, y) {
  for (let r = 0; r < 400; r += 24)
    for (let a = 0; a < 6.28; a += 0.9) {
      const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
      if (!cityCollides(city, nx, ny, 16)) return { x: nx, y: ny };
    }
  return { x, y };
}

// —— 街区填充：每种街区一种填法，全部填满不留空 ——
function addBuilding(city, rng, x, y, w, h, floors, roof, neon) {
  const cols = Math.max(2, Math.floor(w / 34)), rows = Math.max(2, Math.floor(h / 34));
  const lit = [];
  for (let i = 0; i < cols * rows; i++) lit.push(rng() < 0.55);
  city.buildings.push({ x, y, w, h, floors, roof, cols, rows, lit, neon: neon || null });
}
function scatterTrees(city, rng, b, n, palmProb) {
  for (let i = 0; i < n; i++)
    city.trees.push({ x: range(rng, b.x0 + 24, b.x1 - 24), y: range(rng, b.y0 + 24, b.y1 - 24), r: range(rng, 10, 16), palm: rng() < palmProb });
}
function parkingRow(city, rng, x, y, n, angle, types) {
  for (let i = 0; i < n; i++)
    city.parked.push({ x: x + i * 58, y, angle, type: types[i % types.length] });
}
function buildDowntownBlock(city, rng, b) {
  // 高楼群：2×2 共 4 栋塔楼（带间距的广场感）+ 霓虹招牌 + 树。
  const bw = (b.x1 - b.x0 - 70) / 2, bh = (b.y1 - b.y0 - 70) / 2;
  const spots2 = [[b.x0 + 20, b.y0 + 20], [b.x0 + 50 + bw, b.y0 + 20], [b.x0 + 20, b.y0 + 50 + bh], [b.x0 + 50 + bw, b.y0 + 50 + bh]];
  for (let i = 0; i < 4; i++) {
    const [x, y] = spots2[i];
    addBuilding(city, rng, x, y, bw * range(rng, 0.85, 1), bh * range(rng, 0.85, 1), int(rng, 8, 14),
      rng() < 0.5 ? PALETTE.roofGlass : pick(rng, ROOFS), rng() < 0.6 ? pick(rng, NEON_TEXT) : null);
  }
  scatterTrees(city, rng, b, 6, 0.4);
  for (let i = 0; i < 4; i++) city.bushes.push({ x: range(rng, b.x0 + 20, b.x1 - 20), y: range(rng, b.y0 + 20, b.y1 - 20), r: range(rng, 7, 11) });
}
function buildMidBlock(city, rng, b) {
  // 中层街区：3–5 栋中楼 + 停车场（停着的车）+ 树 + 灌木。
  const n = int(rng, 3, 5);
  const cols = n > 3 ? 3 : 2;
  const cw = (b.x1 - b.x0) / cols, ch = (b.y1 - b.y0) / 2;
  let placed = 0;
  for (let gy = 0; gy < 2 && placed < n; gy++)
    for (let gx = 0; gx < cols && placed < n; gx++) {
      if (rng() < 0.18) continue; // 偶尔留一个停车位
      addBuilding(city, rng, b.x0 + gx * cw + 14, b.y0 + gy * ch + 14,
        cw - 28, ch - 28, int(rng, 2, 5), pick(rng, ROOFS), null);
      placed++;
    }
  // 街区南侧一条停车带。
  parkingRow(city, rng, b.x0 + 40, b.y1 - 34, int(rng, 3, 5), 0, ['sedan', 'pickup', 'taxi', 'van']);
  scatterTrees(city, rng, b, 5, 0.5);
  for (let i = 0; i < 3; i++) city.bushes.push({ x: range(rng, b.x0 + 20, b.x1 - 20), y: range(rng, b.y0 + 20, b.y1 - 20), r: range(rng, 6, 10) });
  if (rng() < 0.35) city.pools.push({ x: b.x0 + 40, y: b.y0 + 40, w: 90, h: 55 }); // 青绿泳池
}
function buildBeachBlock(city, rng, b) {
  // 南滩：低矮小屋 + 大量棕榈 + 泳池。
  for (let i = 0; i < 3; i++)
    addBuilding(city, rng, b.x0 + 30 + i * ((b.x1 - b.x0 - 60) / 3), b.y0 + 30, (b.x1 - b.x0) / 3 - 50, 110, 1, pick(rng, ROOFS), null);
  scatterTrees(city, rng, b, 9, 0.85);
  city.pools.push({ x: b.x0 + (b.x1 - b.x0) / 2 - 60, y: b.y1 - 120, w: 120, h: 60 });
}
function buildPark(city, rng, b) {
  // 公园：小路十字 + 池塘 + 长椅 + 密树，取代空绿地。
  city.parks = city.parks || [];
  city.parks.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
  city.pools.push({ x: (b.x0 + b.x1) / 2 - 70, y: (b.y0 + b.y1) / 2 - 45, w: 140, h: 90 });
  scatterTrees(city, rng, b, 16, 0.3);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  city.benches.push({ x: cx - 90, y: cy - 60, a: 0 }, { x: cx + 90, y: cy + 60, a: Math.PI }, { x: cx, y: cy - 110, a: Math.PI / 2 });
  for (let i = 0; i < 6; i++) city.bushes.push({ x: range(rng, b.x0 + 20, b.x1 - 20), y: range(rng, b.y0 + 20, b.y1 - 20), r: range(rng, 8, 13) });
}
function buildDocks(city, rng, b) {
  // 东码头：集装箱堆 + 卡车 + Chop Shop 招牌楼。
  for (let i = 0; i < 8; i++)
    city.containers.push({ x: b.x0 + 30 + (i % 4) * 110, y: b.y0 + 30 + Math.floor(i / 4) * 90, w: 96, h: 70, c: pick(rng, ['#c65a4a', '#4f7fa8', '#d8a03c', '#5f8f5a']) });
  addBuilding(city, rng, b.x0 + 30, b.y1 - 130, 200, 100, 2, PALETTE.roofTerra, 'CHOP SHOP');
  parkingRow(city, rng, b.x0 + 300, b.y1 - 40, 3, 0, ['truck', 'van', 'pickup']);
  scatterTrees(city, rng, b, 3, 0.2);
}
function buildAirport(city, rng, b) {
  // 东南机场：跑道 + 航站楼 + 停机坪。
  city.runway = { x0: b.x0 + 20, y0: b.y1 - 150, x1: b.x1 - 20, y1: b.y1 - 60 };
  addBuilding(city, rng, b.x0 + 40, b.y0 + 30, 320, 130, 3, PALETTE.roofGlass, 'AIRPORT');
  scatterTrees(city, rng, b, 4, 0.3);
}

// 每帧单独画的海面碎光（预渲染图上没有它）。
export function drawGlints(ctx, city, time) {
  for (const g of city.glints) {
    const a = 0.25 + 0.55 * Math.abs(Math.sin(time * 1.4 + g.p));
    ctx.fillStyle = `rgba(255,220,140,${a.toFixed(2)})`;
    ctx.fillRect(g.x, g.y, g.s, 2);
  }
}

// 一次性预渲染：把整座静态城市画进一张离屏大画布，每帧只贴可见区域。
// 否则每帧要画几千个窗/树/斑点，软件渲染下只有 1–2 帧。
export function prerenderCity(city) {
  try {
    const c = document.createElement('canvas');
    c.width = WORLD.w; c.height = WORLD.h;
    const ctx = c.getContext('2d');
    drawCity(ctx, city, { x0: -100, y0: -100, x1: WORLD.w + 100, y1: WORLD.h + 100 }, 0, true);
    city.staticCanvas = c;
  } catch (e) { city.staticCanvas = null; }
}
export function cityCollides(city, x, y, r) {
  if (x < 150 + r && !(x > city.pier.x0 - r && x < city.pier.x1 + r && y > city.pier.y0 - r && y < city.pier.y1 + r)) return true;
  if (x < 0 || y < 0 || x > WORLD.w || y > WORLD.h) return true;
  for (const b of city.buildings)
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
  for (const p of city.pools)
    if (x > p.x - r && x < p.x + p.w + r && y > p.y - r && y < p.y + p.h + r) return true;
  for (const c of city.containers)
    if (x > c.x - r && x < c.x + c.w + r && y > c.y - r && y < c.y + c.h + r) return true;
  return false;
}
const inView = (v, x, y, m) => x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m;

// —— 静态绘制：地面→水/沙→道路→公园→建筑（带长影与暖窗）→小品 ——
// staticOnly=true 时跳过动画碎光（供一次性预渲染用）。
export function drawCity(ctx, city, view, time, staticOnly = false) {
  // 地面
  ctx.fillStyle = PALETTE.grass; ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  ctx.fillStyle = PALETTE.grassDark;
  for (const s of city.speckles) if (inView(view, s.x, s.y, 10)) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.29); ctx.fill(); }
  // 西边海水 + 沙滩
  if (view.x0 < 320) {
    ctx.fillStyle = PALETTE.water; ctx.fillRect(view.x0, view.y0, Math.min(150, view.x1) - view.x0, view.y1 - view.y0);
    ctx.fillStyle = PALETTE.waterDeep; ctx.fillRect(view.x0, view.y0, Math.min(60, view.x1) - view.x0, view.y1 - view.y0);
    ctx.fillStyle = PALETTE.sand; ctx.fillRect(150, view.y0, 150, view.y1 - view.y0);
    // 海面阳光碎光（动画闪烁；预渲染时跳过，由每帧单独画）
    if (!staticOnly) for (const g of city.glints) {
      const a = 0.25 + 0.55 * Math.abs(Math.sin(time * 1.4 + g.p));
      ctx.fillStyle = `rgba(255,220,140,${a.toFixed(2)})`;
      ctx.fillRect(g.x, g.y, g.s, 2);
    }
    // 码头木栈道
    const p = city.pier;
    ctx.fillStyle = PALETTE.pierWood; ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
    ctx.strokeStyle = 'rgba(90,60,30,0.6)'; ctx.lineWidth = 2;
    for (let x = p.x0 + 20; x < p.x1; x += 28) { ctx.beginPath(); ctx.moveTo(x, p.y0); ctx.lineTo(x, p.y1); ctx.stroke(); }
    // 游艇
    for (const y of city.yachts) {
      ctx.save(); ctx.translate(y.x, y.y); ctx.rotate(y.a);
      ctx.fillStyle = '#f4f0e4'; ctx.beginPath(); ctx.ellipse(0, 0, 34, 12, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#7fb3d8'; ctx.fillRect(-8, -8, 18, 8);
      ctx.restore();
    }
  }
  // 道路：暖沥青 + 人行道边 + 车道虚线 + 路口斑马线
  ctx.fillStyle = PALETTE.road;
  for (const x of AVENUES) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD.h);
  for (const y of STREETS) ctx.fillRect(0, y - ROAD_W / 2, WORLD.w, ROAD_W);
  ctx.fillStyle = PALETTE.sidewalk;
  for (const x of AVENUES) { ctx.fillRect(x - ROAD_W / 2 - 10, 0, 10, WORLD.h); ctx.fillRect(x + ROAD_W / 2, 0, 10, WORLD.h); }
  for (const y of STREETS) { ctx.fillRect(0, y - ROAD_W / 2 - 10, WORLD.w, 10); ctx.fillRect(0, y + ROAD_W / 2, WORLD.w, 10); }
  ctx.fillStyle = PALETTE.lane;
  for (const x of AVENUES) for (let y = 30; y < WORLD.h; y += 90) ctx.fillRect(x - 3, y, 6, 44);
  for (const y of STREETS) for (let x = 30; x < WORLD.w; x += 90) ctx.fillRect(x, y - 3, 44, 6);
  ctx.fillStyle = 'rgba(240,230,200,0.85)';
  for (const x of AVENUES) for (const y of STREETS)
    for (let i = -3; i < 4; i++) ctx.fillRect(x + i * 16 - 5, y - ROAD_W / 2 - 4, 10, ROAD_W + 8);
  // 机场跑道
  if (city.runway) {
    const r = city.runway;
    ctx.fillStyle = '#5a5148'; ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    ctx.fillStyle = '#f2d38a';
    for (let x = r.x0 + 30; x < r.x1 - 30; x += 80) ctx.fillRect(x, (r.y0 + r.y1) / 2 - 3, 40, 6);
  }
  // 公园：深绿底 + 小路十字
  if (city.parks) for (const p of city.parks) {
    ctx.fillStyle = '#8fa04e'; ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect((p.x0 + p.x1) / 2 - 8, p.y0, 16, p.y1 - p.y0);
    ctx.fillRect(p.x0, (p.y0 + p.y1) / 2 - 8, p.x1 - p.x0, 16);
  }
  // 泳池：青绿 + 白边 + 碎光
  for (const p of city.pools) {
    ctx.fillStyle = '#efe8d8'; ctx.fillRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);
    ctx.fillStyle = '#4fc3c0'; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(p.x + 8, p.y + 6, p.w - 20, 4);
  }
  // 集装箱
  for (const c of city.containers) {
    ctx.fillStyle = PALETTE.shadow; ctx.fillRect(c.x + 14, c.y + 8, c.w, c.h);
    ctx.fillStyle = c.c; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(c.x + i * c.w / 4, c.y); ctx.lineTo(c.x + i * c.w / 4, c.y + c.h); ctx.stroke(); }
  }
  // 建筑：长影（朝东，影长约楼高 2 倍）→ 楼体 → 暖窗 → 霓虹招牌
  for (const b of city.buildings) {
    if (!inView(view, b.x + b.w / 2, b.y + b.h / 2, 200)) continue;
    const shX = b.floors * 13, shY = b.floors * 4; // 影子向东拉长
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(b.x + shX, b.y + shY, b.w, b.h);
    ctx.fillStyle = b.roof; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(b.x, b.y, b.w, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
    const cw = b.w / b.cols, ch = b.h / b.rows;
    for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) {
      ctx.fillStyle = b.lit[r * b.cols + c] ? PALETTE.windowLit : PALETTE.windowDark;
      ctx.fillRect(b.x + c * cw + cw * 0.28, b.y + r * ch + ch * 0.28, cw * 0.44, ch * 0.44);
    }
    // 屋顶设备
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(b.x + b.w * 0.15, b.y + b.h * 0.15, 14, 10);
    if (b.neon) {
      ctx.save();
      ctx.shadowColor = b.neon.includes('SHOP') ? PALETTE.neonPink : PALETTE.neonCyan;
      ctx.shadowBlur = 16;
      ctx.fillStyle = b.neon.includes('SHOP') ? PALETTE.neonPink : PALETTE.neonCyan;
      ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(b.neon, b.x + b.w / 2, b.y + b.h / 2 + 7);
      ctx.restore();
    }
  }
  // 广告牌
  for (const b of city.billboards) {
    if (!inView(view, b.x, b.y, 80)) continue;
    ctx.fillStyle = PALETTE.shadow; ctx.fillRect(b.x + 10, b.y + 6, 84, 44);
    ctx.fillStyle = '#2c2620'; ctx.fillRect(b.x, b.y, 84, 44);
    ctx.fillStyle = b.color; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(b.text, b.x + 42, b.y + 28);
  }
  // 长椅
  ctx.fillStyle = '#8a6a42';
  for (const b of city.benches) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillRect(-16, -5, 32, 10); ctx.restore(); }
  // 灌木
  for (const b of city.bushes) {
    if (!inView(view, b.x, b.y, 30)) continue;
    ctx.fillStyle = PALETTE.shadow; ctx.beginPath(); ctx.ellipse(b.x + 8, b.y + 5, b.r, b.r * 0.7, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#6f8f3e'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#86a84e'; ctx.beginPath(); ctx.arc(b.x - 3, b.y - 3, b.r * 0.6, 0, 6.29); ctx.fill();
  }
  // 树：长影 + 树冠（棕榈画扇叶）
  for (const t of city.trees) {
    if (!inView(view, t.x, t.y, 40)) continue;
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath(); ctx.ellipse(t.x + 20, t.y + 8, t.r * 1.2, t.r * 0.7, 0, 0, 6.29); ctx.fill();
    if (t.palm) {
      ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(t.x, t.y + 6); ctx.lineTo(t.x, t.y - 6); ctx.stroke();
      ctx.fillStyle = '#5d8f3e';
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + 0.4;
        ctx.beginPath(); ctx.ellipse(t.x + Math.cos(a) * t.r * 0.8, t.y - 4 + Math.sin(a) * t.r * 0.8, t.r * 0.75, 5, a, 0, 6.29); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#5d8f3e'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#74a84e'; ctx.beginPath(); ctx.arc(t.x - 4, t.y - 4, t.r * 0.65, 0, 6.29); ctx.fill();
    }
  }
  // 路灯：杆 + 暖光晕
  for (const l of city.lamps) {
    if (!inView(view, l.x, l.y, 20)) continue;
    ctx.fillStyle = '#3a332c'; ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    ctx.fillStyle = 'rgba(255,210,120,0.85)'; ctx.beginPath(); ctx.arc(l.x, l.y, 4, 0, 6.29); ctx.fill();
    ctx.fillStyle = 'rgba(255,210,120,0.18)'; ctx.beginPath(); ctx.arc(l.x, l.y, 12, 0, 6.29); ctx.fill();
  }
}
