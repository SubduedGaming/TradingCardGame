import { describe, expect, it } from 'vitest';
import { WW2_CARDS } from './ww2';
import {
  NATIONS,
  RARITY_QUOTA,
  ROLE_QUOTA,
  SET_SIZE,
  TYPE_QUOTA,
  planTotal,
  remaining,
  scopeOf,
  scopeTotal,
  tally,
} from './plan';
import { RARITIES } from '../engine/types';
import type { Nation } from '../engine/types';

const ALL: Nation[] = ['neutral', ...NATIONS];

describe('the plan itself', () => {
  it('adds up to the set size', () => {
    expect(planTotal()).toBe(SET_SIZE);
    expect(SET_SIZE).toBeGreaterThanOrEqual(400);
  });

  it('has the same total in each breakdown (rarity, type, role) for every scope', () => {
    for (const scope of ['neutral', 'nation'] as const) {
      const byRarity = scopeTotal(scope);
      expect(Object.values(TYPE_QUOTA[scope]).reduce((a, b) => a + b, 0)).toBe(byRarity);
      expect(TYPE_QUOTA[scope].unit).toBe(Object.values(ROLE_QUOTA[scope]).reduce((a, b) => a + b, 0));
    }
  });

  it('is a steep pyramid: every tier is strictly scarcer than the one below it, overall', () => {
    const total = (r: (typeof RARITIES)[number]) =>
      RARITY_QUOTA.neutral[r] + NATIONS.length * RARITY_QUOTA.nation[r];
    const counts = RARITIES.map(total);
    for (let i = 1; i < counts.length; i++) expect(counts[i]!).toBeLessThan(counts[i - 1]!);
    expect(counts[0]!).toBeGreaterThanOrEqual(counts[4]! * 8); // commons outnumber legendaries 8:1 or more
  });

  it('never has more Legendaries than Epics or more Epics than Rares in any scope', () => {
    for (const scope of ['neutral', 'nation'] as const) {
      const q = RARITY_QUOTA[scope];
      expect(q.legendary).toBeLessThanOrEqual(q.epic);
      expect(q.epic).toBeLessThan(q.rare);
      expect(q.rare).toBeLessThan(q.uncommon);
      expect(q.uncommon).toBeLessThan(q.common);
    }
  });
});

describe('set 1 progress against the plan', () => {
  const counts = tally(WW2_CARDS);

  for (const nation of ALL) {
    it(`${nation} does not exceed any quota`, () => {
      const scope = scopeOf(nation);
      const c = counts[nation];
      for (const r of RARITIES) expect(c.rarity[r], `${nation} ${r}`).toBeLessThanOrEqual(RARITY_QUOTA[scope][r]);
      for (const t of ['building', 'unit', 'order'] as const) {
        expect(c.type[t], `${nation} ${t}`).toBeLessThanOrEqual(TYPE_QUOTA[scope][t]);
      }
      for (const role of Object.keys(ROLE_QUOTA[scope]) as (keyof (typeof ROLE_QUOTA)['neutral'])[]) {
        expect(c.role[role], `${nation} ${role}`).toBeLessThanOrEqual(ROLE_QUOTA[scope][role]);
      }
    });
  }

  it('batch 1: the neutral quota is filled exactly', () => {
    const c = counts.neutral;
    expect(c.total).toBe(70);
    expect(c.rarity).toEqual(RARITY_QUOTA.neutral);
    expect(c.type).toEqual(TYPE_QUOTA.neutral);
    expect(c.role).toEqual(ROLE_QUOTA.neutral);
  });

  it('batch 2: the USA quota is filled exactly', () => {
    const c = counts.usa;
    expect(c.total).toBe(70);
    expect(c.rarity).toEqual(RARITY_QUOTA.nation);
    expect(c.type).toEqual(TYPE_QUOTA.nation);
    expect(c.role).toEqual(ROLE_QUOTA.nation);
  });

  it('batch 3: the UK quota is filled exactly', () => {
    const c = counts.uk;
    expect(c.total).toBe(70);
    expect(c.rarity).toEqual(RARITY_QUOTA.nation);
    expect(c.type).toEqual(TYPE_QUOTA.nation);
    expect(c.role).toEqual(ROLE_QUOTA.nation);
  });

  it('batch 4: the USSR quota is filled exactly', () => {
    const c = counts.ussr;
    expect(c.total).toBe(70);
    expect(c.rarity).toEqual(RARITY_QUOTA.nation);
    expect(c.type).toEqual(TYPE_QUOTA.nation);
    expect(c.role).toEqual(ROLE_QUOTA.nation);
  });

  it('batch 5: the Germany quota is filled exactly', () => {
    const c = counts.germany;
    expect(c.total).toBe(70);
    expect(c.rarity).toEqual(RARITY_QUOTA.nation);
    expect(c.type).toEqual(TYPE_QUOTA.nation);
    expect(c.role).toEqual(ROLE_QUOTA.nation);
  });

  it('batch 6: the Japan quota is filled exactly', () => {
    const c = counts.japan;
    expect(c.total).toBe(70);
    expect(c.rarity).toEqual(RARITY_QUOTA.nation);
    expect(c.type).toEqual(TYPE_QUOTA.nation);
    expect(c.role).toEqual(ROLE_QUOTA.nation);
  });

  it('the whole set is exactly the planned size', () => {
    expect(WW2_CARDS.length).toBe(SET_SIZE);
    expect(new Set(WW2_CARDS.map((c) => c.id)).size).toBe(SET_SIZE);
    expect(new Set(WW2_CARDS.map((c) => c.name)).size).toBe(SET_SIZE);
  });

  it('reports exactly what is still to write', () => {
    const left = remaining(WW2_CARDS);
    const missing = ALL.reduce((n, nation) => n + Object.values(left[nation]).reduce((a, b) => a + b, 0), 0);
    expect(missing + WW2_CARDS.length).toBe(SET_SIZE);
  });
});
