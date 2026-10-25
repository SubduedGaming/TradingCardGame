import type { Card } from '../engine/types';
import { aircraft, building, order, unit } from './builders';

/**
 * Batch 1: neutral cards (docs/08 section 6). 50 cards that complete the neutral quota of 70:
 * 8 buildings, 3 orders and 39 units. Neutral cards work in any army and carry no doctrine.
 */

// ---------------------------------------------------------------- buildings

const PILLBOX = building('pillbox', 'Pillbox', 'neutral', 'common', { steel: 1 }, 5, {}, { keywords: ['guard'] });
const FUEL_DEPOT = building('fuel-depot', 'Fuel Depot', 'neutral', 'common', { supplies: 2, steel: 1 }, 5, { fuel: 1 });
const WORKSHOP = building('workshop', 'Workshop', 'neutral', 'uncommon', { supplies: 3 }, 4, { steel: 1, manpower: 1 });
const ARMOURY = building('armoury', 'Armoury', 'neutral', 'uncommon', { supplies: 1, steel: 1 }, 5, {}, {
  discounts: [{ applies: { role: 'armour' }, resource: 'steel', amount: 1, oncePerTurn: true }],
});
const AMMUNITION_FACTORY = building(
  'ammunition-factory',
  'Ammunition Factory',
  'neutral',
  'uncommon',
  { manpower: 2, steel: 1 },
  5,
  { supplies: 2 },
);
const RAIL_TERMINUS = building('rail-terminus', 'Rail Terminus', 'neutral', 'rare', { supplies: 3, steel: 2 }, 5, {
  supplies: 1,
  manpower: 1,
  steel: 1,
});
const FLAK_TOWER = building('flak-tower', 'Flak Tower', 'neutral', 'rare', { steel: 3, supplies: 1 }, 5, {}, { aa: 3 });
const COMMAND_BUNKER = building('command-bunker', 'Command Bunker', 'neutral', 'epic', { steel: 3, supplies: 2 }, 10, {}, {
  keywords: ['guard'],
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 1 }],
});

// ------------------------------------------------------------------- orders

const RAPID_REPAIR = order('rapid-repair', 'Rapid Repair', 'neutral', 'common', { supplies: 1 }, [
  { trigger: 'onPlay', do: 'heal', target: { kind: 'chosen', of: 'friendlyUnit' }, amount: 3 },
]);
const COUNTER_BATTERY_FIRE = order('counter-battery-fire', 'Counter-Battery Fire', 'neutral', 'uncommon', { supplies: 3 }, [
  { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 4 },
]);
const EMERGENCY_DRAFT = order('emergency-draft', 'Emergency Draft', 'neutral', 'epic', { supplies: 4 }, [
  { trigger: 'onPlay', do: 'draw', count: 3 },
]);

// ----------------------------------------------------------------- infantry

const MILITIA = unit('militia', 'Militia', 'neutral', 'common', 'infantry', { manpower: 1 }, 1, 3);
const MACHINE_GUN_TEAM = unit('machine-gun-team', 'Machine Gun Team', 'neutral', 'common', 'infantry', { manpower: 2 }, 1, 2, {
  keywords: ['ranged'],
});
const PIONEERS = unit('pioneers', 'Pioneers', 'neutral', 'common', 'infantry', { manpower: 1, steel: 1 }, 2, 2, {
  siege: 1,
});
const SCOUT_PATROL = unit('scout-patrol', 'Scout Patrol', 'neutral', 'common', 'infantry', { manpower: 1 }, 1, 1, {
  effects: [{ trigger: 'onDeploy', do: 'draw', count: 1 }],
});
const RAIDERS = unit('raiders', 'Raiders', 'neutral', 'common', 'infantry', { manpower: 1 }, 2, 1, {
  keywords: ['blitz'],
});
const FLAMETHROWER_TEAM = unit('flamethrower-team', 'Flamethrower Team', 'neutral', 'uncommon', 'infantry', { manpower: 2, fuel: 1 }, 4, 1, {
  siege: 2,
});
const SNIPER_TEAM = unit('sniper-team', 'Sniper Team', 'neutral', 'uncommon', 'infantry', { manpower: 2, supplies: 1 }, 4, 1, {
  keywords: ['precision'],
});
const COMMANDO_SQUAD = unit('commando-squad', 'Commando Squad', 'neutral', 'rare', 'infantry', { manpower: 3 }, 3, 3, {
  keywords: ['blitz', 'tenacity'],
});
const RANGER_COMPANY = unit('ranger-company', 'Ranger Company', 'neutral', 'rare', 'infantry', { manpower: 3, supplies: 1 }, 4, 4, {
  keywords: ['blitz', 'dugIn'],
});

// ------------------------------------------------------------------- armour

const ARMOURED_CAR = unit('armoured-car', 'Armoured Car', 'neutral', 'common', 'armour', { steel: 1, fuel: 1 }, 2, 2, {
  keywords: ['blitz'],
});
const HALF_TRACK = unit('half-track', 'Half-track', 'neutral', 'common', 'armour', { steel: 1, fuel: 1, manpower: 1 }, 2, 3, {
  armour: 1,
  keywords: ['rally'],
});
const TANKETTE = unit('tankette', 'Tankette', 'neutral', 'common', 'armour', { steel: 1, fuel: 1 }, 1, 2, { armour: 1 });
const MEDIUM_TANK = unit('medium-tank', 'Medium Tank', 'neutral', 'uncommon', 'armour', { steel: 3, fuel: 1 }, 3, 4, {
  armour: 1,
});
const FLAME_TANK = unit('flame-tank', 'Flame Tank', 'neutral', 'uncommon', 'armour', { steel: 2, fuel: 2 }, 4, 3, {
  armour: 1,
  siege: 2,
});
const HEAVY_TANK = unit('heavy-tank', 'Heavy Tank', 'neutral', 'rare', 'armour', { steel: 4, fuel: 2 }, 5, 7, {
  armour: 2,
  keywords: ['heavy'],
});
const ASSAULT_GUN = unit('assault-gun', 'Assault Gun', 'neutral', 'epic', 'armour', { steel: 3, fuel: 1, supplies: 1 }, 5, 5, {
  armour: 2,
  keywords: ['ranged', 'piercing'],
});

// ------------------------------------------------------ artillery and anti-tank

const HEAVY_MORTAR = unit('heavy-mortar', 'Heavy Mortar', 'neutral', 'common', 'artillery', { manpower: 1, supplies: 2 }, 3, 1, {
  keywords: ['indirect'],
});
const FIELD_GUN = unit('field-gun', 'Field Gun', 'neutral', 'common', 'artillery', { steel: 2, supplies: 1 }, 3, 2, {
  keywords: ['ranged'],
});
const LIGHT_AA_GUN = unit('light-aa-gun', 'Light AA Gun', 'neutral', 'common', 'artillery', { steel: 1, supplies: 1 }, 1, 2, {
  keywords: ['ranged', 'antiAir'],
});
const BAZOOKA_TEAM = unit('bazooka-team', 'Bazooka Team', 'neutral', 'common', 'antiTank', { manpower: 1, steel: 1 }, 2, 1, {
  keywords: ['piercing'],
});
const HEAVY_FIELD_GUN = unit('heavy-field-gun', 'Heavy Field Gun', 'neutral', 'uncommon', 'artillery', { steel: 3, supplies: 1 }, 4, 2, {
  siege: 1,
  keywords: ['ranged'],
});
const MOUNTAIN_GUN = unit('mountain-gun', 'Mountain Gun', 'neutral', 'uncommon', 'artillery', { steel: 2, manpower: 1 }, 3, 2, {
  keywords: ['precision'],
});
const ROCKET_LAUNCHER = unit('rocket-launcher', 'Rocket Launcher', 'neutral', 'uncommon', 'artillery', { steel: 2, supplies: 2 }, 2, 2, {
  keywords: ['indirect', 'salvo'],
});
const SELF_PROPELLED_GUN = unit('self-propelled-gun', 'Self-Propelled Gun', 'neutral', 'rare', 'artillery', { steel: 3, fuel: 1 }, 3, 3, {
  armour: 1,
  keywords: ['indirect'],
});
const FLAK_BATTERY = unit('flak-battery', 'Flak Battery', 'neutral', 'rare', 'artillery', { steel: 3, supplies: 1 }, 4, 3, {
  keywords: ['ranged', 'piercing', 'antiAir'],
});
const SIEGE_HOWITZER = unit('siege-howitzer', 'Siege Howitzer', 'neutral', 'rare', 'artillery', { steel: 4, supplies: 2 }, 6, 2, {
  siege: 3,
  keywords: ['indirect'],
});

// ---------------------------------------------------------------------- air

const RECON_PLANE = aircraft('recon-plane', 'Recon Plane', 'neutral', 'common', { fuel: 1 }, 1, 1, [], {
  effects: [{ trigger: 'onDeploy', do: 'draw', count: 1 }],
});
const LIGHT_BOMBER = aircraft('light-bomber', 'Light Bomber', 'neutral', 'common', { fuel: 2 }, 3, 1, [], { siege: 1 });
const FIGHTER_BOMBER = aircraft('fighter-bomber', 'Fighter-Bomber', 'neutral', 'uncommon', { fuel: 2, steel: 1 }, 3, 3, [], {
  siege: 1,
});
const NIGHT_FIGHTER = aircraft('night-fighter', 'Night Fighter', 'neutral', 'uncommon', { fuel: 2, steel: 1 }, 3, 2, ['fighter']);
const DIVE_BOMBER = aircraft('dive-bomber', 'Dive Bomber', 'neutral', 'rare', { fuel: 3, steel: 1 }, 4, 3, [], { siege: 3 });
const HEAVY_BOMBER = aircraft('heavy-bomber', 'Heavy Bomber', 'neutral', 'epic', { fuel: 4, steel: 2 }, 6, 7, [], {
  siege: 3,
  upkeep: { fuel: 2 },
});

// ------------------------------------------------------------------ support

const SUPPLY_TRUCK = unit('supply-truck', 'Supply Truck', 'neutral', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  effects: [{ trigger: 'onDeploy', do: 'gain', resource: 'supplies', amount: 1 }],
});
const FIELD_KITCHEN = unit('field-kitchen', 'Field Kitchen', 'neutral', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  effects: [{ trigger: 'endOfTurn', do: 'gain', resource: 'manpower', amount: 1 }],
});
const RADIO_TRUCK = unit('radio-truck', 'Radio Truck', 'neutral', 'common', 'support', { manpower: 1, supplies: 1 }, 1, 2, {
  effects: [{ trigger: 'onDeploy', do: 'smoke', target: { kind: 'chosen', of: 'friendlyLane' } }],
});
const MECHANIC = unit('mechanic', 'Mechanic', 'neutral', 'uncommon', 'support', { manpower: 1, supplies: 2 }, 1, 3, {
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 1 }],
});
const SPY_NETWORK = unit('spy-network', 'Spy Network', 'neutral', 'uncommon', 'support', { manpower: 1, supplies: 2 }, 1, 2, {
  effects: [{ trigger: 'onDeploy', do: 'discardRandom', count: 1 }],
});
const STAFF_OFFICER = unit('staff-officer', 'Staff Officer', 'neutral', 'rare', 'support', { manpower: 2, supplies: 2 }, 2, 4, {
  keywords: ['rally'],
  discounts: [{ applies: 'order', resource: 'supplies', amount: 1, oncePerTurn: true }],
});
const COMBAT_SURGEON = unit('combat-surgeon', 'Combat Surgeon', 'neutral', 'epic', 'support', { manpower: 2, supplies: 2 }, 1, 4, {
  effects: [{ trigger: 'endOfTurn', do: 'heal', target: { kind: 'autoAlly', scope: 'any' }, amount: 2 }],
});

export const NEUTRAL_CARDS: Card[] = [
  PILLBOX, FUEL_DEPOT, WORKSHOP, ARMOURY, AMMUNITION_FACTORY, RAIL_TERMINUS, FLAK_TOWER, COMMAND_BUNKER,
  RAPID_REPAIR, COUNTER_BATTERY_FIRE, EMERGENCY_DRAFT,
  MILITIA, MACHINE_GUN_TEAM, PIONEERS, SCOUT_PATROL, RAIDERS, FLAMETHROWER_TEAM, SNIPER_TEAM, COMMANDO_SQUAD, RANGER_COMPANY,
  ARMOURED_CAR, HALF_TRACK, TANKETTE, MEDIUM_TANK, FLAME_TANK, HEAVY_TANK, ASSAULT_GUN,
  HEAVY_MORTAR, FIELD_GUN, LIGHT_AA_GUN, BAZOOKA_TEAM, HEAVY_FIELD_GUN, MOUNTAIN_GUN, ROCKET_LAUNCHER,
  SELF_PROPELLED_GUN, FLAK_BATTERY, SIEGE_HOWITZER,
  RECON_PLANE, LIGHT_BOMBER, FIGHTER_BOMBER, NIGHT_FIGHTER, DIVE_BOMBER, HEAVY_BOMBER,
  SUPPLY_TRUCK, FIELD_KITCHEN, RADIO_TRUCK, MECHANIC, SPY_NETWORK, STAFF_OFFICER, COMBAT_SURGEON,
];
