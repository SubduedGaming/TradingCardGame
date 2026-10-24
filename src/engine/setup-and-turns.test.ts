import { describe, expect, it } from 'vitest';
import { apply, createGame, hashState, IllegalActionError, isTerminal, legalActions } from './game';
import { HAND_LIMIT, RESOURCE_CAP, TURN_LIMIT } from './types';
import type { Card } from './types';
import { buildStarterDeck, BARRACKS, RIFLE_SQUAD } from '../cards/ww2';
import {
  addBuilding,
  buildingCard,
  newGame,
  put,
  setHand,
  setResources,
  step,
  toCombat,
  unitCard,
} from './testkit';

const decks = (): [Card[], Card[]] => [buildStarterDeck(), buildStarterDeck()];

describe('setup', () => {
  it('deals 5 cards, 20 HQ HP and starts in the mulligan phase', () => {
    const s = createGame({ seed: 7, decks: decks(), first: 0 });
    expect(s.phase).toBe('mulligan');
    for (const p of s.players) {
      expect(p.hand).toHaveLength(5);
      expect(p.deck).toHaveLength(25);
      expect(p.hq).toBe(20);
    }
  });

  it('gives the second player 1 Supplies', () => {
    const s = createGame({ seed: 7, decks: decks(), first: 0 });
    expect(s.players[0].resources.supplies).toBe(0);
    expect(s.players[1].resources.supplies).toBe(1);
    const s2 = createGame({ seed: 7, decks: decks(), first: 1 });
    expect(s2.players[0].resources.supplies).toBe(1);
  });

  it('is deterministic for a given seed and differs across seeds', () => {
    const a = createGame({ seed: 42, decks: decks() });
    const b = createGame({ seed: 42, decks: decks() });
    const c = createGame({ seed: 43, decks: decks() });
    expect(hashState(a)).toBe(hashState(b));
    expect(hashState(a)).not.toBe(hashState(c));
  });

  it('does not mutate the input state when applying actions', () => {
    const s = createGame({ seed: 1, decks: decks(), first: 0 });
    const before = hashState(s);
    apply(s, { type: 'mulligan', player: 0, keep: true });
    expect(hashState(s)).toBe(before);
  });

  it('mulligan: redraws one fewer card, once', () => {
    let s = createGame({ seed: 3, decks: decks(), first: 0 });
    s = apply(s, { type: 'mulligan', player: 0, keep: false }).state;
    expect(s.players[0].hand).toHaveLength(4);
    expect(s.players[0].deck).toHaveLength(26);
    expect(legalActions(s, 0).some((a) => a.type === 'mulligan')).toBe(false);
    expect(s.phase).toBe('mulligan');
  });

  it('starts turn 1 for the first player when both mulligans are done', () => {
    const s = newGame(5, 1);
    expect(s.phase).toBe('main');
    expect(s.active).toBe(1);
    expect(s.turn).toBe(1);
  });
});

describe('turn flow', () => {
  it('produces HQ income and skips the first player\'s opening draw', () => {
    const s = newGame(1, 0);
    expect(s.players[0].resources).toEqual({ manpower: 1, steel: 0, fuel: 0, supplies: 1 });
    expect(s.players[0].hand).toHaveLength(5);
  });

  it('second player draws on their first turn and gets HQ income plus the bonus', () => {
    let s = newGame(1, 0);
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    expect(s.active).toBe(1);
    expect(s.turn).toBe(2);
    expect(s.players[1].hand).toHaveLength(6);
    expect(s.players[1].resources).toEqual({ manpower: 1, steel: 0, fuel: 0, supplies: 2 });
  });

  it('banks unspent resources across turns', () => {
    let s = newGame(1, 0);
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    s = step(s, { type: 'endMain', player: 1 }, { type: 'endTurn', player: 1 }).state;
    expect(s.players[0].resources.manpower).toBe(2);
    expect(s.players[0].resources.supplies).toBe(2);
  });

  it('caps each resource at 10', () => {
    let s = newGame(1, 0);
    s.players[1].resources.manpower = RESOURCE_CAP;
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    expect(s.players[1].resources.manpower).toBe(RESOURCE_CAP);
  });

  it('buildings produce from the owner\'s next turn, not the turn they are built', () => {
    let s = newGame(1, 0);
    setHand(s, 0, [BARRACKS]);
    s = step(s, { type: 'construct', player: 0, cardIndex: 0 }).state;
    expect(s.players[0].resources.manpower).toBe(1);
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    s = step(s, { type: 'endMain', player: 1 }, { type: 'endTurn', player: 1 }).state;
    // HQ (+1) and Barracks (+1) on top of the 1 Manpower banked.
    expect(s.players[0].resources.manpower).toBe(3);
  });

  it('advances a Rear unit into an empty Front slot at the owner\'s start of turn', () => {
    let s = newGame(1, 0);
    const rear = put(s, 0, 1, 'rear', unitCard());
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    expect(s.players[0].lanes[1].rear?.uid).toBe(rear.uid);
    s = step(s, { type: 'endMain', player: 1 }, { type: 'endTurn', player: 1 }).state;
    expect(s.players[0].lanes[1].front?.uid).toBe(rear.uid);
    expect(s.players[0].lanes[1].rear).toBeNull();
  });

  it('deals escalating Fatigue damage when drawing from an empty deck', () => {
    let s = newGame(1, 0);
    s.players[1].deck = [];
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    expect(s.players[1].hq).toBe(19);
    s = step(s, { type: 'endMain', player: 1 }, { type: 'endTurn', player: 1 }).state;
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    expect(s.players[1].hq).toBe(17);
  });

  it('ends the game when Fatigue kills an HQ', () => {
    let s = newGame(1, 0);
    s.players[1].deck = [];
    s.players[1].hq = 1;
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    expect(isTerminal(s)).toEqual({ winner: 0 });
  });

  it('forces a discard down to the hand limit before the turn passes', () => {
    let s = newGame(1, 0);
    setHand(s, 0, Array.from({ length: HAND_LIMIT + 2 }, () => RIFLE_SQUAD));
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    expect(s.phase).toBe('discard');
    expect(s.active).toBe(0);
    s = step(s, { type: 'discard', player: 0, cardIndex: 0 }).state;
    expect(s.phase).toBe('discard');
    s = step(s, { type: 'discard', player: 0, cardIndex: 0 }).state;
    expect(s.phase).toBe('main');
    expect(s.active).toBe(1);
    expect(s.players[0].hand).toHaveLength(HAND_LIMIT);
    expect(s.players[0].discard).toHaveLength(2);
  });

  it('decides the game by HQ HP at the turn limit', () => {
    let s = newGame(1, 0);
    s.turn = TURN_LIMIT;
    s.players[1].hq = 12;
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    expect(isTerminal(s)).toEqual({ winner: 0 });
  });

  it('draws at the turn limit when HQ HP is equal', () => {
    let s = newGame(1, 0);
    s.turn = TURN_LIMIT;
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    expect(isTerminal(s)).toEqual({ winner: 'draw' });
  });

  it('a draw happens when both HQs are at 0 at the same state check', () => {
    let s = newGame(1, 0);
    s.players[0].hq = 0;
    s.players[1].hq = 0;
    s = step(s, { type: 'endMain', player: 0 }).state;
    expect(isTerminal(s)).toEqual({ winner: 'draw' });
    expect(s.phase).toBe('ended');
  });

  it('concede ends the game for the opponent, even out of turn', () => {
    const s = newGame(1, 0);
    const r = apply(s, { type: 'concede', player: 1 });
    expect(isTerminal(r.state)).toEqual({ winner: 0 });
    expect(legalActions(r.state, 0)).toEqual([]);
  });
});

describe('Upkeep', () => {
  const bomber = unitCard({
    id: 'test.unit.bomber',
    role: 'air',
    keywords: ['flying'],
    upkeep: { fuel: 1 },
  });

  it('pays Fuel upkeep when affordable', () => {
    let s = newGame(1, 0);
    const u = put(s, 0, 0, 'front', bomber);
    setResources(s, 0, { fuel: 2 });
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    s = step(s, { type: 'endMain', player: 1 }, { type: 'endTurn', player: 1 }).state;
    expect(s.players[0].resources.fuel).toBe(1);
    expect(s.players[0].lanes[0].front?.grounded).toBe(false);
    expect(u.uid).toBe(s.players[0].lanes[0].front?.uid);
  });

  it('Grounds a unit whose upkeep cannot be paid, so it cannot attack', () => {
    let s = newGame(1, 0);
    put(s, 0, 0, 'front', bomber);
    setResources(s, 0, {});
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    s = step(s, { type: 'endMain', player: 1 }, { type: 'endTurn', player: 1 }).state;
    const unit = s.players[0].lanes[0].front!;
    expect(unit.grounded).toBe(true);
    s = step(s, { type: 'endMain', player: 0 }).state;
    expect(legalActions(s, 0).some((a) => a.type === 'attack')).toBe(false);
  });
});

describe('Start-of-turn effects and building production', () => {
  it('multiple buildings add up and respect the cap', () => {
    let s = newGame(1, 0);
    const mine = buildingCard({ produces: { steel: 2 } });
    addBuilding(s, 1, mine);
    addBuilding(s, 1, mine);
    setResources(s, 1, { steel: 8 });
    s = step(s, { type: 'endMain', player: 0 }, { type: 'endTurn', player: 0 }).state;
    expect(s.players[1].resources.steel).toBe(RESOURCE_CAP);
  });

  it('combat can be skipped entirely', () => {
    let s = newGame(1, 0);
    toCombat(s);
    s = step(s, { type: 'endTurn', player: 0 }).state;
    expect(s.active).toBe(1);
  });
});

describe('illegal actions', () => {
  it('rejects acting out of turn, in the wrong phase and with bad indexes', () => {
    const s = newGame(1, 0);
    expect(() => apply(s, { type: 'endMain', player: 1 })).toThrow(IllegalActionError);
    expect(() => apply(s, { type: 'endTurn', player: 0 })).toThrow(IllegalActionError);
    expect(() => apply(s, { type: 'construct', player: 0, cardIndex: 99 })).toThrow(IllegalActionError);
    expect(() =>
      apply(s, { type: 'attack', player: 0, unitUid: 'nope', target: { kind: 'hq', player: 1 } }),
    ).toThrow(IllegalActionError);
  });
});
