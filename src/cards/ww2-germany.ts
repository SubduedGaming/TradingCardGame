import type { Card } from '../engine/types';
import { aircraft, building, order, unit } from './builders';

/**
 * Batch 5: Germany (docs/08 section 6). 62 cards that complete the nation's quota of 70 together
 * with the 8 German cards already in the launch core. Identity: expensive, high-quality units,
 * Blitz tempo and Piercing guns. No party symbols or hate iconography (docs/02 section 9).
 */

// ---------------------------------------------------------------- buildings

const BUNKER_LINE = building('westwall-bunker', 'Westwall Bunker', 'germany', 'common', { supplies: 1 }, 6, {}, { keywords: ['guard'] });
const FLAK_NEST = building('flak-nest', 'Flak Nest', 'germany', 'common', { steel: 1, supplies: 1 }, 6, {}, { aa: 1 });
const RUHR_STEELWORKS = building('ruhr-steelworks', 'Ruhr Steelworks', 'germany', 'common', { steel: 1, supplies: 1 }, 5, { steel: 1 });
const SYNTHETIC_FUEL_PLANT = building('synthetic-fuel-plant', 'Synthetic Fuel Plant', 'germany', 'common', { steel: 1, supplies: 1 }, 4, { fuel: 1 });
const PANZER_DEPOT = building('panzer-depot', 'Panzer Depot', 'germany', 'uncommon', { steel: 2, supplies: 1 }, 5, { steel: 1 }, {
  discounts: [{ applies: { role: 'armour' }, resource: 'steel', amount: 1, oncePerTurn: true }],
});
const LUFTWAFFE_AIRFIELD = building('luftwaffe-airfield', 'Luftwaffe Airfield', 'germany', 'uncommon', { steel: 2, supplies: 1 }, 5, { fuel: 1 }, {
  discounts: [{ applies: { role: 'air' }, resource: 'fuel', amount: 1, oncePerTurn: true }],
});
const KRIEGSAKADEMIE = building('kriegsakademie', 'Kriegsakademie', 'germany', 'uncommon', { manpower: 1, supplies: 2 }, 5, { supplies: 1 }, {
  discounts: [{ applies: 'order', resource: 'supplies', amount: 1, oncePerTurn: true }],
});
const ATLANTIC_WALL_BATTERY = building('atlantic-wall-battery', 'Atlantic Wall Battery', 'germany', 'rare', { steel: 3, supplies: 2 }, 12, {}, {
  keywords: ['guard'],
  aa: 1,
});
const KRUPP_WORKS = building('krupp-works', 'Krupp Works', 'germany', 'rare', { steel: 3, supplies: 2 }, 7, { steel: 2, supplies: 1 });
const PEENEMUNDE = building('peenemunde-rocket-works', 'Peenemuende Rocket Works', 'germany', 'epic', { steel: 4, supplies: 2 }, 8, {
  steel: 1,
  fuel: 1,
}, {
  discounts: [{ applies: { role: 'artillery' }, resource: 'steel', amount: 1, oncePerTurn: true }],
});
const AUTOBAHN_NETWORK = building('autobahn-network', 'Autobahn Network', 'germany', 'epic', { steel: 3, supplies: 2 }, 6, { fuel: 2 }, {
  discounts: [{ applies: { role: 'armour' }, resource: 'fuel', amount: 1, oncePerTurn: true }],
});
const HIGH_COMMAND = building('wehrmacht-high-command', 'Wehrmacht High Command', 'germany', 'legendary', { steel: 4, supplies: 4 }, 12, {
  manpower: 1,
  steel: 1,
  fuel: 1,
}, { keywords: ['guard'] });

// ------------------------------------------------------------------- orders

const STUKA_STRIKE = order('stuka-strike', 'Stuka Strike', 'germany', 'common', { supplies: 2, fuel: 1 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 4 },
]);
const PANZERFAUST_VOLLEY = order('panzerfaust-volley', 'Panzerfaust Volley', 'germany', 'common', { manpower: 1, supplies: 1 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 3, ignoresArmour: true },
]);
const AUTOBAHN_DASH = order('autobahn-dash', 'Autobahn Dash', 'germany', 'common', { fuel: 1 }, [
  { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'chosen', of: 'friendlyUnit' }, keyword: 'blitz' },
]);
const PANZER_RECOVERY = order('panzer-recovery', 'Panzer Recovery', 'germany', 'common', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'heal', target: { kind: 'chosen', of: 'friendlyUnit' }, amount: 4 },
]);
const FUEL_RATION = order('synthetic-fuel-ration', 'Synthetic Fuel Ration', 'germany', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'gain', resource: 'fuel', amount: 2 },
]);
const DEMOLITION_CHARGES = order('demolition-charges', 'Demolition Charges', 'germany', 'common', { manpower: 1, supplies: 1 }, [
  { trigger: 'onPlay', do: 'destroyBuilding', target: { kind: 'chosen', of: 'enemyBuilding' }, maxHp: 4 },
]);
const PINCER_ENCIRCLEMENT = order('pincer-encirclement', 'Pincer Encirclement', 'germany', 'uncommon', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyLane' }, amount: 2 },
]);
const SCHWERPUNKT = order('schwerpunkt', 'Schwerpunkt', 'germany', 'uncommon', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 1 },
  { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'chosen', of: 'friendlyUnit' }, keyword: 'piercing' },
]);
const PARATROOP_DROP = order('paratroop-drop', 'Paratroop Drop', 'germany', 'uncommon', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'summonFromDeck', role: 'infantry', count: 1 },
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 1 },
]);
const GENERAL_STAFF_PLANNING = order('general-staff-planning', 'General Staff Planning', 'germany', 'uncommon', { supplies: 2 }, [
  { trigger: 'onPlay', do: 'draw', count: 1 },
  { trigger: 'onPlay', do: 'gain', resource: 'supplies', amount: 1 },
]);
const FALL_GELB = order('fall-gelb', 'Fall Gelb', 'germany', 'rare', { supplies: 4 }, [
  { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'allFriendlyUnits' }, keyword: 'piercing' },
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 1 },
]);
const V1_FLYING_BOMB = order('v1-flying-bomb', 'V-1 Flying Bomb', 'germany', 'rare', { supplies: 3, fuel: 2 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyBuilding' }, amount: 6 },
]);
const AFRIKA_KORPS_OFFENSIVE = order('afrika-korps-offensive', 'Afrika Korps Offensive', 'germany', 'epic', { supplies: 4, fuel: 2 }, [
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 2 },
  { trigger: 'onPlay', do: 'grantKeyword', target: { kind: 'allFriendlyUnits' }, keyword: 'blitz' },
]);
const ARDENNES_OFFENSIVE = order('ardennes-offensive', 'Ardennes Offensive', 'germany', 'epic', { supplies: 5, fuel: 2 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'allEnemyFrontUnits' }, amount: 3 },
]);
const WUNDERWAFFE_PROGRAMME = order('wunderwaffe-programme', 'Wunderwaffe Programme', 'germany', 'legendary', { supplies: 5, manpower: 3 }, [
  { trigger: 'onPlay', do: 'draw', count: 3 },
  { trigger: 'onPlay', do: 'gain', resource: 'steel', amount: 2 },
  { trigger: 'onPlay', do: 'modifyAttack', target: { kind: 'allFriendlyUnits' }, amount: 1 },
]);

// ----------------------------------------------------------------- infantry

const VOLKSGRENADIERS = unit('volksgrenadiers', 'Volksgrenadiers', 'germany', 'common', 'infantry', { manpower: 1 }, 1, 2, { keywords: ['mass'] });
const MG_42_TEAM = unit('mg-42-team', 'MG 42 Team', 'germany', 'common', 'infantry', { manpower: 2 }, 3, 2, { keywords: ['ranged'] });
const LANDSER_SQUAD = unit('landser-squad', 'Landser Squad', 'germany', 'common', 'infantry', { manpower: 2 }, 3, 3);
const PIONIER_SQUAD = unit('pionier-squad', 'Pionier Squad', 'germany', 'common', 'infantry', { manpower: 1, steel: 1 }, 1, 3, { siege: 2 });
const KRADSCHUTZEN = unit('kradschutzen', 'Kradschuetzen', 'germany', 'common', 'infantry', { manpower: 1 }, 2, 2, { keywords: ['blitz'] });
const GEBIRGSJAGER = unit('gebirgsjager', 'Gebirgsjaeger', 'germany', 'uncommon', 'infantry', { manpower: 2, supplies: 1 }, 4, 3, {
  keywords: ['tenacity'],
});
const SCHARFSCHUTZE = unit('scharfschutze', 'Scharfschuetze', 'germany', 'uncommon', 'infantry', { manpower: 2, supplies: 1 }, 4, 1, {
  keywords: ['precision'],
});
const FALLSCHIRMJAGER = unit('fallschirmjager', 'Fallschirmjaeger', 'germany', 'rare', 'infantry', { manpower: 4, supplies: 1 }, 5, 5, {
  keywords: ['blitz', 'tenacity'],
});
const GROSSDEUTSCHLAND = unit('grossdeutschland-division', 'Grossdeutschland Division', 'germany', 'epic', 'infantry', { manpower: 4, supplies: 2 }, 5, 7, {
  keywords: ['rally', 'tenacity', 'piercing'],
});

// ------------------------------------------------------------------- armour

const PANZER_II = unit('panzer-ii', 'Panzer II', 'germany', 'common', 'armour', { steel: 1, fuel: 1 }, 3, 2, { keywords: ['blitz'] });
const PANZER_38T = unit('panzer-38t', 'Panzer 38(t)', 'germany', 'common', 'armour', { steel: 1, fuel: 1 }, 2, 3, { armour: 1 });
const SDKFZ_222 = unit('sdkfz-222', 'Sd.Kfz. 222', 'germany', 'common', 'armour', { steel: 1, fuel: 1 }, 1, 3, { keywords: ['blitz'] });
const PANZER_III = unit('panzer-iii', 'Panzer III', 'germany', 'uncommon', 'armour', { steel: 2, fuel: 1 }, 3, 4, { armour: 1 });
const PANTHER = unit('panther', 'Panther', 'germany', 'uncommon', 'armour', { steel: 3, fuel: 1 }, 5, 4, { armour: 2 });
const TIGER_II = unit('tiger-ii', 'Tiger II', 'germany', 'rare', 'armour', { steel: 5, fuel: 2 }, 7, 7, {
  armour: 3,
  keywords: ['piercing', 'heavy'],
});
const MAUS = unit('maus', 'Maus', 'germany', 'legendary', 'armour', { steel: 6, fuel: 3 }, 8, 11, { armour: 4, keywords: ['heavy'] });

// ------------------------------------------------------ artillery and anti-tank

const PAK_38 = unit('pak-38', '5cm PaK 38', 'germany', 'common', 'antiTank', { steel: 2 }, 2, 3, { keywords: ['piercing'] });
const NEBELWERFER = unit('nebelwerfer-section', 'Nebelwerfer Section', 'germany', 'common', 'artillery', { manpower: 1, steel: 1 }, 3, 1, {
  keywords: ['indirect'],
});
const FLAKVIERLING = unit('flakvierling', '20mm Flakvierling', 'germany', 'common', 'artillery', { steel: 1, supplies: 1 }, 2, 2, {
  keywords: ['ranged', 'antiAir'],
});
const LEFH_18 = unit('lefh-18', 'leFH 18 Howitzer', 'germany', 'common', 'artillery', { steel: 1, supplies: 1 }, 2, 2, { keywords: ['indirect'] });
const STUG_III = unit('stug-iii', 'StuG III', 'germany', 'uncommon', 'antiTank', { steel: 2, supplies: 1 }, 3, 4, { keywords: ['piercing'] });
const HUMMEL = unit('hummel', 'Hummel', 'germany', 'uncommon', 'artillery', { steel: 3, supplies: 1 }, 4, 3, { keywords: ['indirect'] });
const JAGDPANTHER = unit('jagdpanther', 'Jagdpanther', 'germany', 'rare', 'antiTank', { steel: 4, fuel: 1 }, 6, 4, {
  armour: 1,
  keywords: ['ranged', 'piercing'],
});
const KARL_GERAT = unit('karl-gerat', 'Karl-Geraet Siege Mortar', 'germany', 'epic', 'artillery', { steel: 5, supplies: 3 }, 10, 4, {
  siege: 4,
  keywords: ['indirect'],
});

// ---------------------------------------------------------------------- air

const FIESELER_STORCH = aircraft('fieseler-storch', 'Fieseler Storch', 'germany', 'common', { fuel: 1 }, 1, 2, []);
const BF_110 = aircraft('bf-110', 'Bf 110', 'germany', 'common', { fuel: 2 }, 3, 3, []);
const HE_111 = aircraft('he-111', 'He 111', 'germany', 'common', { fuel: 2 }, 2, 3, [], { siege: 2 });
const FW_190 = aircraft('fw-190', 'Fw 190', 'germany', 'uncommon', { fuel: 2, steel: 1 }, 4, 2, ['fighter']);
const JU_88 = aircraft('ju-88', 'Ju 88', 'germany', 'uncommon', { fuel: 2, steel: 2 }, 4, 4, [], { siege: 1 });
const ME_262 = aircraft('me-262', 'Me 262', 'germany', 'rare', { fuel: 3, steel: 1 }, 5, 3, ['fighter', 'blitz']);

// ------------------------------------------------------------------ support

const FELDKUCHE = unit('feldkuche', 'Feldkueche', 'germany', 'common', 'support', { supplies: 1 }, 1, 3, {
  effects: [{ trigger: 'onDeploy', do: 'gain', resource: 'supplies', amount: 1 }],
});
const KRIEGSBERICHTER = unit('kriegsberichter', 'Kriegsberichter', 'germany', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  effects: [{ trigger: 'onDeploy', do: 'draw', count: 1 }],
});
const SANITATER = unit('sanitater', 'Sanitaeter', 'germany', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 1 }],
});
const FUEL_BOWSER_CREW = unit('fuel-bowser-crew', 'Fuel Bowser Crew', 'germany', 'common', 'support', { manpower: 1, steel: 1 }, 1, 2, {
  effects: [{ trigger: 'onDeploy', do: 'gain', resource: 'fuel', amount: 2 }],
});
const ABWEHR_AGENT = unit('abwehr-agent', 'Abwehr Agent', 'germany', 'uncommon', 'support', { manpower: 1, supplies: 2 }, 1, 2, {
  effects: [
    { trigger: 'onDeploy', do: 'discardRandom', count: 1 },
    { trigger: 'onDeploy', do: 'gain', resource: 'supplies', amount: 1 },
  ],
});

export const GERMANY_CARDS: Card[] = [
  BUNKER_LINE, FLAK_NEST, RUHR_STEELWORKS, SYNTHETIC_FUEL_PLANT,
  PANZER_DEPOT, LUFTWAFFE_AIRFIELD, KRIEGSAKADEMIE, ATLANTIC_WALL_BATTERY, KRUPP_WORKS,
  PEENEMUNDE, AUTOBAHN_NETWORK, HIGH_COMMAND,
  STUKA_STRIKE, PANZERFAUST_VOLLEY, AUTOBAHN_DASH, PANZER_RECOVERY, FUEL_RATION, DEMOLITION_CHARGES,
  PINCER_ENCIRCLEMENT, SCHWERPUNKT, PARATROOP_DROP, GENERAL_STAFF_PLANNING,
  FALL_GELB, V1_FLYING_BOMB, AFRIKA_KORPS_OFFENSIVE, ARDENNES_OFFENSIVE, WUNDERWAFFE_PROGRAMME,
  VOLKSGRENADIERS, MG_42_TEAM, LANDSER_SQUAD, PIONIER_SQUAD, KRADSCHUTZEN,
  GEBIRGSJAGER, SCHARFSCHUTZE, FALLSCHIRMJAGER, GROSSDEUTSCHLAND,
  PANZER_II, PANZER_38T, SDKFZ_222, PANZER_III, PANTHER, TIGER_II, MAUS,
  PAK_38, NEBELWERFER, FLAKVIERLING, LEFH_18, STUG_III, HUMMEL, JAGDPANTHER, KARL_GERAT,
  FIESELER_STORCH, BF_110, HE_111, FW_190, JU_88, ME_262,
  FELDKUCHE, KRIEGSBERICHTER, SANITATER, FUEL_BOWSER_CREW, ABWEHR_AGENT,
];
