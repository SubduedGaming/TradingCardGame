import { describe, expect, it } from 'vitest';
import { apply, hashState, isTerminal, legalActions } from './game';
import { validateCard, validateDeck } from './deck';
import type { Card, GameState, Nation } from './types';
import { RESOURCE_CAP, RESOURCE_TYPES } from './types';
import { BARRACKS, CORE_CARDS, WW2_CARDS, buildStarterDeck } from '../cards/ww2';
import { newGame, put, addBuilding, buildingCard, setHand, setResources, unitCard } from './testkit';
import { playRandomGame, randomDeck } from './simkit';

describe('set integrity', () => {
  it('has the 63-card launch core from docs/03: 12 buildings, 39 units, 12 orders', () => {
    expect(CORE_CARDS).toHaveLength(63);
    expect(CORE_CARDS.filter((c) => c.type === 'building')).toHaveLength(12);
    expect(CORE_CARDS.filter((c) => c.type === 'unit')).toHaveLength(39);
    expect(CORE_CARDS.filter((c) => c.type === 'order')).toHaveLength(12);
  });

  it('matches the documented rarity split of the launch core', () => {
    const count = (type: Card['type'], rarity: Card['rarity']) =>
      CORE_CARDS.filter((c) => c.type === type && c.rarity === rarity).length;
    expect([count('building', 'common'), count('building', 'uncommon'), count('building', 'rare'), count('building', 'legendary')]).toEqual([5, 4, 2, 1]);
    expect([count('unit', 'common'), count('unit', 'uncommon'), count('unit', 'rare'), count('unit', 'legendary')]).toEqual([14, 14, 9, 2]);
    expect([count('order', 'common'), count('order', 'uncommon'), count('order', 'rare'), count('order', 'legendary')]).toEqual([5, 4, 2, 1]);
  });

  it('has unique ids and passes static validation for every card', () => {
    expect(new Set(WW2_CARDS.map((c) => c.id)).size).toBe(WW2_CARDS.length);
    for (const c of WW2_CARDS) expect(validateCard(c), c.id).toEqual([]);
  });

  it('gives every nation signature cards and keeps the starter army legal', () => {
    for (const nation of ['usa', 'uk', 'ussr', 'germany', 'japan'] as Nation[]) {
      expect(WW2_CARDS.filter((c) => c.nation === nation).length).toBeGreaterThanOrEqual(5);
    }
    expect(validateDeck(buildStarterDeck())).toEqual([]);
  });

  it('every Air unit is Flying with Fuel upkeep', () => {
    for (const c of WW2_CARDS) {
      if (c.type === 'unit' && c.role === 'air') {
        expect(c.keywords).toContain('flying');
        expect(c.upkeep?.fuel ?? 0).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

/** A board with targets of every kind, so each card has something legal to do. */
function smokeGame(): GameState {
  const s = newGame(1, 0);
  put(s, 0, 0, 'front', unitCard({ hp: 4 }), { hp: 2 });
  addBuilding(s, 0, buildingCard());
  put(s, 1, 0, 'front', unitCard({ hp: 4 }));
  put(s, 1, 1, 'front', unitCard({ hp: 4 }));
  put(s, 1, 1, 'rear', unitCard({ hp: 4 }));
  addBuilding(s, 1, buildingCard({ hp: 2 }));
  addBuilding(s, 1, buildingCard({ hp: 4 }));
  return s;
}

describe('every card can be played', () => {
  for (const card of WW2_CARDS) {
    it(`${card.name} (${card.id})`, () => {
      const s = smokeGame();
      setHand(s, 0, [card]);
      setResources(s, 0, { manpower: 10, steel: 10, fuel: 10, supplies: 10 });
      const kind = card.type === 'building' ? 'construct' : card.type === 'unit' ? 'deploy' : 'order';
      const plays = legalActions(s, 0).filter((a) => a.type === kind);
      expect(plays.length, 'no legal play').toBeGreaterThan(0);

      const before = hashState(s);
      const r = apply(s, plays[0]!);
      expect(hashState(s)).toBe(before); // input untouched
      const draws = (card.effects ?? []).reduce(
        (n, e) => n + (e.do === 'draw' && (e.trigger === 'onPlay' || e.trigger === 'onDeploy') ? e.count : 0),
        0,
      );
      expect(r.state.players[0].hand).toHaveLength(draws);
      for (const res of RESOURCE_TYPES) {
        expect(r.state.players[0].resources[res]).toBeGreaterThanOrEqual(0);
        expect(r.state.players[0].resources[res]).toBeLessThanOrEqual(RESOURCE_CAP);
      }
      const played = { construct: 'buildingConstructed', deploy: 'unitDeployed', order: 'orderPlayed' }[kind];
      expect(r.events.some((e) => e.type === played)).toBe(true);
    });
  }
});

describe('mixed-deck random play', () => {
  it('random legal decks are legal, and games between them finish with all invariants intact', () => {
    let finished = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = { rng: seed * 31 + 7 };
      const decks: [Card[], Card[]] = [randomDeck(rng), randomDeck(rng)];
      expect(validateDeck(decks[0])).toEqual([]);
      expect(validateDeck(decks[1])).toEqual([]);
      const { final } = playRandomGame(seed, decks);
      expect(isTerminal(final)).not.toBeNull();
      finished++;
    }
    expect(finished).toBe(40);
  });

  it('nation-themed decks activate their doctrine and play to completion', () => {
    for (const nation of ['usa', 'uk', 'ussr', 'germany', 'japan'] as Nation[]) {
      for (let seed = 1; seed <= 6; seed++) {
        const rng = { rng: seed * 131 + nation.length };
        const decks: [Card[], Card[]] = [randomDeck(rng, nation), randomDeck(rng)];
        expect(validateDeck(decks[0])).toEqual([]);
        const { final } = playRandomGame(seed, decks, [nation, null]);
        expect(final.players[0].doctrine).toBe(nation);
        expect(isTerminal(final)).not.toBeNull();
      }
    }
  });

  it('plays the starter army against a themed army', () => {
    const rng = { rng: 99 };
    const { final } = playRandomGame(5, [buildStarterDeck(), randomDeck(rng, 'germany')], [null, 'germany']);
    expect(isTerminal(final)).not.toBeNull();
    expect(BARRACKS.id).toBe('ww2.building.barracks');
  });
});
