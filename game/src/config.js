// config.js — GOLDEN TIDE 全局常量：世界尺寸、配色、车型、任务文案。
// 全部数值集中在这里，调数值只改这一个文件。
export const WORLD = { w: 5200, h: 3800 }; // 世界宽高（世界单位）

// 金色黄昏配色：暖地面、暖道路、暖窗光，夕阳在西边（左），影子朝东拉长。
export const PALETTE = {
  grass: '#b3a45c', grassDark: '#a3934e', grassLight: '#c2b26a',
  road: '#6e5b52', roadEdge: '#8a6f5c', lane: '#f2d38a', sidewalk: '#d9b98a',
  sand: '#eac98f', water: '#2f7f8c', waterDeep: '#256b78', pierWood: '#a97e4f',
  roofCream: '#f2e3c2', roofCoral: '#e8826a', roofTeal: '#5fb3a4', roofTerra: '#c96f3f',
  roofGlass: '#4f7fa8', roofPink: '#e8a7a0', roofWhite: '#efe8d8',
  windowLit: '#ffd27a', windowDark: '#3d4a5c', neonPink: '#ff5fa2', neonCyan: '#37e0d8',
  shadow: 'rgba(58,32,12,0.35)', // 长影颜色（半透明暖棕）
};
export const SUN = { dx: 1, dy: 0.32 }; // 夕阳光方向：自西向东，影子朝东偏南

// 6 种可偷车型：速度（世界单位/秒）、加速、转向、颜色、车库是否收藏。
export const CAR_TYPES = {
  sedan:  { name: 'SEDAN',    top: 430, accel: 300, turn: 2.6, len: 46, wid: 22, color: '#d8d3c8', collect: true },
  taxi:   { name: 'TAXI',     top: 420, accel: 290, turn: 2.6, len: 46, wid: 22, color: '#f2c230', collect: true },
  sports: { name: 'SUNSET SPORTS', top: 560, accel: 420, turn: 3.1, len: 48, wid: 21, color: '#ff7a1a', collect: true },
  van:    { name: 'VAN',      top: 380, accel: 240, turn: 2.2, len: 54, wid: 24, color: '#7fb3d8', collect: true },
  pickup: { name: 'PICKUP',   top: 440, accel: 320, turn: 2.5, len: 50, wid: 23, color: '#c65a4a', collect: true },
  truck:  { name: 'DOCK TRUCK', top: 360, accel: 210, turn: 2.0, len: 62, wid: 26, color: '#8a9a5b', collect: false },
};
export const GARAGE_TARGET = 5; // 车库收藏目标（5 种可收藏车型）
export const CASH_STASHES = 5;  // 隐藏现金点数量

// 剧情任务文案（M1→M4 依次解锁）。
export const MISSIONS = {
  M1: { id: 'M1', code: 'M1 · FIRST JOB', title: 'FIRST JOB', pay: 150,
        brief: 'Pick up the package at the Marina Pier.',
        step2: "Deliver the package to Mara's Garage.",
        banner: 'Mara needs a package from the pier. Go get it, Cash.' },
  M2: { id: 'M2', code: 'M2 · SUNSET STEAL', title: 'SUNSET STEAL', pay: 250,
        brief: 'Steal the orange convertible at the marina.',
        step2: 'Lose the cops — deliver the convertible to the Chop Shop (East Docks).',
        banner: 'That orange convertible is yours. Lose the cops first.' },
  M3: { id: 'M3', code: 'M3 · PIER SHOOTOUT', title: 'PIER SHOOTOUT', pay: 300,
        brief: 'Fight the pier crew and grab the cash bag.',
        step2: 'Shooting raised the heat — take the cash bag!',
        banner: 'The pier crew is armed. Clear them out and grab the bag.' },
  M4: { id: 'M4', code: 'M4 · AIRPORT RUN', title: 'AIRPORT RUN', pay: 500,
        brief: 'Drive the getaway van through the roadblocks to Palmera Airport. 90 seconds!',
        step2: 'Through the roadblocks — get to the airport!',
        banner: 'Last job. Ninety seconds. Do not stop for anything.' },
};
export const PLAYER = {
  walkSpeed: 175, runSpeed: 265, radius: 10,
  hpMax: 100, ammoMax: 24, startMoney: 150,
};
export const WANTED_MAX = 5;
export const SAVE_KEY = 'golden-tide-save-v3';
