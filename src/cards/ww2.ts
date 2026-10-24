import type { BuildingCard, Card, OrderCard, UnitCard } from '../engine/types';

const SET = 'ww2';

// ---------------------------------------------------------------- buildings

export const BARRACKS: BuildingCard = {
  id: 'ww2.building.barracks',
  name: 'Barracks',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'building',
  cost: { supplies: 1 },
  hp: 4,
  produces: { manpower: 1 },
  keywords: [],
};

export const STEEL_MILL: BuildingCard = {
  id: 'ww2.building.steel-mill',
  name: 'Steel Mill',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'building',
  cost: { supplies: 2 },
  hp: 5,
  produces: { steel: 1 },
  keywords: [],
};

export const OIL_DERRICK: BuildingCard = {
  id: 'ww2.building.oil-derrick',
  name: 'Oil Derrick',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'building',
  cost: { supplies: 2 },
  hp: 3,
  produces: { fuel: 1 },
  keywords: [],
};

export const SUPPLY_DEPOT: BuildingCard = {
  id: 'ww2.building.supply-depot',
  name: 'Supply Depot',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'building',
  cost: { manpower: 1 },
  hp: 4,
  produces: { supplies: 1 },
  keywords: [],
};

export const BUNKER: BuildingCard = {
  id: 'ww2.building.bunker',
  name: 'Bunker',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'building',
  cost: { steel: 2 },
  hp: 8,
  produces: {},
  keywords: ['guard'],
};

export const ANTI_AIRCRAFT_BATTERY: BuildingCard = {
  id: 'ww2.building.anti-aircraft-battery',
  name: 'Anti-Aircraft Battery',
  set: SET,
  nation: 'neutral',
  rarity: 'uncommon',
  points: 3,
  type: 'building',
  cost: { steel: 2, supplies: 1 },
  hp: 4,
  produces: {},
  keywords: [],
  aa: 2,
};

export const FIELD_HOSPITAL: BuildingCard = {
  id: 'ww2.building.field-hospital',
  name: 'Field Hospital',
  set: SET,
  nation: 'neutral',
  rarity: 'uncommon',
  points: 3,
  type: 'building',
  cost: { supplies: 2 },
  hp: 4,
  produces: {},
  keywords: [],
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 1 }],
};

// -------------------------------------------------------------------- units

export const RIFLE_SQUAD: UnitCard = {
  id: 'ww2.unit.rifle-squad',
  name: 'Rifle Squad',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'unit',
  role: 'infantry',
  cost: { manpower: 1 },
  attack: 2,
  hp: 2,
  keywords: [],
};

export const LIGHT_TANK: UnitCard = {
  id: 'ww2.unit.light-tank',
  name: 'Light Tank',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'unit',
  role: 'armour',
  cost: { steel: 2, fuel: 1 },
  attack: 2,
  hp: 3,
  armour: 1,
  keywords: [],
};

export const MORTAR_TEAM: UnitCard = {
  id: 'ww2.unit.mortar-team',
  name: 'Mortar Team',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'unit',
  role: 'artillery',
  cost: { manpower: 1, supplies: 1 },
  attack: 2,
  hp: 1,
  keywords: ['ranged', 'indirect'],
};

export const ANTI_TANK_GUN: UnitCard = {
  id: 'ww2.unit.anti-tank-gun',
  name: 'Anti-Tank Gun',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'unit',
  role: 'antiTank',
  cost: { steel: 2, manpower: 1 },
  attack: 3,
  hp: 2,
  keywords: ['ranged', 'piercing'],
};

export const FIELD_MEDIC: UnitCard = {
  id: 'ww2.unit.field-medic',
  name: 'Field Medic',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'unit',
  role: 'support',
  cost: { manpower: 1, supplies: 1 },
  attack: 1,
  hp: 2,
  keywords: [],
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'lane' }, amount: 1 }],
};

// ------------------------------------------------------------------- orders

export const REINFORCEMENTS: OrderCard = {
  id: 'ww2.order.reinforcements',
  name: 'Reinforcements',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'order',
  cost: { supplies: 2 },
  effects: [{ trigger: 'onPlay', do: 'draw', count: 2 }],
};

export const FORCED_MARCH: OrderCard = {
  id: 'ww2.order.forced-march',
  name: 'Forced March',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'order',
  cost: { supplies: 1 },
  effects: [
    { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'chosen', of: 'friendlyUnit' }, keyword: 'blitz' },
  ],
};

export const SMOKE_SCREEN: OrderCard = {
  id: 'ww2.order.smoke-screen',
  name: 'Smoke Screen',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'order',
  cost: { supplies: 1 },
  effects: [{ trigger: 'onPlay', do: 'smoke', target: { kind: 'chosen', of: 'friendlyLane' } }],
};

export const AIR_RAID: OrderCard = {
  id: 'ww2.order.air-raid',
  name: 'Air Raid',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'order',
  cost: { supplies: 2, fuel: 1 },
  effects: [
    {
      trigger: 'onPlay',
      do: 'damage',
      target: { kind: 'chosen', of: 'enemyUnitOrBuilding' },
      amount: 3,
    },
  ],
};

export const DIG_IN: OrderCard = {
  id: 'ww2.order.dig-in',
  name: 'Dig In',
  set: SET,
  nation: 'neutral',
  rarity: 'common',
  points: 2,
  type: 'order',
  cost: { supplies: 1, steel: 1 },
  effects: [{ trigger: 'onPlay', do: 'addMaxHp', target: { kind: 'chosen', of: 'friendlyUnit' }, amount: 2 }],
};

export const SABOTAGE: OrderCard = {
  id: 'ww2.order.sabotage',
  name: 'Sabotage',
  set: SET,
  nation: 'neutral',
  rarity: 'uncommon',
  points: 3,
  type: 'order',
  cost: { supplies: 2 },
  effects: [
    {
      trigger: 'onPlay',
      do: 'destroyBuilding',
      target: { kind: 'chosen', of: 'enemyBuilding' },
      maxHp: 4,
    },
  ],
};

export const WW2_CARDS: Card[] = [
  BARRACKS,
  STEEL_MILL,
  OIL_DERRICK,
  SUPPLY_DEPOT,
  BUNKER,
  ANTI_AIRCRAFT_BATTERY,
  FIELD_HOSPITAL,
  RIFLE_SQUAD,
  LIGHT_TANK,
  MORTAR_TEAM,
  ANTI_TANK_GUN,
  FIELD_MEDIC,
  REINFORCEMENTS,
  FORCED_MARCH,
  SMOKE_SCREEN,
  AIR_RAID,
  DIG_IN,
  SABOTAGE,
];

/** The 30-card Starter Army from docs/03. */
export const STARTER_ARMY: readonly [Card, number][] = [
  [BARRACKS, 3],
  [SUPPLY_DEPOT, 2],
  [STEEL_MILL, 2],
  [OIL_DERRICK, 1],
  [BUNKER, 1],
  [RIFLE_SQUAD, 3],
  [LIGHT_TANK, 3],
  [MORTAR_TEAM, 3],
  [ANTI_TANK_GUN, 3],
  [FIELD_MEDIC, 3],
  [REINFORCEMENTS, 2],
  [FORCED_MARCH, 1],
  [SMOKE_SCREEN, 1],
  [DIG_IN, 1],
  [AIR_RAID, 1],
];

export function buildStarterDeck(): Card[] {
  return STARTER_ARMY.flatMap(([card, n]) => Array.from({ length: n }, () => card));
}
