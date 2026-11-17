// Solmar Heat — shared tuning constants and palette.
// A sun-soaked fictional seaside city. Nothing here comes from any
// commercial game: every name, place and number is original.

export const WORLD = { w: 3200, h: 2400 };

export const ROAD_W = 140; // width of every road in world pixels
export const SIDEWALK = 22; // sidewalk strip hugging each road

// Road centre lines (world pixels). The grid makes the city readable
// on the minimap and gives traffic a simple network to follow.
export const V_ROADS = [360, 980, 1600, 2220, 2840];
export const H_ROADS = [360, 880, 1400, 1920];

// The park occupies the block between these two roads, the marina and
// the beach fill the whole southern strip of the map.
export const PARK = { x: 1600 + ROAD_W / 2 + SIDEWALK, y: 880 + ROAD_W / 2 + SIDEWALK,
  w: (2220 - 1600) - ROAD_W - SIDEWALK * 2, h: (1400 - 880) - ROAD_W - SIDEWALK * 2 };
export const BEACH = { x: 0, y: 2060, w: 1900, h: 340 };
export const MARINA = { x: 1900, y: 2060, w: 1300, h: 340 };

// Player on foot.
export const PLAYER = {
  radius: 14,
  walkSpeed: 235,
  sprintSpeed: 335,
  maxHealth: 100,
  gunDamage: 34,
  gunCooldown: 0.24,
  bulletSpeed: 900,
  interactRange: 78,
};

// Driving. Numbers tuned so a car feels fast next to walking speed
// but still controllable through the grid's corners.
export const CAR = {
  radius: 20,
  accel: 430,
  brake: 700,
  reverseAccel: 300,
  maxSpeed: 560,
  maxReverse: 190,
  turnRate: 2.6,
  drag: 0.55,
};

// Wanted level: 0..5 stars. Crimes and their heat.
export const CRIME = {
  stealCar: 1,
  hitPedestrian: 1,
  shootInPublic: 1,
  maxStars: 5,
  decaySeconds: 22, // quiet time before one star cools off
};

// Police response: how many cruisers each star level sends out.
export function copsForStars(stars) {
  if (stars <= 0) return 0;
  if (stars === 1) return 1;
  if (stars === 2) return 2;
  if (stars === 3) return 3;
  return 4;
}
export const COP = {
  maxSpeed: 600,
  accel: 520,
  turnRate: 3.1,
  ramDamage: 6,
  arrestRange: 72,
  arrestSeconds: 2.4,
  spawnDistance: 650,
  despawnDistance: 1600,
};

// Traffic and pedestrians.
export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const ENEMY = { radius: 14, hp: 100, speed: 150, shootRange: 430, shootCooldown: 1.35, damage: 9 };

// Money.
export const START_MONEY = 120;
export const BUSTED_FINE = 150;
export const BUSTED_FINE_RATE = 0.1;
export const KILL_REWARD = 50;
export const MISSION_REWARDS = [300, 500, 700];

// Palette: warm coastal noon.
export const PAL = {
  grass: '#7fae62',
  grassDark: '#74a258',
  sand: '#e8d39a',
  road: '#3d3f45',
  roadLine: '#e8e4c8',
  sidewalk: '#b9b3a4',
  water: '#2e7fa8',
  waterDeep: '#256b8f',
  park: '#69a854',
  buildingRoof: ['#c96f4a', '#d9a441', '#5b7fa6', '#8a6fae', '#4f9d7a', '#b5546b'],
  buildingEdge: 'rgba(0,0,0,0.28)',
  plaza: '#cfc8b8',
  copBlue: '#2244aa',
  copWhite: '#f2f2f2',
  markerGold: '#ffd23e',
};

export const SAVE_KEY = 'solmar-heat-save-v1';
