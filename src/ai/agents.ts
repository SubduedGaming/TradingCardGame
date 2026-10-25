import type { Action, GameState, PlayerId } from '../engine/types';
import { apply, legalActions } from '../engine/game';
import { nextInt } from '../engine/rng';
import { cardKeepValue, evaluate } from './evaluate';

/**
 * An agent picks one legal action for the acting player. Agents may read their own hand and the
 * public board; they never read the opponent's hand or either deck's order.
 */
export interface Agent {
  name: string;
  choose(state: GameState, player: PlayerId, rng: { rng: number }): Action;
}

function mulliganChoice(state: GameState, player: PlayerId): Action {
  const hand = state.players[player].hand;
  const buildings = hand.filter((c) => c.type === 'building').length;
  const cheap = hand.filter((c) => c.type !== 'building' && Object.values(c.cost).reduce((a, b) => a + b, 0) <= 3).length;
  return { type: 'mulligan', player, keep: buildings >= 1 && cheap >= 1 };
}

function discardChoice(state: GameState, player: PlayerId): Action {
  const hand = state.players[player].hand;
  let worst = 0;
  hand.forEach((c, i) => {
    if (cardKeepValue(c) <= cardKeepValue(hand[worst]!)) worst = i;
  });
  return { type: 'discard', player, cardIndex: worst };
}

/** Phase decisions shared by every agent; returns null when the phase needs a real choice. */
function forcedChoice(state: GameState, player: PlayerId): Action | null {
  if (state.phase === 'mulligan') return mulliganChoice(state, player);
  if (state.phase === 'discard') return discardChoice(state, player);
  return null;
}

/** Recruit: random legal actions with a bias towards building the economy and deploying, plus deliberate mistakes. */
export function recruitAgent(mistakeRate = 0.15): Agent {
  return {
    name: 'recruit',
    choose(state, player, rng) {
      const forced = forcedChoice(state, player);
      if (forced) return forced;
      const all = legalActions(state, player).filter((a) => a.type !== 'concede');
      const end = all.find((a) => a.type === 'endMain' || a.type === 'endTurn')!;
      if (nextInt(rng, 1000) < mistakeRate * 1000) return end;
      const construct = all.filter((a) => a.type === 'construct');
      if (construct.length > 0 && state.players[player].buildings.length < 4) return construct[nextInt(rng, construct.length)]!;
      const busy = all.filter((a) => a.type !== 'endMain' && a.type !== 'endTurn' && a.type !== 'redeploy');
      if (busy.length === 0) return end;
      return busy[nextInt(rng, busy.length)]!;
    },
  };
}

/** Veteran: scores the state after every legal action and takes the best, ending the phase when nothing improves it. */
export function veteranAgent(): Agent {
  return {
    name: 'veteran',
    choose(state, player) {
      const forced = forcedChoice(state, player);
      if (forced) return forced;
      const all = legalActions(state, player).filter((a) => a.type !== 'concede');
      const end = all.find((a) => a.type === 'endMain' || a.type === 'endTurn')!;
      let best: Action = end;
      let bestScore = evaluate(apply(state, end).state, player);
      const threshold = bestScore + 0.05;
      let bestImprovement = threshold;
      for (const a of all) {
        if (a === end) continue;
        const s = evaluate(apply(state, a).state, player);
        if (s > bestImprovement) {
          bestImprovement = s;
          best = a;
        }
      }
      return best;
    },
  };
}
