// 可复现的随机数：mulberry32。?seed=N 固定城市布局、车流与行人，
// 截图与测试每次跑出同一座城；不传 seed 时用真随机。

/** 由一个 32 位种子造一个 [0, 1) 的随机函数。 */
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [min, max) 之间的随机数。 */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** [min, max] 之间的随机整数。 */
export function rangeInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** 从数组里随机挑一个。 */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}
