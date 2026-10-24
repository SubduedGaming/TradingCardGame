import type {
  Action,
  BuildingCard,
  BuildingInPlay,
  Card,
  GameEvent,
  GameState,
  LaneIndex,
  OrderCard,
  PlayerId,
  Resources,
  Row,
  TargetRef,
  UnitCard,
  UnitInPlay,
} from './types';
import { apply, createGame } from './game';
import { emptyResources } from './zones';
import { buildStarterDeck } from '../cards/ww2';

export function unitCard(over: Partial<UnitCard> = {}): UnitCard {
  return {
    id: 'test.unit.dummy',
    name: 'Dummy',
    set: 'test',
    nation: 'neutral',
    rarity: 'common',
    points: 2,
    type: 'unit',
    role: 'infantry',
    cost: { manpower: 1 },
    attack: 2,
    hp: 2,
    keywords: [],
    ...over,
  };
}

export function buildingCard(over: Partial<BuildingCard> = {}): BuildingCard {
  return {
    id: 'test.building.dummy',
    name: 'Dummy Building',
    set: 'test',
    nation: 'neutral',
    rarity: 'common',
    points: 2,
    type: 'building',
    cost: { supplies: 1 },
    hp: 4,
    produces: {},
    keywords: [],
    ...over,
  };
}

export function orderCard(over: Partial<OrderCard> = {}): OrderCard {
  return {
    id: 'test.order.dummy',
    name: 'Dummy Order',
    set: 'test',
    nation: 'neutral',
    rarity: 'common',
    points: 2,
    type: 'order',
    cost: { supplies: 1 },
    effects: [],
    ...over,
  };
}

/** A started game: both mulligans kept, player 0 (or `first`) in the Main phase of turn 1. */
export function newGame(seed = 1, first: PlayerId = 0): GameState {
  const decks: [Card[], Card[]] = [buildStarterDeck(), buildStarterDeck()];
  let state = createGame({ seed, decks, first });
  state = apply(state, { type: 'mulligan', player: 0, keep: true }).state;
  state = apply(state, { type: 'mulligan', player: 1, keep: true }).state;
  return state;
}

/** Places a unit directly on the board (bypasses cost and turn rules). Mutates `state`. */
export function put(
  state: GameState,
  player: PlayerId,
  lane: LaneIndex,
  row: Row,
  card: UnitCard,
  over: Partial<UnitInPlay> = {},
): UnitInPlay {
  const unit: UnitInPlay = {
    uid: `u${state.nextUid++}`,
    owner: player,
    card,
    hp: card.hp,
    maxHp: card.hp,
    fresh: false,
    hasAttacked: false,
    redeployed: false,
    grounded: false,
    tenacityUsed: false,
    tempKeywords: [],
    ...over,
  };
  state.players[player].lanes[lane][row] = unit;
  return unit;
}

export function addBuilding(
  state: GameState,
  player: PlayerId,
  card: BuildingCard,
  over: Partial<BuildingInPlay> = {},
): BuildingInPlay {
  const b: BuildingInPlay = {
    uid: `u${state.nextUid++}`,
    owner: player,
    card,
    hp: card.hp,
    maxHp: card.hp,
    ...over,
  };
  state.players[player].buildings.push(b);
  return b;
}

export function setResources(state: GameState, player: PlayerId, res: Partial<Resources>): void {
  state.players[player].resources = { ...emptyResources(), ...res };
}

export function setHand(state: GameState, player: PlayerId, cards: Card[]): void {
  state.players[player].hand = cards;
}

export function toCombat(state: GameState): void {
  state.phase = 'combat';
}

export function step(state: GameState, ...actions: Action[]): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (const a of actions) {
    const r = apply(current, a);
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

export function attack(state: GameState, unit: UnitInPlay, target: TargetRef) {
  return apply(state, { type: 'attack', player: unit.owner, unitUid: unit.uid, target });
}

/** Which player must act: the one with a pending mulligan, otherwise the active player. */
export function actingPlayer(state: GameState): PlayerId {
  if (state.phase === 'mulligan') return state.players[0].mulliganDone ? 1 : 0;
  return state.active;
}
