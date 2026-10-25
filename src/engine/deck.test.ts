import { describe, expect, it } from 'vitest';
import { validateCard, validateDeck } from './deck';
import type { Card } from './types';
import { BARRACKS, RIFLE_SQUAD, SABOTAGE, WW2_CARDS, buildStarterDeck } from '../cards/ww2';
import { buildingCard, orderCard, unitCard } from './testkit';

describe('Starter Army', () => {
  it('is a legal 30-card, 60-point army (9 buildings, 15 units, 6 orders)', () => {
    const deck = buildStarterDeck();
    expect(deck).toHaveLength(30);
    expect(deck.reduce((n, c) => n + c.points, 0)).toBe(60);
    expect(deck.filter((c) => c.type === 'building')).toHaveLength(9);
    expect(deck.filter((c) => c.type === 'unit')).toHaveLength(15);
    expect(deck.filter((c) => c.type === 'order')).toHaveLength(6);
    expect(validateDeck(deck)).toEqual([]);
  });
});

describe('validateDeck', () => {
  it('rejects wrong sizes', () => {
    const deck = buildStarterDeck();
    expect(validateDeck(deck.slice(0, 29))).toEqual(expect.arrayContaining([expect.stringMatching(/30-40 cards/)]));
    expect(validateDeck([...deck, ...deck.slice(0, 11)])).toEqual(
      expect.arrayContaining([expect.stringMatching(/30-40 cards/)]),
    );
  });

  it('enforces copy limits by rarity', () => {
    const deck: Card[] = [...buildStarterDeck().slice(0, 29), BARRACKS, BARRACKS, BARRACKS, BARRACKS];
    const errors = validateDeck(deck);
    expect(errors.some((e) => e.includes(BARRACKS.id) && e.includes('limit 3'))).toBe(true);

    const rare = unitCard({ id: 'test.unit.rare', rarity: 'rare', points: 5 });
    const rareDeck = [...buildStarterDeck().slice(0, 27), rare, rare, rare];
    expect(validateDeck(rareDeck).some((e) => e.includes('limit 2'))).toBe(true);
  });

  it('enforces the 100 point cap', () => {
    const legends: Card[] = Array.from({ length: 12 }, (_, i) =>
      unitCard({ id: `test.unit.legend-${i}`, rarity: 'legendary', points: 10 }),
    );
    const deck = [...legends, ...buildStarterDeck().slice(0, 18)];
    expect(deck).toHaveLength(30);
    expect(validateDeck(deck).some((e) => e.includes('points'))).toBe(true);
  });

  it('requires 6-12 buildings and at most 10 orders', () => {
    const noBuildings = Array.from({ length: 30 }, () => RIFLE_SQUAD);
    expect(validateDeck(noBuildings).some((e) => e.includes('buildings'))).toBe(true);

    const ordersDeck: Card[] = [
      ...Array.from({ length: 8 }, (_, i) => buildingCard({ id: `test.building.b${i}` })),
      ...Array.from({ length: 11 }, (_, i) => orderCard({ id: `test.order.o${i}` })),
      ...Array.from({ length: 11 }, (_, i) => unitCard({ id: `test.unit.u${i}` })),
    ];
    expect(validateDeck(ordersDeck).some((e) => e.includes('orders'))).toBe(true);
  });
});

describe('validateCard', () => {
  it('accepts every card in the ww2 data', () => {
    for (const c of WW2_CARDS) expect(validateCard(c)).toEqual([]);
  });

  it('has unique ids across the set', () => {
    const ids = WW2_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rejects bad ids, rarity/points mismatches and zero-cost cards', () => {
    expect(validateCard(unitCard({ id: 'BadId' })).some((e) => e.includes('id must look like'))).toBe(true);
    expect(validateCard(unitCard({ id: 'test.order.x' })).some((e) => e.includes('type segment'))).toBe(true);
    expect(validateCard(unitCard({ rarity: 'rare', points: 2 })).some((e) => e.includes('points'))).toBe(true);
    expect(validateCard(unitCard({ cost: {} })).some((e) => e.includes('at least 1 resource'))).toBe(true);
  });

  it('rejects effects the engine cannot resolve', () => {
    const chosenOnTurnEnd = unitCard({
      effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'chosen', of: 'friendlyUnit' }, amount: 1 }],
    });
    expect(validateCard(chosenOnTurnEnd).some((e) => e.includes('chosen targets'))).toBe(true);

    const selfOrder = orderCard({
      effects: [{ trigger: 'onPlay', do: 'heal', target: { kind: 'self' }, amount: 1 }],
    });
    expect(validateCard(selfOrder).some((e) => e.includes('self target'))).toBe(true);

    expect(validateCard(orderCard({ effects: [] })).some((e) => e.includes('onPlay'))).toBe(true);
    expect(validateCard(buildingCard({ keywords: ['flying'] })).some((e) => e.includes('guard'))).toBe(true);
    expect(validateCard(unitCard({ keywords: ['guard'] })).some((e) => e.includes('guard'))).toBe(true);
  });

  it('keeps Sabotage valid', () => {
    expect(validateCard(SABOTAGE)).toEqual([]);
  });
});
