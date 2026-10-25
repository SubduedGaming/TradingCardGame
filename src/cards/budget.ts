import type {
  BuildingCard,
  Card,
  CostDiscount,
  Effect,
  Keyword,
  OrderCard,
  Rarity,
  Resources,
  UnitCard,
} from '../engine/types';
import { RESOURCE_TYPES } from '../engine/types';

/**
 * Power-budget model. Every card gets a "cost" (what it takes to play) and a "power" (what it gives),
 * on one scale, so cards can be compared and new cards can be checked against the curve.
 * Constants are calibrated against set 1 (see budget.test.ts) and are not game rules.
 */

/** Relative scarcity of each resource. Fuel and Steel are scarcer than Manpower and Supplies. */
export const RESOURCE_WEIGHT: Record<keyof Resources, number> = {
  manpower: 1,
  steel: 1,
  fuel: 1.25,
  supplies: 1,
};

export function costValue(cost: Partial<Resources>): number {
  return RESOURCE_TYPES.reduce((n, r) => n + (cost[r] ?? 0) * RESOURCE_WEIGHT[r], 0);
}

const KEYWORD_VALUE: Record<Keyword, number> = {
  blitz: 1,
  piercing: 1,
  ranged: 1,
  indirect: 1.8, // includes ranged (1)
  precision: 1.8, // includes ranged (1)
  flying: 2,
  antiAir: 0.7,
  fighter: 3.5, // includes flying (2) and antiAir (0.7)
  tenacity: 1,
  dugIn: 0.7,
  heavy: -0.7,
  mass: 0.5,
  salvo: 2.5,
  rally: 1,
  guard: 2,
};

/** Keywords implied by another keyword are not counted twice. */
const IMPLIED: Partial<Record<Keyword, Keyword[]>> = {
  fighter: ['flying', 'antiAir'],
  indirect: ['ranged'],
  precision: ['ranged'],
};

function keywordPower(keywords: Keyword[]): number {
  const implied = new Set<Keyword>(keywords.flatMap((k) => IMPLIED[k] ?? []));
  return keywords.reduce((n, k) => n + (implied.has(k) ? 0 : KEYWORD_VALUE[k]), 0);
}

function discountPower(discounts: CostDiscount[] | undefined): number {
  return (discounts ?? []).reduce((n, d) => n + d.amount * (d.oncePerTurn ? 1 : 2) * RESOURCE_WEIGHT[d.resource], 0);
}

/** Armour is worth more on a sturdier body: it multiplies how many hits the unit survives. */
function armourPower(armour: number, hp: number): number {
  return armour * (0.6 + 0.1 * hp);
}

const SIEGE_VALUE = 0.6;
const UPKEEP_PENALTY = 1;

/** Value of a single effect, per use (triggers that repeat every turn count for several turns). */
export function effectPower(effect: Effect): number {
  const repeat = effect.trigger === 'startOfTurn' || effect.trigger === 'endOfTurn' ? 3 : 1;
  switch (effect.do) {
    case 'damage': {
      const wide = effect.target.kind === 'allEnemyFrontUnits' ? 2.5 : effect.target.kind === 'chosen' && effect.target.of === 'enemyLane' ? 2 : 1;
      return effect.amount * 1.1 * wide * repeat;
    }
    case 'heal':
      return effect.amount * 0.8 * repeat;
    case 'draw':
      return effect.count * 1.7;
    case 'gain':
      return effect.amount * 0.9 * repeat;
    case 'gainChosen':
      return effect.amount * 1.0;
    case 'addMaxHp':
      return effect.amount * 1.0;
    case 'modifyAttack':
      return effect.amount * (effect.target.kind === 'allFriendlyUnits' ? 2 : 1);
    case 'grantKeyword':
      return effect.target.kind === 'allFriendlyUnits' ? 3 : 1.5;
    case 'destroyBuilding':
      // Sacrificing one of your own buildings is a cost, not a gain.
      return effect.target.kind === 'chosen' && effect.target.of === 'friendlyBuilding'
        ? -2
        : 1.2 + (effect.maxHp ?? 8) * 0.25;
    case 'smoke':
      return 1.5;
    case 'discardRandom':
      return effect.count * 2.2;
    case 'summonFromDeck':
      return effect.count * 2.2;
  }
}

function effectsPower(effects: Effect[] | undefined): number {
  return (effects ?? []).reduce((n, e) => n + effectPower(e), 0);
}

export function unitPower(c: UnitCard): number {
  const upkeep = Object.entries(c.upkeep ?? {}).reduce((n, [, v]) => n + (v ?? 0) * UPKEEP_PENALTY, 0);
  return (
    c.attack +
    c.hp +
    armourPower(c.armour ?? 0, c.hp) +
    (c.siege ?? 0) * SIEGE_VALUE +
    keywordPower(c.keywords) -
    upkeep +
    effectsPower(c.effects) +
    discountPower(c.discounts)
  );
}

/** Buildings are judged on what they produce over a few turns plus durability and utility. */
export function buildingPower(c: BuildingCard): number {
  const production = RESOURCE_TYPES.reduce((n, r) => n + (c.produces[r] ?? 0) * RESOURCE_WEIGHT[r], 0);
  return (
    production * 3 +
    c.hp * 0.35 +
    keywordPower(c.keywords) +
    (c.aa ?? 0) * 1.4 +
    effectsPower(c.effects) +
    discountPower(c.discounts) * 1.5
  );
}

export function orderPower(c: OrderCard): number {
  return effectsPower(c.effects);
}

export function cardPower(card: Card): number {
  return card.type === 'unit' ? unitPower(card) : card.type === 'building' ? buildingPower(card) : orderPower(card);
}

/**
 * Extra power each rarity tier is allowed over a Common of the same cost. Higher tiers are more
 * complex and more game-changing, so they are budgeted more generously.
 */
export const RARITY_PREMIUM: Record<Rarity, number> = {
  common: 0,
  uncommon: 0.5,
  rare: 1,
  epic: 1.8,
  legendary: 3,
};

/** Power a card is expected to have at its cost and rarity (the fitted curve from set 1). */
export function expectedPower(card: Card): number {
  const c = costValue(card.cost);
  const premium = RARITY_PREMIUM[card.rarity];
  switch (card.type) {
    case 'unit':
      // Expensive units are allowed to be disproportionately strong.
      return 1.15 + 1.7 * c + 0.5 * Math.max(0, c - 4) + premium;
    case 'building':
      return 2 + 1.25 * c + premium;
    case 'order':
      return 1.45 + 0.55 * c + premium;
  }
}

export function budgetResidual(card: Card): number {
  return cardPower(card) - expectedPower(card);
}

/** Allowed residual range. Cards below `min` are too weak for their cost, above `max` too strong. */
export function budgetBand(card: Card): { min: number; max: number } {
  switch (card.type) {
    case 'unit':
      return { min: -2.5, max: 3 };
    case 'building':
      return { min: -2.5, max: 2.5 };
    case 'order':
      return { min: -2, max: 2 };
  }
}
