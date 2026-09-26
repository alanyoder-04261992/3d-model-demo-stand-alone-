/* A REPEATABLE "RANDOM" NUMBER SOURCE, for tests only. Node-safe.

   The only randomness in the designer is inside the 11 texture painters (the
   grain in the siding, the pits in the metal, the grass). Real use keeps
   Math.random, exactly like Barnwright. The look check needs both pages to
   paint IDENTICAL textures, so it hands each painter its own generator,
   restarted at the start of every texture with the seed below. The golden
   capture seeds Barnwright's painters the same way.

   textureSeed(i): i is the texture's position in creation order (0 = siding,
   1 = metal, ... 10 = the corner AO), the order Barnwright creates them in. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function textureSeed(i) {
  return 1000 + i;
}

/* The same generator as a string, for injecting into a page that is not ours
   (Barnwright) with page.addInitScript. Keep in step with mulberry32 above. */
export const MULBERRY32_SOURCE = mulberry32.toString();
