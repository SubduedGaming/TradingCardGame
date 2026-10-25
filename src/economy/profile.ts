import type { Card, Nation, Rarity } from '../engine/types';
import { COPY_LIMIT_BY_RARITY } from '../engine/deck';
import { WW2_CARDS } from '../cards/ww2';
import { buildNationDeck } from '../ai/decks';
import { NO_PITY, openPack, type PityCounters } from './packs';
import type { MarketListing } from './market';
import { DAILY_LOGIN_REWARD, dayKey, matchReward, type AiLevel, type MatchResult, type Reward } from './rewards';

export const PACK_PRICE = 100;
export const STARTING_WB = 200;

/** NPC buyback prices per card (docs/04 section 5). */
export const SELL_VALUE: Record<Rarity, number> = { common: 5, uncommon: 15, rare: 50, epic: 150, legendary: 500 };

/** One append-only record of anything that changed the player's War Bonds or collection. */
export interface LedgerEntry {
  t: number;
  kind: 'start' | 'daily' | 'match' | 'pack' | 'freePack' | 'sell' | 'market';
  wb: number;
  note: string;
  /** Pack seed, so a pack's contents can be verified by replaying it. */
  seed?: number;
  cards?: string[];
}

export interface Profile {
  version: 1;
  id: string;
  wb: number;
  /** Card id -> copies owned. */
  collection: Record<string, number>;
  /** Copies of each card that came from the starter army (they sell for half). */
  starter: Record<string, number>;
  pity: PityCounters;
  packsOpened: number;
  freePacks: number;
  /** Seed counter for pack rolls. */
  packSeed: number;
  lastLoginDay: string;
  lastWinDay: string;
  aiWins: number[];
  /** Market listing ids already bought (they are cleared when the day's stock rotates). */
  marketBought: string[];
  ledger: LedgerEntry[];
}

const LEDGER_MAX = 500;

function log(p: Profile, entry: LedgerEntry): void {
  p.ledger.push(entry);
  if (p.ledger.length > LEDGER_MAX) p.ledger.splice(0, p.ledger.length - LEDGER_MAX);
}

function add(collection: Record<string, number>, id: string, n = 1): void {
  collection[id] = (collection[id] ?? 0) + n;
}

export const CARD_POOL: ReadonlyMap<string, Card> = new Map(WW2_CARDS.map((c) => [c.id, c]));

/** A new account: a 30-card starter army of the chosen nation, 200 WB and one free pack (docs/04 section 10). */
export function newProfile(nation: Exclude<Nation, 'neutral'>, seed: number, now: number): { profile: Profile; starterIds: string[] } {
  const deck = buildNationDeck(nation, { rng: seed | 0 });
  const collection: Record<string, number> = {};
  for (const c of deck) add(collection, c.id);
  const profile: Profile = {
    version: 1,
    id: `p${(seed >>> 0).toString(36)}`,
    wb: STARTING_WB,
    collection,
    starter: { ...collection },
    pity: { ...NO_PITY },
    packsOpened: 0,
    freePacks: 1,
    packSeed: (seed * 2654435761) | 0,
    lastLoginDay: dayKey(now),
    lastWinDay: '',
    aiWins: [],
    marketBought: [],
    ledger: [],
  };
  log(profile, { t: now, kind: 'start', wb: STARTING_WB, note: `Starter army: ${nation}` });
  return { profile, starterIds: deck.map((c) => c.id) };
}

export class EconomyError extends Error {}

/** Claims the daily login bonus. Returns the new profile and the amount (0 if already claimed today). */
export function claimDaily(profile: Profile, now: number): { profile: Profile; amount: number } {
  const day = dayKey(now);
  if (profile.lastLoginDay === day) return { profile, amount: 0 };
  const p = structuredClone(profile);
  p.lastLoginDay = day;
  p.wb += DAILY_LOGIN_REWARD;
  log(p, { t: now, kind: 'daily', wb: DAILY_LOGIN_REWARD, note: 'Daily login' });
  return { profile: p, amount: DAILY_LOGIN_REWARD };
}

export function recordMatch(
  profile: Profile,
  result: MatchResult,
  level: AiLevel | 'pvp',
  now: number,
  ratingGap = 0,
): { profile: Profile; reward: Reward } {
  const p = structuredClone(profile);
  const reward = matchReward({ result, level, ratingGap, now, recentAiWins: p.aiWins, wonToday: p.lastWinDay === dayKey(now) });
  p.wb += reward.total;
  if (result === 'win') {
    if (level !== 'pvp') p.aiWins = [...p.aiWins.filter((t) => now - t < 3_600_000), now];
    p.lastWinDay = dayKey(now);
  }
  log(p, { t: now, kind: 'match', wb: reward.total, note: `${result} vs ${level}` });
  return { profile: p, reward };
}

export interface PackOpening {
  profile: Profile;
  cards: Card[];
  /** Cards in the pack the player did not own before. */
  isNew: boolean[];
}

/** Opens a pack: the free one first if the player has it, otherwise it costs PACK_PRICE. */
export function buyPack(profile: Profile, now: number, pool: Card[] = WW2_CARDS): PackOpening {
  const free = profile.freePacks > 0;
  if (!free && profile.wb < PACK_PRICE) throw new EconomyError(`A pack costs ${PACK_PRICE} WB (you have ${profile.wb})`);
  const p = structuredClone(profile);
  const seed = p.packSeed | 0;
  p.packSeed = (p.packSeed + 0x9e3779b9) | 0;
  const result = openPack(pool, p.collection, p.pity, { rng: seed });
  const isNew = result.cards.map((c) => !((profile.collection[c.id] ?? 0) > 0));
  // a card repeated inside one pack is only "new" the first time
  const firstSeen = new Set<string>();
  result.cards.forEach((c, i) => {
    if (firstSeen.has(c.id)) isNew[i] = false;
    firstSeen.add(c.id);
  });
  for (const c of result.cards) add(p.collection, c.id);
  p.pity = result.pity;
  p.packsOpened += 1;
  if (free) p.freePacks -= 1;
  else p.wb -= PACK_PRICE;
  log(p, {
    t: now,
    kind: free ? 'freePack' : 'pack',
    wb: free ? 0 : -PACK_PRICE,
    note: free ? 'Free starter pack' : 'Standard Pack',
    seed,
    cards: result.cards.map((c) => c.id),
  });
  return { profile: p, cards: result.cards, isNew };
}

/** Copies the player can sell without dropping below `keep` (never below 0). */
export function sellValue(profile: Profile, cardId: string, copies: number): number {
  const card = CARD_POOL.get(cardId);
  if (!card) throw new EconomyError(`Unknown card ${cardId}`);
  const owned = profile.collection[cardId] ?? 0;
  if (copies < 1 || copies > owned) throw new EconomyError(`You own ${owned} of ${card.name}`);
  // Non-starter copies sell first; starter copies sell for half.
  const starter = profile.starter[cardId] ?? 0;
  const normal = Math.min(copies, owned - starter);
  const starterSold = copies - normal;
  return normal * SELL_VALUE[card.rarity] + starterSold * Math.floor(SELL_VALUE[card.rarity] / 2);
}

export function sellCards(profile: Profile, cardId: string, copies: number, now: number): { profile: Profile; earned: number } {
  const earned = sellValue(profile, cardId, copies);
  const p = structuredClone(profile);
  const owned = p.collection[cardId]!;
  const starterSold = Math.max(0, copies - (owned - (p.starter[cardId] ?? 0)));
  p.collection[cardId] = owned - copies;
  if (p.collection[cardId] === 0) delete p.collection[cardId];
  if (starterSold > 0) {
    p.starter[cardId] = (p.starter[cardId] ?? 0) - starterSold;
    if (p.starter[cardId] === 0) delete p.starter[cardId];
  }
  p.wb += earned;
  log(p, { t: now, kind: 'sell', wb: earned, note: `Sold ${copies} x ${CARD_POOL.get(cardId)!.name}`, cards: [cardId] });
  return { profile: p, earned };
}

/** Copies of each card beyond what a deck may ever use (the rarity copy limit). */
export function extras(profile: Profile): Array<{ card: Card; copies: number }> {
  const out: Array<{ card: Card; copies: number }> = [];
  for (const [id, n] of Object.entries(profile.collection)) {
    const card = CARD_POOL.get(id);
    if (!card) continue;
    const extra = n - COPY_LIMIT_BY_RARITY[card.rarity];
    if (extra > 0) out.push({ card, copies: extra });
  }
  return out;
}

/** Sells every card beyond its deck copy limit in one go. */
export function sellExtras(profile: Profile, now: number): { profile: Profile; earned: number; sold: number } {
  let p = profile;
  let earned = 0;
  let sold = 0;
  for (const { card, copies } of extras(profile)) {
    const r = sellCards(p, card.id, copies, now);
    p = r.profile;
    earned += r.earned;
    sold += copies;
  }
  return { profile: p, earned, sold };
}

/** Is `ids` (a deck) fully covered by the player's collection? Returns the missing copies. */
export function missingCards(profile: Profile, ids: string[]): Array<{ id: string; need: number; have: number }> {
  const need = new Map<string, number>();
  for (const id of ids) need.set(id, (need.get(id) ?? 0) + 1);
  const out: Array<{ id: string; need: number; have: number }> = [];
  for (const [id, n] of need) {
    const have = profile.collection[id] ?? 0;
    if (have < n) out.push({ id, need: n, have });
  }
  return out;
}

export function distinctOwned(profile: Profile): number {
  return Object.keys(profile.collection).length;
}

/** Buys one listing from the day's market stock. */
export function buyListing(profile: Profile, listing: MarketListing, now: number): Profile {
  if (listing.id.split('|')[0] !== dayKey(now)) throw new EconomyError('That listing has expired');
  if (profile.marketBought.includes(listing.id)) throw new EconomyError('That listing is already sold');
  if (profile.wb < listing.price) throw new EconomyError(`That costs ${listing.price} WB (you have ${profile.wb})`);
  const p = structuredClone(profile);
  p.marketBought = [...p.marketBought.filter((id) => id.split('|')[0] === dayKey(now)), listing.id];
  p.wb -= listing.price;
  add(p.collection, listing.card.id);
  log(p, { t: now, kind: 'market', wb: -listing.price, note: `Bought ${listing.card.name}`, cards: [listing.card.id] });
  return p;
}
