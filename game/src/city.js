// GOLDEN TIDE — city.js
// One job: build the city of Palmera from a seed — districts, roads, buildings,
// palms, pools, the pier, the beach and the sea — and answer "what is here?"
// questions (road? district? nearest road point?) for the other systems.

import { WORLD, AVENUES, STREETS, ROAD_W, DISTRICTS, PAL, CASH_SPOTS } from './config.js';
import { makeRng } from './rng.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  return DISTRICTS[5];
}

export function isRoad(x, y) {
  // The sea strips and the beach boardwalk are not roads.
  if (x < 240 || y > 3560) return false;
  for (const a of AVENUES) if (Math.abs(x - a) < ROAD_W / 2) return true;
  for (const s of STREETS) if (Math.abs(y - s) < ROAD_W / 2) return true;
  return false;
}

export function onSidewalk(x, y) {
  if (x < 240 || y > 3560) return false;
  for (const a of AVENUES) if (Math.abs(x - a) < ROAD_W / 2 + 16) return true;
  for (const s of STREETS) if (Math.abs(y - s) < ROAD_W / 2 + 16) return true;
  return false;
}

// Snap a point onto the nearest road centre line.
export function nearestRoadPoint(x, y, rng) {
  let bestA = AVENUES[0], bestD = 1e9;
  for (const a of AVENUES) { const d = Math.abs(x - a); if (d < bestD) { bestD = d; bestA = a; } }
  let bestS = STREETS[0]; bestD = 1e9;
  for (const s of STREETS) { const d = Math.abs(y - s); if (d < bestD) { bestD = d; bestS = s; } }
  if (rng && rng.chance(0.5)) return { x: bestA + rng.range(-18, 18), y: Math.max(60, Math.min(WORLD.h - 60, y)) };
  return { x: Math.max(260, Math.min(WORLD.w - 60, x)), y: bestS + (rng ? rng.range(-18, 18) : 0) };
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = []; const palms = []; const pools = []; const yachts = [];
  const wallColors = [PAL.cream, PAL.coral, PAL.teal, PAL.terracotta, '#e8b64c', '#7fb3c8', '#d9a0a0'];
  const glassColors = [PAL.glass, '#2f6b8f', '#4a90b8', '#356b9e'];

  // One building per block cell, skipped where a road, the sea or the beach is.
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + 14, x1 = AVENUES[ai + 1] - ROAD_W / 2 - 14;
      const y0 = STREETS[si] + ROAD_W / 2 + 14, y1 = STREETS[si + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const d = districtAt(cx, cy);
      if (d.id === 'marina' && cx < 700) continue; // pier boardwalk stays open
      if (d.id === 'beach') continue; // sand stays open, palms and pools instead
      const downtown = d.id === 'downtown';
      const n = downtown ? (rng.chance(0.55) ? 2 : 1) : (rng.chance(0.35) ? 2 : 1);
      for (let k = 0; k < n; k++) {
        const w = downtown ? rng.range(90, 170) : rng.range(70, 150);
        const h = downtown ? rng.range(90, 170) : rng.range(60, 130);
        const bx = x0 + rng.range(10, Math.max(11, x1 - x0 - w - 10));
        const by = y0 + rng.range(10, Math.max(11, y1 - y0 - h - 10));
        const tall = downtown ? rng.range(2.2, 4.2) : rng.range(0.8, 1.6); // shadow length factor
        buildings.push({
          x: bx, y: by, w, h, tall,
          color: downtown ? rng.pick(glassColors) : rng.pick(wallColors),
          glass: downtown, neon: downtown && rng.chance(0.5),
          neonColor: rng.pick([PAL.neonPink, PAL.neonCyan, PAL.neonGold]),
          roof: rng.pick(['#8a6a4a', '#5e7d6a', '#a85f3f', '#4a6b7d']),
          lit: rng.next(),
        });
      }
      // Palms line the block corners in the residential north and along the beach.
      if (d.id === 'residential' || d.id === 'oldtown') {
        const pn = rng.int(2, 4);
        for (let p = 0; p < pn; p++) palms.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), s: rng.range(0.8, 1.25) });
      }
    }
  }

  // South beach: sand band, boardwalk palms, two turquoise pools, umbrellas.
  for (let i = 0; i < 26; i++) palms.push({ x: rng.range(1000, 5100), y: rng.range(3000, 3480), s: rng.range(0.9, 1.4) });
  pools.push({ x: 2100, y: 3150, w: 180, h: 90 });
  pools.push({ x: 3600, y: 3200, w: 220, h: 100 });
  // West marina: yachts bobbing beside the pier, palms along the boardwalk.
  for (let i = 0; i < 7; i++) yachts.push({ x: rng.range(60, 190), y: 500 + i * 420 + rng.range(-40, 40), a: rng.range(-0.2, 0.2) });
  for (let i = 0; i < 10; i++) palms.push({ x: rng.range(270, 330), y: 500 + i * 300, s: 1.1 });

  // Grass speckle so the lawns are not flat colour: deterministic dots.
  const speckles = [];
  for (let i = 0; i < 520; i++) {
    const x = rng.range(260, WORLD.w - 60), y = rng.range(60, WORLD.h - 60);
    if (isRoad(x, y) || x < 240 || y > 3560 || y > 2960) continue;
    speckles.push({ x, y, r: rng.range(1.5, 3.5), dark: rng.chance(0.5) });
  }

  // Hidden cash stashes, spread across districts, never on a road.
  const cashSpots = [];
  const cashPlaces = [
    { x: 1150, y: 700 }, { x: 2500, y: 1150 }, { x: 3800, y: 2700 },
    { x: 1500, y: 3300 }, { x: 4700, y: 2000 },
  ];
  for (let i = 0; i < CASH_SPOTS; i++) cashSpots.push({ ...cashPlaces[i], taken: false });

  // Landmarks the missions and the HUD name.
  const landmarks = {
    garage: { x: 1300, y: 3050, label: 'MARA\u2019S GARAGE' },
    pier: { x: 300, y: 1750, label: 'MARINA PIER' },
    chopShop: { x: 4400, y: 1200, label: 'CHOP SHOP' },
    airport: { x: 4900, y: 500, label: 'PALMERA AIRPORT' },
    beachClub: { x: 2100, y: 3150, label: 'BEACH CLUB' },
  };

  return { buildings, palms, pools, yachts, cashSpots, landmarks, speckles, seed };
}
