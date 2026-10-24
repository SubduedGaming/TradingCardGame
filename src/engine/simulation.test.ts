import { describe, expect, it } from 'vitest';
import { apply, createGame, hashState, isTerminal, legalActions, observation } from './game';
import { actingPlayer, newGame, unitCard } from './testkit';
import { pickAction, playRandomGame } from './simkit';
import { buildStarterDeck } from '../cards/ww2';

const starterDecks = (): [ReturnType<typeof buildStarterDeck>, ReturnType<typeof buildStarterDeck>] => [
  buildStarterDeck(),
  buildStarterDeck(),
];

describe('random play (starter armies)', () => {
  it('plays many full games to completion without breaking any invariant', () => {
    let hqWins = 0;
    let totalActions = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { final, actions } = playRandomGame(seed, starterDecks());
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
      const { final, actions } = playRandomGame(seed, starterDecks());
      let s = createGame({ seed, decks: starterDecks() });
      for (const a of actions) s = apply(s, a).state;
      expect(hashState(s)).toBe(hashState(final));
    }
  });

  it('every legal action applies without throwing (sampled across a game)', () => {
    let s = createGame({ seed: 99, decks: starterDecks() });
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
