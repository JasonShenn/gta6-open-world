// 城市生成：道路网格 + 街区建筑 + 公园 + 路灯 + 地标。
// 同一个种子永远生成同一座城。地标是原创虚构地点：
// 码头（Pier）、车库（Garage）、灯塔（Lighthouse），与任务坐标一一对应。

import { ROAD_SPACING, ROAD_W, WORLD_H, WORLD_W } from './config.js';
import { pick, range, rangeInt } from './random.js';

// 屋顶配色：暖色阳光城，屋顶一片一片颜色各异。
const ROOF_COLORS = ['#c96f4a', '#d9a05b', '#7d8ba0', '#a8574f', '#b98a4e', '#5f7d6a', '#8a6f9e', '#4f7d8a'];
// 车身配色。
const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33a', '#e8e8e8', '#3a3a3a', '#4fae62', '#c97bb8', '#e07b2e'];
// 行人衣服配色。
const SHIRT_COLORS = ['#e8e8e8', '#3d7dd9', '#d94f3d', '#4fae62', '#e8c33a', '#c97bb8', '#e07b2e', '#7d8ba0'];

/** 纵向道路的 x 坐标（路中心线）。 */
export function roadXs() {
  const xs = [];
  for (let x = ROAD_SPACING / 2; x < WORLD_W; x += ROAD_SPACING) xs.push(x);
  return xs;
}

/** 横向道路的 y 坐标（路中心线）。 */
export function roadYs() {
  const ys = [];
  for (let y = ROAD_SPACING / 2; y < WORLD_H; y += ROAD_SPACING) ys.push(y);
  return ys;
}

/** 点是否落在任何一条道路上（含路宽）。 */
export function onRoad(x, y) {
  const half = ROAD_W / 2;
  for (const rx of roadXs()) if (Math.abs(x - rx) < half) return true;
  for (const ry of roadYs()) if (Math.abs(y - ry) < half) return true;
  return false;
}

/** 最近的道路中心点（警察刷新的落点、车辆行驶的车道都用它）。 */
export function nearestRoadPoint(x, y) {
  let bestX = roadXs()[0];
  let bestD = Infinity;
  for (const rx of roadXs()) {
    const d = Math.abs(x - rx);
    if (d < bestD) {
      bestD = d;
      bestX = rx;
    }
  }
  let bestY = roadYs()[0];
  bestD = Infinity;
  for (const ry of roadYs()) {
    const d = Math.abs(y - ry);
    if (d < bestD) {
      bestD = d;
      bestY = ry;
    }
  }
  // 离哪条路更近就落在哪条路上。
  return Math.abs(x - bestX) <= Math.abs(y - bestY) ? { x: bestX, y } : { x, y: bestY };
}

/** 生成整座城：建筑、公园、路灯、停车点、三个任务地标。 */
export function createCity(random) {
  const buildings = [];
  const parks = [];
  const lamps = [];
  const trees = [];
  const half = ROAD_W / 2;

  // 每个街区（两条路之间的方块）不是楼就是公园/广场/停车场。
  for (let bx = 0; bx < 7; bx += 1) {
    for (let by = 0; by < 5; by += 1) {
      const x0 = bx * ROAD_SPACING + ROAD_SPACING / 2 + half + 14;
      const y0 = by * ROAD_SPACING + ROAD_SPACING / 2 + half + 14;
      const x1 = (bx + 1) * ROAD_SPACING + ROAD_SPACING / 2 - half - 14;
      const y1 = (by + 1) * ROAD_SPACING + ROAD_SPACING / 2 - half - 14;
      const roll = random();
      if (roll < 0.16) {
        // 公园：绿地 + 几棵树。
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const count = rangeInt(random, 4, 8);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: range(random, x0 + 20, x1 - 20), y: range(random, y0 + 20, y1 - 20), r: range(random, 10, 18) });
        }
        continue;
      }
      if (roll < 0.26) {
        // 露天停车场：空地，停几辆车（由 world 负责放车，这里只留空地）。
        continue;
      }
      // 楼群：一个街区 1–3 栋楼，留出楼间小巷。
      const lots = rangeInt(random, 1, 3);
      for (let i = 0; i < lots; i += 1) {
        const w = range(random, 90, Math.max(100, (x1 - x0) / lots - 24));
        const h = range(random, 80, 190);
        const x = range(random, x0, Math.max(x0 + 1, x1 - w));
        const y = range(random, y0, Math.max(y0 + 1, y1 - h));
        buildings.push({ x, y, w, h, color: pick(random, ROOF_COLORS), height: rangeInt(random, 1, 3) });
      }
    }
  }

  // 路灯：沿每条路每 200 左右一盏，错开在路两侧。
  for (const rx of roadXs()) {
    for (let y = 120; y < WORLD_H; y += 200) {
      lamps.push({ x: rx + half + 8, y, side: 1 });
      lamps.push({ x: rx - half - 8, y: y + 100, side: -1 });
    }
  }
  for (const ry of roadYs()) {
    for (let x = 120; x < WORLD_W; x += 200) {
      lamps.push({ x, y: ry + half + 8, side: 1 });
      lamps.push({ x: x + 100, y: ry - half - 8, side: -1 });
    }
  }

  // 三个任务地标（都在路边，方便到达）。
  const landmarks = {
    // 码头：西南角海边，任务一接头点。
    pier: { x: 200, y: 2280, label: '码头 Pier' },
    // 修车行：城东，任务二逃脱终点。
    garage: { x: 3000, y: 1000, label: '修车行 Garage' },
    // 灯塔：东北角，任务三送货终点。
    lighthouse: { x: 3000, y: 200, label: '灯塔 Lighthouse' },
  };

  // 玩家出生点：市中心偏南的十字路口边。
  const spawn = { x: 1400, y: 1400 };

  return { buildings, parks, lamps, trees, landmarks, spawn, carColors: CAR_COLORS, shirtColors: SHIRT_COLORS };
}
