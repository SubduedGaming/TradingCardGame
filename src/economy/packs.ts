import type { Card, Rarity } from '../engine/types';
import { nextInt } from '../engine/rng';

/** Pack slot tables from docs/04 section 4, in parts per thousand. */
const COMMON_SLOT: Array<[Rarity, number]> = [['common', 1000]];
const SLOT_4: Array<[Rarity, number]> = [['uncommon', 780], ['rare', 180], ['epic', 35], ['legendary', 5]];
const SLOT_5: Array<[Rarity, number]> = [['common', 550], ['uncommon', 300], ['rare', 115], ['epic', 30], ['legendary', 5]];
export const PACK_SLOTS: ReadonlyArray<ReadonlyArray<[Rarity, number]>> = [COMMON_SLOT, COMMON_SLOT, COMMON_SLOT, SLOT_4, SLOT_5];

/** A pack is guaranteed to hold at least a Rare / Epic / Legendary once this many packs pass without one. */
export const PITY = { rare: 8, epic: 40, legendary: 120 } as const;

/** Packs opened since the last pack that held each tier or better. */
export interface PityCounters {
  rare: number;
  epic: number;
  legendary: number;
}

export const NO_PITY: PityCounters = { rare: 0, epic: 0, legendary: 0 };

const rank = (r: Rarity) => ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(r);

function rollRarity(rng: { rng: number }, table: ReadonlyArray<[Rarity, number]>): Rarity {
  let roll = nextInt(rng, 1000);
  for (const [rarity, weight] of table) {
    if (roll < weight) return rarity;
    roll -= weight;
  }
  return table[table.length - 1]![0];
}

export interface PackResult {
  cards: Card[];
  pity: PityCounters;
}

/**
 * Opens one Standard Pack of `pool`. Pity: after 7 packs without a Rare or better (39 without an Epic,
 * 119 without a Legendary) the next pack's fourth slot is upgraded. A Legendary the player already owns
 * is never drawn while an unowned one remains. Deterministic for a given `rng` state.
 */
export function openPack(pool: Card[], owned: Record<string, number>, pity: PityCounters, rng: { rng: number }): PackResult {
  const byRarity = new Map<Rarity, Card[]>();
  for (const c of pool) byRarity.set(c.rarity, [...(byRarity.get(c.rarity) ?? []), c]);

  const rarities = PACK_SLOTS.map((table) => rollRarity(rng, table));
  const best = Math.max(...rarities.map(rank));
  if (pity.legendary + 1 >= PITY.legendary && best < rank('legendary')) rarities[3] = 'legendary';
  else if (pity.epic + 1 >= PITY.epic && best < rank('epic')) rarities[3] = 'epic';
  else if (pity.rare + 1 >= PITY.rare && best < rank('rare')) rarities[3] = 'rare';

  const taken = new Set<string>();
  const cards: Card[] = [];
  for (const rarity of rarities) {
    let options = byRarity.get(rarity) ?? [];
    if (rarity === 'legendary') {
      const unseen = options.filter((c) => !((owned[c.id] ?? 0) > 0) && !taken.has(c.id));
      if (unseen.length > 0) options = unseen;
    }
    if (options.length === 0) throw new Error(`pool has no ${rarity} cards`);
    const card = options[nextInt(rng, options.length)]!;
    if (rarity === 'legendary') taken.add(card.id);
    cards.push(card);
  }

  const top = Math.max(...cards.map((c) => rank(c.rarity)));
  return {
    cards,
    pity: {
      rare: top >= rank('rare') ? 0 : pity.rare + 1,
      epic: top >= rank('epic') ? 0 : pity.epic + 1,
      legendary: top >= rank('legendary') ? 0 : pity.legendary + 1,
    },
  };
}
