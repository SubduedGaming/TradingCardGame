import type {
  Action,
  Card,
  Ctx,
  GameEvent,
  GameState,
  Lane,
  Nation,
  PlayerId,
  PlayerState,
} from './types';
import {
  HAND_LIMIT,
  HQ_HP,
  MULLIGAN_MIN_HAND,
  OPENING_HAND,
  REDEPLOY_COST,
  SECOND_PLAYER_BONUS,
} from './types';
import { nextInt, shuffle } from './rng';
import { addResources, drawOne, emptyResources, newUid, other, pay } from './zones';
import { quoteCost, payQuote } from './costs';
import { chooseDoctrine } from './doctrine';
import { enterBoard } from './units';
import { checkState, endGame } from './damage';
import { resolveEffects } from './effects';
import { resolveAttack } from './combat';
import { endTurn, finishTurn, runAntiAir, startTurn } from './turn';
import { locateUnit } from './stats';
import { isLegal } from './legal';
import { hashString, stableStringify } from './util';

export { legalActions, isLegal } from './legal';

export class IllegalActionError extends Error {
  constructor(public readonly action: Action) {
    super(`Illegal action: ${stableStringify(action)}`);
    this.name = 'IllegalActionError';
  }
}

export interface GameConfig {
  seed: number;
  decks: [Card[], Card[]];
  dataVersion?: string;
  /** Forces who goes first. Omit to decide with the seeded coin flip. */
  first?: PlayerId;
  /**
   * Each player's chosen doctrine (null for none). Omit an entry to use the deck's automatic
   * doctrine: its majority nation with 10+ cards, if not tied (see `chooseDoctrine`).
   */
  doctrines?: [Nation | null | undefined, Nation | null | undefined];
}

function emptyLane(): Lane {
  return { front: null, rear: null };
}

function newPlayer(deck: Card[], doctrine: Nation | null): PlayerState {
  return {
    hq: HQ_HP,
    resources: emptyResources(),
    deck: structuredClone(deck),
    hand: [],
    discard: [],
    lanes: [emptyLane(), emptyLane(), emptyLane()],
    buildings: [],
    constructedThisTurn: false,
    fatigue: 0,
    smoke: [false, false, false],
    mulliganDone: false,
    doctrine,
    discountsUsed: [],
    combinedArmsUsed: false,
    resilienceUsed: false,
  };
}

/** Creates a game in the mulligan phase. Deck legality is checked separately by `validateDeck`. */
export function createGame(config: GameConfig): GameState {
  const state: GameState = {
    dataVersion: config.dataVersion ?? 'dev',
    rng: config.seed | 0,
    turn: 0,
    first: 0,
    active: 0,
    phase: 'mulligan',
    players: [
      newPlayer(config.decks[0], chooseDoctrine(config.decks[0], config.doctrines?.[0])),
      newPlayer(config.decks[1], chooseDoctrine(config.decks[1], config.doctrines?.[1])),
    ],
    winner: null,
    nextUid: 1,
  };

  shuffle(state, state.players[0].deck);
  shuffle(state, state.players[1].deck);
  const flip = nextInt(state, 2) as PlayerId;
  state.first = config.first ?? flip;
  state.active = state.first;

  const ctx: Ctx = { state, events: [] };
  for (const player of [0, 1] as const) {
    for (let i = 0; i < OPENING_HAND; i++) drawOne(ctx, player);
  }
  addResources(state.players[other(state.first)].resources, SECOND_PLAYER_BONUS);
  return state;
}

function removeFromHand(state: GameState, player: PlayerId, cardIndex: number): Card {
  const [card] = state.players[player].hand.splice(cardIndex, 1);
  return card as Card;
}

function applyMulligan(ctx: Ctx, player: PlayerId, keep: boolean): void {
  const s = ctx.state;
  const p = s.players[player];
  p.mulliganDone = true;
  if (!keep) {
    const newSize = Math.max(MULLIGAN_MIN_HAND, p.hand.length - 1);
    p.deck.push(...p.hand);
    p.hand = [];
    shuffle(s, p.deck);
    for (let i = 0; i < newSize; i++) drawOne(ctx, player);
  }
  ctx.events.push({ type: 'mulligan', player, kept: keep });
  if (s.players[0].mulliganDone && s.players[1].mulliganDone) startTurn(ctx);
}

/**
 * Applies an action and returns the new state plus the events it produced.
 * The input state is never mutated. Throws IllegalActionError for illegal actions.
 */
export function apply(state: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  if (!isLegal(state, action)) throw new IllegalActionError(action);

  const s = structuredClone(state);
  const ctx: Ctx = { state: s, events: [] };
  const player = action.player;
  const p = s.players[player];

  switch (action.type) {
    case 'mulligan':
      applyMulligan(ctx, player, action.keep);
      break;

    case 'construct': {
      const card = removeFromHand(s, player, action.cardIndex);
      if (card.type !== 'building') throw new Error('unreachable: legal construct of non-building');
      payQuote(s, player, quoteCost(state, player, card));
      const uid = newUid(s);
      p.buildings.push({ uid, owner: player, card, hp: card.hp, maxHp: card.hp });
      p.constructedThisTurn = true;
      ctx.events.push({ type: 'buildingConstructed', player, uid, cardId: card.id });
      break;
    }

    case 'deploy': {
      const card = removeFromHand(s, player, action.cardIndex);
      if (card.type !== 'unit') throw new Error('unreachable: legal deploy of non-unit');
      payQuote(s, player, quoteCost(state, player, card));
      const unit = enterBoard(ctx, player, card, action.lane, action.row);
      if (card.effects) {
        resolveEffects(ctx, card.effects, 'onDeploy', {
          player,
          sourceUid: unit.uid,
          chosen: action.targets,
        });
      }
      break;
    }

    case 'order': {
      const card = removeFromHand(s, player, action.cardIndex);
      if (card.type !== 'order') throw new Error('unreachable: legal order of non-order');
      payQuote(s, player, quoteCost(state, player, card));
      ctx.events.push({ type: 'orderPlayed', player, cardId: card.id });
      resolveEffects(ctx, card.effects, 'onPlay', { player, chosen: action.targets });
      p.discard.push(card);
      break;
    }

    case 'redeploy': {
      const loc = locateUnit(s, action.unitUid);
      if (!loc) throw new Error('unreachable: legal redeploy of missing unit');
      pay(p.resources, REDEPLOY_COST);
      p.lanes[loc.lane][loc.row] = null;
      p.lanes[action.lane][action.row] = loc.unit;
      loc.unit.redeployed = true;
      ctx.events.push({
        type: 'unitRedeployed',
        player,
        uid: loc.unit.uid,
        lane: action.lane,
        row: action.row,
      });
      break;
    }

    case 'attack': {
      const loc = locateUnit(s, action.unitUid);
      if (!loc) throw new Error('unreachable: legal attack by missing unit');
      resolveAttack(ctx, loc.unit, action.target);
      break;
    }

    case 'discard': {
      const card = removeFromHand(s, player, action.cardIndex);
      p.discard.push(card);
      ctx.events.push({ type: 'discarded', player, cardId: card.id });
      if (p.hand.length <= HAND_LIMIT) finishTurn(ctx);
      break;
    }

    case 'endMain':
      s.phase = 'combat';
      ctx.events.push({ type: 'phaseChanged', phase: 'combat' });
      runAntiAir(ctx);
      break;

    case 'endTurn':
      endTurn(ctx);
      break;

    case 'concede':
      endGame(ctx, other(player), 'concede');
      break;
  }

  checkState(ctx);
  return { state: s, events: ctx.events };
}

export function isTerminal(state: GameState): { winner: PlayerId | 'draw' } | null {
  return state.winner === null ? null : { winner: state.winner };
}

export function hashState(state: GameState): string {
  return hashString(stableStringify(state));
}

type HiddenPlayer = Omit<PlayerState, 'deck' | 'hand'> & { deckSize: number; handSize: number };
type OwnPlayer = Omit<PlayerState, 'deck'> & { deckSize: number };

/** What `viewer` is allowed to know: own hand, but only sizes for decks and the opponent's hand. */
export interface Observation {
  viewer: PlayerId;
  dataVersion: string;
  turn: number;
  first: PlayerId;
  active: PlayerId;
  phase: GameState['phase'];
  winner: GameState['winner'];
  you: OwnPlayer;
  opponent: HiddenPlayer;
}

export function observation(state: GameState, viewer: PlayerId): Observation {
  const { deck, ...you } = structuredClone(state.players[viewer]);
  const { deck: oppDeck, hand: oppHand, ...opponent } = structuredClone(state.players[other(viewer)]);
  return {
    viewer,
    dataVersion: state.dataVersion,
    turn: state.turn,
    first: state.first,
    active: state.active,
    phase: state.phase,
    winner: state.winner,
    you: { ...you, deckSize: deck.length },
    opponent: { ...opponent, deckSize: oppDeck.length, handSize: oppHand.length },
  };
}
