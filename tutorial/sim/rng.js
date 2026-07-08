// Deterministic, seedable RNG. Same seed → same sequence (server-authoritative,
// reproducible, auditable — see docs/architecture/11-data-model.md).

/** mulberry32 PRNG. Returns a function producing floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small RNG object wrapping a seed with convenience helpers. */
export function makeRng(seed) {
  const next = mulberry32(seed >>> 0);
  return {
    next,
    /** float in [min, max) */
    float: (min = 0, max = 1) => min + next() * (max - min),
    /** integer in [min, max] inclusive */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** weighted pick: items with weightFn(item) → weight (>0). */
    pick(items, weightFn = () => 1) {
      let total = 0;
      for (const it of items) total += Math.max(0, weightFn(it));
      let r = next() * total;
      for (const it of items) {
        r -= Math.max(0, weightFn(it));
        if (r < 0) return it;
      }
      return items[items.length - 1];
    },
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
