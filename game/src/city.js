// Solmar Heat — the city itself: road grid, blocks, buildings, the
// central park, the beach and marina, landmarks, and collision.
// Everything is generated once from a fixed seed, so the map is the
// same on every load. All names are original.

import { WORLD, ROAD_W, SIDEWALK, V_ROADS, H_ROADS, PARK, BEACH, MARINA, PAL } from './config.js';
import { makeRng, range, rangeInt, pick, clamp } from './rng.js';

export const CITY_SEED = 20261118;

// Named places the story and missions point at.
export const LANDMARKS = {
  garage: { name: "Vera's Garage", x: 500, y: 560 },        // story hub, west side
  plaza: { name: 'Solmar Plaza', x: 1910, y: 640 },          // downtown square
  tower: { name: 'Lumen Tower', x: 2620, y: 450 },           // forecourt in front of the glass tower, north-east
  market: { name: 'Harbor Market', x: 2330, y: 1830 },       // stalls by the marina road
  chopShop: { name: 'Rust & Bolt Yard', x: 2960, y: 1780 },  // mission 2 drop-off
  pier: { name: 'Sunset Pier', x: 2450, y: 2030 },           // mission 1 pickup, marina's north edge
  hideout: { name: 'Coral Court', x: 700, y: 1700 },         // quiet apartments, south-west
};

function blockRect(vx0, vx1, hy0, hy1) {
  return {
    x: vx0 + ROAD_W / 2 + SIDEWALK,
    y: hy0 + ROAD_W / 2 + SIDEWALK,
    w: (vx1 - vx0) - ROAD_W - SIDEWALK * 2,
    h: (hy1 - hy0) - ROAD_W - SIDEWALK * 2,
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function buildCity() {
  const rng = makeRng(CITY_SEED);
  const buildings = [];
  const trees = [];
  const palms = [];
  const boats = [];
  const parkedCars = [];
  const carColors = ['#d94f3d', '#3d7bd9', '#e8c33a', '#7a4fd9', '#2fae6e', '#e8e8e8', '#222831', '#e87a2a'];

  // --- Buildings, one block at a time -------------------------------------
  const vEdges = [0, ...V_ROADS, WORLD.w];
  const hEdges = [0, ...H_ROADS, WORLD.h];
  for (let bi = 0; bi < vEdges.length - 1; bi++) {
    for (let bj = 0; bj < hEdges.length - 1; bj++) {
      const block = blockRect(vEdges[bi], vEdges[bi + 1], hEdges[bj], hEdges[bj + 1]);
      if (block.w < 60 || block.h < 60) continue;
      // The park block stays green; the southern strip is beach/marina.
      if (rectsOverlap(block, PARK)) continue;
      if (block.y + block.h > BEACH.y - 40) continue;
      // The plaza block (downtown square) stays open, with a fountain.
      const plaza = { x: 1700, y: 470, w: 430, h: 330 };
      if (rectsOverlap(block, plaza)) {
        trees.push({ x: 1780, y: 540 }, { x: 2060, y: 540 }, { x: 1780, y: 730 }, { x: 2060, y: 730 });
        continue;
      }
      const count = rangeInt(rng, 2, 4);
      for (let k = 0; k < count; k++) {
        const bw = range(rng, 90, Math.min(220, block.w * 0.62));
        const bh = range(rng, 80, Math.min(190, block.h * 0.62));
        const bx = range(rng, block.x + 6, block.x + block.w - bw - 6);
        const by = range(rng, block.y + 6, block.y + block.h - bh - 6);
        const rect = { x: bx, y: by, w: bw, h: bh };
        if (buildings.some((b) => rectsOverlap(rect, b))) continue;
        buildings.push({
          ...rect,
          roof: pick(rng, PAL.buildingRoof),
          tall: rng() < 0.18,
          windows: rangeInt(rng, 4, 12),
        });
      }
    }
  }

  // The Lumen Tower is a fixed tall landmark, not a random roof.
  buildings.push({ x: 2560, y: 210, w: 150, h: 190, roof: '#4a6d8c', tall: true, windows: 16, landmark: 'tower' });
  // Vera's Garage: low wide building with a forecourt.
  buildings.push({ x: 430, y: 470, w: 190, h: 130, roof: '#5b7fa6', tall: false, windows: 6, landmark: 'garage' });
  // Harbor Market hall.
  buildings.push({ x: 2260, y: 1760, w: 170, h: 120, roof: '#c96f4a', tall: false, windows: 8, landmark: 'market' });

  // --- Park trees and pond ---------------------------------------------------
  for (let i = 0; i < 46; i++) {
    const x = range(rng, PARK.x + 20, PARK.x + PARK.w - 20);
    const y = range(rng, PARK.y + 20, PARK.y + PARK.h - 20);
    const pond = { x: PARK.x + PARK.w * 0.32, y: PARK.y + PARK.h * 0.3, w: 130, h: 90 };
    if (x > pond.x - 20 && x < pond.x + pond.w + 20 && y > pond.y - 20 && y < pond.y + pond.h + 20) continue;
    trees.push({ x, y, s: range(rng, 0.8, 1.4) });
  }

  // --- Beach palms ------------------------------------------------------------
  for (let i = 0; i < 14; i++) {
    palms.push({ x: range(rng, 80, BEACH.w - 60), y: range(rng, BEACH.y + 40, BEACH.y + 150), s: range(rng, 0.9, 1.3) });
  }

  // --- Marina: docks and moored boats -----------------------------------------
  const dockYs = [2140, 2240, 2340];
  for (const dy of dockYs) {
    for (let i = 0; i < 3; i++) {
      boats.push({
        x: range(rng, 2050, 3000), y: dy + (rng() < 0.5 ? -26 : 26),
        w: range(rng, 46, 78), h: 18, angle: 0,
        color: pick(rng, ['#e8e8e8', '#d94f3d', '#3d7bd9', '#e8c33a']),
      });
    }
  }

  // --- Parked cars along the roads --------------------------------------------
  for (const vx of V_ROADS) {
    for (const hy of H_ROADS) {
      if (rng() < 0.45) continue;
      const along = range(rng, hy + 220, hy + 420);
      parkedCars.push({
        x: vx + ROAD_W / 2 - 16, y: clamp(along, 120, WORLD.h - 120),
        angle: Math.PI / 2, color: pick(rng, carColors), parked: true,
      });
      if (rng() < 0.6) {
        parkedCars.push({
          x: vx - ROAD_W / 2 + 16, y: clamp(along + range(rng, 90, 200), 120, WORLD.h - 120),
          angle: -Math.PI / 2, color: pick(rng, carColors), parked: true,
        });
      }
    }
  }
  // The mission-2 target car: a gold sports coupe on the plaza's edge.
  parkedCars.push({ x: 2080, y: 800, angle: 0.4, color: '#ffd23e', parked: true, targetCar: true });

  // The marina water and the beach are solid obstacles for walking/driving.
  const waterRects = [MARINA, { x: 0, y: 0, w: 0, h: 0 }];
  const pondRect = { x: PARK.x + PARK.w * 0.32, y: PARK.y + PARK.h * 0.3, w: 130, h: 90 };

  return {
    buildings, trees, palms, boats, parkedCars, waterRects, pondRect,
    plaza: { x: 1700, y: 470, w: 430, h: 330 },
    // Is a world point on a road (drivable / walkable) rather than a block?
    isOnRoad(x, y) {
      for (const vx of V_ROADS) if (Math.abs(x - vx) < ROAD_W / 2) return true;
      for (const hy of H_ROADS) if (Math.abs(y - hy) < ROAD_W / 2) return true;
      return false;
    },
    // Nearest road centre line to a point, for traffic lane keeping.
    nearestRoad(x, y) {
      let best = null, bd = Infinity;
      for (const vx of V_ROADS) { const d = Math.abs(x - vx); if (d < bd) { bd = d; best = { axis: 'v', at: vx, dist: d }; } }
      for (const hy of H_ROADS) { const d = Math.abs(y - hy); if (d < bd) { bd = d; best = { axis: 'h', at: hy, dist: d }; } }
      return best;
    },
    // All solid rectangles: buildings, water, pond.
    solidRects() {
      return [...buildings, MARINA, pondRect];
    },
    // Random sidewalk point for pedestrian spawns.
    randomSidewalkPoint() {
      if (rng() < 0.5) {
        const vx = pick(rng, V_ROADS);
        return { x: vx + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 8), y: range(rng, 100, 2000) };
      }
      const hy = pick(rng, H_ROADS);
      return { x: range(rng, 100, 3100), y: hy + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 8) };
    },
    randomRoadPoint() {
      if (rng() < 0.5) {
        const vx = pick(rng, V_ROADS);
        return { x: vx, y: range(rng, 120, 1980), axis: 'v' };
      }
      const hy = pick(rng, H_ROADS);
      return { x: range(rng, 120, 3080), y: hy, axis: 'h' };
    },
  };
}
