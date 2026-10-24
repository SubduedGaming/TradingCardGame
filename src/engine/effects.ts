import type {
  BuildingInPlay,
  ChosenKind,
  Ctx,
  Effect,
  GameState,
  LaneIndex,
  OrderCard,
  PlayerId,
  TargetRef,
  TargetSpec,
  Trigger,
  UnitCard,
  UnitInPlay,
} from './types';
import { LANES, RESOURCE_TYPES, ROWS } from './types';
import { effectiveArmour, hasKw, locateUnit, unitsOf } from './stats';
import { addResources, drawOne, locateBuilding, other } from './zones';
import { hitBuilding, hitHq, hitUnit } from './damage';
import { nextInt, shuffle } from './rng';
import { enterBoard } from './units';

type TargetedEffect = Extract<Effect, { target: TargetSpec }>;

function isTargeted(effect: Effect): effect is TargetedEffect {
  return 'target' in effect;
}

/** Effects that need the player to choose a target for the given trigger, in resolution order. */
export function chosenEffects(effects: Effect[], trigger: Trigger): TargetedEffect[] {
  return effects.filter(isTargeted).filter((e) => e.trigger === trigger && e.target.kind === 'chosen');
}

function candidatesFor(state: GameState, player: PlayerId, of: ChosenKind, effect: Effect): TargetRef[] {
  const opp = other(player);
  const unitRefs = (p: PlayerId): TargetRef[] =>
    unitsOf(state, p).map((l) => ({ kind: 'unit', uid: l.unit.uid }));
  const buildingRefs = (p: PlayerId): TargetRef[] =>
    state.players[p].buildings
      .filter((b) => !(effect.do === 'destroyBuilding' && effect.maxHp !== undefined && b.hp > effect.maxHp))
      .map((b) => ({ kind: 'building', uid: b.uid }));

  switch (of) {
    case 'enemyUnit':
      return unitRefs(opp);
    case 'friendlyUnit':
      return unitRefs(player);
    case 'enemyBuilding':
      return buildingRefs(opp);
    case 'friendlyBuilding':
      return buildingRefs(player);
    case 'enemyUnitOrBuilding':
      return [...unitRefs(opp), ...buildingRefs(opp)];
    case 'friendlyLane':
    case 'enemyLane':
      return LANES.map((lane): TargetRef => ({ kind: 'lane', lane }));
    case 'resource':
      return RESOURCE_TYPES.map((resource): TargetRef => ({ kind: 'resource', resource }));
  }
}

function combosFor(state: GameState, player: PlayerId, effects: Effect[], trigger: Trigger): TargetRef[][] | null {
  const slots = chosenEffects(effects, trigger).map((e) =>
    e.target.kind === 'chosen' ? candidatesFor(state, player, e.target.of, e) : [],
  );
  if (slots.some((s) => s.length === 0)) return null;
  let combos: TargetRef[][] = [[]];
  for (const slot of slots) {
    const next: TargetRef[][] = [];
    for (const combo of combos) for (const t of slot) next.push([...combo, t]);
    combos = next;
  }
  return combos;
}

/** Every legal assignment of targets for an order. Empty if some required target has no candidate. */
export function orderTargetCombos(state: GameState, player: PlayerId, card: OrderCard): TargetRef[][] {
  return combosFor(state, player, card.effects, 'onPlay') ?? [];
}

/**
 * Every legal assignment of targets for a unit's onDeploy effects. Unlike orders, a deploy is still
 * allowed when a target is unavailable: the unit enters and the effect does nothing (`[[]]`).
 */
export function deployTargetCombos(state: GameState, player: PlayerId, card: UnitCard): TargetRef[][] {
  return combosFor(state, player, card.effects ?? [], 'onDeploy') ?? [[]];
}

export interface EffectContext {
  player: PlayerId;
  /** Unit or building that is the source of the effects (for `self` and `autoAlly`). */
  sourceUid?: string;
  chosen: TargetRef[];
}

function unitByRef(state: GameState, ref: TargetRef): UnitInPlay | null {
  return ref.kind === 'unit' ? (locateUnit(state, ref.uid)?.unit ?? null) : null;
}

function buildingByRef(state: GameState, ref: TargetRef): BuildingInPlay | null {
  return ref.kind === 'building' ? locateBuilding(state, ref.uid) : null;
}

function mostDamaged(units: UnitInPlay[]): UnitInPlay | null {
  let best: UnitInPlay | null = null;
  for (const u of units) {
    const missing = u.maxHp - u.hp;
    if (missing > 0 && (best === null || missing > best.maxHp - best.hp)) best = u;
  }
  return best;
}

function resolveTargets(
  state: GameState,
  ec: EffectContext,
  spec: TargetSpec,
  takeChosen: () => TargetRef | undefined,
): TargetRef[] {
  switch (spec.kind) {
    case 'self': {
      if (!ec.sourceUid) return [];
      if (locateUnit(state, ec.sourceUid)) return [{ kind: 'unit', uid: ec.sourceUid }];
      if (locateBuilding(state, ec.sourceUid)) return [{ kind: 'building', uid: ec.sourceUid }];
      return [];
    }
    case 'chosen': {
      const t = takeChosen();
      return t ? [t] : [];
    }
    case 'autoAlly': {
      let pool = unitsOf(state, ec.player);
      if (spec.scope === 'lane' && ec.sourceUid) {
        const src = locateUnit(state, ec.sourceUid);
        if (!src) return [];
        pool = pool.filter((l) => l.lane === src.lane);
      }
      const pick = mostDamaged(pool.map((l) => l.unit));
      return pick ? [{ kind: 'unit', uid: pick.uid }] : [];
    }
    case 'allEnemyFrontUnits':
      return unitsOf(state, other(ec.player))
        .filter((l) => l.row === 'front')
        .map((l) => ({ kind: 'unit', uid: l.unit.uid }));
    case 'allFriendlyUnits':
      return unitsOf(state, ec.player).map((l) => ({ kind: 'unit', uid: l.unit.uid }));
  }
}

function damageUnitByOrder(ctx: Ctx, unit: UnitInPlay, amount: number, ignoresArmour: boolean): void {
  hitUnit(ctx, unit, ignoresArmour ? amount : Math.max(1, amount - effectiveArmour(ctx.state, unit)));
}

function summonFromDeck(ctx: Ctx, player: PlayerId, role: UnitCard['role'], count: number): void {
  const p = ctx.state.players[player];

  const picks: number[] = [];
  p.deck.forEach((c, i) => {
    if (picks.length < count && c.type === 'unit' && c.role === role) picks.push(i);
  });

  const slots: { lane: LaneIndex; row: 'front' | 'rear' }[] = [];
  for (const row of ROWS) for (const lane of LANES) if (!p.lanes[lane][row]) slots.push({ lane, row });

  const n = Math.min(picks.length, slots.length);
  const chosen = picks.slice(0, n);
  const cards = chosen.map((i) => p.deck[i] as UnitCard);
  const taken = new Set(chosen);
  p.deck = p.deck.filter((_, i) => !taken.has(i));
  cards.forEach((card, i) => {
    const slot = slots[i]!;
    enterBoard(ctx, player, card, slot.lane, slot.row);
  });
  shuffle(ctx.state, p.deck);
}

/** Resolves all effects of `effects` whose trigger matches. Chosen targets are consumed in order. */
export function resolveEffects(ctx: Ctx, effects: Effect[], trigger: Trigger, ec: EffectContext): void {
  const state = ctx.state;
  let chosenIndex = 0;
  const takeChosen = () => ec.chosen[chosenIndex++];

  for (const effect of effects) {
    if (effect.trigger !== trigger) continue;
    const targets = isTargeted(effect) ? resolveTargets(state, ec, effect.target, takeChosen) : [];

    switch (effect.do) {
      case 'damage':
        for (const t of targets) {
          if (t.kind === 'unit') {
            const unit = unitByRef(state, t);
            if (unit) damageUnitByOrder(ctx, unit, effect.amount, effect.ignoresArmour === true);
          } else if (t.kind === 'building') {
            const b = buildingByRef(state, t);
            if (b) hitBuilding(ctx, b, effect.amount);
          } else if (t.kind === 'hq') {
            hitHq(ctx, t.player, effect.amount);
          } else if (t.kind === 'lane') {
            const lane = state.players[other(ec.player)].lanes[t.lane];
            for (const unit of [lane.front, lane.rear]) {
              if (unit) damageUnitByOrder(ctx, unit, effect.amount, effect.ignoresArmour === true);
            }
          }
        }
        break;
      case 'heal':
        for (const t of targets) {
          const unit = unitByRef(state, t);
          if (!unit) continue;
          const healed = Math.min(effect.amount, unit.maxHp - unit.hp);
          if (healed > 0) {
            unit.hp += healed;
            ctx.events.push({ type: 'healed', uid: unit.uid, amount: healed });
          }
        }
        break;
      case 'draw':
        for (let i = 0; i < effect.count; i++) drawOne(ctx, ec.player);
        break;
      case 'gain': {
        const gained = addResources(state.players[ec.player].resources, { [effect.resource]: effect.amount });
        ctx.events.push({ type: 'resourcesGained', player: ec.player, gained });
        break;
      }
      case 'gainChosen':
        for (const t of targets) {
          if (t.kind !== 'resource') continue;
          const gained = addResources(state.players[ec.player].resources, { [t.resource]: effect.amount });
          ctx.events.push({ type: 'resourcesGained', player: ec.player, gained });
        }
        break;
      case 'addMaxHp':
        for (const t of targets) {
          const unit = unitByRef(state, t);
          if (unit) {
            unit.maxHp += effect.amount;
            unit.hp += effect.amount;
          }
        }
        break;
      case 'modifyAttack':
        for (const t of targets) {
          const unit = unitByRef(state, t);
          if (unit) unit.tempAttack += effect.amount;
        }
        break;
      case 'grantKeyword':
        for (const t of targets) {
          const unit = unitByRef(state, t);
          if (unit && !hasKw(unit, effect.keyword)) unit.tempKeywords.push(effect.keyword);
        }
        break;
      case 'destroyBuilding':
        for (const t of targets) {
          const b = buildingByRef(state, t);
          if (b && (effect.maxHp === undefined || b.hp <= effect.maxHp)) b.hp = 0;
        }
        break;
      case 'smoke':
        for (const t of targets) {
          if (t.kind === 'lane') state.players[ec.player].smoke[t.lane] = true;
        }
        break;
      case 'discardRandom': {
        const opp = state.players[other(ec.player)];
        for (let i = 0; i < effect.count && opp.hand.length > 0; i++) {
          const [card] = opp.hand.splice(nextInt(state, opp.hand.length), 1);
          if (!card) break;
          opp.discard.push(card);
          ctx.events.push({ type: 'discarded', player: other(ec.player), cardId: card.id });
        }
        break;
      }
      case 'summonFromDeck':
        summonFromDeck(ctx, ec.player, effect.role, effect.count);
        break;
    }
  }
}

/** Runs automatic (non-chosen) triggers for every unit and building a player controls. */
export function runTriggers(ctx: Ctx, trigger: 'startOfTurn' | 'endOfTurn', player: PlayerId): void {
  const sources: { uid: string; effects: Effect[] | undefined }[] = [
    ...unitsOf(ctx.state, player).map((l) => ({ uid: l.unit.uid, effects: l.unit.card.effects })),
    ...ctx.state.players[player].buildings.map((b) => ({ uid: b.uid, effects: b.card.effects })),
  ];
  for (const src of sources) {
    if (!src.effects) continue;
    // A source destroyed by an earlier trigger no longer acts.
    if (!locateUnit(ctx.state, src.uid) && !locateBuilding(ctx.state, src.uid)) continue;
    resolveEffects(ctx, src.effects, trigger, { player, sourceUid: src.uid, chosen: [] });
  }
}
