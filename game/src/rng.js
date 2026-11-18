// rng.js — 可播种的伪随机数（mulberry32），截图布景用固定种子保证每次画面一致。

// 由一个整数种子造一台随机数发生器：同样的种子永远吐出同样的数列。
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 在 [min, max) 之间取一个随机数。
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// 从数组里随机挑一个。
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// 随机取一个整数（含 min，不含 max）。
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min));
}
