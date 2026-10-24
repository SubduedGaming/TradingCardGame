import type { GameState, Keyword, LaneIndex, PlayerId, Row, UnitInPlay } from './types';
import { LANES } from './types';

const IMPLIES: Partial<Record<Keyword, Keyword[]>> = {
  fighter: ['flying', 'antiAir'],
  indirect: ['ranged'],
  precision: ['ranged'],
};

export function keywordsOf(unit: UnitInPlay): Set<Keyword> {
  const set = new Set<Keyword>();
  for (const k of [...unit.card.keywords, ...unit.extraKeywords, ...unit.tempKeywords]) {
    set.add(k);
    for (const implied of IMPLIES[k] ?? []) set.add(implied);
  }
  return set;
}

export function hasKw(unit: UnitInPlay, keyword: Keyword): boolean {
  return keywordsOf(unit).has(keyword);
}

export interface UnitLocation {
  unit: UnitInPlay;
  owner: PlayerId;
  lane: LaneIndex;
  row: Row;
}

/** All units on the board for a player, lane by lane, front before rear. */
export function unitsOf(state: GameState, player: PlayerId): UnitLocation[] {
  const out: UnitLocation[] = [];
  for (const lane of LANES) {
    const l = state.players[player].lanes[lane];
    if (l.front) out.push({ unit: l.front, owner: player, lane, row: 'front' });
    if (l.rear) out.push({ unit: l.rear, owner: player, lane, row: 'rear' });
  }
  return out;
}

export function locateUnit(state: GameState, uid: string): UnitLocation | null {
  for (const player of [0, 1] as const) {
    for (const loc of unitsOf(state, player)) {
      if (loc.unit.uid === uid) return loc;
    }
  }
  return null;
}

/** ATK after Mass and Rally. */
export function effectiveAttack(state: GameState, unit: UnitInPlay): number {
  let attack = unit.card.attack + unit.tempAttack;
  if (hasKw(unit, 'mass') && unitsOf(state, unit.owner).length >= 3) attack += 1;
  if (unit.card.role === 'infantry') {
    const loc = locateUnit(state, unit.uid);
    if (loc) {
      const lane = state.players[unit.owner].lanes[loc.lane];
      const mate = loc.row === 'front' ? lane.rear : lane.front;
      if (mate && hasKw(mate, 'rally')) attack += 1;
    }
  }
  return attack;
}

/** Armour after Dug In (+1 while it is the opponent's turn). */
export function effectiveArmour(state: GameState, unit: UnitInPlay): number {
  let armour = unit.card.armour ?? 0;
  if (hasKw(unit, 'dugIn') && state.active !== unit.owner) armour += 1;
  return armour;
}

/** Damage `attacker` deals to `target` unit in a fight (Armour, Piercing, Fighter bonus). */
export function damageToUnit(state: GameState, attacker: UnitInPlay, target: UnitInPlay): number {
  let damage = effectiveAttack(state, attacker);
  if (damage <= 0) return 0;
  if (hasKw(attacker, 'fighter') && hasKw(target, 'flying')) damage += 2;
  if (hasKw(attacker, 'piercing')) return damage;
  return Math.max(1, damage - effectiveArmour(state, target));
}

/** Damage `attacker` deals to a building or an HQ (Siege applies, no Armour). */
export function damageToStructure(state: GameState, attacker: UnitInPlay): number {
  const base = effectiveAttack(state, attacker);
  if (base <= 0) return 0;
  return base + (attacker.card.siege ?? 0);
}
