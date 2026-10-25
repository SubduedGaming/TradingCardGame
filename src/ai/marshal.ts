import type { Action, Card, GameState, Nation, PlayerId } from '../engine/types';
import { apply, legalActions } from '../engine/game';
import { nextInt, shuffle } from '../engine/rng';
import { NATIONS } from '../cards/plan';
import { forcedChoice, veteranAgent, type Agent } from './agents';
import { annotate, planTurns, type Step } from './commander';
import { buildNationDeck } from './decks';
import { actingSeat } from './sim';
import { evaluate } from './evaluate';

export interface MarshalOptions {
  /** Distinct whole-turn plans from the Commander search that are compared. */
  candidates?: number;
  /** Beam width of that search. */
  beamWidth?: number;
  /** Sampled worlds (opponent hand and both decks) per candidate. */
  worlds?: number;
  /** Turns played out after the planned one before the position is scored. */
  horizon?: number;
}

const WIN = 1000;

/** Cards the opponent is known to have used: their board and their discard pile. */
function seenCards(state: GameState, foe: PlayerId): Card[] {
  const p = state.players[foe];
  const out: Card[] = [...p.discard, ...p.buildings.map((b) => b.card)];
  for (const lane of p.lanes) for (const u of [lane.front, lane.rear]) if (u) out.push(u.card);
  return out;
}

/** The opponent's nation from public information: their doctrine, else the commonest nation among cards seen. */
function guessNation(state: GameState, foe: PlayerId, seen: Card[], rng: { rng: number }): Nation {
  const doctrine = state.players[foe].doctrine;
  if (doctrine) return doctrine;
  const counts = new Map<Nation, number>();
  for (const c of seen) if (c.nation !== 'neutral') counts.set(c.nation, (counts.get(c.nation) ?? 0) + 1);
  let best: Nation | null = null;
  for (const [n, k] of counts) if (!best || k > counts.get(best)!) best = n;
  return best ?? NATIONS[nextInt(rng, NATIONS.length)]!;
}

/**
 * One possible world consistent with what `me` can see: the opponent's hand and deck are re-drawn from a
 * plausible deck of their nation minus the cards already seen, and the order of my own deck is reshuffled
 * (I know its contents but not its order). The true hidden cards are never read.
 */
export function determinize(state: GameState, me: PlayerId, rng: { rng: number }): GameState {
  const foe: PlayerId = me === 0 ? 1 : 0;
  const seen = seenCards(state, foe);
  const nation = guessNation(state, foe, seen, rng);
  const need = state.players[foe].hand.length + state.players[foe].deck.length;

  const pool: Card[] = [];
  const taken = new Map<string, number>();
  for (const c of seen) taken.set(c.id, (taken.get(c.id) ?? 0) + 1);
  for (let round = 0; pool.length < need && round < 4; round++) {
    for (const c of buildNationDeck(nation, rng)) {
      const t = taken.get(c.id) ?? 0;
      if (round === 0 && t > 0) taken.set(c.id, t - 1);
      else pool.push(c);
    }
  }
  shuffle(rng, pool);
  const handSize = state.players[foe].hand.length;

  const players = [...state.players] as GameState['players'];
  players[foe] = { ...players[foe], hand: pool.slice(0, handSize), deck: pool.slice(handSize, need) };
  const myDeck = [...players[me].deck];
  shuffle(rng, myDeck);
  players[me] = { ...players[me], deck: myDeck };
  return { ...state, players, rng: nextInt(rng, 2 ** 31) };
}

const sameAction = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);

/** Plays a plan in a sampled world as far as it stays legal (card draws can shift hand positions). */
function playPlan(world: GameState, me: PlayerId, plan: Action[]): GameState {
  let s = world;
  for (const action of plan) {
    if (s.winner !== null) break;
    if (!legalActions(s, me).some((a) => sameAction(a, action))) break;
    s = apply(s, action).state;
  }
  return s;
}

function rollout(state: GameState, me: PlayerId, untilTurn: number, agent: Agent, rng: { rng: number }): number {
  let s = state;
  for (let i = 0; i < 600 && s.winner === null && s.turn <= untilTurn; i++) {
    const seat = actingSeat(s);
    s = apply(s, agent.choose(s, seat, rng)).state;
  }
  if (s.winner === me) return WIN;
  if (s.winner === (me === 0 ? 1 : 0)) return -WIN;
  if (s.winner === 'draw') return 0;
  return evaluate(s, me);
}

/**
 * Marshal: determinised Monte-Carlo over whole-turn plans (PIMC). The Commander search proposes its best
 * distinct turn plans; each is played in several sampled worlds (the opponent's hidden hand and both deck
 * orders re-drawn) and then rolled out for a few turns by Veteran agents in both seats. The plan with the
 * best mean outcome is played. This is perfect-information Monte-Carlo, not full information-set tree
 * search (ISMCTS): it does not model the opponent's uncertainty about us, and its rollout policy is greedy.
 */
export function marshalAgent(options: MarshalOptions = {}): Agent {
  const candidates = options.candidates ?? 4;
  const beamWidth = options.beamWidth ?? 8;
  const worlds = options.worlds ?? 6;
  const horizon = options.horizon ?? 2;
  const rollers = veteranAgent();
  let plan: Step[] = [];

  function choosePlan(state: GameState, me: PlayerId, rng: { rng: number }): Action[] {
    const found = planTurns(state, me, beamWidth, 40, candidates);
    if (found.length <= 1) return found[0]?.actions ?? [];
    const sampled = Array.from({ length: worlds }, () => determinize(state, me, rng));
    let best = found[0]!;
    let bestMean = -Infinity;
    for (const cand of found) {
      let total = 0;
      for (const world of sampled) {
        const after = playPlan(world, me, cand.actions);
        total += rollout(after, me, state.turn + horizon, rollers, rng);
      }
      const mean = total / sampled.length;
      if (mean > bestMean) {
        bestMean = mean;
        best = cand;
      }
    }
    return best.actions;
  }

  return {
    name: 'marshal',
    choose(state, player, rng) {
      const forced = forcedChoice(state, player);
      if (forced) return forced;
      if (plan.length === 0 || !legalActions(state, player).some((a) => sameAction(a, plan[0]!.action))) {
        plan = annotate(state, choosePlan(state, player, rng));
      }
      const step = plan.shift();
      if (step) return step.action;
      return legalActions(state, player).find((a) => a.type === 'endMain' || a.type === 'endTurn')!;
    },
  };
}
