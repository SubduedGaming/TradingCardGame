import type { Ctx, GameState, LaneIndex, PlayerId, TargetRef, UnitInPlay } from './types';
import { LANES } from './types';
import {
  damageToStructure,
  damageToUnit,
  effectiveAttack,
  hasKw,
  locateUnit,
  unitsOf,
} from './stats';
import { locateBuilding, other } from './zones';
import { hitBuilding, hitHq, hitUnit } from './damage';

export function canAttack(state: GameState, unit: UnitInPlay): boolean {
  if (state.phase !== 'combat' || state.active !== unit.owner) return false;
  if (unit.hasAttacked || unit.redeployed || unit.grounded) return false;
  if (unit.fresh && !hasKw(unit, 'blitz')) return false;
  return effectiveAttack(state, unit) > 0;
}

function canHitAir(attacker: UnitInPlay): boolean {
  return hasKw(attacker, 'flying') || hasKw(attacker, 'antiAir');
}

/** Enemy units in a lane that `attacker` may legally strike, in target order (front then rear). */
function eligibleInLane(attacker: UnitInPlay, victimLane: { front: UnitInPlay | null; rear: UnitInPlay | null }): UnitInPlay[] {
  return [victimLane.front, victimLane.rear].filter(
    (u): u is UnitInPlay => u !== null && (!hasKw(u, 'flying') || canHitAir(attacker)),
  );
}

/** Units a ground attacker may choose from in one enemy lane (Precision: either; otherwise first only). */
function laneTargets(attacker: UnitInPlay, victimLane: { front: UnitInPlay | null; rear: UnitInPlay | null }): UnitInPlay[] {
  const eligible = eligibleInLane(attacker, victimLane);
  if (hasKw(attacker, 'precision')) return eligible;
  return eligible.slice(0, 1);
}

function structureTargets(state: GameState, victim: PlayerId, ignoreGuard: boolean): TargetRef[] {
  const p = state.players[victim];
  const guards = p.buildings.filter((b) => b.card.keywords.includes('guard'));
  if (guards.length > 0 && !ignoreGuard) {
    return guards.map((b) => ({ kind: 'building', uid: b.uid }));
  }
  return [
    { kind: 'hq', player: victim },
    ...p.buildings.map((b): TargetRef => ({ kind: 'building', uid: b.uid })),
  ];
}

/** All legal attack targets for a unit right now (empty if it cannot attack). */
export function attackTargets(state: GameState, unit: UnitInPlay): TargetRef[] {
  if (!canAttack(state, unit)) return [];
  const loc = locateUnit(state, unit.uid);
  if (!loc) return [];

  const victim = other(unit.owner);
  const vp = state.players[victim];
  const out: TargetRef[] = [];

  if (hasKw(unit, 'flying')) {
    const lane = vp.lanes[loc.lane];
    for (const u of [lane.front, lane.rear]) if (u) out.push({ kind: 'unit', uid: u.uid });
    out.push(...structureTargets(state, victim, true));
    return out;
  }

  const ranged = hasKw(unit, 'ranged');
  if (!ranged && loc.row !== 'front') return [];

  const ownLaneSmoked = ranged && vp.smoke[loc.lane];
  const lanes: readonly LaneIndex[] = hasKw(unit, 'indirect') ? LANES : [loc.lane];
  for (const l of lanes) {
    if (ranged && vp.smoke[l]) continue;
    for (const u of laneTargets(unit, vp.lanes[l])) out.push({ kind: 'unit', uid: u.uid });
  }

  const ownLaneHasTarget = laneTargets(unit, vp.lanes[loc.lane]).length > 0;
  if (!ownLaneHasTarget && !ownLaneSmoked) {
    out.push(...structureTargets(state, victim, false));
  }
  return out;
}

/** Resolves one attack. The caller has already checked it is legal. */
export function resolveAttack(ctx: Ctx, attacker: UnitInPlay, target: TargetRef): void {
  const state = ctx.state;
  ctx.events.push({ type: 'attack', player: attacker.owner, uid: attacker.uid, target });
  attacker.hasAttacked = true;

  if (target.kind === 'building') {
    const b = locateBuilding(state, target.uid);
    if (b) hitBuilding(ctx, b, damageToStructure(state, attacker));
    return;
  }
  if (target.kind === 'hq') {
    hitHq(ctx, target.player, damageToStructure(state, attacker));
    return;
  }
  if (target.kind !== 'unit') return;

  const defLoc = locateUnit(state, target.uid);
  if (!defLoc) return;
  const defender = defLoc.unit;

  const victims: UnitInPlay[] = hasKw(attacker, 'salvo')
    ? unitsOf(state, defLoc.owner)
        .filter((l) => l.lane === defLoc.lane)
        .map((l) => l.unit)
        .filter((u) => !hasKw(u, 'flying') || canHitAir(attacker))
    : [defender];

  const attackerFlying = hasKw(attacker, 'flying');
  const attackerMelee = !hasKw(attacker, 'ranged') && !attackerFlying;
  const counters = attackerMelee || (attackerFlying && hasKw(defender, 'flying'));

  // Damage is computed first and applied together so a fight is simultaneous.
  const hits = victims.map((v) => ({ unit: v, amount: damageToUnit(state, attacker, v) }));
  const counterAmount = counters ? damageToUnit(state, defender, attacker) : 0;

  for (const h of hits) hitUnit(ctx, h.unit, h.amount);
  if (counterAmount > 0) hitUnit(ctx, attacker, counterAmount);
}
