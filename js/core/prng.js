/**
 * mulberry32 — fast, statistically sound 32-bit seeded PRNG.
 *
 * Returns a function that behaves exactly like Math.random():
 * produces a float in [0, 1) from a 32-bit integer seed.
 *
 * Why mulberry32:
 *   - Single 32-bit state — tiny memory footprint
 *   - Passes PractRand statistical tests for all output sizes useful for mazes
 *   - Trivial to re-create given the seed → perfect for reproducibility / sharing
 *   - No floating-point seed → no precision loss when stored or typed by the user
 *
 * Usage:
 *   const rng = mulberry32(42);
 *   rng();  // → some float in [0, 1)
 *   rng();  // → next float in the sequence
 */
export function mulberry32(seed) {
  let s = seed >>> 0; // ensure unsigned 32-bit integer
  return function rng() {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * Returns a random 32-bit unsigned integer suitable as a PRNG seed.
 * Combines the current timestamp with a Math.random() call to avoid
 * identical seeds when initMaze() is called multiple times per millisecond.
 */
export function randomSeed() {
  return (Date.now() ^ Math.trunc(Math.random() * 0x100000000)) >>> 0;
}
