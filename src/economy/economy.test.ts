import { describe, expect, it } from 'vitest';
import { WW2_CARDS } from '../cards/ww2';
import { COPY_LIMIT_BY_RARITY, validateDeck } from '../engine/deck';
import type { Rarity } from '../engine/types';
import { RARITIES } from '../engine/types';
import { NO_PITY, PITY, openPack, type PityCounters } from './packs';
import { PRICE_BOUNDS, dailyStock } from './market';
import { DAILY_LOGIN_REWARD, dayKey, farmMultiplier, matchReward } from './rewards';
import {
  CARD_POOL, EconomyError, PACK_PRICE, SELL_VALUE, STARTING_WB, buyListing, buyPack, claimDaily, extras, missingCards,
  newProfile, recordMatch, sellCards, sellExtras, sellValue,
} from './profile';

const NOW = new Date(2026, 5, 10, 12).getTime();
const DAY = 86_400_000;
const rank = (r: Rarity) => RARITIES.indexOf(r);

describe('packs', () => {
  it('opens 5 cards: three commons then two upgraded slots', () => {
    const { cards } = openPack(WW2_CARDS, {}, NO_PITY, { rng: 1 });
    expect(cards).toHaveLength(5);
    expect(cards.slice(0, 3).every((c) => c.rarity === 'common')).toBe(true);
    expect(cards[3]!.rarity).not.toBe('common');
  });

  it('is deterministic for a seed', () => {
    const a = openPack(WW2_CARDS, {}, NO_PITY, { rng: 99 }).cards.map((c) => c.id);
    const b = openPack(WW2_CARDS, {}, NO_PITY, { rng: 99 }).cards.map((c) => c.id);
    expect(a).toEqual(b);
  });

  it('matches the documented drop rates over many packs', () => {
    const counts: Record<string, number> = {};
    const packs = 30000;
    let pity: PityCounters = NO_PITY;
    for (let i = 0; i < packs; i++) {
      const r = openPack(WW2_CARDS, {}, pity, { rng: i * 7919 + 13 });
      pity = r.pity;
      for (const c of r.cards) counts[c.rarity] = (counts[c.rarity] ?? 0) + 1;
    }
    const per = (r: string) => (counts[r] ?? 0) / packs;
    // docs/04: 3.55 / 1.08 / 0.295 / 0.065 / 0.01 per pack; pity lifts the rare tiers a little
    expect(per('common')).toBeGreaterThan(3.4);
    expect(per('common')).toBeLessThan(3.6);
    expect(per('uncommon')).toBeGreaterThan(1.0);
    expect(per('uncommon')).toBeLessThan(1.15);
    expect(per('rare')).toBeGreaterThan(0.28);
    expect(per('rare')).toBeLessThan(0.34);
    expect(per('epic')).toBeGreaterThan(0.055);
    expect(per('epic')).toBeLessThan(0.09);
    expect(per('legendary')).toBeGreaterThan(0.007);
    expect(per('legendary')).toBeLessThan(0.016);
    // the pyramid holds in packs too
    expect(per('common')).toBeGreaterThan(per('uncommon'));
    expect(per('uncommon')).toBeGreaterThan(per('rare'));
    expect(per('rare')).toBeGreaterThan(per('epic'));
    expect(per('epic')).toBeGreaterThan(per('legendary'));
  });

  it('forces each pity tier when its counter runs out', () => {
    for (let i = 0; i < 300; i++) {
      const rare = openPack(WW2_CARDS, {}, { rare: PITY.rare - 1, epic: 0, legendary: 0 }, { rng: i });
      expect(Math.max(...rare.cards.map((c) => rank(c.rarity)))).toBeGreaterThanOrEqual(rank('rare'));
      const epic = openPack(WW2_CARDS, {}, { rare: 0, epic: PITY.epic - 1, legendary: 0 }, { rng: i });
      expect(Math.max(...epic.cards.map((c) => rank(c.rarity)))).toBeGreaterThanOrEqual(rank('epic'));
      const leg = openPack(WW2_CARDS, {}, { rare: 0, epic: 0, legendary: PITY.legendary - 1 }, { rng: i });
      expect(leg.cards.some((c) => c.rarity === 'legendary')).toBe(true);
      expect(leg.pity).toEqual(NO_PITY);
    }
  });

  it('never goes more than the pity limits without a Rare, Epic or Legendary', () => {
    let pity: PityCounters = NO_PITY;
    let worst = { rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < 20000; i++) {
      const r = openPack(WW2_CARDS, {}, pity, { rng: i * 31 + 5 });
      pity = r.pity;
      worst = { rare: Math.max(worst.rare, pity.rare), epic: Math.max(worst.epic, pity.epic), legendary: Math.max(worst.legendary, pity.legendary) };
    }
    expect(worst.rare).toBeLessThan(PITY.rare);
    expect(worst.epic).toBeLessThan(PITY.epic);
    expect(worst.legendary).toBeLessThan(PITY.legendary);
  });

  it('does not hand out a Legendary you own while an unowned one remains', () => {
    const legendaries = WW2_CARDS.filter((c) => c.rarity === 'legendary');
    const owned = Object.fromEntries(legendaries.slice(1).map((c) => [c.id, 1]));
    for (let i = 0; i < 4000; i++) {
      const { cards } = openPack(WW2_CARDS, owned, { rare: 0, epic: 0, legendary: PITY.legendary - 1 }, { rng: i });
      for (const c of cards.filter((x) => x.rarity === 'legendary')) expect(c.id).toBe(legendaries[0]!.id);
    }
    // with every Legendary owned, duplicates are allowed
    const all = Object.fromEntries(legendaries.map((c) => [c.id, 1]));
    const { cards } = openPack(WW2_CARDS, all, { rare: 0, epic: 0, legendary: PITY.legendary - 1 }, { rng: 3 });
    expect(cards.some((c) => c.rarity === 'legendary')).toBe(true);
  });
});

describe('rewards', () => {
  const base = { now: NOW, recentAiWins: [] as number[], wonToday: true };
  it('pays the documented amounts', () => {
    expect(matchReward({ ...base, result: 'win', level: 'recruit' }).total).toBe(40);
    expect(matchReward({ ...base, result: 'win', level: 'veteran' }).total).toBe(60);
    expect(matchReward({ ...base, result: 'win', level: 'commander' }).total).toBe(90);
    expect(matchReward({ ...base, result: 'loss', level: 'commander' }).total).toBe(15);
    expect(matchReward({ ...base, result: 'draw', level: 'recruit' }).total).toBe(25);
  });

  it('adds 50% (rounded up) for the first win of the day', () => {
    expect(matchReward({ ...base, wonToday: false, result: 'win', level: 'veteran' }).total).toBe(90);
    expect(matchReward({ ...base, wonToday: false, result: 'win', level: 'recruit' }).total).toBe(60);
    expect(matchReward({ ...base, wonToday: false, result: 'loss', level: 'recruit' }).total).toBe(15);
  });

  it('decays after 10 and 20 wins in an hour, and forgets old wins', () => {
    const wins = (n: number, age = 60_000) => Array.from({ length: n }, () => NOW - age);
    expect(farmMultiplier(wins(9), NOW)).toBe(1);
    expect(farmMultiplier(wins(10), NOW)).toBe(0.5);
    expect(farmMultiplier(wins(20), NOW)).toBe(0.25);
    expect(farmMultiplier(wins(30, 2 * 3_600_000), NOW)).toBe(1);
    expect(matchReward({ ...base, recentAiWins: wins(10), result: 'win', level: 'veteran' }).total).toBe(30);
  });
});

describe('profile', () => {
  const start = () => newProfile('germany', 4242, NOW);

  it('starts with a legal 30-card army, 200 WB and a free pack', () => {
    const { profile, starterIds } = start();
    const deck = starterIds.map((id) => CARD_POOL.get(id)!);
    expect(validateDeck(deck)).toEqual([]);
    expect(profile.wb).toBe(STARTING_WB);
    expect(profile.freePacks).toBe(1);
    expect(missingCards(profile, starterIds)).toEqual([]);
  });

  it('opens the free pack first, then charges 100 WB, and refuses without funds', () => {
    let { profile } = start();
    const free = buyPack(profile, NOW);
    expect(free.profile.wb).toBe(STARTING_WB);
    expect(free.profile.freePacks).toBe(0);
    expect(free.cards).toHaveLength(5);
    profile = free.profile;
    const paid = buyPack(profile, NOW);
    expect(paid.profile.wb).toBe(STARTING_WB - PACK_PRICE);
    const total = (p: typeof profile) => Object.values(p.collection).reduce((a, b) => a + b, 0);
    expect(total(paid.profile)).toBe(total(profile) + 5);
    expect(profile.wb).toBe(STARTING_WB); // the input is never mutated
    let broke = { ...paid.profile, wb: 99 };
    expect(() => buyPack(broke, NOW)).toThrow(EconomyError);
    broke = { ...broke, wb: 100 };
    expect(buyPack(broke, NOW).profile.wb).toBe(0);
  });

  it('records every pack with a seed that reproduces its contents', () => {
    const { profile } = start();
    const opened = buyPack(profile, NOW);
    const entry = opened.profile.ledger.at(-1)!;
    expect(entry.cards).toEqual(opened.cards.map((c) => c.id));
    const replay = openPack(WW2_CARDS, profile.collection, profile.pity, { rng: entry.seed! });
    expect(replay.cards.map((c) => c.id)).toEqual(entry.cards);
  });

  it('flags only first-time cards as new', () => {
    const { profile } = start();
    const opened = buyPack(profile, NOW);
    opened.cards.forEach((c, i) => {
      if (opened.isNew[i]) expect(profile.collection[c.id] ?? 0).toBe(0);
    });
  });

  it('sells at buyback prices, starter copies at half', () => {
    const { profile } = start();
    const starterId = Object.keys(profile.starter)[0]!;
    const card = CARD_POOL.get(starterId)!;
    expect(sellValue(profile, starterId, 1)).toBe(Math.floor(SELL_VALUE[card.rarity] / 2));
    const withExtra = { ...profile, collection: { ...profile.collection, [starterId]: profile.collection[starterId]! + 1 } };
    // the non-starter copy sells first, at full price
    expect(sellValue(withExtra, starterId, 1)).toBe(SELL_VALUE[card.rarity]);
    const sold = sellCards(withExtra, starterId, 2, NOW);
    expect(sold.earned).toBe(SELL_VALUE[card.rarity] + Math.floor(SELL_VALUE[card.rarity] / 2));
    expect(sold.profile.wb).toBe(withExtra.wb + sold.earned);
    expect(() => sellCards(profile, starterId, 99, NOW)).toThrow(EconomyError);
  });

  it('sells extras beyond the copy limit and nothing else', () => {
    const { profile } = start();
    const id = WW2_CARDS.find((c) => c.rarity === 'legendary')!.id;
    const loaded = { ...profile, collection: { ...profile.collection, [id]: 3 } };
    expect(extras(loaded).find((e) => e.card.id === id)!.copies).toBe(3 - COPY_LIMIT_BY_RARITY.legendary);
    const r = sellExtras(loaded, NOW);
    expect(r.profile.collection[id]).toBe(1);
    expect(r.earned).toBe(2 * SELL_VALUE.legendary);
    expect(extras(r.profile)).toEqual([]);
  });

  it('pays the daily login once per day', () => {
    const { profile } = start();
    expect(claimDaily(profile, NOW).amount).toBe(0); // already claimed on the day of creation
    const next = claimDaily(profile, NOW + DAY);
    expect(next.amount).toBe(DAILY_LOGIN_REWARD);
    expect(claimDaily(next.profile, NOW + DAY + 1000).amount).toBe(0);
  });

  it('applies match rewards, first-win bonus and anti-farm', () => {
    let { profile } = start();
    const first = recordMatch(profile, 'win', 'veteran', NOW);
    expect(first.reward.total).toBe(90);
    profile = first.profile;
    expect(recordMatch(profile, 'win', 'veteran', NOW + 1000).reward.total).toBe(60);
    for (let i = 0; i < 10; i++) profile = recordMatch(profile, 'win', 'veteran', NOW + 2000 + i).profile;
    expect(recordMatch(profile, 'win', 'veteran', NOW + 5000).reward.total).toBe(30);
    expect(recordMatch(profile, 'loss', 'veteran', NOW + 5000).reward.total).toBe(15);
  });
});

describe('market', () => {
  it('has the same stock all day, a different stock on another day, and respects price bounds', () => {
    const a = dailyStock(NOW);
    expect(dailyStock(NOW + 3_600_000).map((l) => l.id + l.card.id + l.price)).toEqual(a.map((l) => l.id + l.card.id + l.price));
    expect(dailyStock(NOW + 3 * DAY).map((l) => l.card.id)).not.toEqual(a.map((l) => l.card.id));
    for (const l of a) {
      expect(l.price).toBeGreaterThanOrEqual(PRICE_BOUNDS[l.card.rarity].min);
      expect(l.price).toBeLessThanOrEqual(PRICE_BOUNDS[l.card.rarity].max);
    }
    expect(a.filter((l) => l.card.rarity === 'legendary')).toHaveLength(1);
  });

  it('prices every listing above the NPC buyback so selling to players beats the system', () => {
    for (const l of dailyStock(NOW)) expect(l.price).toBeGreaterThan(SELL_VALUE[l.card.rarity]);
  });

  it('lets a player buy a listing once, with enough War Bonds, today only', () => {
    const { profile } = newProfile('usa', 1, NOW);
    const cheap = dailyStock(NOW).find((l) => l.card.rarity === 'common')!;
    const bought = buyListing(profile, cheap, NOW);
    expect(bought.wb).toBe(profile.wb - cheap.price);
    expect(bought.collection[cheap.card.id]).toBe((profile.collection[cheap.card.id] ?? 0) + 1);
    expect(() => buyListing(bought, cheap, NOW)).toThrow(/already sold/);
    const legendary = dailyStock(NOW).find((l) => l.card.rarity === 'legendary')!;
    expect(() => buyListing(profile, legendary, NOW)).toThrow(/costs/);
    expect(() => buyListing(profile, cheap, NOW + 2 * DAY)).toThrow(/expired/);
    expect(dayKey(NOW)).toBe(cheap.id.split('|')[0]);
  });
});
