// GOLDEN TIDE — rng.js
// One job: small seeded random numbers, so the city and every screenshot are
// reproducible from one seed. Same seed, same Palmera, every time.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // Float in [min, max).
    range(min, max) { return min + next() * (max - min); },
    // Integer in [min, max] inclusive.
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    // One item from an array.
    pick(list) { return list[Math.floor(next() * list.length)]; },
    // True with probability p.
    chance(p) { return next() < p; },
  };
}
