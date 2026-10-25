import type { Card, GameState, Nation, PlayerId } from '../engine/types';
import { apply, createGame, isTerminal } from '../engine/game';
import type { Agent } from './agents';

export interface MatchResult {
  winner: PlayerId | 'draw';
  turns: number;
  reason: 'hq' | 'concede' | 'turnLimit';
  actions: number;
  final: GameState;
}

export interface Seat {
  deck: Card[];
  agent: Agent;
  doctrine?: Nation | null;
}

/** Plays one full match headlessly; the seed fixes both the deal and the agents' random choices. */
export function playMatch(seed: number, seats: [Seat, Seat]): MatchResult {
  let state = createGame({
    seed,
    decks: [seats[0].deck, seats[1].deck],
    doctrines: [seats[0].doctrine, seats[1].doctrine],
  });
  const rng = { rng: seed * 2654435761 + 12345 };
  let actions = 0;
  let reason: MatchResult['reason'] = 'turnLimit';
  for (; actions < 5000 && !isTerminal(state); actions++) {
    const player = actingSeat(state);
    const action = seats[player].agent.choose(state, player, rng);
    const result = apply(state, action);
    state = result.state;
    for (const e of result.events) if (e.type === 'gameEnded') reason = e.reason;
  }
  if (state.winner === null) throw new Error(`match ${seed} did not finish in ${actions} actions`);
  return { winner: state.winner, turns: state.turn, reason, actions, final: state };
}

/** The player who must act: during the mulligan whoever has not decided yet, otherwise the active player. */
export function actingSeat(state: GameState): PlayerId {
  if (state.phase === 'mulligan') return state.players[0].mulliganDone ? 1 : 0;
  return state.active;
}

export interface SeriesResult {
  games: number;
  wins: [number, number];
  draws: number;
  firstPlayerWins: number;
  avgTurns: number;
  turnLimit: number;
}

/** Plays `games` matches, swapping seats every other game so first-player advantage cancels out. */
export function playSeries(games: number, baseSeed: number, a: Seat, b: Seat): SeriesResult {
  const out: SeriesResult = { games, wins: [0, 0], draws: 0, firstPlayerWins: 0, avgTurns: 0, turnLimit: 0 };
  let turns = 0;
  for (let i = 0; i < games; i++) {
    const swap = i % 2 === 1;
    const r = playMatch(baseSeed + i, swap ? [b, a] : [a, b]);
    turns += r.turns;
    if (r.reason === 'turnLimit') out.turnLimit += 1;
    if (r.winner === 'draw') out.draws += 1;
    else {
      const aWon = (r.winner === 0) !== swap;
      out.wins[aWon ? 0 : 1] += 1;
      if (r.winner === r.final.first) out.firstPlayerWins += 1;
    }
  }
  out.avgTurns = turns / games;
  return out;
}
