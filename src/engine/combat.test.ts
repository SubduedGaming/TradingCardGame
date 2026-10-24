import { describe, expect, it } from 'vitest';
import { apply, isTerminal, legalActions } from './game';
import type { GameState, TargetRef, UnitInPlay } from './types';
import { ANTI_AIRCRAFT_BATTERY, BUNKER } from '../cards/ww2';
import { addBuilding, attack, buildingCard, newGame, put, step, toCombat, unitCard } from './testkit';

function combatGame(): GameState {
  const s = newGame(1, 0);
  toCombat(s);
  return s;
}

function targetsOf(s: GameState, u: UnitInPlay): TargetRef[] {
  return legalActions(s, u.owner).flatMap((a) =>
    a.type === 'attack' && a.unitUid === u.uid ? [a.target] : [],
  );
}

const unitRef = (u: UnitInPlay): TargetRef => ({ kind: 'unit', uid: u.uid });
const hq1: TargetRef = { kind: 'hq', player: 1 };

describe('basic melee combat', () => {
  it('deals damage, takes counter-damage simultaneously and discards the dead', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard({ attack: 3, hp: 3 }));
    const d = put(s, 1, 0, 'front', unitCard({ attack: 2, hp: 2 }));
    const r = attack(s, a, unitRef(d));
    expect(r.state.players[1].lanes[0].front).toBeNull();
    expect(r.state.players[1].discard).toHaveLength(1);
    expect(r.state.players[0].lanes[0].front?.hp).toBe(1);
    expect(r.events.some((e) => e.type === 'unitDestroyed')).toBe(true);
  });

  it('can kill both units in a trade', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard({ attack: 2, hp: 2 }));
    const d = put(s, 1, 0, 'front', unitCard({ attack: 2, hp: 2 }));
    const r = attack(s, a, unitRef(d));
    expect(r.state.players[0].lanes[0].front).toBeNull();
    expect(r.state.players[1].lanes[0].front).toBeNull();
  });

  it('a unit attacks only once per turn', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard({ attack: 1, hp: 5 }));
    const d = put(s, 1, 0, 'front', unitCard({ attack: 0, hp: 5 }));
    const r = attack(s, a, unitRef(d));
    expect(targetsOf(r.state, r.state.players[0].lanes[0].front!)).toEqual([]);
  });

  it('Fresh units cannot attack unless they have Blitz', () => {
    const s = combatGame();
    const fresh = put(s, 0, 0, 'front', unitCard(), { fresh: true });
    const blitz = put(s, 0, 1, 'front', unitCard({ keywords: ['blitz'] }), { fresh: true });
    expect(targetsOf(s, fresh)).toEqual([]);
    expect(targetsOf(s, blitz).length).toBeGreaterThan(0);
  });
});

describe('targeting', () => {
  it('must hit the enemy Front unit before the Rear unit, and the Rear if Front is empty', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard());
    const front = put(s, 1, 0, 'front', unitCard());
    const rear = put(s, 1, 0, 'rear', unitCard());
    expect(targetsOf(s, a)).toEqual([unitRef(front)]);
    s.players[1].lanes[0].front = null;
    expect(targetsOf(s, a)).toEqual([unitRef(rear)]);
  });

  it('only attacks the unit in its own lane', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard());
    const other = put(s, 1, 1, 'front', unitCard());
    expect(targetsOf(s, a)).not.toContainEqual(unitRef(other));
  });

  it('melee units in the Rear cannot attack, Ranged units in the Rear can', () => {
    const s = combatGame();
    const melee = put(s, 0, 0, 'rear', unitCard());
    const gun = put(s, 0, 1, 'rear', unitCard({ keywords: ['ranged'] }));
    put(s, 1, 0, 'front', unitCard());
    put(s, 1, 1, 'front', unitCard());
    expect(targetsOf(s, melee)).toEqual([]);
    expect(targetsOf(s, gun)).toHaveLength(1);
  });

  it('Breakthrough: an empty lane lets the attacker hit the HQ or any building', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard({ attack: 2 }));
    const b1 = addBuilding(s, 1, buildingCard());
    const b2 = addBuilding(s, 1, buildingCard());
    const t = targetsOf(s, a);
    expect(t).toContainEqual(hq1);
    expect(t).toContainEqual({ kind: 'building', uid: b1.uid });
    expect(t).toContainEqual({ kind: 'building', uid: b2.uid });
    const r = attack(s, a, hq1);
    expect(r.state.players[1].hq).toBe(18);
    expect(r.state.players[0].lanes[0].front?.hp).toBe(2);
  });

  it('cannot hit the HQ while an enemy unit blocks the lane', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard());
    put(s, 1, 0, 'front', unitCard());
    expect(targetsOf(s, a)).not.toContainEqual(hq1);
  });

  it('Guard buildings must be hit before the HQ or other buildings', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard());
    const plain = addBuilding(s, 1, buildingCard());
    const bunker = addBuilding(s, 1, BUNKER);
    expect(targetsOf(s, a)).toEqual([{ kind: 'building', uid: bunker.uid }]);
    expect(targetsOf(s, a)).not.toContainEqual({ kind: 'building', uid: plain.uid });
    bunker.hp = 1;
    const r = attack(s, a, { kind: 'building', uid: bunker.uid });
    expect(r.state.players[1].buildings.map((b) => b.uid)).toEqual([plain.uid]);
    expect(targetsOf(r.state, r.state.players[0].lanes[0].front!)).toEqual([]); // already attacked
  });

  it('destroying a building frees its slot and sends it to the discard', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard({ attack: 5 }));
    const b = addBuilding(s, 1, buildingCard({ hp: 4 }));
    const r = attack(s, a, { kind: 'building', uid: b.uid });
    expect(r.state.players[1].buildings).toHaveLength(0);
    expect(r.state.players[1].discard).toHaveLength(1);
    expect(r.events.some((e) => e.type === 'buildingDestroyed')).toBe(true);
  });

  it('winning: reducing the enemy HQ to 0 ends the game', () => {
    const s = combatGame();
    s.players[1].hq = 2;
    const a = put(s, 0, 0, 'front', unitCard({ attack: 2 }));
    const r = attack(s, a, hq1);
    expect(isTerminal(r.state)).toEqual({ winner: 0 });
    expect(r.state.phase).toBe('ended');
    expect(legalActions(r.state, 0)).toEqual([]);
  });
});

describe('damage rules', () => {
  it('Armour reduces each hit but never below 1', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard({ attack: 2 }));
    const tank = put(s, 1, 0, 'front', unitCard({ attack: 0, hp: 5, armour: 1 }));
    expect(attack(s, a, unitRef(tank)).state.players[1].lanes[0].front?.hp).toBe(4);

    const pea = put(s, 0, 1, 'front', unitCard({ attack: 1 }));
    const heavy = put(s, 1, 1, 'front', unitCard({ attack: 0, hp: 5, armour: 3 }));
    expect(attack(s, pea, unitRef(heavy)).state.players[1].lanes[1].front?.hp).toBe(4);
  });

  it('Piercing ignores Armour', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard({ attack: 3, keywords: ['piercing'] }));
    const tank = put(s, 1, 0, 'front', unitCard({ attack: 0, hp: 5, armour: 2 }));
    expect(attack(s, a, unitRef(tank)).state.players[1].lanes[0].front?.hp).toBe(2);
  });

  it('counter-damage is reduced by the attacker\'s Armour', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard({ attack: 1, hp: 5, armour: 2 }));
    const d = put(s, 1, 0, 'front', unitCard({ attack: 2, hp: 5 }));
    const r = attack(s, a, unitRef(d));
    expect(r.state.players[0].lanes[0].front?.hp).toBe(4); // 2 - 2 -> min 1
  });

  it('Siege adds damage against buildings and the HQ but not units', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard({ attack: 2, siege: 3, hp: 9 }));
    expect(attack(s, a, hq1).state.players[1].hq).toBe(15);

    const b = put(s, 0, 1, 'front', unitCard({ attack: 2, siege: 3, hp: 9 }));
    const d = put(s, 1, 1, 'front', unitCard({ attack: 0, hp: 9 }));
    expect(attack(s, b, unitRef(d)).state.players[1].lanes[1].front?.hp).toBe(7);
  });

  it('Ranged attacks are not countered', () => {
    const s = combatGame();
    const gun = put(s, 0, 0, 'rear', unitCard({ attack: 1, hp: 1, keywords: ['ranged'] }));
    const d = put(s, 1, 0, 'front', unitCard({ attack: 5, hp: 5 }));
    const r = attack(s, gun, unitRef(d));
    expect(r.state.players[0].lanes[0].rear?.hp).toBe(1);
    expect(r.state.players[1].lanes[0].front?.hp).toBe(4);
  });

  it('Tenacity: survives the first lethal hit with 1 HP, dies to the second', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard({ attack: 5, hp: 9 }));
    const gun = put(s, 0, 0, 'rear', unitCard({ attack: 5, hp: 9, keywords: ['ranged'] }));
    const t = put(s, 1, 0, 'front', unitCard({ attack: 0, hp: 2, keywords: ['tenacity'] }));
    let r = attack(s, a, unitRef(t));
    expect(r.state.players[1].lanes[0].front?.hp).toBe(1);
    expect(r.events.some((e) => e.type === 'tenacity')).toBe(true);
    r = attack(r.state, gun, unitRef(t));
    expect(r.state.players[1].lanes[0].front).toBeNull();
  });

  it('Dug In gives +1 Armour only during the opponent\'s turn', () => {
    const s = combatGame();
    const a = put(s, 0, 0, 'front', unitCard({ attack: 2 }));
    const d = put(s, 1, 0, 'front', unitCard({ attack: 0, hp: 5, keywords: ['dugIn'] }));
    expect(attack(s, a, unitRef(d)).state.players[1].lanes[0].front?.hp).toBe(4);
  });

  it('Mass: +1 ATK while controlling three or more units', () => {
    const s = combatGame();
    const mass = put(s, 0, 0, 'front', unitCard({ attack: 1, keywords: ['mass'], hp: 9 }));
    const d = put(s, 1, 0, 'front', unitCard({ attack: 0, hp: 9 }));
    expect(attack(s, mass, unitRef(d)).state.players[1].lanes[0].front?.hp).toBe(8);
    put(s, 0, 1, 'front', unitCard());
    put(s, 0, 2, 'front', unitCard());
    expect(attack(s, mass, unitRef(d)).state.players[1].lanes[0].front?.hp).toBe(7);
  });

  it('Rally: other friendly Infantry in the same lane get +1 ATK', () => {
    const s = combatGame();
    const grunt = put(s, 0, 0, 'front', unitCard({ attack: 2, hp: 9 }));
    put(s, 0, 0, 'rear', unitCard({ attack: 0, keywords: ['rally'] }));
    const elsewhere = put(s, 0, 1, 'front', unitCard({ attack: 2, hp: 9 }));
    const d0 = put(s, 1, 0, 'front', unitCard({ attack: 0, hp: 9 }));
    const d1 = put(s, 1, 1, 'front', unitCard({ attack: 0, hp: 9 }));
    expect(attack(s, grunt, unitRef(d0)).state.players[1].lanes[0].front?.hp).toBe(6);
    expect(attack(s, elsewhere, unitRef(d1)).state.players[1].lanes[1].front?.hp).toBe(7);
  });
});

describe('Ranged variants', () => {
  it('Indirect units can strike units in other lanes', () => {
    const s = combatGame();
    const mortar = put(s, 0, 0, 'rear', unitCard({ keywords: ['ranged', 'indirect'] }));
    const near = put(s, 1, 0, 'front', unitCard());
    const far = put(s, 1, 2, 'front', unitCard());
    const t = targetsOf(s, mortar);
    expect(t).toContainEqual(unitRef(far));
    expect(t).toContainEqual(unitRef(near));
    expect(t).not.toContainEqual(hq1); // the attacker's own lane has a target
  });

  it('Indirect units still follow Breakthrough when their own lane is empty', () => {
    const s = combatGame();
    const mortar = put(s, 0, 0, 'rear', unitCard({ keywords: ['ranged', 'indirect'] }));
    const t = targetsOf(s, mortar);
    expect(t).toContainEqual(hq1);
  });

  it('Precision units may choose either enemy unit in the lane', () => {
    const s = combatGame();
    const sniper = put(s, 0, 0, 'rear', unitCard({ keywords: ['precision'] }));
    const front = put(s, 1, 0, 'front', unitCard());
    const rear = put(s, 1, 0, 'rear', unitCard());
    expect(targetsOf(s, sniper)).toEqual([unitRef(front), unitRef(rear)]);
  });

  it('Salvo hits every enemy unit in the target lane, applying Armour to each', () => {
    const s = combatGame();
    const rockets = put(s, 0, 0, 'rear', unitCard({ attack: 3, keywords: ['ranged', 'salvo'] }));
    const front = put(s, 1, 0, 'front', unitCard({ attack: 0, hp: 5 }));
    const rear = put(s, 1, 0, 'rear', unitCard({ attack: 0, hp: 5, armour: 2 }));
    const other = put(s, 1, 1, 'front', unitCard({ attack: 0, hp: 5 }));
    const r = attack(s, rockets, unitRef(front));
    expect(r.state.players[1].lanes[0].front?.hp).toBe(2);
    expect(r.state.players[1].lanes[0].rear?.hp).toBe(4);
    expect(r.state.players[1].lanes[1].front?.hp).toBe(other.hp);
  });
});

describe('Flying and Anti-Air', () => {
  it('Flying attackers ignore lane protection and may hit units, buildings or the HQ', () => {
    const s = combatGame();
    const plane = put(s, 0, 0, 'rear', unitCard({ keywords: ['flying'] }));
    const front = put(s, 1, 0, 'front', unitCard());
    const rear = put(s, 1, 0, 'rear', unitCard());
    const b = addBuilding(s, 1, buildingCard());
    const t = targetsOf(s, plane);
    expect(t).toEqual(
      expect.arrayContaining([unitRef(front), unitRef(rear), { kind: 'building', uid: b.uid }, hq1]),
    );
  });

  it('Flying attackers ignore Guard', () => {
    const s = combatGame();
    const plane = put(s, 0, 0, 'front', unitCard({ keywords: ['flying'] }));
    addBuilding(s, 1, BUNKER);
    expect(targetsOf(s, plane)).toContainEqual(hq1);
  });

  it('ground units cannot target Flying units without Anti-Air (the lane counts as empty)', () => {
    const s = combatGame();
    const grunt = put(s, 0, 0, 'front', unitCard());
    const plane = put(s, 1, 0, 'front', unitCard({ keywords: ['flying'] }));
    const t = targetsOf(s, grunt);
    expect(t).not.toContainEqual(unitRef(plane));
    expect(t).toContainEqual(hq1); // lane counts as empty
  });

  it('Anti-Air ground units can target Flying units', () => {
    const s = combatGame();
    const flak = put(s, 0, 0, 'rear', unitCard({ keywords: ['ranged', 'antiAir'] }));
    const plane = put(s, 1, 0, 'front', unitCard({ keywords: ['flying'] }));
    expect(targetsOf(s, flak)).toContainEqual(unitRef(plane));
  });

  it('a Flying attacker is not countered by ground units but is by other Flying units', () => {
    const s = combatGame();
    const plane = put(s, 0, 0, 'front', unitCard({ attack: 1, hp: 5, keywords: ['flying'] }));
    const ground = put(s, 1, 0, 'front', unitCard({ attack: 3, hp: 5 }));
    expect(attack(s, plane, unitRef(ground)).state.players[0].lanes[0].front?.hp).toBe(5);

    const plane2 = put(s, 0, 1, 'front', unitCard({ attack: 1, hp: 5, keywords: ['flying'] }));
    const enemyPlane = put(s, 1, 1, 'front', unitCard({ attack: 2, hp: 5, keywords: ['flying'] }));
    expect(attack(s, plane2, unitRef(enemyPlane)).state.players[0].lanes[1].front?.hp).toBe(3);
  });

  it('Fighters deal +2 damage to Flying units and count as Flying + Anti-Air', () => {
    const s = combatGame();
    const fighter = put(s, 0, 0, 'front', unitCard({ attack: 3, hp: 5, keywords: ['fighter'] }));
    const bomber = put(s, 1, 0, 'front', unitCard({ attack: 0, hp: 5, keywords: ['flying'] }));
    const ground = put(s, 1, 0, 'rear', unitCard({ attack: 0, hp: 5 }));
    expect(targetsOf(s, fighter)).toContainEqual(unitRef(ground)); // Flying: any unit in lane
    const r = attack(s, fighter, unitRef(bomber));
    expect(r.state.players[1].lanes[0].front).toBeNull(); // 3 + 2 = 5
  });

  it('AA batteries damage an enemy Flying unit when the attacker\'s Combat phase begins', () => {
    let s = newGame(1, 0);
    put(s, 0, 0, 'front', unitCard({ hp: 3, keywords: ['flying'] }));
    put(s, 0, 1, 'front', unitCard({ hp: 3 }));
    addBuilding(s, 1, ANTI_AIRCRAFT_BATTERY);
    s = step(s, { type: 'endMain', player: 0 }).state;
    expect(s.players[0].lanes[0].front?.hp).toBe(1);
    expect(s.players[0].lanes[1].front?.hp).toBe(3);
  });

  it('AA batteries can destroy a Flying unit and do nothing without targets', () => {
    let s = newGame(1, 0);
    put(s, 0, 0, 'front', unitCard({ hp: 2, keywords: ['flying'] }));
    addBuilding(s, 1, ANTI_AIRCRAFT_BATTERY);
    s = step(s, { type: 'endMain', player: 0 }).state;
    expect(s.players[0].lanes[0].front).toBeNull();
    expect(s.players[0].discard).toHaveLength(1);

    const s2 = newGame(1, 0);
    addBuilding(s2, 1, ANTI_AIRCRAFT_BATTERY);
    expect(() => apply(s2, { type: 'endMain', player: 0 })).not.toThrow();
  });
});

describe('Smoke', () => {
  it('blocks enemy Ranged attacks (including Breakthrough) into the lane but not melee attacks', () => {
    const s = combatGame();
    s.players[1].smoke = [true, false, false];
    const gun = put(s, 0, 0, 'rear', unitCard({ keywords: ['ranged'] }));
    const melee = put(s, 0, 1, 'front', unitCard());
    put(s, 1, 0, 'front', unitCard());
    expect(targetsOf(s, gun)).toEqual([]);

    s.players[1].lanes[0].front = null;
    expect(targetsOf(s, gun)).toEqual([]); // no Breakthrough through smoke either
    expect(targetsOf(s, melee).length).toBeGreaterThan(0);
  });

  it('Indirect units can still shell other lanes', () => {
    const s = combatGame();
    s.players[1].smoke = [true, false, false];
    const mortar = put(s, 0, 0, 'rear', unitCard({ keywords: ['indirect'] }));
    const hidden = put(s, 1, 0, 'front', unitCard());
    const exposed = put(s, 1, 2, 'front', unitCard());
    const t = targetsOf(s, mortar);
    expect(t).toContainEqual(unitRef(exposed));
    expect(t).not.toContainEqual(unitRef(hidden));
  });
});
