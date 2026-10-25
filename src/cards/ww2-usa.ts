import type { Card } from '../engine/types';
import { aircraft, building, order, unit } from './builders';

/**
 * Batch 2: United States (docs/08 section 6). 59 cards that complete the nation's quota of 70
 * together with the 11 USA cards already in the launch core. Identity: industry, mobility,
 * airpower and logistics. The Industrial Might doctrine rewards building every turn.
 */

// ---------------------------------------------------------------- buildings

const SANDBAG_LINE = building('sandbag-line', 'Sandbag Line', 'usa', 'common', { manpower: 1 }, 6, {}, {
  keywords: ['guard'],
});
const TRAINING_CAMP = building('training-camp', 'Training Camp', 'usa', 'common', { supplies: 2 }, 4, { manpower: 1 }, {
  discounts: [{ applies: { role: 'infantry' }, resource: 'manpower', amount: 1, oncePerTurn: true }],
});
const AIRCRAFT_HANGAR = building('aircraft-hangar', 'Aircraft Hangar', 'usa', 'common', { steel: 2, supplies: 1 }, 5, {}, {
  discounts: [{ applies: { role: 'air' }, resource: 'fuel', amount: 1, oncePerTurn: true }],
});
const FUEL_PIPELINE = building('fuel-pipeline', 'Fuel Pipeline', 'usa', 'common', { steel: 2, supplies: 1 }, 4, { fuel: 1 });
const LIBERTY_SHIPYARD = building('liberty-shipyard', 'Liberty Shipyard', 'usa', 'uncommon', { supplies: 3, steel: 1 }, 5, {
  steel: 1,
  fuel: 1,
});
const EVACUATION_HOSPITAL = building('evacuation-hospital', 'Evacuation Hospital', 'usa', 'uncommon', { manpower: 1, supplies: 2 }, 5, {}, {
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 2 }],
});
const TRAINING_AIRFIELD = building('training-airfield', 'Training Airfield', 'usa', 'uncommon', { steel: 2, supplies: 2 }, 5, { fuel: 1 }, {
  discounts: [{ applies: { role: 'air' }, resource: 'fuel', amount: 1, oncePerTurn: true }],
});
const DETROIT_TANK_ARSENAL = building('detroit-tank-arsenal', 'Detroit Tank Arsenal', 'usa', 'rare', { supplies: 3, steel: 2 }, 6, { steel: 2 }, {
  discounts: [{ applies: { role: 'armour' }, resource: 'steel', amount: 1, oncePerTurn: true }],
});
const NAVAL_BASE = building('naval-base', 'Naval Base', 'usa', 'rare', { steel: 3, supplies: 2 }, 8, { fuel: 1 }, {
  keywords: ['guard'],
});
const PENTAGON = building('pentagon', 'Pentagon', 'usa', 'epic', { steel: 3, supplies: 3 }, 10, { supplies: 2, manpower: 1 });
const ARSENAL_OF_DEMOCRACY = building('arsenal-of-democracy', 'Arsenal of Democracy', 'usa', 'legendary', { steel: 4, supplies: 4 }, 10, {
  steel: 2,
  fuel: 1,
  supplies: 1,
});

// ------------------------------------------------------------------- orders

const CLOSE_AIR_SUPPORT = order('close-air-support', 'Close Air Support', 'usa', 'common', { supplies: 2, fuel: 1 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 4 },
]);
const FUEL_CONVOY = order('fuel-convoy', 'Fuel Convoy', 'usa', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'gain', resource: 'fuel', amount: 2 },
]);
const BAZOOKA_AMBUSH = order('bazooka-ambush', 'Bazooka Ambush', 'usa', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 2, ignoresArmour: true },
]);
const RALLY_THE_TROOPS = order('rally-the-troops', 'Rally the Troops', 'usa', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'chosen', of: 'friendlyUnit' }, amount: 2 },
]);
const HOT_MEAL = order('hot-meal', 'Hot Meal', 'usa', 'common', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'heal', target: { kind: 'chosen', of: 'friendlyUnit' }, amount: 4 },
]);
const DRAFT_CALL_UP = order('draft-call-up', 'Draft Call-up', 'usa', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'gain', resource: 'manpower', amount: 2 },
]);
const CARPET_BOMBING = order('carpet-bombing', 'Carpet Bombing', 'usa', 'uncommon', { supplies: 3, fuel: 2 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyLane' }, amount: 3 },
]);
const AIRDROP_REINFORCEMENTS = order('airdrop-reinforcements', 'Airdrop Reinforcements', 'usa', 'uncommon', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'summonFromDeck', role: 'infantry', count: 1 },
]);
const SHORE_BOMBARDMENT = order('shore-bombardment', 'Shore Bombardment', 'usa', 'uncommon', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyBuilding' }, amount: 5 },
]);
const OPERATION_COBRA = order('operation-cobra', 'Operation Cobra', 'usa', 'rare', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'allFriendlyUnits' }, keyword: 'blitz' },
]);
const MARSHALL_PLAN = order('marshall-plan', 'Marshall Plan', 'usa', 'rare', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'gainChosen', target: { kind: 'chosen', of: 'resource' }, amount: 4 },
]);
const NAPALM_STRIKE = order('napalm-strike', 'Napalm Strike', 'usa', 'rare', { supplies: 3, fuel: 2 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 6 },
]);
const MASS_PRODUCTION = order('mass-production', 'Mass Production', 'usa', 'epic', { supplies: 4 }, [
  { trigger: 'onPlay', do: 'draw', count: 3 },
  { trigger: 'onPlay', do: 'gain', resource: 'steel', amount: 2 },
]);
const MARKET_GARDEN = order('market-garden', 'Operation Market Garden', 'usa', 'epic', { supplies: 5 }, [
  { trigger: 'onPlay', do: 'summonFromDeck', role: 'infantry', count: 2 },
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 1 },
]);

// ----------------------------------------------------------------- infantry

const BAR_TEAM = unit('bar-team', 'BAR Team', 'usa', 'common', 'infantry', { manpower: 2 }, 3, 2, { keywords: ['ranged'] });
const DRAFTEE_PLATOON = unit('draftee-platoon', 'Draftee Platoon', 'usa', 'common', 'infantry', { manpower: 1 }, 2, 1, {
  keywords: ['mass'],
});
const INFANTRY_COMPANY = unit('infantry-company', 'Infantry Company', 'usa', 'common', 'infantry', { manpower: 3 }, 4, 4);
const NATIONAL_GUARD = unit('national-guard', 'National Guard', 'usa', 'common', 'infantry', { manpower: 2 }, 2, 4, {
  keywords: ['dugIn'],
});
const REPLACEMENTS = unit('replacements', 'Replacements', 'usa', 'common', 'infantry', { manpower: 1 }, 1, 1, {
  effects: [{ trigger: 'onDeploy', do: 'gain', resource: 'manpower', amount: 1 }],
});
const MARINE_RAIDERS = unit('marine-raiders', 'Marine Raiders', 'usa', 'uncommon', 'infantry', { manpower: 2, supplies: 1 }, 4, 2, {
  keywords: ['blitz'],
});
const RANGER_BATTALION = unit('ranger-battalion', 'Ranger Battalion', 'usa', 'uncommon', 'infantry', { manpower: 3, supplies: 1 }, 4, 3, {
  keywords: ['piercing'],
});
const BIG_RED_ONE = unit('big-red-one', 'The Big Red One', 'usa', 'rare', 'infantry', { manpower: 4, supplies: 1 }, 5, 5, {
  keywords: ['rally', 'dugIn'],
});

// ------------------------------------------------------------------- armour

const M3_STUART = unit('m3-stuart', 'M3 Stuart', 'usa', 'common', 'armour', { steel: 1, fuel: 1 }, 2, 2, { armour: 1 });
const M8_GREYHOUND = unit('m8-greyhound', 'M8 Greyhound', 'usa', 'common', 'armour', { steel: 1, fuel: 1 }, 1, 3, {
  armour: 1,
  keywords: ['blitz'],
});
const M5_LIGHT_TANK = unit('m5-light-tank', 'M5 Light Tank', 'usa', 'common', 'armour', { steel: 2, fuel: 1 }, 3, 3, { armour: 1 });
const WILLYS_JEEP = unit('willys-jeep', 'Willys Jeep', 'usa', 'common', 'armour', { steel: 1, fuel: 1 }, 1, 2, {
  keywords: ['blitz', 'rally'],
});
const EASY_EIGHT = unit('m4a3e8-easy-eight', 'M4A3E8 Easy Eight', 'usa', 'uncommon', 'armour', { steel: 3, fuel: 1 }, 3, 5, {
  armour: 1,
});
const SHERMAN_JUMBO = unit('sherman-jumbo', 'M4A3E2 Jumbo', 'usa', 'uncommon', 'armour', { steel: 3, fuel: 1 }, 2, 6, { armour: 2 });
const M26_PERSHING = unit('m26-pershing', 'M26 Pershing', 'usa', 'rare', 'armour', { steel: 4, fuel: 2 }, 5, 6, {
  armour: 2,
  keywords: ['piercing'],
});
const M4_CALLIOPE = unit('m4-calliope', 'M4 Calliope', 'usa', 'epic', 'armour', { steel: 3, fuel: 1, supplies: 1 }, 3, 4, {
  armour: 1,
  keywords: ['indirect', 'salvo'],
});

// ------------------------------------------------------ artillery and anti-tank

const PACK_HOWITZER = unit('pack-howitzer', 'Pack Howitzer', 'usa', 'common', 'artillery', { steel: 2, supplies: 1 }, 3, 2, {
  keywords: ['indirect'],
});
const M3_GMC = unit('m3-gmc', 'M3 Gun Motor Carriage', 'usa', 'common', 'antiTank', { steel: 2, fuel: 1 }, 3, 2, {
  keywords: ['ranged', 'piercing'],
});
const QUAD_FIFTY = unit('quad-fifty', 'Quad Fifty', 'usa', 'common', 'artillery', { steel: 1, supplies: 1 }, 2, 2, {
  keywords: ['ranged', 'antiAir'],
});
const BOFORS_40MM = unit('bofors-40mm', 'Bofors 40mm', 'usa', 'common', 'artillery', { steel: 2, supplies: 1 }, 2, 3, {
  keywords: ['ranged', 'antiAir'],
});
const M7_PRIEST = unit('m7-priest', 'M7 Priest', 'usa', 'uncommon', 'artillery', { steel: 3, supplies: 1 }, 3, 3, {
  keywords: ['indirect'],
});
const M12_GMC = unit('m12-gmc', 'M12 Gun Motor Carriage', 'usa', 'rare', 'artillery', { steel: 4, supplies: 2 }, 7, 3, {
  siege: 2,
  keywords: ['ranged'],
});
const M36_JACKSON = unit('m36-jackson', 'M36 Jackson', 'usa', 'epic', 'antiTank', { steel: 3, fuel: 1, supplies: 1 }, 5, 4, {
  armour: 1,
  keywords: ['ranged', 'piercing'],
});

// ---------------------------------------------------------------------- air

const F4F_WILDCAT = aircraft('f4f-wildcat', 'F4F Wildcat', 'usa', 'common', { fuel: 2 }, 3, 1, ['fighter']);
const SBD_DAUNTLESS = aircraft('sbd-dauntless', 'SBD Dauntless', 'usa', 'common', { fuel: 2 }, 3, 1, [], { siege: 2 });
const L4_GRASSHOPPER = aircraft('l-4-grasshopper', 'L-4 Grasshopper', 'usa', 'common', { fuel: 1 }, 1, 2, []);
const P_47_THUNDERBOLT = aircraft('p-47-thunderbolt', 'P-47 Thunderbolt', 'usa', 'uncommon', { fuel: 2, steel: 2 }, 4, 4, [], {
  armour: 1,
  siege: 1,
});
const P_38_LIGHTNING = aircraft('p-38-lightning', 'P-38 Lightning', 'usa', 'rare', { fuel: 3, steel: 1 }, 4, 3, ['fighter'], {
  siege: 1,
});
const B_24_LIBERATOR = aircraft('b-24-liberator', 'B-24 Liberator', 'usa', 'epic', { fuel: 4, steel: 2 }, 6, 6, [], { siege: 2 });

// ------------------------------------------------------------------ support

const SEABEES = unit('seabees', 'Seabees', 'usa', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  discounts: [{ applies: 'building', resource: 'supplies', amount: 1, oncePerTurn: true }],
});
const QUARTERMASTER_CORPS = unit('quartermaster-corps', 'Quartermaster Corps', 'usa', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 3, {
  effects: [{ trigger: 'onDeploy', do: 'gain', resource: 'steel', amount: 1 }],
});
const SIGNAL_CORPS = unit('signal-corps', 'Signal Corps', 'usa', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  effects: [{ trigger: 'onDeploy', do: 'draw', count: 1 }],
});
const ARMY_CHAPLAIN = unit('army-chaplain', 'Army Chaplain', 'usa', 'common', 'support', { manpower: 1, supplies: 2 }, 1, 3, {
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'lane' }, amount: 1 }],
});
const WAR_CORRESPONDENT = unit('war-correspondent', 'War Correspondent', 'usa', 'uncommon', 'support', { manpower: 1, supplies: 2 }, 1, 2, {
  effects: [
    { trigger: 'onDeploy', do: 'draw', count: 1 },
    { trigger: 'onDeploy', do: 'gain', resource: 'supplies', amount: 1 },
  ],
});

export const USA_CARDS: Card[] = [
  SANDBAG_LINE, TRAINING_CAMP, AIRCRAFT_HANGAR, FUEL_PIPELINE,
  LIBERTY_SHIPYARD, EVACUATION_HOSPITAL, TRAINING_AIRFIELD,
  DETROIT_TANK_ARSENAL, NAVAL_BASE, PENTAGON, ARSENAL_OF_DEMOCRACY,
  CLOSE_AIR_SUPPORT, FUEL_CONVOY, BAZOOKA_AMBUSH, RALLY_THE_TROOPS, HOT_MEAL, DRAFT_CALL_UP,
  CARPET_BOMBING, AIRDROP_REINFORCEMENTS, SHORE_BOMBARDMENT,
  OPERATION_COBRA, MARSHALL_PLAN, NAPALM_STRIKE, MASS_PRODUCTION, MARKET_GARDEN,
  BAR_TEAM, DRAFTEE_PLATOON, INFANTRY_COMPANY, NATIONAL_GUARD, REPLACEMENTS,
  MARINE_RAIDERS, RANGER_BATTALION, BIG_RED_ONE,
  M3_STUART, M8_GREYHOUND, M5_LIGHT_TANK, WILLYS_JEEP, EASY_EIGHT, SHERMAN_JUMBO, M26_PERSHING, M4_CALLIOPE,
  PACK_HOWITZER, M3_GMC, QUAD_FIFTY, BOFORS_40MM, M7_PRIEST, M12_GMC, M36_JACKSON,
  F4F_WILDCAT, SBD_DAUNTLESS, L4_GRASSHOPPER, P_47_THUNDERBOLT, P_38_LIGHTNING, B_24_LIBERATOR,
  SEABEES, QUARTERMASTER_CORPS, SIGNAL_CORPS, ARMY_CHAPLAIN, WAR_CORRESPONDENT,
];
