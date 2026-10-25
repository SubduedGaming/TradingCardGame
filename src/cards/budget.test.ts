import { describe, expect, it } from 'vitest';
import { WW2_CARDS } from './ww2';
import { budgetBand, budgetResidual, cardPower, costValue, effectPower, RARITY_PREMIUM, unitPower } from './budget';
import { RARITIES } from '../engine/types';
import { unitCard } from '../engine/testkit';

describe('power budget', () => {
  for (const card of WW2_CARDS) {
    it(`${card.name} is within budget for its cost and rarity`, () => {
      const { min, max } = budgetBand(card);
      const r = budgetResidual(card);
      expect(r, `${card.id}: residual ${r.toFixed(2)} outside [${min}, ${max}]`).toBeGreaterThanOrEqual(min);
      expect(r, `${card.id}: residual ${r.toFixed(2)} outside [${min}, ${max}]`).toBeLessThanOrEqual(max);
    });
  }

  it('grants strictly more budget to each higher rarity tier', () => {
    const premiums = RARITIES.map((r) => RARITY_PREMIUM[r]);
    for (let i = 1; i < premiums.length; i++) expect(premiums[i]!).toBeGreaterThan(premiums[i - 1]!);
  });

  it('prices scarcer resources higher', () => {
    expect(costValue({ fuel: 1 })).toBeGreaterThan(costValue({ manpower: 1 }));
    expect(costValue({ steel: 2, fuel: 1 })).toBeGreaterThan(costValue({ manpower: 2 }));
  });

  it('values stats, defence and evasion monotonically', () => {
    const base = unitCard({ attack: 2, hp: 2 });
    expect(unitPower({ ...base, attack: 3 })).toBeGreaterThan(unitPower(base));
    expect(unitPower({ ...base, hp: 3 })).toBeGreaterThan(unitPower(base));
    expect(unitPower({ ...base, armour: 1 })).toBeGreaterThan(unitPower(base));
    expect(unitPower({ ...base, keywords: ['flying'] })).toBeGreaterThan(unitPower(base));
    expect(unitPower({ ...base, upkeep: { fuel: 1 } })).toBeLessThan(unitPower(base));
    expect(unitPower({ ...base, keywords: ['heavy'] })).toBeLessThan(unitPower(base));
  });

  it('does not count a keyword twice when another keyword implies it', () => {
    const plain = unitCard({ keywords: ['fighter'] });
    const redundant = unitCard({ keywords: ['fighter', 'flying', 'antiAir'] });
    expect(unitPower(redundant)).toBe(unitPower(plain));
  });

  it('treats sacrificing your own building as a cost', () => {
    const own = effectPower({ trigger: 'onPlay', do: 'destroyBuilding', target: { kind: 'chosen', of: 'friendlyBuilding' } });
    const theirs = effectPower({ trigger: 'onPlay', do: 'destroyBuilding', target: { kind: 'chosen', of: 'enemyBuilding' } });
    expect(own).toBeLessThan(0);
    expect(theirs).toBeGreaterThan(0);
  });

  it('gives every card a finite power', () => {
    for (const c of WW2_CARDS) expect(Number.isFinite(cardPower(c))).toBe(true);
  });
});
