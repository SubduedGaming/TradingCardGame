import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { Action } from '../engine/types';
import { createGame } from '../engine/game';
import { apply } from '../engine/game';
import { CARD_POOL } from '../economy/profile';
import { PRICE_BOUNDS } from '../economy/market';
import type { ServerMsg } from '../shared/protocol';
import { createApp, type App } from './app';
import { loadConfig } from './config';
import { Logger } from './log';
import type { MeView } from './service';

let app: App;
let base = '';
let now = new Date(2026, 5, 10, 12).getTime();
const DAY = 86_400_000;

const lines: string[] = [];
async function boot(overrides = {}) {
  const cfg = loadConfig({ dbPath: ':memory:', staticDir: '', port: 0, host: '127.0.0.1', aiDelayMs: 0, queueFillMs: 300, turnTimerMs: 60_000, awayGraceMs: 50, adminToken: 'secret', ...overrides });
  app = createApp(cfg, { log: new Logger('error', (l) => lines.push(l)), now: () => now });
  const port = await app.listen();
  base = `http://127.0.0.1:${port}`;
}
beforeEach(async () => {
  now = new Date(2026, 5, 10, 12).getTime();
  await boot();
});
afterEach(async () => {
  await app.close();
});

async function call(method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}

let counter = 0;
async function newPlayer(nation = 'usa', name = `player${++counter}`) {
  const r = await call('POST', '/api/register', { name, password: 'correct horse', nation });
  expect(r.status).toBe(200);
  return { name, token: r.json.token as string, me: r.json.me as MeView };
}

class Client {
  ws: WebSocket;
  msgs: ServerMsg[] = [];
  private waiters: Array<{ pred: (m: ServerMsg) => boolean; resolve: (m: ServerMsg) => void }> = [];
  seat = -1;
  matchId = '';
  auto: ((m: Extract<ServerMsg, { type: 'state' }>) => Action | null) | null = null;
  constructor(token: string) {
    this.ws = new WebSocket(`${base.replace('http', 'ws')}/ws?token=${token}`);
    this.ws.on('message', (d) => {
      const m = JSON.parse(String(d)) as ServerMsg;
      this.msgs.push(m);
      if (m.type === 'matchStart') {
        this.seat = m.seat;
        this.matchId = m.matchId;
      }
      if (m.type === 'state' && this.auto && m.acting === this.seat) {
        const a = this.auto(m);
        if (a) this.send({ type: 'action', matchId: m.matchId, action: a });
      }
      this.waiters = this.waiters.filter((w) => {
        if (!w.pred(m)) return true;
        w.resolve(m);
        return false;
      });
    });
  }
  send(msg: object) {
    this.ws.send(JSON.stringify(msg));
  }
  open() {
    return new Promise<void>((ok, fail) => {
      this.ws.once('open', () => ok());
      this.ws.once('error', fail);
      this.ws.once('unexpected-response', (_q, res) => fail(new Error(`HTTP ${res.statusCode}`)));
    });
  }
  waitFor<T extends ServerMsg['type']>(type: T, timeout = 20_000): Promise<Extract<ServerMsg, { type: T }>> {
    const hit = this.msgs.find((m) => m.type === type);
    if (hit) return Promise.resolve(hit as Extract<ServerMsg, { type: T }>);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timed out waiting for ${type}; got ${this.msgs.map((m) => m.type).join(',')}`)), timeout);
      this.waiters.push({ pred: (m) => m.type === type, resolve: (m) => (clearTimeout(t), resolve(m as never)) });
    });
  }
  close() {
    this.ws.close();
  }
}

/** A simple bot that plays whatever is legal, preferring to do something over passing. */
function bot(seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return (m: Extract<ServerMsg, { type: 'state' }>): Action | null => {
    const mull = m.legal.find((a) => a.type === 'mulligan' && a.keep);
    if (mull) return mull;
    const discard = m.legal.find((a) => a.type === 'discard');
    if (discard) return discard;
    const end = m.legal.find((a) => a.type === 'endMain' || a.type === 'endTurn');
    const doing = m.legal.filter((a) => a.type !== 'concede' && a.type !== 'endMain' && a.type !== 'endTurn' && a.type !== 'redeploy');
    if (doing.length > 0 && rnd() < 0.8) return doing[Math.floor(rnd() * doing.length)]!;
    return end ?? null;
  };
}

describe('accounts', () => {
  it('registers, signs in, and rejects bad input', async () => {
    const p = await newPlayer('germany', 'Alice');
    expect(p.me.account.name).toBe('Alice');
    expect(p.me.profile.wb).toBe(200);
    expect(p.me.profile.freePacks).toBe(1);
    expect(p.me.decks).toHaveLength(1);
    expect(p.me.decks[0]!.cardIds).toHaveLength(30);

    expect((await call('POST', '/api/register', { name: 'alice', password: 'another pass', nation: 'usa' })).status).toBe(409); // names are case-insensitive
    expect((await call('POST', '/api/register', { name: 'x', password: 'another pass', nation: 'usa' })).status).toBe(400);
    expect((await call('POST', '/api/register', { name: 'Bobby', password: 'short', nation: 'usa' })).status).toBe(400);
    expect((await call('POST', '/api/register', { name: 'Bobby', password: 'long enough', nation: 'mars' })).status).toBe(400);

    expect((await call('POST', '/api/login', { name: 'Alice', password: 'wrong password' })).status).toBe(401);
    expect((await call('POST', '/api/login', { name: 'Nobody', password: 'wrong password' })).status).toBe(401);
    const ok = await call('POST', '/api/login', { name: 'alice', password: 'correct horse' });
    expect(ok.status).toBe(200);
    expect((await call('GET', '/api/me', undefined, ok.json.token)).json.me.account.name).toBe('Alice');
    expect((await call('GET', '/api/me')).status).toBe(401);
    await call('POST', '/api/logout', {}, ok.json.token);
    expect((await call('GET', '/api/me', undefined, ok.json.token)).status).toBe(401);
  });

  it('never stores or returns the password', async () => {
    const p = await newPlayer('usa', 'Carol');
    expect(JSON.stringify(p.me)).not.toMatch(/correct horse|pass_hash|salt/);
  });

  it('keeps the health endpoint public and the admin API closed without the token', async () => {
    expect((await call('GET', '/api/health')).json.ok).toBe(true);
    expect((await call('GET', '/api/admin/stats')).status).toBe(404);
    expect((await call('GET', '/api/admin/stats', undefined, undefined, { 'x-admin-token': 'secret' })).json.db.accounts).toBe(0);
  });
});

describe('economy over the API', () => {
  it('opens the free pack, then charges, and rejects a pack without funds', async () => {
    const p = await newPlayer();
    const first = await call('POST', '/api/packs/open', {}, p.token);
    expect(first.json.cards).toHaveLength(5);
    expect(first.json.me.profile.wb).toBe(200);
    expect(first.json.me.profile.freePacks).toBe(0);
    const second = await call('POST', '/api/packs/open', {}, p.token);
    expect(second.json.me.profile.wb).toBe(100);
    await call('POST', '/api/packs/open', {}, p.token);
    const broke = await call('POST', '/api/packs/open', {}, p.token);
    expect(broke.status).toBe(400);
    expect(broke.json.error).toMatch(/costs 100/);
    const ledger = (await call('GET', '/api/me', undefined, p.token)).json.me.profile.ledger;
    expect(ledger.filter((l: any) => l.kind === 'pack' || l.kind === 'freePack')).toHaveLength(3);
  });

  it('claims the daily bonus once per day', async () => {
    const p = await newPlayer();
    expect((await call('POST', '/api/daily', {}, p.token)).json.amount).toBe(0);
    now += DAY;
    expect((await call('POST', '/api/daily', {}, p.token)).json.amount).toBe(20);
    expect((await call('POST', '/api/daily', {}, p.token)).json.amount).toBe(0);
  });

  it('saves armies, flags ones that cannot be played, and enforces ownership', async () => {
    const p = await newPlayer();
    const starter = p.me.decks[0]!;
    const ok = await call('PUT', '/api/decks/mine', { name: 'Copy', cardIds: starter.cardIds }, p.token);
    expect(ok.json.problems).toEqual([]);
    const unowned = [...CARD_POOL.values()].filter((c) => !p.me.profile.collection[c.id])[0]!;
    const bad = await call('PUT', '/api/decks/bad', { name: 'Bad', cardIds: [...starter.cardIds.slice(1), unowned.id] }, p.token);
    expect(bad.json.problems.join(' ')).toMatch(/you own 0/);
    expect((await call('PUT', '/api/decks/x', { name: 'Unknown', cardIds: ['ww2.unit.nope'] }, p.token)).status).toBe(400);
    expect((await call('DELETE', '/api/decks/bad', undefined, p.token)).json.me.decks.map((d: any) => d.id)).not.toContain('bad');
  });

  it('sells cards and refuses to sell more than owned', async () => {
    const p = await newPlayer();
    const id = Object.keys(p.me.profile.collection)[0]!;
    const sold = await call('POST', '/api/sell', { cardId: id, copies: 1 }, p.token);
    expect(sold.json.earned).toBeGreaterThan(0);
    expect((await call('POST', '/api/sell', { cardId: id, copies: 99 }, p.token)).status).toBe(400);
  });
});

describe('player market', () => {
  async function seller() {
    const p = await newPlayer('usa');
    // open packs until there is a spare copy outside the starter army to list
    await call('POST', '/api/packs/open', {}, p.token);
    const me = (await call('GET', '/api/me', undefined, p.token)).json.me as MeView;
    const used = new Set(me.decks.flatMap((d) => d.cardIds));
    const spare = Object.keys(me.profile.collection).find((id) => !used.has(id))!;
    return { p, spare, me };
  }

  it('lists, buys with an 8% tax, and moves the card', async () => {
    const { p, spare } = await seller();
    const price = PRICE_BOUNDS[CARD_POOL.get(spare)!.rarity].min + 10;
    const listed = await call('POST', '/api/market/list', { cardId: spare, price }, p.token);
    expect(listed.status).toBe(200);
    expect(listed.json.me.profile.collection[spare]).toBeUndefined();

    const buyer = await newPlayer('uk');
    await call('POST', '/api/admin/grant', { name: buyer.name, wb: 5000 }, undefined, { 'x-admin-token': 'secret' });
    const market = (await call('GET', '/api/market', undefined, buyer.token)).json;
    const listing = market.players.find((l: any) => l.cardId === spare);
    expect(listing.seller).toBe(p.name);
    const bought = await call('POST', '/api/market/buy', { id: listing.id }, buyer.token);
    expect(bought.json.me.profile.collection[spare]).toBe(1);
    expect(bought.json.me.profile.wb).toBe(200 + 5000 - price);
    const sellerMe = (await call('GET', '/api/me', undefined, p.token)).json.me as MeView;
    expect(sellerMe.profile.wb).toBe(200 + Math.floor(price * 0.92));
    expect((await call('POST', '/api/market/buy', { id: listing.id }, buyer.token)).status).toBe(404);
  });

  it('enforces price bounds, deck reservation, own-listing and funds rules, and cancel returns the card', async () => {
    const { p, spare, me } = await seller();
    const { min, max } = PRICE_BOUNDS[CARD_POOL.get(spare)!.rarity];
    expect((await call('POST', '/api/market/list', { cardId: spare, price: min - 1 }, p.token)).status).toBe(400);
    expect((await call('POST', '/api/market/list', { cardId: spare, price: max + 1 }, p.token)).status).toBe(400);
    const inDeck = me.decks[0]!.cardIds[0]!;
    const blocked = await call('POST', '/api/market/list', { cardId: inDeck, price: PRICE_BOUNDS[CARD_POOL.get(inDeck)!.rarity].min }, p.token);
    expect(blocked.status).toBe(400);
    expect(blocked.json.error).toMatch(/saved armies/);

    const listed = await call('POST', '/api/market/list', { cardId: spare, price: min }, p.token);
    const market = (await call('GET', '/api/market', undefined, p.token)).json;
    const mine = market.players.find((l: any) => l.id === listed.json.id);
    expect(mine.mine).toBe(true);
    expect((await call('POST', '/api/market/buy', { id: mine.id }, p.token)).status).toBe(400);
    const poor = await newPlayer('uk');
    await call('POST', '/api/sell', { cardId: Object.keys(poor.me.profile.collection)[0], copies: 1 }, poor.token);
    const cancelled = await call('POST', '/api/market/cancel', { id: mine.id }, p.token);
    expect(cancelled.json.me.profile.collection[spare]).toBeGreaterThanOrEqual(1);
    expect((await call('POST', '/api/market/cancel', { id: mine.id }, p.token)).status).toBe(404);
  });

  it('returns the card when a listing expires', async () => {
    const { p, spare } = await seller();
    await call('POST', '/api/market/list', { cardId: spare, price: PRICE_BOUNDS[CARD_POOL.get(spare)!.rarity].min }, p.token);
    now += 15 * DAY;
    const market = (await call('GET', '/api/market', undefined, p.token)).json;
    expect(market.players).toHaveLength(0);
    expect(((await call('GET', '/api/me', undefined, p.token)).json.me as MeView).profile.collection[spare]).toBeGreaterThanOrEqual(1);
  });

  it('buys from the daily NPC stock', async () => {
    const p = await newPlayer();
    const market = (await call('GET', '/api/market', undefined, p.token)).json;
    const cheap = market.npc.find((l: any) => l.card.rarity === 'common');
    const r = await call('POST', '/api/market/npc/buy', { id: cheap.id }, p.token);
    expect(r.json.me.profile.wb).toBe(200 - cheap.price);
    expect((await call('POST', '/api/market/npc/buy', { id: cheap.id }, p.token)).status).toBe(400);
  });
});

describe('matches over WebSocket', () => {
  it('rejects a socket without a valid token', async () => {
    const c = new Client('nope');
    await expect(c.open()).rejects.toThrow(/401/);
  });

  it('plays a full match against the AI, pays the reward and records a replayable log', async () => {
    const p = await newPlayer('usa', 'Dana');
    const c = new Client(p.token);
    await c.open();
    await c.waitFor('hello');
    c.auto = bot(5);
    c.send({ type: 'queue', mode: 'ai', deckId: 'starter', level: 'recruit', opponent: 'germany' });
    const start = await c.waitFor('matchStart');
    expect(start.opponent.kind).toBe('ai');
    expect(start.rated).toBe(false);
    const over = await c.waitFor('gameOver');
    expect(over.rewards).not.toBeNull();
    const me = (await call('GET', '/api/me', undefined, p.token)).json.me as MeView;
    expect(me.profile.wb).toBe(200 + over.rewards!.total);
    expect(me.account.rating).toBe(1000); // AI matches are unrated

    // the stored action log replays to the same final state
    const row = (await call('GET', `/api/admin/match/${start.matchId}`, undefined, undefined, { 'x-admin-token': 'secret' })).json;
    const cfg = JSON.parse(row.config) as { decks: string[][] };
    let s = createGame({ seed: row.seed, decks: cfg.decks.map((ids) => ids.map((id) => CARD_POOL.get(id)!)) as never });
    for (const a of JSON.parse(row.actions) as Action[]) s = apply(s, a).state;
    expect(String(s.winner)).toBe(row.winner);
    expect(s.turn).toBe(row.turns);
    c.close();
  }, 60_000);

  it('never sends the opponent hand or either deck order', async () => {
    const p = await newPlayer();
    const c = new Client(p.token);
    await c.open();
    c.send({ type: 'queue', mode: 'ai', deckId: 'starter', level: 'veteran', opponent: 'japan' });
    const st = await c.waitFor('state');
    const text = JSON.stringify(st.obs);
    expect(st.obs.opponent).not.toHaveProperty('hand');
    expect(st.obs.opponent).not.toHaveProperty('deck');
    expect(st.obs.you).not.toHaveProperty('deck');
    expect(st.obs.opponent.handSize).toBeGreaterThan(0);
    expect(text).not.toMatch(/japan\.unit/); // no opponent card ids anywhere before they are played
    c.close();
  });

  it('refuses illegal actions and actions out of turn', async () => {
    const p = await newPlayer();
    const c = new Client(p.token);
    await c.open();
    c.send({ type: 'queue', mode: 'ai', deckId: 'starter', level: 'recruit', opponent: 'usa' });
    const start = await c.waitFor('matchStart');
    await c.waitFor('state');
    c.send({ type: 'action', matchId: start.matchId, action: { type: 'endTurn', player: start.seat } });
    c.send({ type: 'action', matchId: start.matchId, action: { type: 'concede', player: (1 - start.seat) as 0 | 1 } });
    c.send({ type: 'action', matchId: 'wrong', action: { type: 'endTurn', player: start.seat } });
    await new Promise((r) => setTimeout(r, 300));
    expect(c.msgs.filter((m) => m.type === 'error').length).toBeGreaterThanOrEqual(3);
    expect(c.msgs.some((m) => m.type === 'gameOver')).toBe(false);
    c.close();
  });

  it('rejects an army the player cannot field', async () => {
    const p = await newPlayer();
    await call('PUT', '/api/decks/tiny', { name: 'Tiny', cardIds: p.me.decks[0]!.cardIds.slice(0, 5) }, p.token);
    const c = new Client(p.token);
    await c.open();
    c.send({ type: 'queue', mode: 'ai', deckId: 'tiny', level: 'recruit', opponent: 'usa' });
    const err = await c.waitFor('error');
    expect(err.message).toMatch(/cannot be used/);
    c.close();
  });

  it('matches two players, rates them with Elo and pays PvP rewards', async () => {
    const a = await newPlayer('usa', 'Ann');
    const b = await newPlayer('germany', 'Ben');
    const ca = new Client(a.token);
    const cb = new Client(b.token);
    await Promise.all([ca.open(), cb.open()]);
    ca.auto = bot(1);
    cb.auto = bot(2);
    ca.send({ type: 'queue', mode: 'pvp', deckId: 'starter' });
    cb.send({ type: 'queue', mode: 'pvp', deckId: 'starter' });
    const [sa, sb] = await Promise.all([ca.waitFor('matchStart'), cb.waitFor('matchStart')]);
    expect(sa.matchId).toBe(sb.matchId);
    expect(sa.seat).not.toBe(sb.seat);
    expect(sa.rated).toBe(true);
    expect(sa.opponent).toMatchObject({ kind: 'human', name: 'Ben' });
    const [oa, ob] = await Promise.all([ca.waitFor('gameOver'), cb.waitFor('gameOver')]);
    expect(oa.winner).toBe(ob.winner);
    if (oa.winner !== 'draw') {
      expect(oa.rating!.after + ob.rating!.after).toBe(2000);
      const winner = oa.winner === sa.seat ? oa : ob;
      const loser = winner === oa ? ob : oa;
      expect(winner.rating!.after).toBeGreaterThan(1000);
      expect(loser.rating!.after).toBeLessThan(1000);
      expect(winner.rewards!.total).toBeGreaterThanOrEqual(70);
      expect(loser.rewards!.total).toBe(15);
    }
    const stats = (await call('GET', '/api/admin/stats', undefined, undefined, { 'x-admin-token': 'secret' })).json;
    expect(stats.live.rooms).toBe(0);
    ca.close();
    cb.close();
  }, 60_000);

  it('fills a lone queued player with an AI after the wait, unrated', async () => {
    const p = await newPlayer();
    const c = new Client(p.token);
    await c.open();
    c.auto = bot(3);
    c.send({ type: 'queue', mode: 'pvp', deckId: 'starter' });
    await c.waitFor('queued');
    const start = await c.waitFor('matchStart');
    expect(start.opponent.kind).toBe('ai');
    expect(start.rated).toBe(false);
    const over = await c.waitFor('gameOver');
    expect(over.rating).toBeNull();
    c.close();
  }, 60_000);

  it('lets a player reconnect to a match in progress, and an AI covers an absent seat', async () => {
    const p = await newPlayer();
    const c1 = new Client(p.token);
    await c1.open();
    c1.send({ type: 'queue', mode: 'ai', deckId: 'starter', level: 'recruit', opponent: 'usa' });
    const start = await c1.waitFor('matchStart');
    await c1.waitFor('state');
    c1.close();
    await new Promise((r) => setTimeout(r, 100));
    const c2 = new Client(p.token);
    await c2.open();
    const again = await c2.waitFor('matchStart');
    expect(again.matchId).toBe(start.matchId);
    await c2.waitFor('state');

    // leave and stay away: the AI finishes the match without the player
    c2.close();
    await expect(
      (async () => {
        const deadline = Date.now() + 40_000;
        for (;;) {
          const stats = (await call('GET', '/api/admin/stats', undefined, undefined, { 'x-admin-token': 'secret' })).json;
          if (stats.live.rooms === 0) return true;
          if (Date.now() > deadline) throw new Error('match never finished');
          await new Promise((r) => setTimeout(r, 200));
        }
      })(),
    ).resolves.toBe(true);
    const matches = (await call('GET', '/api/admin/matches', undefined, undefined, { 'x-admin-token': 'secret' })).json.matches;
    expect(matches[0].winner).not.toBeNull();
  }, 60_000);

  it('records client errors for debugging', async () => {
    const p = await newPlayer();
    await call('POST', '/api/client-error', { message: 'boom', stack: 'at x', url: '/menu' }, p.token);
    const errors = (await call('GET', '/api/admin/errors', undefined, undefined, { 'x-admin-token': 'secret' })).json.client;
    expect(errors[0].message).toBe('boom');
  });
});
