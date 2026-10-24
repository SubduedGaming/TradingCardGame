import { describe, expect, it } from 'vitest';
import { apply, createGame, hashState, isTerminal, legalActions, observation } from './game';
import { nextInt } from './rng';
import type { Action, GameState, PlayerId } from './types';
import { BUILDING_SLOTS, RESOURCE_CAP, RESOURCE_TYPES } from './types';
import { buildStarterDeck } from '../cards/ww2';
import { actingPlayer, newGame, unitCard } from './testkit';

const DECK_SIZE = 30;

function countCards(s: GameState, player: PlayerId): number {
  const p = s.players[player];
  let units = 0;
  for (const lane of p.lanes) units += (lane.front ? 1 : 0) + (lane.rear ? 1 : 0);
  return p.deck.length + p.hand.length + p.discard.length + p.buildings.length + units;
}

function expectInvariants(s: GameState): void {
  for (const player of [0, 1] as const) {
    const p = s.players[player];
    for (const r of RESOURCE_TYPES) {
      expect(p.resources[r]).toBeGreaterThanOrEqual(0);
      expect(p.resources[r]).toBeLessThanOrEqual(RESOURCE_CAP);
    }
    expect(p.buildings.length).toBeLessThanOrEqual(BUILDING_SLOTS);
    expect(countCards(s, player)).toBe(DECK_SIZE);
    for (const lane of p.lanes) {
      for (const u of [lane.front, lane.rear]) {
        if (!u) continue;
        expect(u.hp).toBeGreaterThan(0);
        expect(u.hp).toBeLessThanOrEqual(u.maxHp);
        expect(u.owner).toBe(player);
      }
    }
    for (const b of p.buildings) expect(b.hp).toBeGreaterThan(0);
  }
}

/** Picks a random non-concede legal action, favouring actions that are not "end phase". */
function pickAction(s: GameState, player: PlayerId, rng: { rng: number }): Action {
  const all = legalActions(s, player).filter((a) => a.type !== 'concede');
  const busy = all.filter((a) => a.type !== 'endMain' && a.type !== 'endTurn');
  const pool = busy.length > 0 && nextInt(rng, 10) < 8 ? busy : all;
  return pool[nextInt(rng, pool.length)]!;
}

function playRandomGame(seed: number): { final: GameState; actions: Action[] } {
  let s = createGame({ seed, decks: [buildStarterDeck(), buildStarterDeck()] });
  const rng = { rng: seed * 7919 + 1 };
  const actions: Action[] = [];
  for (let i = 0; i < 20000 && !isTerminal(s); i++) {
    const action = pickAction(s, actingPlayer(s), rng);
    actions.push(action);
    s = apply(s, action).state;
    expectInvariants(s);
  }
  return { final: s, actions };
}

describe('random play', () => {
  it('plays many full games to completion without breaking any invariant', () => {
    let hqWins = 0;
    let totalActions = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { final, actions } = playRandomGame(seed);
      expect(isTerminal(final)).not.toBeNull();
      expect(final.phase).toBe('ended');
      expect(legalActions(final, 0)).toEqual([]);
      totalActions += actions.length;
      if (final.players[0].hq <= 0 || final.players[1].hq <= 0) hqWins++;
    }
    expect(totalActions).toBeGreaterThan(1000);
    expect(hqWins).toBeGreaterThan(0);
  });

  it('replaying the recorded actions reproduces the exact final state', () => {
    for (const seed of [3, 11, 29]) {
      const { final, actions } = playRandomGame(seed);
      let s = createGame({ seed, decks: [buildStarterDeck(), buildStarterDeck()] });
      for (const a of actions) s = apply(s, a).state;
      expect(hashState(s)).toBe(hashState(final));
    }
  });

  it('every legal action applies without throwing (sampled across a game)', () => {
    let s = createGame({ seed: 99, decks: [buildStarterDeck(), buildStarterDeck()] });
    const rng = { rng: 5 };
    for (let i = 0; i < 400 && !isTerminal(s); i++) {
      const player = actingPlayer(s);
      for (const a of legalActions(s, player)) {
        if (a.type === 'concede') continue;
        expect(() => apply(s, a)).not.toThrow();
      }
      s = apply(s, pickAction(s, player, rng)).state;
    }
  });
});

describe('observation', () => {
  it('hides the opponent hand and both decks but shows own hand and public board', () => {
    const s = newGame(1, 0);
    s.players[1].hand[0] = unitCard({ id: 'test.unit.secret-hand', name: 'SecretHand' });
    s.players[1].deck[0] = unitCard({ id: 'test.unit.secret-deck', name: 'SecretDeck' });
    s.players[0].deck[0] = unitCard({ id: 'test.unit.my-deck', name: 'MyDeck' });
    const obs = observation(s, 0);
    expect(obs.you.hand).toHaveLength(5);
    expect(obs.you.deckSize).toBe(25);
    expect(obs.opponent.handSize).toBe(5);
    expect(obs.opponent.deckSize).toBe(25);
    expect('hand' in obs.opponent).toBe(false);
    expect('deck' in obs.opponent).toBe(false);
    expect('deck' in obs.you).toBe(false);
    const json = JSON.stringify(obs);
    expect(json).not.toContain('SecretHand');
    expect(json).not.toContain('SecretDeck');
    expect(json).not.toContain('MyDeck');
  });
});
