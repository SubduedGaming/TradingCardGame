import type { Card, Nation, ResourceType } from '../engine/types';
import { RESOURCE_TYPES } from '../engine/types';
import { COPY_LIMIT_BY_RARITY, DECK_MIN, ORDERS_MAX, POINTS_CAP } from '../engine/deck';
import { nextInt } from '../engine/rng';
import { WW2_CARDS } from '../cards/ww2';

/**
 * A random legal 30-card deck of one nation's cards plus neutral cards. It holds 8 buildings that between
 * them produce every resource, then fills with units and orders within the copy limits, the point cap and
 * the order limit. Used for balance simulation and as the seed for AI opponent decks (docs/05 section 6).
 */
export function buildNationDeck(nation: Nation, rng: { rng: number }, pool: Card[] = WW2_CARDS, owned?: Record<string, number>): Card[] {
  const cards = pool.filter((c) => c.nation === nation || c.nation === 'neutral');
  const deck: Card[] = [];
  const copies = new Map<string, number>();
  let points = 0;
  let orders = 0;

  const tryAdd = (card: Card): boolean => {
    const n = copies.get(card.id) ?? 0;
    if (n >= Math.min(COPY_LIMIT_BY_RARITY[card.rarity], owned ? (owned[card.id] ?? 0) : Infinity)) return false;
    const slotsLeft = Math.max(0, DECK_MIN - deck.length - 1);
    if (points + card.points + slotsLeft * 2 > POINTS_CAP) return false;
    if (card.type === 'order' && orders >= ORDERS_MAX) return false;
    deck.push(card);
    copies.set(card.id, n + 1);
    points += card.points;
    if (card.type === 'order') orders += 1;
    return true;
  };
  const pick = (list: Card[]) => list[nextInt(rng, list.length)]!;

  const buildings = cards.filter((c) => c.type === 'building');
  const produces = (c: Card, r: ResourceType) => c.type === 'building' && (c.produces[r] ?? 0) > 0;
  for (const r of RESOURCE_TYPES) {
    if (deck.some((c) => produces(c, r))) continue;
    const makers = buildings.filter((c) => produces(c, r));
    for (let guard = 0; makers.length > 0 && !deck.some((c) => produces(c, r)) && guard < 200; guard++) tryAdd(pick(makers));
  }
  for (let guard = 0; deck.filter((c) => c.type === 'building').length < 8 && guard < 500; guard++) tryAdd(pick(buildings));

  const rest = cards.filter((c) => c.type !== 'building');
  // Weight towards the nation's own cards so the deck reaches its doctrine threshold.
  const own = rest.filter((c) => c.nation === nation);
  for (let guard = 0; deck.length < DECK_MIN && guard < 8000; guard++) {
    tryAdd(nextInt(rng, 100) < 65 ? pick(own) : pick(rest));
  }
  if (deck.length < DECK_MIN) throw new Error(`could not build a ${nation} deck`);
  return deck;
}
