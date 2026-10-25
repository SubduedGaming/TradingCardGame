import { describe, expect, it } from 'vitest';
import { buildStarterDeck } from '../cards/ww2';
import { apply, createGame, isLegal, isTerminal } from '../engine/game';
import { validateDeck } from '../engine/deck';
import { chooseDoctrine } from '../engine/doctrine';
import { NATIONS } from '../cards/plan';
import { recruitAgent, veteranAgent } from './agents';
import { evaluate } from './evaluate';
import { buildNationDeck } from './decks';
import { actingSeat, playMatch, playSeries } from './sim';

const starter = () => buildStarterDeck();

describe('agents', () => {
  for (const agent of [recruitAgent(), veteranAgent()]) {
    it(`${agent.name} only ever chooses legal actions and finishes the game`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        let s = createGame({ seed, decks: [starter(), starter()] });
        const rng = { rng: seed };
        for (let i = 0; i < 5000 && !isTerminal(s); i++) {
          const player = actingSeat(s);
          const action = agent.choose(s, player, rng);
          expect(isLegal(s, action), JSON.stringify(action)).toBe(true);
          expect(action.type).not.toBe('concede');
          s = apply(s, action).state;
        }
        expect(s.winner).not.toBeNull();
      }
    });
  }

  it('is deterministic: the same seed gives the same match', () => {
    const run = () => playMatch(7, [{ deck: starter(), agent: veteranAgent() }, { deck: starter(), agent: recruitAgent() }]);
    const a = run();
    const b = run();
    expect([a.winner, a.turns, a.actions]).toEqual([b.winner, b.turns, b.actions]);
  });

  it('does not read the opponent hand: the evaluation is unchanged by swapping its contents', () => {
    const s = createGame({ seed: 3, decks: [starter(), starter()] });
    const before = evaluate(s, 0);
    const other = structuredClone(s);
    other.players[1].hand = [...other.players[1].hand].reverse();
    expect(evaluate(other, 0)).toBe(before);
    other.players[1].hand = other.players[1].hand.map((c) => other.players[1].deck[0] ?? c);
    expect(evaluate(other, 0)).toBe(before);
  });
});

describe('evaluation', () => {
  it('scores a won game as very good and a lost game as very bad', () => {
    const s = createGame({ seed: 1, decks: [starter(), starter()] });
    s.winner = 0;
    expect(evaluate(s, 0)).toBeGreaterThan(500);
    expect(evaluate(s, 1)).toBeLessThan(-500);
    s.winner = 'draw';
    expect(evaluate(s, 0)).toBe(0);
  });
});

describe('difficulty tiers (docs/05 section 3)', () => {
  it('Veteran clearly beats Recruit with the same deck, seats swapped', () => {
    const r = playSeries(60, 500, { deck: starter(), agent: veteranAgent() }, { deck: starter(), agent: recruitAgent() });
    expect(r.wins[0] / r.games).toBeGreaterThan(0.7);
  });

  it('in a Veteran mirror the first player has only a small edge', () => {
    const r = playSeries(80, 900, { deck: starter(), agent: veteranAgent() }, { deck: starter(), agent: veteranAgent() });
    expect(r.firstPlayerWins / (r.games - r.draws)).toBeLessThan(0.65);
  });
});

describe('AI decks', () => {
  for (const nation of NATIONS) {
    it(`builds legal ${nation} decks that unlock the ${nation} doctrine`, () => {
      for (let i = 1; i <= 8; i++) {
        const deck = buildNationDeck(nation, { rng: i });
        expect(validateDeck(deck)).toEqual([]);
        expect(chooseDoctrine(deck)).toBe(nation);
        expect(deck.every((c) => c.nation === nation || c.nation === 'neutral')).toBe(true);
      }
    });
  }
});
