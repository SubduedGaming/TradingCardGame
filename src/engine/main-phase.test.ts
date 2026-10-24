import { describe, expect, it } from 'vitest';
import { apply, IllegalActionError, legalActions } from './game';
import { BUILDING_SLOTS } from './types';
import { BARRACKS, LIGHT_TANK, RIFLE_SQUAD } from '../cards/ww2';
import {
  addBuilding,
  buildingCard,
  newGame,
  put,
  setHand,
  setResources,
  step,
  unitCard,
} from './testkit';

describe('construct', () => {
  it('pays the cost, places the building and allows only one per turn', () => {
    let s = newGame(1, 0);
    setHand(s, 0, [BARRACKS, BARRACKS]);
    setResources(s, 0, { supplies: 5 });
    s = step(s, { type: 'construct', player: 0, cardIndex: 0 }).state;
    expect(s.players[0].buildings).toHaveLength(1);
    expect(s.players[0].resources.supplies).toBe(4);
    expect(s.players[0].hand).toHaveLength(1);
    expect(() => apply(s, { type: 'construct', player: 0, cardIndex: 0 })).toThrow(IllegalActionError);
  });

  it('is not allowed when unaffordable or when all building slots are full', () => {
    const s = newGame(1, 0);
    setHand(s, 0, [BARRACKS]);
    setResources(s, 0, {});
    expect(legalActions(s, 0).some((a) => a.type === 'construct')).toBe(false);

    setResources(s, 0, { supplies: 5 });
    for (let i = 0; i < BUILDING_SLOTS; i++) addBuilding(s, 0, buildingCard());
    expect(legalActions(s, 0).some((a) => a.type === 'construct')).toBe(false);
  });

  it('resets the one-per-turn limit on the next turn', () => {
    let s = newGame(1, 0);
    setHand(s, 0, [BARRACKS, BARRACKS]);
    setResources(s, 0, { supplies: 5 });
    s = step(s, { type: 'construct', player: 0, cardIndex: 0 }).state;
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    s = step(s, { type: 'endMain', player: 1 }, { type: 'endTurn', player: 1 }).state;
    expect(legalActions(s, 0).some((a) => a.type === 'construct')).toBe(true);
  });
});

describe('deploy', () => {
  it('pays the cost and places a Fresh unit in the chosen slot', () => {
    let s = newGame(1, 0);
    setHand(s, 0, [RIFLE_SQUAD]);
    setResources(s, 0, { manpower: 3 });
    const r = step(s, { type: 'deploy', player: 0, cardIndex: 0, lane: 2, row: 'rear' });
    s = r.state;
    const u = s.players[0].lanes[2].rear!;
    expect(u.card.id).toBe(RIFLE_SQUAD.id);
    expect(u.fresh).toBe(true);
    expect(s.players[0].resources.manpower).toBe(2);
    expect(r.events.some((e) => e.type === 'unitDeployed')).toBe(true);
  });

  it('cannot deploy into an occupied slot or without the right resources', () => {
    const s = newGame(1, 0);
    setHand(s, 0, [LIGHT_TANK]);
    setResources(s, 0, { steel: 2, fuel: 0 });
    expect(legalActions(s, 0).some((a) => a.type === 'deploy')).toBe(false);

    setResources(s, 0, { steel: 2, fuel: 1 });
    put(s, 0, 0, 'front', unitCard());
    const deploys = legalActions(s, 0).filter((a) => a.type === 'deploy');
    expect(deploys).toHaveLength(5);
    expect(deploys.some((a) => a.type === 'deploy' && a.lane === 0 && a.row === 'front')).toBe(false);
  });

  it('runs onDeploy effects', () => {
    let s = newGame(1, 0);
    const scout = unitCard({
      id: 'test.unit.scout',
      effects: [{ trigger: 'onDeploy', do: 'draw', count: 1 }],
    });
    setHand(s, 0, [scout]);
    setResources(s, 0, { manpower: 1 });
    s = step(s, { type: 'deploy', player: 0, cardIndex: 0, lane: 0, row: 'front' }).state;
    expect(s.players[0].hand).toHaveLength(1);
  });
});

describe('redeploy', () => {
  it('moves a non-Fresh unit to a different lane for 1 Supplies and stops it attacking', () => {
    let s = newGame(1, 0);
    const u = put(s, 0, 0, 'front', unitCard());
    setResources(s, 0, { supplies: 2 });
    s = step(s, { type: 'redeploy', player: 0, unitUid: u.uid, lane: 2, row: 'front' }).state;
    expect(s.players[0].lanes[0].front).toBeNull();
    expect(s.players[0].lanes[2].front?.uid).toBe(u.uid);
    expect(s.players[0].resources.supplies).toBe(1);
    s = step(s, { type: 'endMain', player: 0 }).state;
    expect(legalActions(s, 0).some((a) => a.type === 'attack')).toBe(false);
  });

  it('is illegal for Fresh, Heavy or already-redeployed units, and into the same lane', () => {
    const s = newGame(1, 0);
    setResources(s, 0, { supplies: 5 });
    const fresh = put(s, 0, 0, 'front', unitCard(), { fresh: true });
    const heavy = put(s, 0, 1, 'front', unitCard({ keywords: ['heavy'] }));
    const moved = put(s, 0, 2, 'front', unitCard(), { redeployed: true });
    const normal = put(s, 0, 2, 'rear', unitCard());
    const redeploys = legalActions(s, 0).filter((a) => a.type === 'redeploy');
    const movers = new Set(redeploys.map((a) => (a.type === 'redeploy' ? a.unitUid : '')));
    expect(movers.has(fresh.uid)).toBe(false);
    expect(movers.has(heavy.uid)).toBe(false);
    expect(movers.has(moved.uid)).toBe(false);
    expect(movers.has(normal.uid)).toBe(true);
    expect(
      redeploys.some((a) => a.type === 'redeploy' && a.unitUid === normal.uid && a.lane === 2),
    ).toBe(false);
  });

  it('needs 1 Supplies', () => {
    const s = newGame(1, 0);
    put(s, 0, 0, 'front', unitCard());
    setResources(s, 0, { supplies: 0 });
    expect(legalActions(s, 0).some((a) => a.type === 'redeploy')).toBe(false);
  });
});

describe('legalActions visibility', () => {
  it('only offers concede to the player who is not acting', () => {
    const s = newGame(1, 0);
    expect(legalActions(s, 1).map((a) => a.type)).toEqual(['concede']);
  });
});
