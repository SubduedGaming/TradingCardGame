import type { Card, GameState, PlayerId, Resources, UnitInPlay } from '../engine/types';
import { RESOURCE_TYPES, TURN_LIMIT } from '../engine/types';
import { effectiveArmour, effectiveAttack, keywordsOf, unitsOf } from '../engine/stats';
import { RESOURCE_WEIGHT } from '../cards/budget';

/** Hand-tuned weights for the evaluation function (docs/05 section 4). */
export const WEIGHTS = {
  hq: 1.6,
  board: 1,
  building: 1,
  hand: 0.35,
  bank: 0.4,
  win: 1000,
  /** How many turns of production a building is worth when evaluated. */
  horizon: 6,
};

function resourceValue(res: Partial<Resources>): number {
  return RESOURCE_TYPES.reduce((n, r) => n + (res[r] ?? 0) * RESOURCE_WEIGHT[r], 0);
}

const KEYWORD_BONUS: Record<string, number> = {
  blitz: 0.8,
  piercing: 0.8,
  ranged: 0.8,
  indirect: 1.4,
  precision: 1.4,
  flying: 1.2,
  antiAir: 0.5,
  fighter: 2,
  tenacity: 1,
  dugIn: 0.6,
  heavy: -0.5,
  mass: 0.3,
  salvo: 2,
  rally: 0.8,
};

/** How much a unit on the board is worth, from stats and keywords. */
export function unitValue(state: GameState, unit: UnitInPlay): number {
  const attack = effectiveAttack(state, unit);
  const armour = effectiveArmour(state, unit);
  let v = attack * 1.1 + unit.hp * 0.75 + armour * (0.5 + unit.hp * 0.08) + (unit.card.siege ?? 0) * 0.4;
  for (const k of keywordsOf(unit)) v += KEYWORD_BONUS[k] ?? 0;
  if (unit.card.effects?.some((e) => e.trigger === 'startOfTurn' || e.trigger === 'endOfTurn')) v += 1.5;
  if (unit.card.discounts?.length) v += 1;
  return v;
}

function sideValue(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  let v = 0;
  for (const { unit } of unitsOf(state, player)) v += unitValue(state, unit) * WEIGHTS.board;
  const horizon = Math.max(0, Math.min(WEIGHTS.horizon, (TURN_LIMIT - state.turn) / 2));
  for (const b of p.buildings) {
    v += (resourceValue(b.card.produces) * horizon + b.hp * 0.12 + (b.card.aa ?? 0) * 1) * WEIGHTS.building;
    if (b.card.keywords.includes('guard')) v += 1;
    if (b.card.discounts?.length) v += 1.5;
    if (b.card.effects?.length) v += 2;
  }
  v += resourceValue(p.resources) * WEIGHTS.bank;
  return v;
}

/**
 * Score of `state` from `viewer`'s side: positive is good. Reads only public information and the
 * viewer's own hand (the opponent's hand counts as its size), as an observation would.
 */
export function evaluate(state: GameState, viewer: PlayerId): number {
  if (state.winner !== null) {
    if (state.winner === 'draw') return 0;
    return state.winner === viewer ? WEIGHTS.win : -WEIGHTS.win;
  }
  const me = state.players[viewer];
  const opp = state.players[viewer === 0 ? 1 : 0];
  const oppId: PlayerId = viewer === 0 ? 1 : 0;
  let score = WEIGHTS.hq * (me.hq - opp.hq);
  score += sideValue(state, viewer) - sideValue(state, oppId);
  score += WEIGHTS.hand * (me.hand.length - opp.hand.length);
  score -= lethalExposure(state, viewer);
  return score;
}

/** Penalty when the opponent's units could finish off a low HQ next turn. */
function lethalExposure(state: GameState, viewer: PlayerId): number {
  const me = state.players[viewer];
  const oppId: PlayerId = viewer === 0 ? 1 : 0;
  let threat = 0;
  for (const { unit } of unitsOf(state, oppId)) threat += effectiveAttack(state, unit);
  const margin = me.hq - threat;
  return margin <= 0 ? 6 + -margin : margin <= 4 ? (5 - margin) * 0.6 : 0;
}

/** How much a card in hand is worth keeping when the hand is over the limit. */
export function cardKeepValue(card: Card): number {
  return card.points + (card.type === 'building' ? 1 : 0);
}
