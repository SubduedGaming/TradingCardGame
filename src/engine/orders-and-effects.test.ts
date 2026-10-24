import { describe, expect, it } from 'vitest';
import { apply, IllegalActionError, legalActions } from './game';
import type { GameState, TargetRef, UnitInPlay } from './types';
import {
  AIR_RAID,
  DIG_IN,
  FIELD_HOSPITAL,
  FIELD_MEDIC,
  FORCED_MARCH,
  REINFORCEMENTS,
  SABOTAGE,
  SMOKE_SCREEN,
} from '../cards/ww2';
import {
  addBuilding,
  buildingCard,
  newGame,
  orderCard,
  put,
  setHand,
  setResources,
  step,
  unitCard,
} from './testkit';

const unitRef = (u: UnitInPlay): TargetRef => ({ kind: 'unit', uid: u.uid });

function orders(s: GameState) {
  return legalActions(s, 0).filter((a) => a.type === 'order');
}

describe('Reinforcements', () => {
  it('draws two cards, costs 2 Supplies and goes to the discard', () => {
    let s = newGame(1, 0);
    setHand(s, 0, [REINFORCEMENTS]);
    setResources(s, 0, { supplies: 3 });
    const deckBefore = s.players[0].deck.length;
    s = step(s, { type: 'order', player: 0, cardIndex: 0, targets: [] }).state;
    expect(s.players[0].hand).toHaveLength(2);
    expect(s.players[0].deck).toHaveLength(deckBefore - 2);
    expect(s.players[0].resources.supplies).toBe(1);
    expect(s.players[0].discard.map((c) => c.id)).toEqual([REINFORCEMENTS.id]);
  });

  it('cannot be played without enough Supplies', () => {
    const s = newGame(1, 0);
    setHand(s, 0, [REINFORCEMENTS]);
    setResources(s, 0, { supplies: 1 });
    expect(orders(s)).toHaveLength(0);
  });
});

describe('Forced March', () => {
  it('lets a Fresh unit attack this turn only', () => {
    let s = newGame(1, 0);
    const u = put(s, 0, 0, 'front', unitCard(), { fresh: true });
    setHand(s, 0, [FORCED_MARCH]);
    setResources(s, 0, { supplies: 1 });
    s = step(
      s,
      { type: 'order', player: 0, cardIndex: 0, targets: [unitRef(u)] },
      { type: 'endMain', player: 0 },
    ).state;
    expect(legalActions(s, 0).some((a) => a.type === 'attack' && a.unitUid === u.uid)).toBe(true);
    s = step(s, { type: 'endTurn', player: 0 }).state;
    expect(s.players[0].lanes[0].front?.tempKeywords).toEqual([]);
  });

  it('offers one legal play per friendly unit and none without units', () => {
    const s = newGame(1, 0);
    setHand(s, 0, [FORCED_MARCH]);
    setResources(s, 0, { supplies: 1 });
    expect(orders(s)).toHaveLength(0);
    put(s, 0, 0, 'front', unitCard());
    put(s, 0, 2, 'front', unitCard());
    put(s, 1, 1, 'front', unitCard());
    expect(orders(s)).toHaveLength(2);
  });

  it('rejects an enemy unit as the target', () => {
    const s = newGame(1, 0);
    const enemy = put(s, 1, 0, 'front', unitCard());
    put(s, 0, 0, 'front', unitCard());
    setHand(s, 0, [FORCED_MARCH]);
    setResources(s, 0, { supplies: 1 });
    expect(() =>
      apply(s, { type: 'order', player: 0, cardIndex: 0, targets: [unitRef(enemy)] }),
    ).toThrow(IllegalActionError);
  });
});

describe('Smoke Screen', () => {
  it('protects the chosen lane from enemy Ranged units until the caster\'s next turn', () => {
    let s = newGame(1, 0);
    put(s, 0, 0, 'front', unitCard());
    const mortar = put(s, 1, 1, 'rear', unitCard({ keywords: ['ranged', 'indirect'] }));
    setHand(s, 0, [SMOKE_SCREEN]);
    setResources(s, 0, { supplies: 1 });
    s = step(
      s,
      { type: 'order', player: 0, cardIndex: 0, targets: [{ kind: 'lane', lane: 0 }] },
      { type: 'endMain', player: 0 },
      { type: 'endTurn', player: 0 },
      { type: 'endMain', player: 1 },
    ).state;
    const shots = legalActions(s, 1).filter((a) => a.type === 'attack' && a.unitUid === mortar.uid);
    expect(shots.length).toBeGreaterThan(0); // lanes 1 and 2 are still open (HQ via breakthrough)
    expect(
      shots.some(
        (a) => a.type === 'attack' && a.target.kind === 'unit' && a.target.uid === s.players[0].lanes[0].front?.uid,
      ),
    ).toBe(false);

    s = step(s, { type: 'endTurn', player: 1 }).state;
    expect(s.players[0].smoke).toEqual([false, false, false]);
  });
});

describe('Air Raid', () => {
  it('deals 3 damage to a building and Armour-reduced damage to a unit', () => {
    const s = newGame(1, 0);
    const tank = put(s, 1, 0, 'front', unitCard({ hp: 5, armour: 1 }));
    const b = addBuilding(s, 1, buildingCard({ hp: 5 }));
    setHand(s, 0, [AIR_RAID, AIR_RAID]);
    setResources(s, 0, { supplies: 4, fuel: 2 });
    const asBuilding = step(s, {
      type: 'order',
      player: 0,
      cardIndex: 0,
      targets: [{ kind: 'building', uid: b.uid }],
    }).state;
    expect(asBuilding.players[1].buildings[0]?.hp).toBe(2);
    const asUnit = step(s, { type: 'order', player: 0, cardIndex: 0, targets: [unitRef(tank)] }).state;
    expect(asUnit.players[1].lanes[0].front?.hp).toBe(3);
  });

  it('can destroy its target, which goes to the owner\'s discard', () => {
    let s = newGame(1, 0);
    const squad = put(s, 1, 0, 'front', unitCard({ hp: 3 }));
    setHand(s, 0, [AIR_RAID]);
    setResources(s, 0, { supplies: 2, fuel: 1 });
    s = step(s, { type: 'order', player: 0, cardIndex: 0, targets: [unitRef(squad)] }).state;
    expect(s.players[1].lanes[0].front).toBeNull();
    expect(s.players[1].discard).toHaveLength(1);
  });

  it('needs a target', () => {
    const s = newGame(1, 0);
    setHand(s, 0, [AIR_RAID]);
    setResources(s, 0, { supplies: 2, fuel: 1 });
    expect(orders(s)).toHaveLength(0);
  });
});

describe('Dig In', () => {
  it('permanently adds 2 max HP and HP', () => {
    let s = newGame(1, 0);
    const u = put(s, 0, 0, 'front', unitCard({ hp: 2 }));
    setHand(s, 0, [DIG_IN]);
    setResources(s, 0, { supplies: 1, steel: 1 });
    s = step(s, { type: 'order', player: 0, cardIndex: 0, targets: [unitRef(u)] }).state;
    const after = s.players[0].lanes[0].front!;
    expect(after.hp).toBe(4);
    expect(after.maxHp).toBe(4);
  });
});

describe('Sabotage', () => {
  it('can only target buildings with 4 HP or less, and destroys them', () => {
    let s = newGame(1, 0);
    const weak = addBuilding(s, 1, buildingCard({ hp: 4 }));
    addBuilding(s, 1, buildingCard({ hp: 8 }));
    setHand(s, 0, [SABOTAGE]);
    setResources(s, 0, { supplies: 2 });
    const plays = orders(s);
    expect(plays).toHaveLength(1);
    s = step(s, { type: 'order', player: 0, cardIndex: 0, targets: [{ kind: 'building', uid: weak.uid }] }).state;
    expect(s.players[1].buildings).toHaveLength(1);
    expect(s.players[1].discard).toHaveLength(1);
  });

  it('is unplayable when every enemy building is too sturdy', () => {
    const s = newGame(1, 0);
    addBuilding(s, 1, buildingCard({ hp: 8 }));
    setHand(s, 0, [SABOTAGE]);
    setResources(s, 0, { supplies: 2 });
    expect(orders(s)).toHaveLength(0);
  });
});

describe('End-of-turn healing', () => {
  it('Field Medic heals the most damaged friendly unit in its lane by 1', () => {
    let s = newGame(1, 0);
    put(s, 0, 0, 'rear', FIELD_MEDIC);
    put(s, 0, 0, 'front', unitCard({ hp: 4 }), { hp: 1 });
    const faraway = put(s, 0, 1, 'front', unitCard({ hp: 4 }), { hp: 1 });
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    expect(s.players[0].lanes[0].front?.hp).toBe(2);
    expect(s.players[0].lanes[1].front?.hp).toBe(faraway.hp);
  });

  it('never heals above max HP and does nothing when nobody is hurt', () => {
    let s = newGame(1, 0);
    put(s, 0, 0, 'front', FIELD_MEDIC);
    const r = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 });
    expect(r.events.some((e) => e.type === 'healed')).toBe(false);
    s = r.state;
    expect(s.players[0].lanes[0].front?.hp).toBe(FIELD_MEDIC.hp);
  });

  it('Field Hospital heals the most damaged friendly unit anywhere', () => {
    let s = newGame(1, 0);
    addBuilding(s, 0, FIELD_HOSPITAL);
    put(s, 0, 0, 'front', unitCard({ hp: 4 }), { hp: 3 });
    put(s, 0, 2, 'front', unitCard({ hp: 4 }), { hp: 1 });
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    expect(s.players[0].lanes[2].front?.hp).toBe(2);
    expect(s.players[0].lanes[0].front?.hp).toBe(3);
  });
});

describe('start-of-turn triggers', () => {
  it('fire for units and buildings at the start of their owner\'s turn, before Production', () => {
    let s = newGame(1, 0);
    const payroll = unitCard({
      id: 'test.unit.paymaster',
      effects: [{ trigger: 'startOfTurn', do: 'gain', resource: 'steel', amount: 2 }],
    });
    put(s, 0, 0, 'front', payroll);
    addBuilding(
      s,
      0,
      buildingCard({ effects: [{ trigger: 'startOfTurn', do: 'gain', resource: 'fuel', amount: 1 }] }),
    );
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    expect(s.players[0].resources.steel).toBe(0); // opponent's turn: nothing fires
    s = step(s, { type: 'endMain', player: 1 }, { type: 'endTurn', player: 1 }).state;
    expect(s.players[0].resources.steel).toBe(2);
    expect(s.players[0].resources.fuel).toBe(1);
  });
});

describe('effect primitives', () => {
  it('gain adds resources up to the cap', () => {
    let s = newGame(1, 0);
    const windfall = orderCard({
      effects: [{ trigger: 'onPlay', do: 'gain', resource: 'steel', amount: 3 }],
    });
    setHand(s, 0, [windfall]);
    setResources(s, 0, { supplies: 1, steel: 9 });
    s = step(s, { type: 'order', player: 0, cardIndex: 0, targets: [] }).state;
    expect(s.players[0].resources.steel).toBe(10);
  });

  it('damage with ignoresArmour skips Armour; allEnemyFrontUnits hits every Front unit', () => {
    let s = newGame(1, 0);
    const barrage = orderCard({
      effects: [
        { trigger: 'onPlay', do: 'damage', target: { kind: 'allEnemyFrontUnits' }, amount: 2, ignoresArmour: true },
      ],
    });
    put(s, 1, 0, 'front', unitCard({ hp: 5, armour: 3 }));
    put(s, 1, 1, 'front', unitCard({ hp: 5 }));
    put(s, 1, 1, 'rear', unitCard({ hp: 5 }));
    setHand(s, 0, [barrage]);
    setResources(s, 0, { supplies: 1 });
    s = step(s, { type: 'order', player: 0, cardIndex: 0, targets: [] }).state;
    expect(s.players[1].lanes[0].front?.hp).toBe(3);
    expect(s.players[1].lanes[1].front?.hp).toBe(3);
    expect(s.players[1].lanes[1].rear?.hp).toBe(5);
  });

  it('heal restores HP on a chosen friendly unit, up to its max', () => {
    let s = newGame(1, 0);
    const strike = orderCard({
      effects: [{ trigger: 'onPlay', do: 'heal', target: { kind: 'chosen', of: 'friendlyUnit' }, amount: 2 }],
    });
    const u = put(s, 0, 0, 'front', unitCard({ hp: 4 }), { hp: 1 });
    setHand(s, 0, [strike]);
    setResources(s, 0, { supplies: 1 });
    s = step(s, { type: 'order', player: 0, cardIndex: 0, targets: [unitRef(u)] }).state;
    expect(s.players[0].lanes[0].front?.hp).toBe(3);
  });

  it('supports orders with two chosen targets', () => {
    let s = newGame(1, 0);
    const duel = orderCard({
      effects: [
        { trigger: 'onPlay', do: 'heal', target: { kind: 'chosen', of: 'friendlyUnit' }, amount: 1 },
        { trigger: 'onPlay', do: 'damage', target: { kind: 'chosen', of: 'enemyUnit' }, amount: 1, ignoresArmour: true },
      ],
    });
    const mine = put(s, 0, 0, 'front', unitCard({ hp: 3 }), { hp: 1 });
    const theirs = put(s, 1, 0, 'front', unitCard({ hp: 3 }));
    put(s, 1, 1, 'front', unitCard({ hp: 3 }));
    setHand(s, 0, [duel]);
    setResources(s, 0, { supplies: 1 });
    expect(orders(s)).toHaveLength(2); // 1 friendly x 2 enemies
    s = step(s, { type: 'order', player: 0, cardIndex: 0, targets: [unitRef(mine), unitRef(theirs)] }).state;
    expect(s.players[0].lanes[0].front?.hp).toBe(2);
    expect(s.players[1].lanes[0].front?.hp).toBe(2);
  });
});
