import type { Card, Nation, Rarity, Role } from '../engine/types';

/**
 * The card plan for a full set (docs/08-set-plan.md). Quotas are ceilings that batches fill up to;
 * set-plan.test.ts fails if a batch overshoots one, and the progress report shows what is still missing.
 */
export const SET_SIZE = 420;

export type PlanScope = 'neutral' | 'nation';
export type RoleGroup = 'infantry' | 'armour' | 'artillery' | 'air' | 'support';

/** Steep pyramid: each tier is much scarcer than the one below it. Totals 420. */
export const RARITY_QUOTA: Record<PlanScope, Record<Rarity, number>> = {
  neutral: { common: 35, uncommon: 20, rare: 10, epic: 5, legendary: 0 },
  nation: { common: 31, uncommon: 19, rare: 11, epic: 6, legendary: 3 },
};

export const TYPE_QUOTA: Record<PlanScope, Record<Card['type'], number>> = {
  neutral: { building: 16, unit: 44, order: 10 },
  nation: { building: 12, unit: 42, order: 16 },
};

/** Units only. Anti-Tank counts with artillery. */
export const ROLE_QUOTA: Record<PlanScope, Record<RoleGroup, number>> = {
  neutral: { infantry: 10, armour: 8, artillery: 12, air: 6, support: 8 },
  nation: { infantry: 11, armour: 9, artillery: 9, air: 8, support: 5 },
};

export const NATIONS: readonly Nation[] = ['usa', 'uk', 'ussr', 'germany', 'japan'];

export function scopeOf(nation: Nation): PlanScope {
  return nation === 'neutral' ? 'neutral' : 'nation';
}

export function roleGroup(role: Role): RoleGroup {
  return role === 'antiTank' ? 'artillery' : role;
}

export function scopeTotal(scope: PlanScope): number {
  return Object.values(RARITY_QUOTA[scope]).reduce((a, b) => a + b, 0);
}

export function planTotal(): number {
  return scopeTotal('neutral') + NATIONS.length * scopeTotal('nation');
}

export interface Tally {
  rarity: Record<Rarity, number>;
  type: Record<Card['type'], number>;
  role: Record<RoleGroup, number>;
  total: number;
}

export function emptyTally(): Tally {
  return {
    rarity: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
    type: { building: 0, unit: 0, order: 0 },
    role: { infantry: 0, armour: 0, artillery: 0, air: 0, support: 0 },
    total: 0,
  };
}

/** Counts a card list against the plan, per nation. */
export function tally(cards: Card[]): Record<Nation, Tally> {
  const out = {
    neutral: emptyTally(),
    usa: emptyTally(),
    uk: emptyTally(),
    ussr: emptyTally(),
    germany: emptyTally(),
    japan: emptyTally(),
  };
  for (const c of cards) {
    const t = out[c.nation];
    t.rarity[c.rarity] += 1;
    t.type[c.type] += 1;
    if (c.type === 'unit') t.role[roleGroup(c.role)] += 1;
    t.total += 1;
  }
  return out;
}

/** What is still missing, per nation and tier (never negative). */
export function remaining(cards: Card[]): Record<Nation, Record<Rarity, number>> {
  const counts = tally(cards);
  const out = {} as Record<Nation, Record<Rarity, number>>;
  for (const nation of ['neutral', ...NATIONS] as Nation[]) {
    const quota = RARITY_QUOTA[scopeOf(nation)];
    const have = counts[nation].rarity;
    out[nation] = {
      common: Math.max(0, quota.common - have.common),
      uncommon: Math.max(0, quota.uncommon - have.uncommon),
      rare: Math.max(0, quota.rare - have.rare),
      epic: Math.max(0, quota.epic - have.epic),
      legendary: Math.max(0, quota.legendary - have.legendary),
    };
  }
  return out;
}
