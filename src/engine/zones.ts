import type { BuildingInPlay, Ctx, GameState, PlayerId, Resources } from './types';
import { RESOURCE_CAP, RESOURCE_TYPES } from './types';

export const other = (player: PlayerId): PlayerId => (player === 0 ? 1 : 0);

export function emptyResources(): Resources {
  return { manpower: 0, steel: 0, fuel: 0, supplies: 0 };
}

export function canAfford(bank: Resources, cost: Partial<Resources>): boolean {
  return RESOURCE_TYPES.every((r) => bank[r] >= (cost[r] ?? 0));
}

export function pay(bank: Resources, cost: Partial<Resources>): void {
  for (const r of RESOURCE_TYPES) bank[r] -= cost[r] ?? 0;
}

/** Adds resources respecting the cap. Returns what was actually gained. */
export function addResources(bank: Resources, gain: Partial<Resources>): Resources {
  const gained = emptyResources();
  for (const r of RESOURCE_TYPES) {
    const want = gain[r] ?? 0;
    const next = Math.min(RESOURCE_CAP, bank[r] + want);
    gained[r] = next - bank[r];
    bank[r] = next;
  }
  return gained;
}

/** Draw one card. An empty deck causes Fatigue (1, then 2, then 3 ... HQ damage). */
export function drawOne(ctx: Ctx, player: PlayerId): void {
  const p = ctx.state.players[player];
  const card = p.deck.shift();
  if (card) {
    p.hand.push(card);
    ctx.events.push({ type: 'cardDrawn', player, cardId: card.id });
    return;
  }
  p.fatigue += 1;
  p.hq -= p.fatigue;
  ctx.events.push({ type: 'fatigue', player, damage: p.fatigue });
}

export function locateBuilding(state: GameState, uid: string): BuildingInPlay | null {
  for (const p of state.players) {
    const found = p.buildings.find((b) => b.uid === uid);
    if (found) return found;
  }
  return null;
}

export function newUid(state: GameState): string {
  const uid = `u${state.nextUid}`;
  state.nextUid += 1;
  return uid;
}
