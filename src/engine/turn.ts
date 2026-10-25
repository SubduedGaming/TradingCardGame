import type { Ctx, Resources } from './types';
import { HAND_LIMIT, HQ_INCOME, LANES, RESOURCE_TYPES, TURN_LIMIT } from './types';
import { effectiveArmour, effectiveAttack, hasKw, unitsOf } from './stats';
import { addResources, canAfford, drawOne, emptyResources, other, pay } from './zones';
import { checkState, endGame, hitUnit } from './damage';
import { runTriggers } from './effects';

/** Start, Upkeep, Production and Draw phases for the active player, ending in the Main phase. */
export function startTurn(ctx: Ctx): void {
  const s = ctx.state;
  s.turn += 1;
  const pid = s.active;
  const p = s.players[pid];
  ctx.events.push({ type: 'turnStarted', player: pid, turn: s.turn });

  // Start: ready units, reset per-turn flags, advance Rear units into empty Front slots.
  for (const { unit } of unitsOf(s, pid)) {
    unit.fresh = false;
    unit.hasAttacked = false;
    unit.redeployed = false;
    unit.grounded = false;
  }
  p.constructedThisTurn = false;
  p.discountsUsed = [];
  p.combinedArmsUsed = false;
  p.resilienceUsed = false;
  p.smoke = [false, false, false];
  for (const lane of LANES) {
    const l = p.lanes[lane];
    if (!l.front && l.rear) {
      l.front = l.rear;
      l.rear = null;
      ctx.events.push({ type: 'unitAdvanced', player: pid, lane, uid: l.front.uid });
    }
  }
  runTriggers(ctx, 'startOfTurn', pid);

  // Upkeep: units that cannot pay are Grounded this turn.
  for (const { unit } of unitsOf(s, pid)) {
    const upkeep = unit.card.upkeep;
    if (!upkeep) continue;
    const paid = canAfford(p.resources, upkeep);
    if (paid) pay(p.resources, upkeep);
    else unit.grounded = true;
    ctx.events.push({ type: 'upkeep', player: pid, uid: unit.uid, paid });
  }

  // Production: HQ and every building.
  const income: Resources = emptyResources();
  for (const r of RESOURCE_TYPES) income[r] += HQ_INCOME[r] ?? 0;
  for (const b of p.buildings) for (const r of RESOURCE_TYPES) income[r] += b.card.produces[r] ?? 0;
  const gained = addResources(p.resources, income);
  ctx.events.push({ type: 'resourcesProduced', player: pid, gained });

  // Draw: the very first turn of the game skips the draw.
  if (s.turn > 1) drawOne(ctx, pid);

  checkState(ctx);
  if (s.phase !== 'ended') {
    s.phase = 'main';
    ctx.events.push({ type: 'phaseChanged', phase: 'main' });
  }
}

/** AA batteries of the defending player fire as the active player's Combat phase begins. */
export function runAntiAir(ctx: Ctx): void {
  const s = ctx.state;
  const defender = other(s.active);
  for (const b of s.players[defender].buildings) {
    const aa = b.card.aa;
    if (!aa) continue;
    const flyers = unitsOf(s, s.active)
      .map((l) => l.unit)
      .filter((u) => hasKw(u, 'flying') && u.hp > 0);
    if (flyers.length === 0) return;
    // The owner chooses; the engine picks the most dangerous flyer (highest ATK, then lowest HP).
    flyers.sort((a, c) => effectiveAttack(s, c) - effectiveAttack(s, a) || a.hp - c.hp);
    const target = flyers[0]!;
    hitUnit(ctx, target, Math.max(1, aa - effectiveArmour(s, target)));
  }
}

/** End phase. Pauses in the 'discard' phase if the active player has too many cards. */
export function endTurn(ctx: Ctx): void {
  const s = ctx.state;
  const pid = s.active;

  runTriggers(ctx, 'endOfTurn', pid);
  for (const player of [0, 1] as const) {
    for (const { unit } of unitsOf(s, player)) {
      unit.tempKeywords = [];
      unit.tempAttack = 0;
    }
  }
  checkState(ctx);
  if (s.phase === 'ended') return;

  if (s.players[pid].hand.length > HAND_LIMIT) {
    s.phase = 'discard';
    ctx.events.push({ type: 'phaseChanged', phase: 'discard' });
    return;
  }
  finishTurn(ctx);
}

/** Closes the turn (after discarding), applies the turn limit, and starts the next turn. */
export function finishTurn(ctx: Ctx): void {
  const s = ctx.state;
  ctx.events.push({ type: 'turnEnded', player: s.active });

  if (s.turn >= TURN_LIMIT) {
    const hq0 = s.players[0].hq;
    const hq1 = s.players[1].hq;
    endGame(ctx, hq0 === hq1 ? 'draw' : hq0 > hq1 ? 0 : 1, 'turnLimit');
    return;
  }
  s.active = other(s.active);
  startTurn(ctx);
}
