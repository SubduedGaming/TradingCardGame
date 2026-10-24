import type { BuildingInPlay, Ctx, PlayerId, UnitInPlay } from './types';
import { LANES, ROWS } from './types';
import { hasKw } from './stats';

/** Applies raw damage to a unit. Tenacity keeps it at 1 HP the first time it would die. */
export function hitUnit(ctx: Ctx, unit: UnitInPlay, amount: number): void {
  if (amount <= 0) return;
  unit.hp -= amount;
  ctx.events.push({ type: 'damage', target: { kind: 'unit', uid: unit.uid }, amount });
  if (unit.hp <= 0 && hasKw(unit, 'tenacity') && !unit.tenacityUsed) {
    unit.hp = 1;
    unit.tenacityUsed = true;
    ctx.events.push({ type: 'tenacity', uid: unit.uid });
  }
}

export function hitBuilding(ctx: Ctx, building: BuildingInPlay, amount: number): void {
  if (amount <= 0) return;
  building.hp -= amount;
  ctx.events.push({ type: 'damage', target: { kind: 'building', uid: building.uid }, amount });
}

export function hitHq(ctx: Ctx, player: PlayerId, amount: number): void {
  if (amount <= 0) return;
  ctx.state.players[player].hq -= amount;
  ctx.events.push({ type: 'damage', target: { kind: 'hq', player }, amount });
}

/**
 * State check: remove destroyed units and buildings (to their owner's discard),
 * then decide whether the game is over. Safe to call repeatedly.
 */
export function checkState(ctx: Ctx): void {
  const s = ctx.state;
  if (s.phase === 'ended') return;

  for (const player of [0, 1] as const) {
    const p = s.players[player];
    for (const laneIndex of LANES) {
      const lane = p.lanes[laneIndex];
      for (const row of ROWS) {
        const unit = lane[row];
        if (unit && unit.hp <= 0) {
          lane[row] = null;
          p.discard.push(unit.card);
          ctx.events.push({ type: 'unitDestroyed', player, uid: unit.uid, cardId: unit.card.id });
        }
      }
    }
    const survivors: BuildingInPlay[] = [];
    for (const b of p.buildings) {
      if (b.hp <= 0) {
        p.discard.push(b.card);
        ctx.events.push({ type: 'buildingDestroyed', player, uid: b.uid, cardId: b.card.id });
      } else {
        survivors.push(b);
      }
    }
    p.buildings = survivors;
  }

  const dead0 = s.players[0].hq <= 0;
  const dead1 = s.players[1].hq <= 0;
  if (!dead0 && !dead1) return;
  endGame(ctx, dead0 && dead1 ? 'draw' : dead0 ? 1 : 0, 'hq');
}

export function endGame(
  ctx: Ctx,
  winner: PlayerId | 'draw',
  reason: 'hq' | 'concede' | 'turnLimit',
): void {
  const s = ctx.state;
  if (s.phase === 'ended') return;
  s.winner = winner;
  s.phase = 'ended';
  ctx.events.push({ type: 'gameEnded', winner, reason });
}
