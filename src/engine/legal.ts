import type { Action, GameState, PlayerId } from './types';
import { BUILDING_SLOTS, HAND_LIMIT, LANES, REDEPLOY_COST, ROWS } from './types';
import { attackTargets } from './combat';
import { orderTargetCombos } from './effects';
import { hasKw, unitsOf } from './stats';
import { canAfford } from './zones';
import { stableStringify } from './util';

/** Every action `player` may take right now. Concede is always available until the game ends. */
export function legalActions(state: GameState, player: PlayerId): Action[] {
  if (state.phase === 'ended') return [];
  const out: Action[] = [];
  const p = state.players[player];

  if (state.phase === 'mulligan' && !p.mulliganDone) {
    out.push({ type: 'mulligan', player, keep: true }, { type: 'mulligan', player, keep: false });
  }
  out.push({ type: 'concede', player });
  if (state.active !== player || state.phase === 'mulligan') return out;

  if (state.phase === 'discard') {
    if (p.hand.length > HAND_LIMIT) {
      p.hand.forEach((_, cardIndex) => out.push({ type: 'discard', player, cardIndex }));
    }
    return out;
  }

  if (state.phase === 'main') {
    p.hand.forEach((card, cardIndex) => {
      if (!canAfford(p.resources, card.cost)) return;
      if (card.type === 'building') {
        if (!p.constructedThisTurn && p.buildings.length < BUILDING_SLOTS) {
          out.push({ type: 'construct', player, cardIndex });
        }
      } else if (card.type === 'unit') {
        for (const lane of LANES) {
          for (const row of ROWS) {
            if (!p.lanes[lane][row]) out.push({ type: 'deploy', player, cardIndex, lane, row });
          }
        }
      } else {
        for (const targets of orderTargetCombos(state, player, card)) {
          out.push({ type: 'order', player, cardIndex, targets });
        }
      }
    });

    if (canAfford(p.resources, REDEPLOY_COST)) {
      for (const loc of unitsOf(state, player)) {
        const u = loc.unit;
        if (u.fresh || u.redeployed || hasKw(u, 'heavy')) continue;
        for (const lane of LANES) {
          if (lane === loc.lane) continue;
          for (const row of ROWS) {
            if (!p.lanes[lane][row]) out.push({ type: 'redeploy', player, unitUid: u.uid, lane, row });
          }
        }
      }
    }
    out.push({ type: 'endMain', player });
    return out;
  }

  // combat
  for (const { unit } of unitsOf(state, player)) {
    for (const target of attackTargets(state, unit)) {
      out.push({ type: 'attack', player, unitUid: unit.uid, target });
    }
  }
  out.push({ type: 'endTurn', player });
  return out;
}

export function isLegal(state: GameState, action: Action): boolean {
  const key = stableStringify(action);
  return legalActions(state, action.player).some((a) => stableStringify(a) === key);
}
