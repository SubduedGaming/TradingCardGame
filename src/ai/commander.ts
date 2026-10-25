import type { Action, GameState, PlayerId } from '../engine/types';
import { apply, hashState, legalActions } from '../engine/game';
import { forcedChoice, type Agent } from './agents';
import { evaluate } from './evaluate';

export interface CommanderOptions {
  /** Nodes kept per search layer. */
  beamWidth?: number;
  /** Hard cap on actions per planned turn (a safety net, a normal turn needs far fewer). */
  maxDepth?: number;
}

interface Node {
  state: GameState;
  actions: Action[];
  /** Heuristic used to rank nodes inside the beam. */
  score: number;
}

type Step = { action: Action; before: string };

const IMPROVE = 0.05;

/** The turn is over for `player` once play passes to the other seat (or the game ends). */
function turnOver(state: GameState, player: PlayerId): boolean {
  return state.winner !== null || state.active !== player;
}

/** Clears the opponent's forced hand-limit discard so their turn can continue to combat. */
function settleDiscard(state: GameState, foe: PlayerId): GameState {
  let s = state;
  for (let guard = 0; guard < 20 && s.winner === null && s.phase === 'discard' && s.active === foe; guard++) {
    s = apply(s, forcedChoice(s, foe)!).state;
  }
  return s;
}

/**
 * The opponent's reply, from public information only: their units already on the board attack greedily.
 * Cards in their hand are never read, so the result is a floor on what they can do to us.
 */
function respond(state: GameState, me: PlayerId): number {
  if (state.winner !== null) return evaluate(state, me);
  const foe: PlayerId = me === 0 ? 1 : 0;
  let s = settleDiscard(state, foe);
  if (s.winner !== null || s.active !== foe) return evaluate(s, me);
  if (s.phase === 'main') s = apply(s, { type: 'endMain', player: foe }).state;
  for (let i = 0; i < 12 && s.winner === null && s.phase === 'combat'; i++) {
    const attacks = legalActions(s, foe).filter((a) => a.type === 'attack');
    if (attacks.length === 0) break;
    let best: GameState | null = null;
    let bestScore = evaluate(s, foe) + IMPROVE;
    for (const a of attacks) {
      const next = apply(s, a).state;
      const v = evaluate(next, foe);
      if (v > bestScore) {
        bestScore = v;
        best = next;
      }
    }
    if (!best) break;
    s = best;
  }
  return evaluate(s, me);
}

/**
 * Commander: beam search over whole-turn action sequences. Leaves are scored after the opponent's
 * best on-board counter-attack, so it avoids leaving itself open to lethal (docs/05 section 5).
 * The plan for a turn is computed once and then replayed; it replans if the state ever differs.
 */
export function commanderAgent(options: CommanderOptions = {}): Agent {
  const beamWidth = options.beamWidth ?? 10;
  const maxDepth = options.maxDepth ?? 40;
  let plan: Step[] = [];

  function search(start: GameState, me: PlayerId): Step[] {
    let layer: Node[] = [{ state: start, actions: [], score: evaluate(start, me) }];
    let best: { actions: Action[]; value: number } | null = null;

    for (let depth = 0; depth < maxDepth && layer.length > 0; depth++) {
      const seen = new Set<string>();
      const next: Node[] = [];
      for (const node of layer) {
        const forced = node.state.phase === 'discard' ? forcedChoice(node.state, me) : null;
        const options = forced ? [forced] : legalActions(node.state, me);
        for (const action of options) {
          if (action.type === 'concede') continue;
          const state = apply(node.state, action).state;
          const actions = [...node.actions, action];
          if (turnOver(state, me)) {
            const value = respond(state, me);
            if (!best || value > best.value) best = { actions, value };
            continue;
          }
          const key = hashState(state);
          if (seen.has(key)) continue;
          seen.add(key);
          next.push({ state, actions, score: evaluate(state, me) });
        }
      }
      next.sort((a, b) => b.score - a.score);
      layer = next.slice(0, beamWidth);
    }

    const out: Step[] = [];
    let s = start;
    for (const action of best?.actions ?? []) {
      out.push({ action, before: hashState(s) });
      s = apply(s, action).state;
    }
    return out;
  }

  return {
    name: 'commander',
    choose(state, player) {
      const forced = forcedChoice(state, player);
      if (forced) return forced;
      const here = hashState(state);
      if (plan.length === 0 || plan[0]!.before !== here) plan = search(state, player);
      const step = plan.shift();
      if (step) return step.action;
      // The depth cap ended the search without finishing a turn: end the phase cleanly.
      return legalActions(state, player).find((a) => a.type === 'endMain' || a.type === 'endTurn')!;
    },
  };
}
