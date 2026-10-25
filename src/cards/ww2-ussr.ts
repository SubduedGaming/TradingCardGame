import type { Card } from '../engine/types';
import { aircraft, building, order, unit } from './builders';

/**
 * Batch 4: Soviet Union (docs/08 section 6). 60 cards that complete the nation's quota of 70
 * together with the 10 USSR cards already in the launch core. Identity: mass infantry, heavy armour,
 * rocket artillery and ground-attack aircraft. Mass Mobilisation rewards fielding many units.
 */

// ---------------------------------------------------------------- buildings

const KOLKHOZ_FARM = building('kolkhoz-farm', 'Kolkhoz Farm', 'ussr', 'common', { supplies: 1 }, 4, { manpower: 1 });
const TRACTOR_FACTORY = building('tractor-factory', 'Tractor Factory', 'ussr', 'common', { steel: 1, supplies: 1 }, 5, { steel: 1 });
const ZENITKA_POSITION = building('zenitka-position', 'Zenitka Position', 'ussr', 'common', { steel: 1, supplies: 1 }, 5, {}, { aa: 1 });
const TRENCH_NETWORK = building('trench-network', 'Trench Network', 'ussr', 'common', { manpower: 1 }, 7, {}, { keywords: ['guard'] });
const URAL_FOUNDRY = building('ural-foundry', 'Ural Foundry', 'ussr', 'uncommon', { steel: 2, supplies: 1 }, 6, { steel: 2 });
const BAKU_OILFIELD = building('baku-oilfield', 'Baku Oilfield', 'ussr', 'uncommon', { steel: 2, supplies: 1 }, 4, { fuel: 1, supplies: 1 });
const PARTISAN_CAMP = building('partisan-camp', 'Partisan Camp', 'ussr', 'uncommon', { manpower: 1, supplies: 1 }, 4, { manpower: 1 }, {
  discounts: [{ applies: { role: 'infantry' }, resource: 'manpower', amount: 1, oncePerTurn: true }],
});
const KIROV_PLANT = building('kirov-plant', 'Kirov Plant', 'ussr', 'rare', { steel: 3, supplies: 2 }, 7, { steel: 2 }, {
  discounts: [{ applies: { role: 'armour' }, resource: 'steel', amount: 1, oncePerTurn: true }],
});
const METRO_SHELTER = building('metro-shelter', 'Moscow Metro Shelter', 'ussr', 'rare', { steel: 2, supplies: 2 }, 12, {}, {
  keywords: ['guard'],
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 1 }],
});
const STAVKA = building('stavka-headquarters', 'Stavka Headquarters', 'ussr', 'epic', { supplies: 3, manpower: 2 }, 8, { manpower: 1, supplies: 1 }, {
  discounts: [{ applies: { role: 'infantry' }, resource: 'manpower', amount: 1, oncePerTurn: true }],
});

// ------------------------------------------------------------------- orders

const HUMAN_WAVE = order('human-wave', 'Human Wave', 'ussr', 'common', { manpower: 2 }, [
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 1 },
]);
const MOLOTOV_COCKTAILS = order('molotov-cocktails', 'Molotov Cocktails', 'ussr', 'common', { manpower: 1 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 2, ignoresArmour: true },
]);
const RASPUTITSA = order('rasputitsa', 'Rasputitsa Mud', 'ussr', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'smoke', target: { kind: 'chosen', of: 'friendlyLane' } },
]);
const SCRAP_DRIVE = order('scrap-drive', 'Scrap Drive', 'ussr', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'gain', resource: 'steel', amount: 2 },
]);
const ARTILLERY_PREPARATION = order('artillery-preparation', 'Artillery Preparation', 'ussr', 'common', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 3 },
]);
const PARTISAN_SABOTAGE = order('partisan-sabotage', 'Partisan Sabotage', 'ussr', 'common', { manpower: 1, supplies: 1 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyBuilding' }, amount: 3 },
]);
const DEEP_BATTLE = order('deep-battle', 'Deep Battle', 'ussr', 'uncommon', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'allFriendlyUnits' }, keyword: 'blitz' },
]);
const WINTER_OFFENSIVE = order('winter-offensive', 'Winter Offensive', 'ussr', 'uncommon', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'allEnemyFrontUnits' }, amount: 1 },
]);
const CONSCRIPTION_DRIVE = order('conscription-drive', 'Conscription Drive', 'ussr', 'uncommon', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'summonFromDeck', role: 'infantry', count: 1 },
  { trigger: 'onPlay', do: 'gain', resource: 'manpower', amount: 1 },
]);
const ROCKET_SALVO = order('rocket-salvo', 'Rocket Salvo', 'ussr', 'uncommon', { supplies: 2, steel: 1 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyLane' }, amount: 2 },
]);
const OPERATION_URANUS = order('operation-uranus', 'Operation Uranus', 'ussr', 'rare', { supplies: 4 }, [
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 1 },
  { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'allFriendlyUnits' }, keyword: 'blitz' },
]);
const ARCTIC_CONVOY = order('arctic-convoy', 'Arctic Convoy', 'ussr', 'rare', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'gainChosen', target: { kind: 'chosen', of: 'resource' }, amount: 4 },
]);
const OPERATION_BAGRATION = order('operation-bagration', 'Operation Bagration', 'ussr', 'epic', { supplies: 5, steel: 1 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'allEnemyFrontUnits' }, amount: 2 },
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 1 },
]);
const GREAT_PATRIOTIC_WAR = order('great-patriotic-war', 'The Great Patriotic War', 'ussr', 'epic', { supplies: 4, manpower: 2 }, [
  { trigger: 'onPlay', do: 'summonFromDeck', role: 'infantry', count: 2 },
  { trigger: 'onPlay', do: 'draw', count: 1 },
]);
const STALINGRAD = order('battle-of-stalingrad', 'The Battle of Stalingrad', 'ussr', 'legendary', { supplies: 5, manpower: 3 }, [
  { trigger: 'onPlay', do: 'summonFromDeck', role: 'infantry', count: 3 },
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 1 },
  { trigger: 'onPlay', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 2 },
]);

// ----------------------------------------------------------------- infantry

const RESERVISTS = unit('reservists', 'Reservists', 'ussr', 'common', 'infantry', { manpower: 1 }, 2, 1, { keywords: ['mass'] });
const MILITIA_BRIGADE = unit('militia-brigade', 'Militia Brigade', 'ussr', 'common', 'infantry', { manpower: 2 }, 2, 3, { keywords: ['dugIn'] });
const SIBERIAN_RIFLES = unit('siberian-rifles', 'Siberian Rifles', 'ussr', 'common', 'infantry', { manpower: 2 }, 3, 2, { keywords: ['tenacity'] });
const SMG_COMPANY = unit('smg-company', 'SMG Company', 'ussr', 'common', 'infantry', { manpower: 2 }, 3, 2, { keywords: ['blitz'] });
const SAPPER_BATTALION = unit('sapper-battalion', 'Sapper Battalion', 'ussr', 'common', 'infantry', { manpower: 1, steel: 1 }, 1, 3, { siege: 2 });
const NAVAL_INFANTRY = unit('naval-infantry', 'Naval Infantry', 'ussr', 'uncommon', 'infantry', { manpower: 2, supplies: 1 }, 4, 3, {
  keywords: ['blitz'],
});
const ZAITSEV_SNIPER = unit('zaitsev-sniper', 'Zaitsev\'s Sniper', 'ussr', 'uncommon', 'infantry', { manpower: 2, supplies: 1 }, 4, 1, {
  keywords: ['precision'],
});
const SIBERIAN_DIVISION = unit('siberian-division', 'Siberian Division', 'ussr', 'rare', 'infantry', { manpower: 4, supplies: 1 }, 5, 5, {
  keywords: ['dugIn', 'tenacity'],
});
const PAVLOVS_HOUSE = unit('pavlovs-house', 'Pavlov\'s House Garrison', 'ussr', 'epic', 'infantry', { manpower: 3, supplies: 2 }, 4, 7, {
  keywords: ['dugIn', 'tenacity', 'rally'],
});

// ------------------------------------------------------------------- armour

const T_26 = unit('t-26', 'T-26', 'ussr', 'common', 'armour', { steel: 1, fuel: 1 }, 3, 2);
const BT_7 = unit('bt-7', 'BT-7', 'ussr', 'common', 'armour', { steel: 1, fuel: 1 }, 2, 2, { keywords: ['blitz'] });
const T_60 = unit('t-60', 'T-60', 'ussr', 'common', 'armour', { steel: 1, fuel: 1 }, 1, 3, { armour: 1 });
const KV_1 = unit('kv-1', 'KV-1', 'ussr', 'common', 'armour', { steel: 2, fuel: 1 }, 2, 5, { armour: 2, keywords: ['heavy'] });
const T_34_85 = unit('t-34-85', 'T-34-85', 'ussr', 'uncommon', 'armour', { steel: 3, fuel: 1 }, 4, 5, { armour: 1 });
const KV_2 = unit('kv-2', 'KV-2', 'ussr', 'rare', 'armour', { steel: 4, fuel: 1 }, 5, 5, { armour: 2, siege: 2, keywords: ['heavy'] });
const IS_3 = unit('is-3', 'IS-3', 'ussr', 'epic', 'armour', { steel: 5, fuel: 2 }, 6, 7, { armour: 3, keywords: ['piercing'] });

// ------------------------------------------------------ artillery and anti-tank

const REGIMENTAL_GUN = unit('76mm-regimental-gun', '76mm Regimental Gun', 'ussr', 'common', 'artillery', { steel: 1, supplies: 1 }, 2, 2, {
  keywords: ['ranged'],
});
const GUN_45MM = unit('45mm-at-gun', '45mm AT Gun', 'ussr', 'common', 'antiTank', { steel: 2 }, 2, 3, { keywords: ['piercing'] });
const MORTAR_82 = unit('82mm-mortar', '82mm Mortar', 'ussr', 'common', 'artillery', { manpower: 1, steel: 1 }, 3, 1, { keywords: ['indirect'] });
const MAXIM_QUAD = unit('maxim-quad', 'Maxim Quad Mount', 'ussr', 'common', 'artillery', { steel: 1, supplies: 1 }, 2, 2, {
  keywords: ['ranged', 'antiAir'],
});
const ZIS_3 = unit('zis-3', 'ZiS-3', 'ussr', 'uncommon', 'artillery', { steel: 2, supplies: 1 }, 3, 3, { keywords: ['indirect'] });
const SU_76 = unit('su-76', 'SU-76', 'ussr', 'uncommon', 'antiTank', { steel: 3, fuel: 1 }, 4, 3, { keywords: ['ranged', 'piercing'] });
const ISU_152 = unit('isu-152', 'ISU-152', 'ussr', 'rare', 'artillery', { steel: 4, supplies: 2 }, 6, 5, {
  siege: 3,
  keywords: ['ranged', 'piercing', 'heavy'],
});
const BM_31 = unit('bm-31', 'BM-31 Rocket Battery', 'ussr', 'epic', 'artillery', { steel: 3, supplies: 2 }, 4, 4, {
  siege: 2,
  keywords: ['indirect', 'salvo'],
});

// ---------------------------------------------------------------------- air

const I_16 = aircraft('i-16', 'Polikarpov I-16', 'ussr', 'common', { fuel: 2 }, 2, 2, ['fighter']);
const PO_2 = aircraft('po-2', 'Po-2 Night Witch', 'ussr', 'common', { fuel: 1 }, 2, 1, [], { siege: 2 });
const PE_2 = aircraft('pe-2', 'Pe-2 Peshka', 'ussr', 'common', { fuel: 2 }, 2, 3, [], { siege: 2 });
const YAK_1 = aircraft('yak-1', 'Yak-1', 'ussr', 'common', { fuel: 2 }, 3, 1, ['fighter']);
const LA_5 = aircraft('la-5', 'La-5', 'ussr', 'uncommon', { fuel: 2, steel: 1 }, 4, 2, ['fighter']);
const TU_2 = aircraft('tu-2', 'Tupolev Tu-2', 'ussr', 'uncommon', { fuel: 2, steel: 2 }, 4, 4, [], { siege: 1 });
const YAK_3 = aircraft('yak-3', 'Yak-3', 'ussr', 'rare', { fuel: 3, steel: 1 }, 5, 3, ['fighter', 'blitz']);

// ------------------------------------------------------------------ support

const HORSE_CART_TRAIN = unit('horse-cart-train', 'Horse Cart Train', 'ussr', 'common', 'support', { supplies: 1 }, 1, 3, {
  effects: [{ trigger: 'onDeploy', do: 'gain', resource: 'supplies', amount: 1 }],
});
const SANITAR = unit('sanitar', 'Sanitar Medic', 'ussr', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'lane' }, amount: 1 }],
});
const RAILWAY_TROOPS = unit('railway-troops', 'Railway Troops', 'ussr', 'common', 'support', { manpower: 1, steel: 1 }, 1, 2, {
  effects: [{ trigger: 'onDeploy', do: 'gain', resource: 'steel', amount: 2 }],
});
const PARTISAN_RADIO = unit('partisan-radio-operator', 'Partisan Radio Operator', 'ussr', 'uncommon', 'support', { manpower: 1, supplies: 2 }, 1, 2, {
  effects: [
    { trigger: 'onDeploy', do: 'draw', count: 1 },
    { trigger: 'onDeploy', do: 'gain', resource: 'supplies', amount: 1 },
  ],
});

export const USSR_CARDS: Card[] = [
  KOLKHOZ_FARM, TRACTOR_FACTORY, ZENITKA_POSITION, TRENCH_NETWORK,
  URAL_FOUNDRY, BAKU_OILFIELD, PARTISAN_CAMP, KIROV_PLANT, METRO_SHELTER, STAVKA,
  HUMAN_WAVE, MOLOTOV_COCKTAILS, RASPUTITSA, SCRAP_DRIVE, ARTILLERY_PREPARATION, PARTISAN_SABOTAGE,
  DEEP_BATTLE, WINTER_OFFENSIVE, CONSCRIPTION_DRIVE, ROCKET_SALVO,
  OPERATION_URANUS, ARCTIC_CONVOY, OPERATION_BAGRATION, GREAT_PATRIOTIC_WAR, STALINGRAD,
  RESERVISTS, MILITIA_BRIGADE, SIBERIAN_RIFLES, SMG_COMPANY, SAPPER_BATTALION,
  NAVAL_INFANTRY, ZAITSEV_SNIPER, SIBERIAN_DIVISION, PAVLOVS_HOUSE,
  T_26, BT_7, T_60, KV_1, T_34_85, KV_2, IS_3,
  REGIMENTAL_GUN, GUN_45MM, MORTAR_82, MAXIM_QUAD, ZIS_3, SU_76, ISU_152, BM_31,
  I_16, PO_2, PE_2, YAK_1, LA_5, TU_2, YAK_3,
  HORSE_CART_TRAIN, SANITAR, RAILWAY_TROOPS, PARTISAN_RADIO,
];
