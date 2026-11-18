// GOLDEN TIDE — config.js
// One job: every constant, colour and tuning number for the game, in one place.
// The golden-hour palette lives here so the whole city shares one sunset.

export const WORLD = { w: 5200, h: 3800 }; // world size in pixels
export const VIEW = { w: 1280, h: 720 }; // play viewport the screenshots use
export const ZOOM = 1.35; // camera zoom: the city reads bigger, cars read as cars

// Golden-hour palette: warm sun, long shadows, sea green and coral walls.
export const PAL = {
  grass: '#8fae5a', grassDry: '#b5a05e', sand: '#e8cf9a', sandWet: '#d9b878',
  sea: '#1e7f8e', seaDeep: '#14606e', seaSpark: '#ffe9a8',
  road: '#4a4642', roadEdge: '#6b655e', sidewalk: '#c9b18c', dash: '#f2d38a',
  shadow: 'rgba(60,30,10,0.30)', // long sunset shadow colour
  cream: '#f2e3c2', coral: '#e8876b', teal: '#5fb8a6', terracotta: '#c67b4e',
  glass: '#3f7ea6', glassHi: '#9fd4e8', palm: '#3f7d44', palmDark: '#2c5c31',
  roof: '#8a6a4a', neonPink: '#ff5fa2', neonCyan: '#39e6ff', neonGold: '#ffd34d',
  gold: '#ffd34d', money: '#7be382', police: '#2b4fd8', policeLight: '#ff3b30',
  hud: 'rgba(20,14,8,0.72)', hudEdge: 'rgba(255,211,77,0.55)',
};

export const DISTRICTS = [
  { id: 'marina', name: 'Marina & Pier', x0: 0, y0: 0, x1: 950, y1: 3800, tint: '#e8cf9a' },
  { id: 'downtown', name: 'Downtown', x0: 1650, y0: 950, x1: 3350, y1: 2450, tint: '#3f7ea6' },
  { id: 'oldtown', name: 'Old Town', x0: 1650, y0: 2450, x1: 3350, y1: 3800, tint: '#c67b4e' },
  { id: 'beach', name: 'South Beach', x0: 950, y0: 2950, x1: 5200, y1: 3800, tint: '#e8cf9a' },
  { id: 'industrial', name: 'East Docks', x0: 4050, y0: 0, x1: 5200, y1: 2950, tint: '#8a8a86' },
  { id: 'residential', name: 'Palm Heights', x0: 950, y0: 0, x1: 4050, y1: 950, tint: '#8fae5a' },
];

// Avenue / street centre lines. Roads are 96 px wide, sidewalks hug them.
export const AVENUES = [420, 1020, 1620, 2220, 2820, 3420, 4020, 4620];
export const STREETS = [420, 920, 1420, 1920, 2420, 2920, 3420];
export const ROAD_W = 96;

// Car types the player can steal and drive. topSpeed in px/s.
export const CAR_TYPES = {
  sedan: { name: 'Sedan', color: '#d8d3c8', top: 330, accel: 210, grip: 3.4, len: 46, wid: 22 },
  sports: { name: 'Sunset Sports', color: '#ff7a1a', top: 470, accel: 300, grip: 4.2, len: 48, wid: 22 },
  taxi: { name: 'Taxi Cab', color: '#ffc81e', top: 340, accel: 220, grip: 3.5, len: 46, wid: 22 },
  van: { name: 'Getaway Van', color: '#7a8a99', top: 300, accel: 180, grip: 3.0, len: 56, wid: 26 },
  police: { name: 'Police Cruiser', color: '#2b4fd8', top: 430, accel: 280, grip: 4.0, len: 48, wid: 23 },
  truck: { name: 'Dock Truck', color: '#b8573f', top: 280, accel: 160, grip: 2.8, len: 60, wid: 26 },
};

// Mission script: Cole "Cash" Vega runs jobs for Mara at the beach garage.
export const MISSIONS = [
  {
    id: 'm1', code: 'M1', title: 'FIRST JOB',
    brief: 'Mara needs a package off the pier. Grab it, bring it to her garage.',
    stages: [
      { text: 'Pick up the package at the Marina Pier', target: { x: 300, y: 1750, r: 70 } },
      { text: 'Deliver the package to Mara\u2019s Garage', target: { x: 1300, y: 3050, r: 90 } },
    ],
    reward: 150,
  },
  {
    id: 'm2', code: 'M2', title: 'SUNSET STEAL',
    brief: 'A sunset-orange convertible is parked at the marina. Steal it, lose the cops, drop it at the chop shop.',
    stages: [
      { text: 'Steal the orange convertible at the marina', target: { x: 560, y: 2100, r: 80 } },
      { text: 'Deliver the convertible to the Chop Shop (East Docks)', target: { x: 4400, y: 1200, r: 100 } },
    ],
    reward: 400,
  },
  {
    id: 'm3', code: 'M3', title: 'PIER SHOOTOUT',
    brief: 'The pier crew is holding Mara\u2019s cash. Take it back — guns out, cops will come.',
    stages: [
      { text: 'Fight the pier crew and grab the cash bag', target: { x: 330, y: 2350, r: 110 } },
      { text: 'Escape the pier — lose the heat, reach the garage', target: { x: 1300, y: 3050, r: 110 } },
    ],
    reward: 600,
  },
  {
    id: 'm4', code: 'M4', title: 'AIRPORT RUN',
    brief: 'Last job. Drive the getaway van through the roadblocks to Palmera Airport before the timer runs out.',
    stages: [
      { text: 'Get in the getaway van at the garage', target: { x: 1300, y: 3050, r: 90 } },
      { text: 'Reach Palmera Airport — beat the clock!', target: { x: 4900, y: 500, r: 120 } },
    ],
    reward: 1200, timeLimit: 180,
  },
];

export const CASH_SPOTS = 5; // hidden cash stashes around the city, $50 each
export const TAXI_FARE_MIN = 40;
export const TAXI_FARE_MAX = 80;
export const START_MONEY = 60;
export const SAVE_KEY = 'golden-tide-save-v1';
