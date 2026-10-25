import type { Card } from '../engine/types';
import { aircraft, building, order, unit } from './builders';
import { NEUTRAL_CARDS } from './ww2-neutral';
import { USA_CARDS } from './ww2-usa';
import { UK_CARDS } from './ww2-uk';
import { USSR_CARDS } from './ww2-ussr';
import { GERMANY_CARDS } from './ww2-germany';
import { JAPAN_CARDS } from './ww2-japan';

// ---------------------------------------------------------------- buildings

export const BARRACKS = building('barracks', 'Barracks', 'neutral', 'common', { supplies: 1 }, 4, { manpower: 1 });
export const STEEL_MILL = building('steel-mill', 'Steel Mill', 'neutral', 'common', { supplies: 2 }, 5, { steel: 1 });
export const OIL_DERRICK = building('oil-derrick', 'Oil Derrick', 'neutral', 'common', { supplies: 2 }, 3, { fuel: 1 });
export const SUPPLY_DEPOT = building('supply-depot', 'Supply Depot', 'neutral', 'common', { manpower: 1 }, 4, {
  supplies: 1,
});
export const BUNKER = building('bunker', 'Bunker', 'neutral', 'common', { steel: 2 }, 8, {}, { keywords: ['guard'] });

export const FIELD_HOSPITAL = building('field-hospital', 'Field Hospital', 'neutral', 'uncommon', { supplies: 2 }, 4, {}, {
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 1 }],
});
export const REFINERY = building('refinery', 'Refinery', 'neutral', 'uncommon', { supplies: 3, steel: 1 }, 4, { fuel: 2 });
export const ANTI_AIRCRAFT_BATTERY = building(
  'anti-aircraft-battery',
  'Anti-Aircraft Battery',
  'neutral',
  'uncommon',
  { steel: 2, supplies: 1 },
  4,
  {},
  { aa: 2 },
);
export const RAIL_YARD = building('rail-yard', 'Rail Yard', 'ussr', 'uncommon', { supplies: 2, steel: 1 }, 5, {
  supplies: 1,
  manpower: 1,
});

export const RADAR_STATION = building('radar-station', 'Radar Station', 'uk', 'rare', { supplies: 1, steel: 1 }, 5, {}, {
  discounts: [{ applies: { role: 'air' }, resource: 'fuel', amount: 1, oncePerTurn: true }],
});
export const MOTOR_POOL = building('motor-pool', 'Motor Pool', 'usa', 'rare', { supplies: 3, steel: 2 }, 5, {
  fuel: 1,
  steel: 1,
});

export const TANKOGRAD_WORKS = building(
  'tankograd-works',
  'Tankograd Works',
  'ussr',
  'legendary',
  { supplies: 4, steel: 3 },
  8,
  { steel: 2, manpower: 1 },
  { discounts: [{ applies: { role: 'armour' }, resource: 'steel', amount: 1, oncePerTurn: false }] },
);

// -------------------------------------------------------------------- units

// Infantry
export const RIFLE_SQUAD = unit('rifle-squad', 'Rifle Squad', 'neutral', 'common', 'infantry', { manpower: 1 }, 2, 2);
export const CONSCRIPT_PLATOON = unit('conscript-platoon', 'Conscript Platoon', 'ussr', 'common', 'infantry', { manpower: 1 }, 1, 1, {
  keywords: ['mass'],
});
export const GI_RIFLE_SQUAD = unit('gi-rifle-squad', 'GI Rifle Squad', 'usa', 'common', 'infantry', { manpower: 2 }, 3, 3);
export const TOMMY_SECTION = unit('tommy-section', 'Tommy Section', 'uk', 'common', 'infantry', { manpower: 2 }, 2, 3, {
  keywords: ['dugIn'],
});
export const GRENADIER_SQUAD = unit('grenadier-squad', 'Grenadier Squad', 'germany', 'common', 'infantry', { manpower: 2 }, 3, 2, {
  siege: 2,
});
export const IMPERIAL_INFANTRY = unit('imperial-infantry', 'Imperial Infantry', 'japan', 'common', 'infantry', { manpower: 2 }, 3, 2, {
  keywords: ['tenacity'],
});
export const MARKSMAN = unit('marksman', 'Marksman', 'uk', 'uncommon', 'infantry', { manpower: 2, supplies: 1 }, 3, 1, {
  keywords: ['precision'],
});
export const COMBAT_ENGINEER = unit('combat-engineer', 'Combat Engineer', 'usa', 'uncommon', 'infantry', { manpower: 2, steel: 1 }, 2, 3, {
  siege: 2,
  effects: [
    {
      trigger: 'onDeploy',
      do: 'destroyBuilding',
      target: { kind: 'chosen', of: 'enemyBuilding' },
      maxHp: 2,
    },
  ],
});
export const PARATROOPERS = unit('paratroopers', 'Paratroopers', 'usa', 'uncommon', 'infantry', { manpower: 2, fuel: 1 }, 3, 2, {
  keywords: ['blitz'],
});
export const SHOCK_TROOPS = unit('shock-troops', 'Shock Troops', 'germany', 'uncommon', 'infantry', { manpower: 3 }, 4, 3, {
  keywords: ['blitz'],
});
export const GUARDS_RIFLE_DIVISION = unit('guards-rifle-division', 'Guards Rifle Division', 'ussr', 'rare', 'infantry', { manpower: 3, supplies: 1 }, 4, 5, {
  keywords: ['dugIn', 'rally'],
});
export const NAVAL_LANDING_FORCE = unit('naval-landing-force', 'Naval Landing Force', 'japan', 'rare', 'infantry', { manpower: 3, supplies: 1 }, 4, 4, {
  keywords: ['blitz', 'tenacity'],
});

// Armour
export const LIGHT_TANK = unit('light-tank', 'Light Tank', 'neutral', 'common', 'armour', { steel: 2, fuel: 1 }, 2, 3, {
  armour: 1,
});
export const UNIVERSAL_CARRIER = unit('universal-carrier', 'Universal Carrier', 'uk', 'common', 'armour', { steel: 1, fuel: 1 }, 2, 2, {
  armour: 1,
  keywords: ['blitz'],
});
export const TYPE_97_CHI_HA = unit('type-97-chi-ha', 'Type 97 Chi-Ha', 'japan', 'common', 'armour', { steel: 2, fuel: 1 }, 2, 3, {
  armour: 1,
  keywords: ['tenacity'],
});
export const M4_SHERMAN = unit('m4-sherman', 'M4 Sherman', 'usa', 'uncommon', 'armour', { steel: 2, fuel: 1 }, 3, 4, {
  armour: 1,
});
export const T_34 = unit('t-34', 'T-34', 'ussr', 'uncommon', 'armour', { steel: 2, fuel: 2 }, 3, 3, { armour: 2 });
export const PANZER_IV = unit('panzer-iv', 'Panzer IV', 'germany', 'uncommon', 'armour', { steel: 3, fuel: 1 }, 4, 3, {
  armour: 1,
  keywords: ['piercing'],
});
export const CHURCHILL = unit('churchill', 'Churchill', 'uk', 'rare', 'armour', { steel: 3, fuel: 1 }, 2, 6, {
  armour: 3,
  keywords: ['heavy'],
});
export const TIGER_I = unit('tiger-i', 'Tiger I', 'germany', 'rare', 'armour', { steel: 4, fuel: 2 }, 6, 6, {
  armour: 3,
  keywords: ['piercing', 'heavy'],
});
export const IS_2 = unit('is-2', 'IS-2', 'ussr', 'legendary', 'armour', { steel: 5, fuel: 2 }, 7, 8, {
  armour: 3,
  siege: 3,
  keywords: ['piercing', 'heavy'],
});

// Artillery and Anti-Tank
export const MORTAR_TEAM = unit('mortar-team', 'Mortar Team', 'neutral', 'common', 'artillery', { manpower: 1, supplies: 1 }, 2, 1, {
  keywords: ['ranged', 'indirect'],
});
export const ANTI_TANK_GUN = unit('anti-tank-gun', 'Anti-Tank Gun', 'neutral', 'common', 'antiTank', { steel: 2, manpower: 1 }, 3, 2, {
  keywords: ['ranged', 'piercing'],
});
export const TYPE_96_AA_GUN = unit('type-96-aa-gun', 'Type 96 AA Gun', 'japan', 'common', 'artillery', { steel: 2, supplies: 1 }, 2, 2, {
  keywords: ['ranged', 'antiAir'],
});
export const QF_25_POUNDER = unit('25-pounder', '25-pounder', 'uk', 'uncommon', 'artillery', { steel: 2, supplies: 1 }, 3, 2, {
  keywords: ['ranged', 'indirect'],
});
export const HOWITZER_105MM = unit('105mm-howitzer', '105mm Howitzer', 'usa', 'uncommon', 'artillery', { steel: 3, supplies: 1 }, 4, 2, {
  siege: 2,
  keywords: ['ranged', 'indirect'],
});
export const M10_WOLVERINE = unit('m10-wolverine', 'M10 Wolverine', 'usa', 'uncommon', 'antiTank', { steel: 3, fuel: 1 }, 3, 3, {
  armour: 1,
  keywords: ['piercing'],
});
export const FLAK_88 = unit('88mm-flak', '88mm Flak', 'germany', 'rare', 'antiTank', { steel: 3, supplies: 1 }, 4, 3, {
  keywords: ['ranged', 'piercing', 'antiAir'],
});
export const KATYUSHA = unit('katyusha', 'Katyusha', 'ussr', 'rare', 'artillery', { steel: 3, supplies: 2 }, 3, 3, {
  keywords: ['ranged', 'indirect', 'salvo'],
});

// Air
export const BF_109 = aircraft('bf-109', 'Bf 109', 'germany', 'common', { fuel: 2 }, 3, 1, ['fighter']);
export const SPITFIRE = aircraft('spitfire', 'Spitfire', 'uk', 'uncommon', { fuel: 2, steel: 1 }, 3, 3, ['fighter']);
export const STUKA = aircraft('stuka', 'Stuka', 'germany', 'uncommon', { fuel: 2, steel: 1 }, 3, 2, [], { siege: 3 });
export const IL_2_STURMOVIK = aircraft('il-2-sturmovik', 'Il-2 Sturmovik', 'ussr', 'uncommon', { fuel: 2, steel: 2 }, 3, 4, [], {
  armour: 1,
  siege: 2,
});
export const A6M_ZERO = aircraft('a6m-zero', 'A6M Zero', 'japan', 'rare', { fuel: 3 }, 4, 2, ['fighter', 'blitz']);
export const P_51_MUSTANG = aircraft('p-51-mustang', 'P-51 Mustang', 'usa', 'rare', { fuel: 3 }, 4, 3, ['fighter']);
export const B_17_FLYING_FORTRESS = aircraft('b-17-flying-fortress', 'B-17 Flying Fortress', 'usa', 'legendary', { fuel: 4, steel: 2 }, 6, 8, [], {
  siege: 3,
  upkeep: { fuel: 2 },
});

// Support
export const FIELD_MEDIC = unit('field-medic', 'Field Medic', 'neutral', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'lane' }, amount: 1 }],
});
export const FIELD_RADIO_OPERATOR = unit('field-radio-operator', 'Field Radio Operator', 'uk', 'uncommon', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  discounts: [{ applies: 'order', resource: 'supplies', amount: 1, oncePerTurn: true }],
});
export const COMMISSAR = unit('commissar', 'Commissar', 'ussr', 'rare', 'support', { manpower: 2 }, 2, 3, {
  keywords: ['rally'],
});

// ------------------------------------------------------------------- orders

export const AIR_RAID = order('air-raid', 'Air Raid', 'neutral', 'common', { supplies: 2, fuel: 1 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnitOrBuilding' }, amount: 3 },
]);
export const SMOKE_SCREEN = order('smoke-screen', 'Smoke Screen', 'neutral', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'smoke', target: { kind: 'chosen', of: 'friendlyLane' } },
]);
export const REINFORCEMENTS = order('reinforcements', 'Reinforcements', 'neutral', 'common', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'draw', count: 2 },
]);
export const FORCED_MARCH = order('forced-march', 'Forced March', 'neutral', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'chosen', of: 'friendlyUnit' }, keyword: 'blitz' },
]);
export const DIG_IN = order('dig-in', 'Dig In', 'neutral', 'common', { supplies: 1, steel: 1 }, [
  { trigger: 'onPlay', do: 'addMaxHp', target: { kind: 'chosen', of: 'friendlyUnit' }, amount: 2 },
]);
export const SABOTAGE = order('sabotage', 'Sabotage', 'neutral', 'uncommon', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'destroyBuilding', target: { kind: 'chosen', of: 'enemyBuilding' }, maxHp: 4 },
]);
export const NAVAL_BOMBARDMENT = order('naval-bombardment', 'Naval Bombardment', 'neutral', 'uncommon', { supplies: 3, fuel: 2 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'allEnemyFrontUnits' }, amount: 2 },
]);
export const LEND_LEASE = order('lend-lease', 'Lend-Lease', 'usa', 'uncommon', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'gainChosen', target: { kind: 'chosen', of: 'resource' }, amount: 3 },
]);
export const SCORCHED_EARTH = order('scorched-earth', 'Scorched Earth', 'ussr', 'uncommon', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'destroyBuilding', target: { kind: 'chosen', of: 'friendlyBuilding' } },
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyLane' }, amount: 3 },
]);
export const ENIGMA_INTERCEPT = order('enigma-intercept', 'Enigma Intercept', 'uk', 'rare', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'discardRandom', count: 1 },
]);
export const BLITZKRIEG = order('blitzkrieg', 'Blitzkrieg', 'germany', 'rare', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'allFriendlyUnits' }, keyword: 'blitz' },
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 1 },
]);
export const OPERATION_OVERLORD = order('operation-overlord', 'Operation Overlord', 'usa', 'legendary', { supplies: 5 }, [
  { trigger: 'onPlay', do: 'summonFromDeck', role: 'infantry', count: 3 },
]);

/** The 63-card launch core described in docs/03. */
export const CORE_CARDS: Card[] = [
  BARRACKS, STEEL_MILL, OIL_DERRICK, SUPPLY_DEPOT, BUNKER,
  FIELD_HOSPITAL, REFINERY, ANTI_AIRCRAFT_BATTERY, RAIL_YARD,
  RADAR_STATION, MOTOR_POOL, TANKOGRAD_WORKS,
  RIFLE_SQUAD, CONSCRIPT_PLATOON, GI_RIFLE_SQUAD, TOMMY_SECTION, GRENADIER_SQUAD, IMPERIAL_INFANTRY,
  MARKSMAN, COMBAT_ENGINEER, PARATROOPERS, SHOCK_TROOPS, GUARDS_RIFLE_DIVISION, NAVAL_LANDING_FORCE,
  LIGHT_TANK, UNIVERSAL_CARRIER, TYPE_97_CHI_HA, M4_SHERMAN, T_34, PANZER_IV, CHURCHILL, TIGER_I, IS_2,
  MORTAR_TEAM, ANTI_TANK_GUN, TYPE_96_AA_GUN, QF_25_POUNDER, HOWITZER_105MM, M10_WOLVERINE, FLAK_88, KATYUSHA,
  BF_109, SPITFIRE, STUKA, IL_2_STURMOVIK, A6M_ZERO, P_51_MUSTANG, B_17_FLYING_FORTRESS,
  FIELD_MEDIC, FIELD_RADIO_OPERATOR, COMMISSAR,
  AIR_RAID, SMOKE_SCREEN, REINFORCEMENTS, FORCED_MARCH, DIG_IN,
  SABOTAGE, NAVAL_BOMBARDMENT, LEND_LEASE, SCORCHED_EARTH,
  ENIGMA_INTERCEPT, BLITZKRIEG, OPERATION_OVERLORD,
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

/** Every card in set 1. Grows batch by batch towards the 420-card plan (docs/08). */
export const WW2_CARDS: Card[] = [...CORE_CARDS, ...NEUTRAL_CARDS, ...USA_CARDS, ...UK_CARDS, ...USSR_CARDS, ...GERMANY_CARDS, ...JAPAN_CARDS];
