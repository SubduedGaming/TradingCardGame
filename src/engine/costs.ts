import type { Card, CostDiscount, GameState, PlayerId, Resources } from './types';
import { RESOURCE_TYPES } from './types';
import { DOCTRINE_DISCOUNTS } from './doctrine';
import { unitsOf } from './stats';
import { canAfford, pay } from './zones';

export interface CostQuote {
  cost: Partial<Resources>;
  /** Once-per-turn discount keys this purchase would use up. */
  used: string[];
}

interface DiscountSource {
  key: string;
  discount: CostDiscount;
}

function sourcesFor(state: GameState, player: PlayerId): DiscountSource[] {
  const p = state.players[player];
  const out: DiscountSource[] = [];
  const add = (prefix: string, discounts: CostDiscount[] | undefined) =>
    discounts?.forEach((discount, i) => out.push({ key: `${prefix}#${i}`, discount }));

  for (const b of p.buildings) add(b.uid, b.card.discounts);
  for (const { unit } of unitsOf(state, player)) add(unit.uid, unit.card.discounts);
  if (p.doctrine) add(`doctrine:${p.doctrine}`, DOCTRINE_DISCOUNTS[p.doctrine]);
  return out;
}

function matches(discount: CostDiscount, card: Card): boolean {
  const a = discount.applies;
  if (a === 'order') return card.type === 'order';
  if (a === 'building') return card.type === 'building';
  return card.type === 'unit' && card.role === a.role;
}

/** What `card` costs `player` right now, after discounts. Never below 1 resource in total. */
export function quoteCost(state: GameState, player: PlayerId, card: Card): CostQuote {
  const p = state.players[player];
  const cost: Partial<Resources> = { ...card.cost };
  const used: string[] = [];
  const total = () => RESOURCE_TYPES.reduce((n, r) => n + (cost[r] ?? 0), 0);
  const unitCount = unitsOf(state, player).length;

  for (const { key, discount } of sourcesFor(state, player)) {
    if (!matches(discount, card)) continue;
    if (discount.minUnits !== undefined && unitCount < discount.minUnits) continue;
    if (discount.oncePerTurn && p.discountsUsed.includes(key)) continue;
    const have = cost[discount.resource] ?? 0;
    const cut = Math.min(discount.amount, have, total() - 1);
    if (cut <= 0) continue;
    if (have - cut === 0) delete cost[discount.resource];
    else cost[discount.resource] = have - cut;
    if (discount.oncePerTurn) used.push(key);
  }
  return { cost, used };
}

export function canPlay(state: GameState, player: PlayerId, card: Card): boolean {
  return canAfford(state.players[player].resources, quoteCost(state, player, card).cost);
}

/** Pays a quote and marks its once-per-turn discounts as used. */
export function payQuote(state: GameState, player: PlayerId, quote: CostQuote): void {
  const p = state.players[player];
  pay(p.resources, quote.cost);
  p.discountsUsed.push(...quote.used);
}
