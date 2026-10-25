import type { Card } from '../engine/types';
import { aircraft, building, order, unit } from './builders';

/**
 * Batch 6: Japan (docs/08 section 6). 65 cards that complete the nation's quota of 70 together
 * with the 5 Japanese cards already in the launch core. Identity: relentless infantry with
 * Tenacity, fast light armour and carrier-borne air power. No flags or rising-sun imagery.
 */

// ---------------------------------------------------------------- buildings

const TUNNEL_COMPLEX = building('tunnel-complex', 'Tunnel Complex', 'japan', 'common', { manpower: 1 }, 7, {}, { keywords: ['guard'] });
const TYPE_88_AA_POST = building('type-88-aa-post', 'Type 88 AA Post', 'japan', 'common', { steel: 1, supplies: 1 }, 6, {}, { aa: 1 });
const VILLAGE_GRANARY = building('village-granary', 'Village Granary', 'japan', 'common', { manpower: 1 }, 4, { supplies: 1 });
const KYUSHU_IRONWORKS = building('kyushu-ironworks', 'Kyushu Ironworks', 'japan', 'common', { steel: 1, supplies: 1 }, 5, { steel: 1 });
const KURE_ARSENAL = building('kure-naval-arsenal', 'Kure Naval Arsenal', 'japan', 'uncommon', { steel: 2, supplies: 1 }, 6, { steel: 1, supplies: 1 });
const SEAPLANE_BASE = building('seaplane-base', 'Seaplane Base', 'japan', 'uncommon', { steel: 2, supplies: 1 }, 5, { fuel: 1 }, { aa: 1 });
const CONSCRIPTION_OFFICE = building('conscription-office', 'Conscription Office', 'japan', 'uncommon', { manpower: 1, supplies: 1 }, 4, { manpower: 1 }, {
  discounts: [{ applies: { role: 'infantry' }, resource: 'manpower', amount: 1, oncePerTurn: true }],
});
const TRUK_LAGOON = building('truk-lagoon-base', 'Truk Lagoon Base', 'japan', 'rare', { steel: 3, supplies: 2 }, 9, { fuel: 1 }, { keywords: ['guard'] });
const MITSUBISHI_WORKS = building('mitsubishi-aircraft-works', 'Mitsubishi Aircraft Works', 'japan', 'rare', { steel: 3, supplies: 1 }, 6, {
  steel: 1,
  fuel: 1,
});
const COMBINED_FLEET_HQ = building('combined-fleet-headquarters', 'Combined Fleet Headquarters', 'japan', 'epic', { supplies: 3, steel: 2 }, 8, {
  fuel: 1,
  supplies: 1,
}, {
  discounts: [{ applies: { role: 'air' }, resource: 'fuel', amount: 1, oncePerTurn: true }],
});
const MANCHURIAN_ZONE = building('manchurian-industrial-zone', 'Manchurian Industrial Zone', 'japan', 'epic', { steel: 3, supplies: 3 }, 7, {
  steel: 2,
  supplies: 1,
});
const IMPERIAL_HQ = building('imperial-general-headquarters', 'Imperial General Headquarters', 'japan', 'legendary', { steel: 4, supplies: 4 }, 12, {
  manpower: 1,
  steel: 1,
  supplies: 1,
}, { keywords: ['guard'] });

// ------------------------------------------------------------------- orders

const BANZAI_CHARGE = order('banzai-charge', 'Banzai Charge', 'japan', 'common', { manpower: 2 }, [
  { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'allFriendlyUnits' }, keyword: 'blitz' },
]);
const JUNGLE_AMBUSH = order('jungle-ambush', 'Jungle Ambush', 'japan', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 2, ignoresArmour: true },
]);
const EMERGENCY_RATIONS = order('emergency-rations', 'Emergency Rations', 'japan', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'heal', target: { kind: 'chosen', of: 'friendlyUnit' }, amount: 3 },
]);
const MORTAR_BARRAGE = order('mortar-barrage', 'Mortar Barrage', 'japan', 'common', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyLane' }, amount: 1 },
]);
const RAID_ON_THE_DEPOT = order('raid-on-the-depot', 'Raid on the Depot', 'japan', 'common', { manpower: 1, supplies: 1 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyBuilding' }, amount: 3 },
]);
const SCAVENGED_SUPPLIES = order('scavenged-supplies', 'Scavenged Supplies', 'japan', 'common', { manpower: 1 }, [
  { trigger: 'onPlay', do: 'gain', resource: 'supplies', amount: 2 },
]);
const CARRIER_STRIKE = order('carrier-strike', 'Carrier Strike', 'japan', 'uncommon', { supplies: 2, fuel: 2 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 5 },
]);
const TORPEDO_RUN = order('torpedo-run', 'Torpedo Run', 'japan', 'uncommon', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyBuilding' }, amount: 5 },
]);
const TUNNEL_WARFARE = order('tunnel-warfare', 'Tunnel Warfare', 'japan', 'uncommon', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'smoke', target: { kind: 'chosen', of: 'friendlyLane' } },
  { trigger: 'onPlay', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 2 },
]);
const RADIO_INTERCEPT = order('radio-intercept', 'Radio Intercept', 'japan', 'uncommon', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'draw', count: 1 },
  { trigger: 'onPlay', do: 'gain', resource: 'fuel', amount: 1 },
]);
const SPECIAL_LANDING = order('special-naval-landing', 'Special Naval Landing', 'japan', 'uncommon', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'summonFromDeck', role: 'infantry', count: 1 },
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'chosen', of: 'friendlyUnit' }, amount: 1 },
]);
const OPERATION_Z = order('operation-z', 'Operation Z', 'japan', 'rare', { supplies: 4, fuel: 2 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'allEnemyFrontUnits' }, amount: 2 },
]);
const JUNGLE_OFFENSIVE = order('jungle-offensive', 'Jungle Offensive', 'japan', 'rare', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'allFriendlyUnits' }, keyword: 'blitz' },
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 1 },
]);
const FALL_OF_SINGAPORE = order('fall-of-singapore', 'Fall of Singapore', 'japan', 'epic', { supplies: 5, fuel: 2 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'allEnemyFrontUnits' }, amount: 2 },
  { trigger: 'onPlay', do: 'summonFromDeck', role: 'infantry', count: 1 },
]);
const DECISIVE_BATTLE = order('decisive-battle-doctrine', 'Decisive Battle Doctrine', 'japan', 'epic', { supplies: 4, steel: 2 }, [
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 1 },
  { trigger: 'onPlay', do: 'draw', count: 2 },
  { trigger: 'onPlay', do: 'gain', resource: 'steel', amount: 1 },
]);
const BATTLE_OF_MIDWAY = order('battle-of-midway', 'The Battle of Midway', 'japan', 'legendary', { supplies: 5, fuel: 3 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'allEnemyFrontUnits' }, amount: 3 },
  { trigger: 'onPlay', do: 'draw', count: 1 },
]);

// ----------------------------------------------------------------- infantry

const TYPE_38_SQUAD = unit('type-38-rifle-squad', 'Type 38 Rifle Squad', 'japan', 'common', 'infantry', { manpower: 1 }, 1, 2, { keywords: ['mass'] });
const JUNGLE_FIGHTERS = unit('jungle-fighters', 'Jungle Fighters', 'japan', 'common', 'infantry', { manpower: 2 }, 2, 2, { keywords: ['blitz'] });
const TUNNEL_DEFENDERS = unit('tunnel-defenders', 'Tunnel Defenders', 'japan', 'common', 'infantry', { manpower: 2 }, 2, 3, { keywords: ['dugIn'] });
const BAMBOO_SPEAR_MILITIA = unit('bamboo-spear-militia', 'Bamboo Spear Militia', 'japan', 'common', 'infantry', { manpower: 1 }, 2, 1, {
  keywords: ['tenacity'],
});
const JUNGLE_SNIPER = unit('jungle-sniper', 'Jungle Sniper', 'japan', 'uncommon', 'infantry', { manpower: 2, supplies: 1 }, 4, 1, {
  keywords: ['precision'],
});
const TYPE_99_MG_TEAM = unit('type-99-lmg-team', 'Type 99 LMG Team', 'japan', 'uncommon', 'infantry', { manpower: 2, supplies: 1 }, 3, 2, {
  keywords: ['ranged'],
});
const IMPERIAL_GUARDS = unit('imperial-guards', 'Imperial Guards', 'japan', 'uncommon', 'infantry', { manpower: 2, supplies: 1 }, 3, 4, {
  keywords: ['tenacity'],
});
const KWANTUNG_REGIMENT = unit('kwantung-army-regiment', 'Kwantung Army Regiment', 'japan', 'rare', 'infantry', { manpower: 4, supplies: 1 }, 5, 4, {
  keywords: ['tenacity'],
});
const SHOCK_REGIMENT = unit('shock-regiment', 'Shock Regiment', 'japan', 'epic', 'infantry', { manpower: 3, supplies: 2 }, 5, 4, {
  keywords: ['blitz', 'tenacity'],
});

// ------------------------------------------------------------------- armour

const TYPE_95_HA_GO = unit('type-95-ha-go', 'Type 95 Ha-Go', 'japan', 'common', 'armour', { steel: 1, fuel: 1 }, 3, 2);
const TYPE_94_TANKETTE = unit('type-94-tankette', 'Type 94 Tankette', 'japan', 'common', 'armour', { steel: 1, fuel: 1 }, 2, 1, { keywords: ['blitz'] });
const TYPE_98_KE_NI = unit('type-98-ke-ni', 'Type 98 Ke-Ni', 'japan', 'common', 'armour', { steel: 1, fuel: 1 }, 2, 2, { keywords: ['blitz'] });
const TYPE_89_I_GO = unit('type-89-i-go', 'Type 89 I-Go', 'japan', 'common', 'armour', { steel: 2, fuel: 1 }, 2, 4, { armour: 1 });
const TYPE_1_CHI_HE = unit('type-1-chi-he', 'Type 1 Chi-He', 'japan', 'uncommon', 'armour', { steel: 2, fuel: 1 }, 3, 4, { armour: 1 });
const TYPE_2_KA_MI = unit('type-2-ka-mi', 'Type 2 Ka-Mi', 'japan', 'uncommon', 'armour', { steel: 2, fuel: 1 }, 3, 3, { armour: 1, keywords: ['blitz'] });
const TYPE_3_CHI_NU = unit('type-3-chi-nu', 'Type 3 Chi-Nu', 'japan', 'rare', 'armour', { steel: 3, fuel: 1 }, 5, 4, { armour: 1, keywords: ['piercing'] });
const TYPE_4_CHI_TO = unit('type-4-chi-to', 'Type 4 Chi-To', 'japan', 'rare', 'armour', { steel: 4, fuel: 1 }, 5, 5, { armour: 2, keywords: ['piercing'] });

// ------------------------------------------------------ artillery and anti-tank

const TYPE_92_INFANTRY_GUN = unit('type-92-infantry-gun', 'Type 92 Infantry Gun', 'japan', 'common', 'artillery', { steel: 1, supplies: 1 }, 2, 2, {
  keywords: ['ranged'],
});
const TYPE_97_MORTAR = unit('type-97-mortar', 'Type 97 Mortar', 'japan', 'common', 'artillery', { manpower: 1, steel: 1 }, 3, 1, {
  keywords: ['indirect'],
});
const TYPE_1_AT_GUN = unit('type-1-47mm-at-gun', 'Type 1 47mm AT Gun', 'japan', 'common', 'antiTank', { steel: 2 }, 2, 3, { keywords: ['piercing'] });
const TYPE_98_AA_CANNON = unit('type-98-20mm-aa', 'Type 98 20mm AA Cannon', 'japan', 'common', 'artillery', { steel: 1, supplies: 1 }, 2, 2, {
  keywords: ['ranged', 'antiAir'],
});
const TYPE_96_HOWITZER = unit('type-96-15cm-howitzer', 'Type 96 15cm Howitzer', 'japan', 'uncommon', 'artillery', { steel: 3, supplies: 1 }, 4, 3, {
  keywords: ['indirect'],
});
const TYPE_1_HO_NI = unit('type-1-ho-ni', 'Type 1 Ho-Ni', 'japan', 'uncommon', 'antiTank', { steel: 3, fuel: 1 }, 4, 3, {
  keywords: ['ranged', 'piercing'],
});
const TYPE_4_ROCKET = unit('type-4-20cm-rocket', 'Type 4 20cm Rocket Launcher', 'japan', 'rare', 'artillery', { steel: 4, supplies: 1 }, 5, 3, {
  siege: 3,
  keywords: ['indirect'],
});
const TYPE_45_COASTAL_GUN = unit('type-45-coastal-gun', 'Type 45 Coastal Gun', 'japan', 'epic', 'artillery', { steel: 5, supplies: 3 }, 9, 6, {
  siege: 3,
  keywords: ['ranged'],
});

// ---------------------------------------------------------------------- air

const KI_27 = aircraft('ki-27-nate', 'Ki-27 Nate', 'japan', 'common', { fuel: 2 }, 2, 2, ['fighter']);
const KI_51 = aircraft('ki-51-sonia', 'Ki-51 Sonia', 'japan', 'common', { fuel: 1 }, 1, 2, [], { siege: 1 });
const B5N_KATE = aircraft('b5n-kate', 'B5N Kate', 'japan', 'common', { fuel: 2 }, 2, 3, [], { siege: 2 });
const KI_43 = aircraft('ki-43-hayabusa', 'Ki-43 Hayabusa', 'japan', 'uncommon', { fuel: 2, steel: 1 }, 4, 2, ['fighter']);
const D3A_VAL = aircraft('d3a-val', 'D3A Val', 'japan', 'uncommon', { fuel: 2, steel: 2 }, 4, 3, [], { siege: 2 });
const N1K_SHIDEN = aircraft('n1k-shiden', 'N1K Shiden', 'japan', 'rare', { fuel: 3, steel: 1 }, 5, 3, ['fighter', 'blitz']);
const KIDO_BUTAI = aircraft('kido-butai-strike-wing', 'Kido Butai Strike Wing', 'japan', 'legendary', { fuel: 4, steel: 3 }, 8, 8, [], {
  armour: 1,
  siege: 3,
});

// ------------------------------------------------------------------ support

const RICE_CARRIERS = unit('rice-carriers', 'Rice Carriers', 'japan', 'common', 'support', { supplies: 1 }, 1, 3, {
  effects: [{ trigger: 'onDeploy', do: 'gain', resource: 'supplies', amount: 1 }],
});
const FIELD_NURSE = unit('field-nurse', 'Field Nurse', 'japan', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 1 }],
});
const ENGINEER_PIONEERS = unit('engineer-pioneers', 'Engineer Pioneers', 'japan', 'common', 'support', { manpower: 1, steel: 1 }, 1, 2, {
  effects: [{ trigger: 'onDeploy', do: 'gain', resource: 'steel', amount: 2 }],
});
const KEMPEITAI_AGENT = unit('kempeitai-agent', 'Kempeitai Agent', 'japan', 'uncommon', 'support', { manpower: 1, supplies: 2 }, 1, 2, {
  effects: [
    { trigger: 'onDeploy', do: 'discardRandom', count: 1 },
    { trigger: 'onDeploy', do: 'gain', resource: 'supplies', amount: 1 },
  ],
});
const RADIO_TECHNICIAN = unit('radio-technician', 'Radio Technician', 'japan', 'uncommon', 'support', { manpower: 1, supplies: 2 }, 1, 2, {
  effects: [
    { trigger: 'onDeploy', do: 'draw', count: 1 },
    { trigger: 'onDeploy', do: 'gain', resource: 'fuel', amount: 1 },
  ],
});

export const JAPAN_CARDS: Card[] = [
  TUNNEL_COMPLEX, TYPE_88_AA_POST, VILLAGE_GRANARY, KYUSHU_IRONWORKS,
  KURE_ARSENAL, SEAPLANE_BASE, CONSCRIPTION_OFFICE, TRUK_LAGOON, MITSUBISHI_WORKS,
  COMBINED_FLEET_HQ, MANCHURIAN_ZONE, IMPERIAL_HQ,
  BANZAI_CHARGE, JUNGLE_AMBUSH, EMERGENCY_RATIONS, MORTAR_BARRAGE, RAID_ON_THE_DEPOT, SCAVENGED_SUPPLIES,
  CARRIER_STRIKE, TORPEDO_RUN, TUNNEL_WARFARE, RADIO_INTERCEPT, SPECIAL_LANDING,
  OPERATION_Z, JUNGLE_OFFENSIVE, FALL_OF_SINGAPORE, DECISIVE_BATTLE, BATTLE_OF_MIDWAY,
  TYPE_38_SQUAD, JUNGLE_FIGHTERS, TUNNEL_DEFENDERS, BAMBOO_SPEAR_MILITIA,
  JUNGLE_SNIPER, TYPE_99_MG_TEAM, IMPERIAL_GUARDS, KWANTUNG_REGIMENT, SHOCK_REGIMENT,
  TYPE_95_HA_GO, TYPE_94_TANKETTE, TYPE_98_KE_NI, TYPE_89_I_GO, TYPE_1_CHI_HE, TYPE_2_KA_MI, TYPE_3_CHI_NU, TYPE_4_CHI_TO,
  TYPE_92_INFANTRY_GUN, TYPE_97_MORTAR, TYPE_1_AT_GUN, TYPE_98_AA_CANNON,
  TYPE_96_HOWITZER, TYPE_1_HO_NI, TYPE_4_ROCKET, TYPE_45_COASTAL_GUN,
  KI_27, KI_51, B5N_KATE, KI_43, D3A_VAL, N1K_SHIDEN, KIDO_BUTAI,
  RICE_CARRIERS, FIELD_NURSE, ENGINEER_PIONEERS, KEMPEITAI_AGENT, RADIO_TECHNICIAN,
];
