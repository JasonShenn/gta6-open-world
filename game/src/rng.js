// rng.js — 确定性随机数：mulberry32。截图布景与城市生成共用，保证同 seed 同画面。
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 在 [min, max) 均匀取数
export function range(rng, min, max) { return min + rng() * (max - min); }
// 从数组里随机挑一个
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
// 整数随机 [min, max]
export function int(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }
