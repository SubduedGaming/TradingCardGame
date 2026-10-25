import type { Card, Rarity } from '../engine/types';
import { nextInt } from '../engine/rng';
import { WW2_CARDS } from '../cards/ww2';
import { dayKey } from './rewards';

/** Price bounds per rarity (docs/04 section 6.1). */
export const PRICE_BOUNDS: Record<Rarity, { min: number; max: number }> = {
  common: { min: 8, max: 60 },
  uncommon: { min: 25, max: 200 },
  rare: { min: 80, max: 800 },
  epic: { min: 300, max: 2500 },
  legendary: { min: 1000, max: 10000 },
};

const BASE_PRICE: Record<Rarity, number> = { common: 15, uncommon: 50, rare: 200, epic: 700, legendary: 3000 };
const STOCK: Record<Rarity, number> = { common: 6, uncommon: 5, rare: 4, epic: 2, legendary: 1 };

export interface MarketListing {
  /** `<day>|<n>`: unique within a day and tied to it. */
  id: string;
  card: Card;
  price: number;
}

function hashDay(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  return h | 0;
}

/**
 * The simulated market (docs/04 section 6.3): NPC sellers with a rotating daily stock. The stock is a pure
 * function of the date, so it is the same all day and for everyone; a server market can replace it later
 * behind the same listing shape.
 */
export function dailyStock(now: number, pool: Card[] = WW2_CARDS): MarketListing[] {
  const day = dayKey(now);
  const rng = { rng: hashDay(day) };
  const out: MarketListing[] = [];
  let n = 0;
  for (const rarity of ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const) {
    const cards = pool.filter((c) => c.rarity === rarity);
    const picked = new Set<string>();
    for (let i = 0; i < STOCK[rarity] && picked.size < cards.length; i++) {
      let card = cards[nextInt(rng, cards.length)]!;
      while (picked.has(card.id)) card = cards[nextInt(rng, cards.length)]!;
      picked.add(card.id);
      const { min, max } = PRICE_BOUNDS[rarity];
      const price = Math.min(max, Math.max(min, Math.round(BASE_PRICE[rarity] * (0.8 + nextInt(rng, 41) / 100))));
      out.push({ id: `${day}|${n++}`, card, price });
    }
  }
  return out;
}
