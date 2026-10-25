import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Card, Nation } from '../engine/types';
import { validateDeck } from '../engine/deck';
import { WW2_CARDS } from '../cards/ww2';
import { PRICE_BOUNDS, dailyStock, type MarketListing } from '../economy/market';
import {
  CARD_POOL, EconomyError, SELL_VALUE, buyListing, buyPack, claimDaily, extras, missingCards, newProfile, sellCards, sellExtras,
  type PackOpening, type Profile,
} from '../economy/profile';
import { dayKey } from '../economy/rewards';
import type { Logger } from './log';
import type { AccountRow, DeckRow, Store } from './store';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const NATIONS = ['usa', 'uk', 'ussr', 'germany', 'japan'] as const;
const NAME_RE = /^[A-Za-z0-9_ -]{3,20}$/;
export const MARKET_TAX = 0.08;
export const MAX_LISTINGS = 20;
export const LISTING_DAYS = 14;
const DAY_MS = 86_400_000;

const scryptAsync = (password: string, salt: string): Promise<Buffer> =>
  new Promise((resolve, reject) => scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))));

export interface MeView {
  account: { id: number; name: string; rating: number; ratedGames: number };
  profile: Omit<Profile, 'aiWins' | 'ledger' | 'packSeed'> & { ledger: Profile['ledger'] };
  decks: DeckRow[];
}

export interface MarketView {
  npc: Array<MarketListing & { sold: boolean }>;
  players: Array<{ id: number; cardId: string; price: number; seller: string; mine: boolean; expires: number }>;
}

export class GameService {
  constructor(
    readonly store: Store,
    private log: Logger,
    private now: () => number = Date.now,
  ) {}

  // ------------------------------------------------------------ accounts

  async register(name: string, password: string, nation: string): Promise<{ token: string; accountId: number }> {
    name = name.trim();
    if (!NAME_RE.test(name)) throw new ApiError(400, 'Names are 3-20 characters: letters, numbers, spaces, - and _');
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new ApiError(400, 'Passwords need 8-128 characters');
    if (!(NATIONS as readonly string[]).includes(nation)) throw new ApiError(400, 'Choose a starter nation');
    if (this.store.accountByName(name)) throw new ApiError(409, 'That name is taken');

    const salt = randomBytes(16).toString('hex');
    const hash = (await scryptAsync(password, salt)).toString('hex');
    const now = this.now();
    const seed = randomBytes(4).readUInt32LE() | 0;
    try {
      const accountId = this.store.tx(() => {
        const id = this.store.createAccount(name, hash, salt, now);
        const { profile, starterIds } = newProfile(nation as Exclude<Nation, 'neutral'>, seed, now);
        profile.packSeed = randomBytes(4).readInt32LE();
        this.store.putProfile(id, profile);
        this.store.putDeck(id, { id: 'starter', name: `Starter army (${nation.toUpperCase()})`, cardIds: starterIds, updated: now });
        return id;
      });
      this.log.info('account registered', { accountId, name, nation });
      return { token: this.newSession(accountId), accountId };
    } catch (e) {
      if (String(e).includes('UNIQUE')) throw new ApiError(409, 'That name is taken');
      throw e;
    }
  }

  async login(name: string, password: string): Promise<{ token: string; accountId: number }> {
    const account = this.store.accountByName(String(name).trim());
    // Always do the hashing work so a wrong name and a wrong password take the same time.
    const salt = account?.salt ?? '0'.repeat(32);
    const hash = await scryptAsync(String(password), salt);
    const ok = account !== undefined && timingSafeEqual(hash, Buffer.from(account.pass_hash, 'hex'));
    if (!ok) throw new ApiError(401, 'Wrong name or password');
    this.log.info('login', { accountId: account.id, name: account.name });
    return { token: this.newSession(account.id), accountId: account.id };
  }

  private newSession(accountId: number): string {
    const token = randomBytes(32).toString('hex');
    this.store.createSession(token, accountId, this.now() + 30 * DAY_MS);
    return token;
  }

  accountForToken(token: string | undefined): AccountRow | undefined {
    if (!token) return undefined;
    const id = this.store.sessionAccount(token, this.now());
    return id === undefined ? undefined : this.store.accountById(id);
  }

  logout(token: string): void {
    this.store.deleteSession(token);
  }

  me(accountId: number): MeView {
    const account = this.store.accountById(accountId)!;
    const { aiWins: _a, packSeed: _s, ...rest } = this.store.getProfile(accountId);
    return {
      account: { id: account.id, name: account.name, rating: account.rating, ratedGames: account.rated_games },
      profile: { ...rest, ledger: rest.ledger.slice(-40) },
      decks: this.store.listDecks(accountId),
    };
  }

  // ------------------------------------------------------------ economy

  private guard<R>(fn: () => R): R {
    try {
      return fn();
    } catch (e) {
      if (e instanceof EconomyError) throw new ApiError(400, e.message);
      throw e;
    }
  }

  claimDaily(accountId: number): { amount: number } {
    return this.store.withProfile(accountId, (p) => {
      const r = claimDaily(p, this.now());
      return { profile: r.profile, result: { amount: r.amount } };
    });
  }

  openPack(accountId: number): { cards: string[]; isNew: boolean[] } {
    const out: PackOpening = this.guard(() =>
      this.store.withProfile(accountId, (p) => {
        const r = buyPack(p, this.now());
        return { profile: r.profile, result: r };
      }),
    );
    return { cards: out.cards.map((c) => c.id), isNew: out.isNew };
  }

  sell(accountId: number, cardId: string, copies: number): { earned: number } {
    if (!Number.isInteger(copies) || copies < 1) throw new ApiError(400, 'Choose how many copies to sell');
    return this.guard(() =>
      this.store.withProfile(accountId, (p) => {
        const r = sellCards(p, cardId, copies, this.now());
        return { profile: r.profile, result: { earned: r.earned } };
      }),
    );
  }

  sellExtras(accountId: number): { earned: number; sold: number } {
    return this.store.withProfile(accountId, (p) => {
      const r = sellExtras(p, this.now());
      return { profile: r.profile, result: { earned: r.earned, sold: r.sold } };
    });
  }

  // ------------------------------------------------------------ decks

  saveDeck(accountId: number, id: string, name: string, cardIds: unknown): DeckRow {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new ApiError(400, 'Bad deck id');
    if (typeof name !== 'string' || name.trim().length < 1 || name.length > 40) throw new ApiError(400, 'Name the army (1-40 characters)');
    if (!Array.isArray(cardIds) || cardIds.length > 60 || cardIds.some((c) => typeof c !== 'string' || !CARD_POOL.has(c))) {
      throw new ApiError(400, 'That army contains unknown cards');
    }
    const decks = this.store.listDecks(accountId);
    if (!decks.some((d) => d.id === id) && decks.length >= 20) throw new ApiError(400, 'You can keep up to 20 armies');
    const deck: DeckRow = { id, name: name.trim(), cardIds: cardIds as string[], updated: this.now() };
    this.store.putDeck(accountId, deck);
    return deck;
  }

  deleteDeck(accountId: number, id: string): void {
    this.store.deleteDeck(accountId, id);
  }

  /** Problems that stop an army being used in a match: rules, then ownership. Empty means playable. */
  deckProblems(accountId: number, cardIds: string[]): string[] {
    const cards = cardIds.map((id) => CARD_POOL.get(id)).filter((c): c is Card => c !== undefined);
    const errors = validateDeck(cards);
    for (const m of missingCards(this.store.getProfile(accountId), cardIds)) {
      errors.push(`${CARD_POOL.get(m.id)?.name ?? m.id}: you own ${m.have} of the ${m.need} in this army`);
    }
    return errors;
  }

  /** Copies of each card that saved armies use, which therefore cannot be listed on the market. */
  private reservedByDecks(accountId: number): Map<string, number> {
    const reserved = new Map<string, number>();
    for (const d of this.store.listDecks(accountId)) {
      const per = new Map<string, number>();
      for (const id of d.cardIds) per.set(id, (per.get(id) ?? 0) + 1);
      for (const [id, n] of per) reserved.set(id, Math.max(reserved.get(id) ?? 0, n));
    }
    return reserved;
  }

  // ------------------------------------------------------------ market

  expireListings(): number {
    const now = this.now();
    const expired = this.store.expiredListings(now);
    for (const l of expired) {
      this.store.tx(() => {
        this.store.setListingStatus(l.id, 'expired');
        this.store.withProfile(l.seller_id, (p) => {
          const next = structuredClone(p);
          next.collection[l.card_id] = (next.collection[l.card_id] ?? 0) + 1;
          next.ledger.push({ t: now, kind: 'market', wb: 0, note: `Listing expired: ${CARD_POOL.get(l.card_id)?.name}`, cards: [l.card_id] });
          return { profile: next, result: null };
        });
      });
    }
    return expired.length;
  }

  market(accountId: number): MarketView {
    this.expireListings();
    const profile = this.store.getProfile(accountId);
    const now = this.now();
    const names = new Map<number, string>();
    const sellerName = (id: number) => names.get(id) ?? (names.set(id, this.store.accountById(id)?.name ?? '?'), names.get(id)!);
    return {
      npc: dailyStock(now).map((l) => ({ ...l, sold: profile.marketBought.includes(l.id) })),
      players: this.store.activeListings().map((l) => ({
        id: l.id, cardId: l.card_id, price: l.price, seller: sellerName(l.seller_id), mine: l.seller_id === accountId, expires: l.expires,
      })),
    };
  }

  buyNpcListing(accountId: number, listingId: string): void {
    const listing = dailyStock(this.now()).find((l) => l.id === listingId);
    if (!listing) throw new ApiError(400, 'That listing has expired');
    this.guard(() =>
      this.store.withProfile(accountId, (p) => ({ profile: buyListing(p, listing, this.now()), result: null })),
    );
  }

  listCard(accountId: number, cardId: string, price: number): { id: number } {
    const card = CARD_POOL.get(cardId);
    if (!card) throw new ApiError(400, 'Unknown card');
    const { min, max } = PRICE_BOUNDS[card.rarity];
    if (!Number.isInteger(price) || price < min || price > max) throw new ApiError(400, `${card.rarity} cards list for ${min}-${max} WB`);
    if (this.store.activeListingCount(accountId) >= MAX_LISTINGS) throw new ApiError(400, `You can have ${MAX_LISTINGS} active listings`);
    const now = this.now();
    return this.store.tx(() => {
      const profile = this.store.getProfile(accountId);
      const owned = profile.collection[cardId] ?? 0;
      const reserved = this.reservedByDecks(accountId).get(cardId) ?? 0;
      if (owned - reserved < 1) {
        throw new ApiError(400, owned === 0 ? `You don't own ${card.name}` : `${card.name} is used by one of your saved armies. Remove it from the army first.`);
      }
      const next = structuredClone(profile);
      next.collection[cardId] = owned - 1;
      if (next.collection[cardId] === 0) delete next.collection[cardId];
      // a listed copy leaves the starter count first only when it has to: the starter count never exceeds what is owned
      const left = next.collection[cardId] ?? 0;
      if ((next.starter[cardId] ?? 0) > left) {
        if (left === 0) delete next.starter[cardId];
        else next.starter[cardId] = left;
      }
      next.ledger.push({ t: now, kind: 'market', wb: 0, note: `Listed ${card.name} for ${price} WB`, cards: [cardId] });
      this.store.putProfile(accountId, next);
      return { id: this.store.insertListing(accountId, cardId, price, now, now + LISTING_DAYS * DAY_MS) };
    });
  }

  cancelListing(accountId: number, listingId: number): void {
    const l = this.store.listing(listingId);
    if (!l || l.seller_id !== accountId || l.status !== 'active') throw new ApiError(404, 'No such active listing of yours');
    this.store.tx(() => {
      this.store.setListingStatus(l.id, 'cancelled');
      this.store.withProfile(accountId, (p) => {
        const next = structuredClone(p);
        next.collection[l.card_id] = (next.collection[l.card_id] ?? 0) + 1;
        return { profile: next, result: null };
      });
    });
  }

  buyPlayerListing(accountId: number, listingId: number): void {
    const now = this.now();
    this.store.tx(() => {
      const l = this.store.listing(listingId);
      if (!l || l.status !== 'active') throw new ApiError(404, 'That listing is gone');
      if (l.seller_id === accountId) throw new ApiError(400, 'You cannot buy your own listing');
      const card = CARD_POOL.get(l.card_id)!;
      const buyer = this.store.getProfile(accountId);
      if (buyer.wb < l.price) throw new ApiError(400, `That costs ${l.price} WB (you have ${buyer.wb})`);
      const proceeds = Math.floor(l.price * (1 - MARKET_TAX));
      const b = structuredClone(buyer);
      b.wb -= l.price;
      b.collection[l.card_id] = (b.collection[l.card_id] ?? 0) + 1;
      b.ledger.push({ t: now, kind: 'market', wb: -l.price, note: `Bought ${card.name} from a player`, cards: [l.card_id] });
      this.store.putProfile(accountId, b);
      const seller = structuredClone(this.store.getProfile(l.seller_id));
      seller.wb += proceeds;
      seller.ledger.push({ t: now, kind: 'market', wb: proceeds, note: `Sold ${card.name} (${l.price} WB, 8% tax)`, cards: [l.card_id] });
      this.store.putProfile(l.seller_id, seller);
      this.store.setListingStatus(l.id, 'sold');
    });
  }

  // ------------------------------------------------------------ debug

  /** Admin only: puts War Bonds on an account (for testing the economy). */
  grant(name: string, wb: number): { wb: number } {
    const a = this.store.accountByName(name);
    if (!a) throw new ApiError(404, 'No such account');
    return this.store.withProfile(a.id, (p) => {
      const next = structuredClone(p);
      next.wb += wb;
      next.ledger.push({ t: this.now(), kind: 'daily', wb, note: 'Admin grant' });
      return { profile: next, result: { wb: next.wb } };
    });
  }

  /** Admin only: lets the account claim the daily bonus and first-win bonus again as if it were a new day. */
  resetDaily(name: string): void {
    const a = this.store.accountByName(name);
    if (!a) throw new ApiError(404, 'No such account');
    this.store.withProfile(a.id, (p) => ({ profile: { ...p, lastLoginDay: '', lastWinDay: '' }, result: null }));
  }

  today(): string {
    return dayKey(this.now());
  }
}

export { extras, SELL_VALUE, WW2_CARDS };
