/** mulberry32. The generator state lives in `state.rng` so a game is fully described by its JSON. */
export function nextFloat(holder: { rng: number }): number {
  holder.rng = (holder.rng + 0x6d2b79f5) | 0;
  let t = holder.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextInt(holder: { rng: number }, n: number): number {
  return Math.floor(nextFloat(holder) * n);
}

/** In-place Fisher-Yates shuffle. */
export function shuffle<T>(holder: { rng: number }, items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(holder, i + 1);
    const a = items[i] as T;
    items[i] = items[j] as T;
    items[j] = a;
  }
}
