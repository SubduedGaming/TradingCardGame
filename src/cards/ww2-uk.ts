import type { Card } from '../engine/types';
import { aircraft, building, order, unit } from './builders';

/**
 * Batch 3: United Kingdom (docs/08 section 6). 61 cards that complete the nation's quota of 70
 * together with the 9 UK cards already in the launch core. Identity: stubborn defence, healing,
 * intelligence and the RAF. The Resolve doctrine rewards units deployed while the HQ is hurt.
 */

// ---------------------------------------------------------------- buildings

const ANDERSON_SHELTER = building('anderson-shelter', 'Anderson Shelter', 'uk', 'common', { manpower: 1, supplies: 1 }, 6, {}, {
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 1 }],
});
const ACK_ACK_POST = building('ack-ack-post', 'Ack-Ack Post', 'uk', 'common', { steel: 1, supplies: 1 }, 5, {}, { aa: 1 });
const NAAFI_CANTEEN = building('naafi-canteen', 'NAAFI Canteen', 'uk', 'common', { manpower: 1, supplies: 1 }, 5, { supplies: 1 });
const WELSH_COLLIERY = building('welsh-colliery', 'Welsh Colliery', 'uk', 'common', { supplies: 2 }, 5, { steel: 1 });
const ROYAL_ORDNANCE_FACTORY = building('royal-ordnance-factory', 'Royal Ordnance Factory', 'uk', 'uncommon', { steel: 2, supplies: 1 }, 5, {
  steel: 1,
  supplies: 1,
});
const SCAPA_FLOW = building('scapa-flow', 'Scapa Flow Anchorage', 'uk', 'uncommon', { steel: 2, supplies: 1 }, 6, { fuel: 1 }, { aa: 1 });
const OPERATIONS_ROOM = building('operations-room', 'Operations Room', 'uk', 'uncommon', { steel: 1, supplies: 2 }, 5, { supplies: 1 }, {
  discounts: [{ applies: 'order', resource: 'supplies', amount: 1, oncePerTurn: true }],
});
const MULBERRY_HARBOUR = building('mulberry-harbour', 'Mulberry Harbour', 'uk', 'rare', { steel: 3, supplies: 2 }, 8, { supplies: 2 }, {
  discounts: [{ applies: 'building', resource: 'steel', amount: 1, oncePerTurn: true }],
});
const CASTLE_BROMWICH = building('castle-bromwich', 'Castle Bromwich Factory', 'uk', 'rare', { steel: 3, supplies: 1 }, 6, {
  steel: 1,
  fuel: 1,
});
const BLETCHLEY_PARK = building('bletchley-park', 'Bletchley Park', 'uk', 'epic', { supplies: 3, steel: 1, manpower: 1 }, 6, { supplies: 1 }, {
  effects: [{ trigger: 'endOfTurn', do: 'draw', count: 1 }],
});
const CABINET_WAR_ROOMS = building('cabinet-war-rooms', 'Cabinet War Rooms', 'uk', 'legendary', { steel: 3, supplies: 3 }, 10, {
  manpower: 1,
  supplies: 1,
  steel: 1,
}, { keywords: ['guard'] });

// ------------------------------------------------------------------- orders

const CREEPING_BARRAGE = order('creeping-barrage', 'Creeping Barrage', 'uk', 'common', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyLane' }, amount: 2 },
]);
const DIG_FOR_VICTORY = order('dig-for-victory', 'Dig for Victory', 'uk', 'common', { manpower: 1 }, [
  { trigger: 'onPlay', do: 'gain', resource: 'supplies', amount: 2 },
]);
const ARMOUR_PIERCING_ROUNDS = order('armour-piercing-rounds', 'Armour-Piercing Rounds', 'uk', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'chosen', of: 'friendlyUnit' }, keyword: 'piercing' },
]);
const SANDBAGGING = order('sandbagging', 'Sandbagging', 'uk', 'common', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'addMaxHp', target: { kind: 'chosen', of: 'friendlyUnit' }, amount: 2 },
]);
const INTELLIGENCE_REPORT = order('intelligence-report', 'Intelligence Report', 'uk', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'draw', count: 1 },
]);
const COMMANDO_RAID = order('commando-raid', 'Commando Raid', 'uk', 'common', { manpower: 1, supplies: 2 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyBuilding' }, amount: 4 },
]);
const TYPHOON_ROCKET_STRIKE = order('typhoon-rocket-strike', 'Typhoon Rocket Strike', 'uk', 'uncommon', { supplies: 2, fuel: 1 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 4, ignoresArmour: true },
]);
const MAKE_DO_AND_MEND = order('make-do-and-mend', 'Make Do and Mend', 'uk', 'uncommon', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'heal', target: { kind: 'chosen', of: 'friendlyUnit' }, amount: 5 },
]);
const COMBINED_OPERATIONS = order('combined-operations', 'Combined Operations', 'uk', 'uncommon', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 1 },
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 1 },
]);
const ULTRA_DECRYPT = order('ultra-decrypt', 'Ultra Decrypt', 'uk', 'uncommon', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'draw', count: 2 },
]);
const OPERATION_DYNAMO = order('operation-dynamo', 'Operation Dynamo', 'uk', 'rare', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'summonFromDeck', role: 'infantry', count: 1 },
  { trigger: 'onPlay', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 3 },
]);
const DAMBUSTERS_RAID = order('dambusters-raid', 'Dambusters Raid', 'uk', 'rare', { supplies: 2, fuel: 2 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyBuilding' }, amount: 6 },
]);
const SECOND_ALAMEIN = order('second-alamein', 'Second Alamein', 'uk', 'epic', { supplies: 4, fuel: 1 }, [
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 2 },
  { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'allFriendlyUnits' }, keyword: 'piercing' },
]);
const BOMBER_COMMAND_OFFENSIVE = order('bomber-command-offensive', 'Bomber Command Offensive', 'uk', 'epic', { supplies: 5, fuel: 3 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'allEnemyFrontUnits' }, amount: 3 },
]);
const THEIR_FINEST_HOUR = order('their-finest-hour', 'Their Finest Hour', 'uk', 'legendary', { supplies: 4, manpower: 2 }, [
  { trigger: 'onPlay', do: 'draw', count: 2 },
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 2 },
  { trigger: 'onPlay', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 2 },
]);

// ----------------------------------------------------------------- infantry

const HOME_GUARD = unit('home-guard', 'Home Guard', 'uk', 'common', 'infantry', { manpower: 1 }, 1, 2, { keywords: ['dugIn'] });
const BREN_GUN_TEAM = unit('bren-gun-team', 'Bren Gun Team', 'uk', 'common', 'infantry', { manpower: 2 }, 2, 3, { keywords: ['ranged'] });
const PALS_BATTALION = unit('pals-battalion', 'Pals Battalion', 'uk', 'common', 'infantry', { manpower: 3 }, 3, 3, { keywords: ['mass'] });
const DISPATCH_RIDER = unit('dispatch-rider', 'Dispatch Rider', 'uk', 'common', 'infantry', { manpower: 1 }, 1, 1, { keywords: ['blitz'] });
const ROYAL_ENGINEERS = unit('royal-engineers', 'Royal Engineers', 'uk', 'common', 'infantry', { manpower: 1, steel: 1 }, 2, 3, { siege: 2 });
const GURKHA_RIFLEMEN = unit('gurkha-riflemen', 'Gurkha Riflemen', 'uk', 'uncommon', 'infantry', { manpower: 2, supplies: 1 }, 4, 3, {
  keywords: ['tenacity'],
});
const ROYAL_MARINES = unit('royal-marines', 'Royal Marines', 'uk', 'uncommon', 'infantry', { manpower: 2, supplies: 1 }, 3, 4, {
  keywords: ['blitz'],
});
const HIGHLAND_REGIMENT = unit('highland-regiment', 'Highland Regiment', 'uk', 'rare', 'infantry', { manpower: 4, supplies: 1 }, 5, 5, {
  keywords: ['tenacity', 'rally'],
});
const FIRST_AIRBORNE = unit('first-airborne-division', '1st Airborne Division', 'uk', 'epic', 'infantry', { manpower: 4, supplies: 2 }, 6, 6, {
  keywords: ['blitz', 'piercing', 'tenacity'],
});

// ------------------------------------------------------------------- armour

const VICKERS_LIGHT_TANK = unit('vickers-light-tank', 'Vickers Light Tank', 'uk', 'common', 'armour', { steel: 1, fuel: 1 }, 2, 3, {
  armour: 1,
});
const DAIMLER_DINGO = unit('daimler-dingo', 'Daimler Dingo', 'uk', 'common', 'armour', { steel: 1, fuel: 1 }, 1, 3, { keywords: ['blitz'] });
const MATILDA_II = unit('matilda-ii', 'Matilda II', 'uk', 'common', 'armour', { steel: 2, fuel: 1 }, 2, 4, { armour: 2 });
const VALENTINE = unit('valentine', 'Valentine Tank', 'uk', 'common', 'armour', { steel: 2, fuel: 1 }, 3, 4, { armour: 1 });
const CROMWELL = unit('cromwell', 'Cromwell', 'uk', 'uncommon', 'armour', { steel: 3, fuel: 1 }, 4, 4, { armour: 1, keywords: ['blitz'] });
const CHURCHILL_CROCODILE = unit('churchill-crocodile', 'Churchill Crocodile', 'uk', 'rare', 'armour', { steel: 3, fuel: 2 }, 4, 5, {
  armour: 2,
  siege: 3,
});
const SHERMAN_FIREFLY = unit('sherman-firefly', 'Sherman Firefly', 'uk', 'epic', 'armour', { steel: 4, fuel: 1 }, 5, 5, {
  armour: 1,
  keywords: ['ranged', 'piercing'],
});

// ------------------------------------------------------ artillery and anti-tank

const SIX_POUNDER = unit('6-pounder', '6-pounder', 'uk', 'common', 'antiTank', { steel: 2 }, 2, 3, { keywords: ['piercing'] });
const AA_37_INCH = unit('3-7-inch-aa-gun', '3.7-inch AA Gun', 'uk', 'common', 'artillery', { steel: 2, supplies: 1 }, 2, 3, {
  keywords: ['ranged', 'antiAir'],
});
const MORTAR_42 = unit('4-2-inch-mortar', '4.2-inch Mortar', 'uk', 'common', 'artillery', { manpower: 1, steel: 1 }, 3, 1, {
  keywords: ['indirect'],
});
const SMOKE_MORTAR_TEAM = unit('smoke-mortar-team', 'Smoke Mortar Team', 'uk', 'common', 'artillery', { manpower: 1, supplies: 1 }, 1, 2, {
  keywords: ['ranged'],
  effects: [{ trigger: 'onDeploy', do: 'smoke', target: { kind: 'chosen', of: 'friendlyLane' } }],
});
const SEXTON = unit('sexton', 'Sexton', 'uk', 'uncommon', 'artillery', { steel: 3, supplies: 1 }, 4, 3, { keywords: ['indirect'] });
const SEVENTEEN_POUNDER = unit('17-pounder', '17-pounder', 'uk', 'uncommon', 'antiTank', { steel: 3, supplies: 1 }, 5, 2, {
  keywords: ['ranged', 'piercing'],
});
const BL_55_INCH = unit('bl-5-5-inch-gun', 'BL 5.5-inch Gun', 'uk', 'rare', 'artillery', { steel: 4, supplies: 1 }, 5, 3, {
  siege: 3,
  keywords: ['indirect'],
});
const LAND_MATTRESS = unit('land-mattress', 'Land Mattress', 'uk', 'epic', 'artillery', { steel: 3, supplies: 2 }, 4, 3, {
  siege: 2,
  keywords: ['indirect', 'salvo'],
});

// ---------------------------------------------------------------------- air

const HURRICANE = aircraft('hawker-hurricane', 'Hawker Hurricane', 'uk', 'common', { fuel: 2 }, 2, 3, ['fighter']);
const LYSANDER = aircraft('westland-lysander', 'Westland Lysander', 'uk', 'common', { fuel: 1 }, 1, 2, []);
const SWORDFISH = aircraft('fairey-swordfish', 'Fairey Swordfish', 'uk', 'common', { fuel: 2 }, 2, 3, [], { siege: 2 });
const TYPHOON = aircraft('hawker-typhoon', 'Hawker Typhoon', 'uk', 'uncommon', { fuel: 2, steel: 2 }, 4, 3, [], { armour: 1, siege: 2 });
const MOSQUITO = aircraft('mosquito', 'de Havilland Mosquito', 'uk', 'uncommon', { fuel: 2, steel: 1 }, 3, 2, ['blitz', 'precision']);
const GLOSTER_METEOR = aircraft('gloster-meteor', 'Gloster Meteor', 'uk', 'rare', { fuel: 3, steel: 1 }, 5, 3, ['fighter', 'blitz']);
const AVRO_LANCASTER = aircraft('avro-lancaster', 'Avro Lancaster', 'uk', 'legendary', { fuel: 4, steel: 3 }, 8, 8, [], {
  armour: 1,
  siege: 3,
});

// ------------------------------------------------------------------ support

const LAND_GIRLS = unit('land-girls', 'Land Girls', 'uk', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  effects: [{ trigger: 'onDeploy', do: 'gain', resource: 'supplies', amount: 2 }],
});
const AIR_RAID_WARDEN = unit('air-raid-warden', 'Air Raid Warden', 'uk', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 1 }],
});
const ARMY_SERVICE_CORPS = unit('army-service-corps', 'Army Service Corps', 'uk', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  effects: [{ trigger: 'onDeploy', do: 'gain', resource: 'fuel', amount: 2 }],
});
const SOE_AGENT = unit('soe-agent', 'SOE Agent', 'uk', 'uncommon', 'support', { manpower: 1, supplies: 2 }, 1, 2, {
  effects: [
    { trigger: 'onDeploy', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 2 },
    { trigger: 'onDeploy', do: 'draw', count: 1 },
  ],
});

export const UK_CARDS: Card[] = [
  ANDERSON_SHELTER, ACK_ACK_POST, NAAFI_CANTEEN, WELSH_COLLIERY,
  ROYAL_ORDNANCE_FACTORY, SCAPA_FLOW, OPERATIONS_ROOM,
  MULBERRY_HARBOUR, CASTLE_BROMWICH, BLETCHLEY_PARK, CABINET_WAR_ROOMS,
  CREEPING_BARRAGE, DIG_FOR_VICTORY, ARMOUR_PIERCING_ROUNDS, SANDBAGGING, INTELLIGENCE_REPORT, COMMANDO_RAID,
  TYPHOON_ROCKET_STRIKE, MAKE_DO_AND_MEND, COMBINED_OPERATIONS, ULTRA_DECRYPT,
  OPERATION_DYNAMO, DAMBUSTERS_RAID, SECOND_ALAMEIN, BOMBER_COMMAND_OFFENSIVE, THEIR_FINEST_HOUR,
  HOME_GUARD, BREN_GUN_TEAM, PALS_BATTALION, DISPATCH_RIDER, ROYAL_ENGINEERS,
  GURKHA_RIFLEMEN, ROYAL_MARINES, HIGHLAND_REGIMENT, FIRST_AIRBORNE,
  VICKERS_LIGHT_TANK, DAIMLER_DINGO, MATILDA_II, VALENTINE, CROMWELL, CHURCHILL_CROCODILE, SHERMAN_FIREFLY,
  SIX_POUNDER, AA_37_INCH, MORTAR_42, SMOKE_MORTAR_TEAM, SEXTON, SEVENTEEN_POUNDER, BL_55_INCH, LAND_MATTRESS,
  HURRICANE, LYSANDER, SWORDFISH, TYPHOON, MOSQUITO, GLOSTER_METEOR, AVRO_LANCASTER,
  LAND_GIRLS, AIR_RAID_WARDEN, ARMY_SERVICE_CORPS, SOE_AGENT,
];
