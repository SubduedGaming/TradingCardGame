import { describe, expect, it } from 'vitest';
import { apply, createGame, IllegalActionError, legalActions } from './game';
import { quoteCost } from './costs';
import { chooseDoctrine, DOCTRINE_MIN_CARDS } from './doctrine';
import { hasKw } from './stats';
import type { Action, Card, GameState, TargetRef } from './types';
import {
  BF_109,
  BLITZKRIEG,
  COMBAT_ENGINEER,
  CONSCRIPT_PLATOON,
  ENIGMA_INTERCEPT,
  FIELD_RADIO_OPERATOR,
  GI_RIFLE_SQUAD,
  IMPERIAL_INFANTRY,
  LEND_LEASE,
  LIGHT_TANK,
  NAVAL_BOMBARDMENT,
  OPERATION_OVERLORD,
  RADAR_STATION,
  REINFORCEMENTS,
  RIFLE_SQUAD,
  SCORCHED_EARTH,
  STEEL_MILL,
  TANKOGRAD_WORKS,
  UNIVERSAL_CARRIER,
  buildStarterDeck,
} from '../cards/ww2';
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

const RICH = { manpower: 10, steel: 10, fuel: 10, supplies: 10 };

function deckWith(card: Card, n: number): Card[] {
  return [...Array.from({ length: n }, () => card), ...buildStarterDeck().slice(0, 30 - n)];
}

const deployAction = (cardIndex: number, lane: 0 | 1 | 2, row: 'front' | 'rear' = 'front', targets: TargetRef[] = []): Action => ({
  type: 'deploy',
  player: 0,
  cardIndex,
  lane,
  row,
  targets,
});

const orderAction = (cardIndex: number, targets: TargetRef[] = []): Action => ({
  type: 'order',
  player: 0,
  cardIndex,
  targets,
});

function passTurn(s: GameState, player: 0 | 1): GameState {
  return step(s, { type: 'endMain', player }, { type: 'endTurn', player }).state;
}

describe('cost discounts', () => {
  const cheapJet = unitCard({
    id: 'test.unit.cheap-jet',
    role: 'air',
    cost: { fuel: 1 },
    keywords: ['flying'],
  });

  it('Radar Station: the first Air unit each turn costs 1 less Fuel, the second does not', () => {
    let s = newGame(1, 0);
    addBuilding(s, 0, RADAR_STATION);
    setHand(s, 0, [BF_109, BF_109]);
    setResources(s, 0, RICH);
    expect(quoteCost(s, 0, BF_109).cost).toEqual({ fuel: 1 });
    s = step(s, deployAction(0, 0)).state;
    expect(s.players[0].resources.fuel).toBe(9);
    expect(quoteCost(s, 0, BF_109).cost).toEqual({ fuel: 2 });
    s = step(s, deployAction(0, 1)).state;
    expect(s.players[0].resources.fuel).toBe(7);
  });

  it('a discount renews on the owner\'s next turn', () => {
    let s = newGame(1, 0);
    addBuilding(s, 0, RADAR_STATION);
    setHand(s, 0, [BF_109]);
    setResources(s, 0, RICH);
    s = step(s, deployAction(0, 0)).state;
    s = passTurn(s, 0);
    s = passTurn(s, 1);
    expect(quoteCost(s, 0, BF_109).cost).toEqual({ fuel: 1 });
  });

  it('never takes a card below 1 resource in total, and does not use up the once-per-turn discount', () => {
    const s = newGame(1, 0);
    addBuilding(s, 0, RADAR_STATION);
    expect(quoteCost(s, 0, cheapJet)).toEqual({ cost: { fuel: 1 }, used: [] });
    expect(quoteCost(s, 0, BF_109).used).toHaveLength(1);
  });

  it('two sources stack but still stop at a total cost of 1', () => {
    const s = newGame(1, 0);
    addBuilding(s, 0, RADAR_STATION);
    addBuilding(s, 0, RADAR_STATION);
    const q = quoteCost(s, 0, BF_109);
    expect(q.cost).toEqual({ fuel: 1 });
    expect(q.used).toHaveLength(1);
  });

  it('Field Radio Operator: the first Order each turn costs 1 less Supplies', () => {
    let s = newGame(1, 0);
    put(s, 0, 0, 'front', FIELD_RADIO_OPERATOR);
    setHand(s, 0, [REINFORCEMENTS, REINFORCEMENTS]);
    setResources(s, 0, { supplies: 6 });
    s = step(s, orderAction(0)).state;
    expect(s.players[0].resources.supplies).toBe(5);
    s = step(s, orderAction(0)).state;
    expect(s.players[0].resources.supplies).toBe(3);
  });

  it('Tankograd Works: Armour units always cost 1 less Steel (but not other units)', () => {
    const s = newGame(1, 0);
    addBuilding(s, 0, TANKOGRAD_WORKS);
    expect(quoteCost(s, 0, LIGHT_TANK).cost).toEqual({ steel: 1, fuel: 1 });
    expect(quoteCost(s, 0, UNIVERSAL_CARRIER).cost).toEqual({ fuel: 1 });
    expect(quoteCost(s, 0, RIFLE_SQUAD).cost).toEqual({ manpower: 1 });
    expect(quoteCost(s, 0, LIGHT_TANK).used).toEqual([]);
  });

  it('the discounted price is what legalActions checks and what apply charges', () => {
    let s = newGame(1, 0);
    addBuilding(s, 0, RADAR_STATION);
    setHand(s, 0, [BF_109]);
    setResources(s, 0, { fuel: 1 });
    expect(legalActions(s, 0).some((a) => a.type === 'deploy')).toBe(true);
    s = step(s, deployAction(0, 0)).state;
    expect(s.players[0].resources.fuel).toBe(0);
  });

  it('only the owner benefits', () => {
    const s = newGame(1, 0);
    addBuilding(s, 1, RADAR_STATION);
    expect(quoteCost(s, 0, BF_109).cost).toEqual({ fuel: 2 });
  });
});

describe('doctrine selection', () => {
  it('picks the majority nation with 10+ cards, ignoring neutral cards', () => {
    expect(chooseDoctrine(deckWith(GI_RIFLE_SQUAD, DOCTRINE_MIN_CARDS))).toBe('usa');
    expect(chooseDoctrine(deckWith(GI_RIFLE_SQUAD, DOCTRINE_MIN_CARDS - 1))).toBeNull();
    expect(chooseDoctrine(buildStarterDeck())).toBeNull();
  });

  it('a tie gives no automatic doctrine, but an explicit choice resolves it', () => {
    const tied = [
      ...Array.from({ length: 10 }, () => GI_RIFLE_SQUAD),
      ...Array.from({ length: 10 }, () => CONSCRIPT_PLATOON),
      ...buildStarterDeck().slice(0, 10),
    ];
    expect(chooseDoctrine(tied)).toBeNull();
    expect(chooseDoctrine(tied, 'ussr')).toBe('ussr');
    expect(chooseDoctrine(tied, null)).toBeNull();
  });

  it('rejects a doctrine the deck does not qualify for', () => {
    expect(() => chooseDoctrine(buildStarterDeck(), 'usa')).toThrow(/needs 10/);
    expect(() => chooseDoctrine(buildStarterDeck(), 'neutral')).toThrow();
  });

  it('is applied by createGame, per player, and can be declined', () => {
    const decks: [Card[], Card[]] = [deckWith(GI_RIFLE_SQUAD, 12), buildStarterDeck()];
    expect(createGame({ seed: 1, decks }).players.map((p) => p.doctrine)).toEqual(['usa', null]);
    expect(createGame({ seed: 1, decks, doctrines: [null, undefined] }).players[0].doctrine).toBeNull();
  });
});

describe('nation doctrines in play', () => {
  it('USA Industrial Might: first Building each turn costs 1 less Supplies (never below 1 total)', () => {
    let s = newGame(1, 0, [deckWith(GI_RIFLE_SQUAD, 12), buildStarterDeck()]);
    setHand(s, 0, [STEEL_MILL]);
    setResources(s, 0, { supplies: 1 });
    expect(quoteCost(s, 0, STEEL_MILL).cost).toEqual({ supplies: 1 });
    s = step(s, { type: 'construct', player: 0, cardIndex: 0 }).state;
    expect(s.players[0].resources.supplies).toBe(0);
    expect(s.players[0].buildings).toHaveLength(1);
  });

  it('USSR Mass Mobilisation: Infantry cost 1 less Manpower with 3+ units, not before', () => {
    const s = newGame(1, 0, [deckWith(CONSCRIPT_PLATOON, 12), buildStarterDeck()]);
    expect(quoteCost(s, 0, GI_RIFLE_SQUAD).cost).toEqual({ manpower: 2 });
    put(s, 0, 0, 'front', unitCard());
    put(s, 0, 1, 'front', unitCard());
    expect(quoteCost(s, 0, GI_RIFLE_SQUAD).cost).toEqual({ manpower: 2 });
    put(s, 0, 2, 'front', unitCard());
    expect(quoteCost(s, 0, GI_RIFLE_SQUAD).cost).toEqual({ manpower: 1 });
    expect(quoteCost(s, 0, RIFLE_SQUAD).cost).toEqual({ manpower: 1 }); // already minimal
    expect(quoteCost(s, 0, LIGHT_TANK).cost).toEqual({ steel: 2, fuel: 1 });
  });

  it('UK Resolve: units deployed while the HQ has 10 HP or less get +1 HP', () => {
    const s = newGame(1, 0, [Array.from({ length: 30 }, () => ukCard()), buildStarterDeck()]);
    expect(s.players[0].doctrine).toBe('uk');
    setHand(s, 0, [RIFLE_SQUAD, RIFLE_SQUAD]);
    setResources(s, 0, RICH);
    const healthy = step(s, deployAction(0, 0)).state.players[0].lanes[0].front!;
    expect(healthy.hp).toBe(2);
    s.players[0].hq = 10;
    const hurt = step(s, deployAction(0, 0)).state.players[0].lanes[0].front!;
    expect(hurt.hp).toBe(3);
    expect(hurt.maxHp).toBe(3);
  });

  it('Germany Combined Arms: only the first Armour unit each turn gains Blitz', () => {
    let s = newGame(1, 0, [Array.from({ length: 30 }, () => germanTank()), buildStarterDeck()]);
    expect(s.players[0].doctrine).toBe('germany');
    setHand(s, 0, [LIGHT_TANK, LIGHT_TANK, RIFLE_SQUAD]);
    setResources(s, 0, RICH);
    s = step(s, deployAction(0, 0), deployAction(0, 1), deployAction(0, 2)).state;
    const [a, b, c] = [0, 1, 2].map((i) => s.players[0].lanes[i as 0 | 1 | 2].front!);
    expect(hasKw(a!, 'blitz')).toBe(true);
    expect(hasKw(b!, 'blitz')).toBe(false);
    expect(hasKw(c!, 'blitz')).toBe(false);

    s = step(s, { type: 'endMain', player: 0 }).state;
    expect(legalActions(s, 0).some((x) => x.type === 'attack' && x.unitUid === a!.uid)).toBe(true);
    expect(legalActions(s, 0).some((x) => x.type === 'attack' && x.unitUid === b!.uid)).toBe(false);
  });

  it('Germany Combined Arms resets each turn', () => {
    let s = newGame(1, 0, [Array.from({ length: 30 }, () => germanTank()), buildStarterDeck()]);
    setHand(s, 0, [LIGHT_TANK]);
    setResources(s, 0, RICH);
    s = step(s, deployAction(0, 0)).state;
    expect(s.players[0].combinedArmsUsed).toBe(true);
    s = passTurn(s, 0);
    s = passTurn(s, 1);
    expect(s.players[0].combinedArmsUsed).toBe(false);
  });

  it('Japan Spirit of Resilience: deployed units gain Tenacity', () => {
    let s = newGame(1, 0, [deckWith(IMPERIAL_INFANTRY, 12), buildStarterDeck()]);
    expect(s.players[0].doctrine).toBe('japan');
    setHand(s, 0, [RIFLE_SQUAD, IMPERIAL_INFANTRY]);
    setResources(s, 0, RICH);
    s = step(s, deployAction(0, 0), deployAction(0, 1)).state;
    const plain = s.players[0].lanes[0].front!;
    expect(plain.extraKeywords).toEqual(['tenacity']);
    expect(hasKw(plain, 'tenacity')).toBe(true);
    expect(s.players[0].lanes[1].front!.extraKeywords).toEqual([]); // already had it
  });

  it('the opponent\'s doctrine never affects the other player', () => {
    const s = newGame(1, 0, [deckWith(CONSCRIPT_PLATOON, 12), buildStarterDeck()]);
    put(s, 1, 0, 'front', unitCard());
    put(s, 1, 1, 'front', unitCard());
    put(s, 1, 2, 'front', unitCard());
    expect(quoteCost(s, 1, GI_RIFLE_SQUAD).cost).toEqual({ manpower: 2 });
  });
});

function ukCard(): Card {
  return { ...unitCard({ id: 'test.unit.uk', nation: 'uk' }) };
}
function germanTank(): Card {
  return { ...unitCard({ id: 'test.unit.de-tank', nation: 'germany', role: 'armour' }) };
}

describe('deploy-time targets (Combat Engineer)', () => {
  it('offers a target for each enemy building with 2 HP or less, and the effect destroys it', () => {
    let s = newGame(1, 0);
    const weak = addBuilding(s, 1, buildingCard({ hp: 2 }));
    addBuilding(s, 1, buildingCard({ hp: 3 }));
    setHand(s, 0, [COMBAT_ENGINEER]);
    setResources(s, 0, RICH);
    const deploys = legalActions(s, 0).filter((a) => a.type === 'deploy');
    expect(deploys).toHaveLength(6); // 6 free slots x 1 candidate
    expect(deploys.every((a) => a.type === 'deploy' && a.targets.length === 1)).toBe(true);
    s = step(s, deployAction(0, 0, 'front', [{ kind: 'building', uid: weak.uid }])).state;
    expect(s.players[1].buildings).toHaveLength(1);
    expect(s.players[1].discard).toHaveLength(1);
    expect(s.players[0].lanes[0].front?.card.id).toBe(COMBAT_ENGINEER.id);
  });

  it('must pick a target when one exists, but may deploy with none when there is no candidate', () => {
    const s = newGame(1, 0);
    setHand(s, 0, [COMBAT_ENGINEER]);
    setResources(s, 0, RICH);
    addBuilding(s, 1, buildingCard({ hp: 2 }));
    expect(() => apply(s, deployAction(0, 0, 'front', []))).toThrow(IllegalActionError);
    expect(() =>
      apply(s, deployAction(0, 0, 'front', [{ kind: 'building', uid: 'nope' }])),
    ).toThrow(IllegalActionError);

    s.players[1].buildings = [];
    expect(legalActions(s, 0).filter((a) => a.type === 'deploy')).toHaveLength(6);
    const r = apply(s, deployAction(0, 0, 'front', []));
    expect(r.state.players[0].lanes[0].front).not.toBeNull();
  });
});

describe('Lend-Lease', () => {
  it('lets the player choose which resource to gain 3 of, capped at 10', () => {
    const s = newGame(1, 0);
    setHand(s, 0, [LEND_LEASE]);
    setResources(s, 0, { supplies: 2, fuel: 9 });
    const plays = legalActions(s, 0).filter((a) => a.type === 'order');
    expect(plays).toHaveLength(4);
    const fuel = step(s, orderAction(0, [{ kind: 'resource', resource: 'fuel' }])).state;
    expect(fuel.players[0].resources.fuel).toBe(10);
    const steel = step(s, orderAction(0, [{ kind: 'resource', resource: 'steel' }])).state;
    expect(steel.players[0].resources.steel).toBe(3);
    expect(steel.players[0].resources.supplies).toBe(0);
  });
});

describe('Scorched Earth', () => {
  it('destroys one of your buildings and damages every enemy unit in the chosen lane', () => {
    let s = newGame(1, 0);
    const mine = addBuilding(s, 0, buildingCard());
    put(s, 1, 1, 'front', unitCard({ hp: 5 }));
    put(s, 1, 1, 'rear', unitCard({ hp: 5, armour: 2 }));
    put(s, 1, 2, 'front', unitCard({ hp: 5 }));
    setHand(s, 0, [SCORCHED_EARTH]);
    setResources(s, 0, { supplies: 2 });
    expect(legalActions(s, 0).filter((a) => a.type === 'order')).toHaveLength(3); // 1 building x 3 lanes
    s = step(
      s,
      orderAction(0, [
        { kind: 'building', uid: mine.uid },
        { kind: 'lane', lane: 1 },
      ]),
    ).state;
    expect(s.players[0].buildings).toHaveLength(0);
    expect(s.players[0].discard.map((c) => c.id)).toContain(buildingCard().id);
    expect(s.players[1].lanes[1].front?.hp).toBe(2);
    expect(s.players[1].lanes[1].rear?.hp).toBe(4); // 3 - 2 armour = 1
    expect(s.players[1].lanes[2].front?.hp).toBe(5);
  });

  it('is unplayable without a building of your own', () => {
    const s = newGame(1, 0);
    setHand(s, 0, [SCORCHED_EARTH]);
    setResources(s, 0, { supplies: 2 });
    expect(legalActions(s, 0).filter((a) => a.type === 'order')).toHaveLength(0);
  });
});

describe('Naval Bombardment', () => {
  it('hits every enemy Front unit for 2 (Armour applies) and spares Rear units', () => {
    let s = newGame(1, 0);
    put(s, 1, 0, 'front', unitCard({ hp: 4 }));
    put(s, 1, 1, 'front', unitCard({ hp: 4, armour: 1 }));
    put(s, 1, 1, 'rear', unitCard({ hp: 4 }));
    setHand(s, 0, [NAVAL_BOMBARDMENT]);
    setResources(s, 0, RICH);
    s = step(s, orderAction(0)).state;
    expect(s.players[1].lanes[0].front?.hp).toBe(2);
    expect(s.players[1].lanes[1].front?.hp).toBe(3);
    expect(s.players[1].lanes[1].rear?.hp).toBe(4);
  });
});

describe('Enigma Intercept', () => {
  it('makes the opponent discard a random card from hand, deterministically per seed', () => {
    const run = () => {
      const s = newGame(7, 0);
      setHand(s, 0, [ENIGMA_INTERCEPT]);
      setResources(s, 0, RICH);
      const handBefore = s.players[1].hand.length;
      const after = step(s, orderAction(0)).state;
      expect(after.players[1].hand).toHaveLength(handBefore - 1);
      expect(after.players[1].discard).toHaveLength(1);
      return after.players[1].discard[0]!.id;
    };
    expect(run()).toBe(run());
  });

  it('does nothing when the opponent has no cards', () => {
    const s = newGame(1, 0);
    s.players[1].hand = [];
    setHand(s, 0, [ENIGMA_INTERCEPT]);
    setResources(s, 0, RICH);
    const after = step(s, orderAction(0)).state;
    expect(after.players[1].discard).toHaveLength(0);
  });
});

describe('Blitzkrieg', () => {
  it('gives all your units Blitz and +1 ATK this turn only', () => {
    let s = newGame(1, 0);
    const a = put(s, 0, 0, 'front', unitCard({ attack: 2 }), { fresh: true });
    const b = put(s, 0, 1, 'front', unitCard({ attack: 3 }), { fresh: true });
    const enemy = put(s, 1, 0, 'front', unitCard({ attack: 0, hp: 9 }));
    setHand(s, 0, [BLITZKRIEG]);
    setResources(s, 0, RICH);
    s = step(s, orderAction(0), { type: 'endMain', player: 0 }).state;
    expect(legalActions(s, 0).some((x) => x.type === 'attack' && x.unitUid === b.uid)).toBe(true);
    s = step(s, {
      type: 'attack',
      player: 0,
      unitUid: a.uid,
      target: { kind: 'unit', uid: enemy.uid },
    }).state;
    expect(s.players[1].lanes[0].front?.hp).toBe(6); // 2 + 1
    s = step(s, { type: 'endTurn', player: 0 }).state;
    for (const lane of [0, 1] as const) {
      expect(s.players[0].lanes[lane].front?.tempAttack).toBe(0);
      expect(s.players[0].lanes[lane].front?.tempKeywords).toEqual([]);
    }
  });
});

describe('Operation Overlord', () => {
  function overlordGame(): GameState {
    const s = newGame(1, 0);
    s.players[0].deck = [
      LIGHT_TANK,
      RIFLE_SQUAD,
      RIFLE_SQUAD,
      GI_RIFLE_SQUAD,
      RIFLE_SQUAD,
      LIGHT_TANK,
    ];
    setHand(s, 0, [OPERATION_OVERLORD]);
    setResources(s, 0, RICH);
    return s;
  }

  it('puts up to three Infantry from the deck onto the board, Fresh, and shuffles', () => {
    const s0 = overlordGame();
    const s = step(s0, orderAction(0)).state;
    const board = [0, 1, 2].map((l) => s.players[0].lanes[l as 0 | 1 | 2].front);
    expect(board.every((u) => u && u.card.role === 'infantry' && u.fresh)).toBe(true);
    expect(s.players[0].deck).toHaveLength(3);
    expect(s.players[0].deck.filter((c) => c.type === 'unit' && c.role === 'infantry')).toHaveLength(1);
    expect(s.players[0].deck.filter((c) => c.id === LIGHT_TANK.id)).toHaveLength(2);
    expect(s.rng).not.toBe(s0.rng); // the deck was shuffled
  });

  it('only fills empty slots, Front slots first', () => {
    const s0 = overlordGame();
    put(s0, 0, 0, 'front', unitCard());
    put(s0, 0, 1, 'front', unitCard());
    const s = step(s0, orderAction(0)).state;
    expect(s.players[0].lanes[2].front).not.toBeNull();
    expect(s.players[0].lanes[0].rear).not.toBeNull();
    expect(s.players[0].lanes[1].rear).not.toBeNull();
    expect(s.players[0].deck).toHaveLength(3);
  });

  it('summons fewer when the deck has fewer Infantry, and nothing when the board is full', () => {
    const s0 = overlordGame();
    s0.players[0].deck = [LIGHT_TANK, RIFLE_SQUAD];
    const s = step(s0, orderAction(0)).state;
    expect(s.players[0].lanes[0].front?.card.id).toBe(RIFLE_SQUAD.id);
    expect(s.players[0].lanes[1].front).toBeNull();
    expect(s.players[0].deck).toHaveLength(1);

    const full = overlordGame();
    for (const lane of [0, 1, 2] as const) {
      put(full, 0, lane, 'front', unitCard());
      put(full, 0, lane, 'rear', unitCard());
    }
    const after = step(full, orderAction(0)).state;
    expect(after.players[0].deck).toHaveLength(6);
  });

  it('summoned units are subject to the owner\'s doctrine', () => {
    const s0 = newGame(1, 0, [deckWith(IMPERIAL_INFANTRY, 12), buildStarterDeck()]);
    s0.players[0].deck = [RIFLE_SQUAD];
    setHand(s0, 0, [OPERATION_OVERLORD]);
    setResources(s0, 0, RICH);
    const s = step(s0, orderAction(0)).state;
    expect(s.players[0].lanes[0].front?.extraKeywords).toEqual(['tenacity']);
  });
});
