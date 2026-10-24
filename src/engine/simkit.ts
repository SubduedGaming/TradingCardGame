import { expect } from 'vitest';
import { apply, createGame, isTerminal, legalActions } from './game';
import { COPY_LIMIT_BY_RARITY, DECK_MIN, ORDERS_MAX, POINTS_CAP } from './deck';
import { nextInt } from './rng';
import type { Action, Card, GameState, Nation, PlayerId } from './types';
import { BUILDING_SLOTS, RESOURCE_CAP, RESOURCE_TYPES } from './types';
import { actingPlayer } from './testkit';
import { WW2_CARDS } from '../cards/ww2';

export function countCards(s: GameState, player: PlayerId): number {
  const p = s.players[player];
  let units = 0;
  for (const lane of p.lanes) units += (lane.front ? 1 : 0) + (lane.rear ? 1 : 0);
  return p.deck.length + p.hand.length + p.discard.length + p.buildings.length + units;
}

/** Structural invariants that must hold after every action of every game. */
export function expectInvariants(s: GameState, deckSizes: [number, number]): void {
  for (const player of [0, 1] as const) {
    const p = s.players[player];
    for (const r of RESOURCE_TYPES) {
      expect(p.resources[r]).toBeGreaterThanOrEqual(0);
      expect(p.resources[r]).toBeLessThanOrEqual(RESOURCE_CAP);
    }
    expect(p.buildings.length).toBeLessThanOrEqual(BUILDING_SLOTS);
    expect(countCards(s, player)).toBe(deckSizes[player]);
    for (const lane of p.lanes) {
      for (const u of [lane.front, lane.rear]) {
        if (!u) continue;
        expect(u.hp).toBeGreaterThan(0);
        expect(u.hp).toBeLessThanOrEqual(u.maxHp);
        expect(u.owner).toBe(player);
      }
    }
    for (const b of p.buildings) {
      expect(b.hp).toBeGreaterThan(0);
      expect(b.owner).toBe(player);
    }
  }
  const uids = new Set<string>();
  for (const p of s.players) {
    for (const lane of p.lanes) {
      for (const u of [lane.front, lane.rear]) if (u) uids.add(u.uid);
    }
    for (const b of p.buildings) uids.add(b.uid);
  }
  const total =
    s.players.reduce((n, p) => n + p.buildings.length, 0) +
    s.players.reduce((n, p) => n + p.lanes.reduce((m, l) => m + (l.front ? 1 : 0) + (l.rear ? 1 : 0), 0), 0);
  expect(uids.size).toBe(total); // every uid on the board is unique
}

/** A random non-concede legal action, favouring actions that are not "end phase". */
export function pickAction(s: GameState, player: PlayerId, rng: { rng: number }): Action {
  const all = legalActions(s, player).filter((a) => a.type !== 'concede');
  const busy = all.filter((a) => a.type !== 'endMain' && a.type !== 'endTurn');
  const pool = busy.length > 0 && nextInt(rng, 10) < 8 ? busy : all;
  return pool[nextInt(rng, pool.length)]!;
}

export function playRandomGame(
  seed: number,
  decks: [Card[], Card[]],
  doctrines?: [Nation | null | undefined, Nation | null | undefined],
): { final: GameState; actions: Action[] } {
  let s = createGame({ seed, decks, doctrines });
  const sizes: [number, number] = [decks[0].length, decks[1].length];
  const rng = { rng: seed * 7919 + 1 };
  const actions: Action[] = [];
  for (let i = 0; i < 20000 && !isTerminal(s); i++) {
    const action = pickAction(s, actingPlayer(s), rng);
    actions.push(action);
    s = apply(s, action).state;
    expectInvariants(s, sizes);
  }
  return { final: s, actions };
}

/**
 * A random legal 30-card deck from the WW2 set: 7 buildings first, then random cards within the copy
 * limits, the point cap and the order limit. `favour` front-loads cards of one nation (up to 12) so the
 * deck qualifies for that nation's doctrine.
 */
export function randomDeck(rng: { rng: number }, favour?: Nation): Card[] {
  const deck: Card[] = [];
  const copies = new Map<string, number>();
  let points = 0;
  let orders = 0;

  const tryAdd = (card: Card): boolean => {
    const n = copies.get(card.id) ?? 0;
    if (n >= COPY_LIMIT_BY_RARITY[card.rarity]) return false;
    // Keep enough budget (2 points, the cheapest card) for the slots still to fill.
    const slotsLeft = Math.max(0, DECK_MIN - deck.length - 1);
    if (points + card.points + slotsLeft * 2 > POINTS_CAP) return false;
    if (card.type === 'order' && orders >= ORDERS_MAX) return false;
    deck.push(card);
    copies.set(card.id, n + 1);
    points += card.points;
    if (card.type === 'order') orders += 1;
    return true;
  };
  const pickFrom = (pool: Card[]) => pool[nextInt(rng, pool.length)]!;

  const buildings = WW2_CARDS.filter((c) => c.type === 'building');
  for (let guard = 0; deck.filter((c) => c.type === 'building').length < 7 && guard < 500; guard++) {
    tryAdd(pickFrom(buildings));
  }
  if (favour) {
    const own = WW2_CARDS.filter((c) => c.nation === favour && c.type !== 'building');
    for (let guard = 0; deck.filter((c) => c.nation === favour).length < 12 && guard < 2000; guard++) {
      tryAdd(pickFrom(own));
    }
  }
  const rest = WW2_CARDS.filter((c) => c.type !== 'building');
  for (let guard = 0; deck.length < DECK_MIN && guard < 5000; guard++) tryAdd(pickFrom(rest));
  if (deck.length < DECK_MIN) throw new Error('could not build a random deck');
  return deck;
}
