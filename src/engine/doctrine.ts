import type { Card, CostDiscount, Nation } from './types';

/** A deck needs at least this many cards of one nation to unlock that nation's doctrine. */
export const DOCTRINE_MIN_CARDS = 10;

/** Doctrines that work as cost discounts. The other doctrines act when a unit enters play (see units.ts). */
export const DOCTRINE_DISCOUNTS: Partial<Record<Nation, CostDiscount[]>> = {
  // Industrial Might: your first Building each turn costs 1 less Supplies.
  usa: [{ applies: 'building', resource: 'supplies', amount: 1, oncePerTurn: true }],
  // Mass Mobilisation: Infantry cost 1 less Manpower while you control 3+ units.
  ussr: [{ applies: { role: 'infantry' }, resource: 'manpower', amount: 1, oncePerTurn: false, minUnits: 3 }],
};

export function nationCounts(deck: Card[]): Map<Nation, number> {
  const counts = new Map<Nation, number>();
  for (const c of deck) {
    if (c.nation === 'neutral') continue;
    counts.set(c.nation, (counts.get(c.nation) ?? 0) + 1);
  }
  return counts;
}

/**
 * Picks the doctrine for a deck.
 * - `requested` given: that nation (or null for none). Throws if the deck does not qualify.
 * - otherwise: the nation with the most cards if it has at least DOCTRINE_MIN_CARDS and is not tied;
 *   a tie means no doctrine until the player chooses one explicitly.
 */
export function chooseDoctrine(deck: Card[], requested?: Nation | null): Nation | null {
  const counts = nationCounts(deck);
  if (requested !== undefined) {
    if (requested === null) return null;
    if (requested === 'neutral' || (counts.get(requested) ?? 0) < DOCTRINE_MIN_CARDS) {
      throw new Error(`doctrine '${requested}' needs ${DOCTRINE_MIN_CARDS}+ ${requested} cards in the deck`);
    }
    return requested;
  }
  let best: Nation | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [nation, n] of counts) {
    if (n > bestCount) {
      best = nation;
      bestCount = n;
      tied = false;
    } else if (n === bestCount) {
      tied = true;
    }
  }
  return best !== null && bestCount >= DOCTRINE_MIN_CARDS && !tied ? best : null;
}
