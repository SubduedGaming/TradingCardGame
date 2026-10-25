import type {
  BuildingCard,
  Effect,
  Keyword,
  Nation,
  OrderCard,
  Rarity,
  Resources,
  Role,
  UnitCard,
} from '../engine/types';
import { POINTS_BY_RARITY } from '../engine/deck';

export const SET = 'ww2';

export type Cost = Partial<Resources>;

export function building(
  slug: string,
  name: string,
  nation: Nation,
  rarity: Rarity,
  cost: Cost,
  hp: number,
  produces: Cost,
  extra: Partial<BuildingCard> = {},
): BuildingCard {
  return {
    id: `${SET}.building.${slug}`,
    name,
    set: SET,
    nation,
    rarity,
    points: POINTS_BY_RARITY[rarity],
    type: 'building',
    cost,
    hp,
    produces,
    keywords: [],
    ...extra,
  };
}

export function unit(
  slug: string,
  name: string,
  nation: Nation,
  rarity: Rarity,
  role: Role,
  cost: Cost,
  attack: number,
  hp: number,
  extra: Partial<UnitCard> = {},
): UnitCard {
  return {
    id: `${SET}.unit.${slug}`,
    name,
    set: SET,
    nation,
    rarity,
    points: POINTS_BY_RARITY[rarity],
    type: 'unit',
    role,
    cost,
    attack,
    hp,
    keywords: [],
    ...extra,
  };
}

/** Air units are Flying and pay Fuel upkeep (1 unless stated). */
export function aircraft(
  slug: string,
  name: string,
  nation: Nation,
  rarity: Rarity,
  cost: Cost,
  attack: number,
  hp: number,
  keywords: Keyword[],
  extra: Partial<UnitCard> = {},
): UnitCard {
  return unit(slug, name, nation, rarity, 'air', cost, attack, hp, {
    keywords: ['flying', ...keywords],
    upkeep: { fuel: 1 },
    ...extra,
  });
}

export function order(
  slug: string,
  name: string,
  nation: Nation,
  rarity: Rarity,
  cost: Cost,
  effects: Effect[],
): OrderCard {
  return {
    id: `${SET}.order.${slug}`,
    name,
    set: SET,
    nation,
    rarity,
    points: POINTS_BY_RARITY[rarity],
    type: 'order',
    cost,
    effects,
  };
}
