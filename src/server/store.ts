import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Profile } from '../economy/profile';

// `node:sqlite` has no un-prefixed name, which some bundlers and test runners cannot resolve, so load it at run time.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

export interface AccountRow {
  id: number;
  name: string;
  pass_hash: string;
  salt: string;
  rating: number;
  rated_games: number;
  created: number;
}

export interface DeckRow {
  id: string;
  name: string;
  cardIds: string[];
  updated: number;
}

export interface ListingRow {
  id: number;
  seller_id: number;
  card_id: string;
  price: number;
  created: number;
  expires: number;
  status: 'active' | 'sold' | 'cancelled' | 'expired';
}

export interface MatchRow {
  id: string;
  kind: string;
  seed: number;
  p0: number | null;
  p1: number | null;
  config: string;
  actions: string;
  winner: string | null;
  reason: string | null;
  turns: number | null;
  created: number;
  ended: number | null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1000,
  rated_games INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (account_id INTEGER PRIMARY KEY REFERENCES accounts(id), json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS decks (
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  card_ids TEXT NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (account_id, id)
);
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES accounts(id),
  card_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS listings_active ON listings(status, card_id);
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  seed INTEGER NOT NULL,
  p0 INTEGER,
  p1 INTEGER,
  config TEXT NOT NULL,
  actions TEXT NOT NULL DEFAULT '[]',
  winner TEXT,
  reason TEXT,
  turns INTEGER,
  created INTEGER NOT NULL,
  ended INTEGER
);
CREATE TABLE IF NOT EXISTS client_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER,
  at INTEGER NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  ua TEXT
);
`;

/** All persistence. A single synchronous SQLite connection: every method is atomic on its own, `tx` groups several. */
export class Store {
  readonly db: DatabaseSyncType;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  private depth = 0;

  /** Runs `fn` in one transaction. Calls nest: the outermost one commits or rolls everything back. */
  tx<T>(fn: () => T): T {
    if (this.depth > 0) return fn();
    this.db.exec('BEGIN IMMEDIATE');
    this.depth = 1;
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    } finally {
      this.depth = 0;
    }
  }

  // ---- accounts and sessions
  createAccount(name: string, hash: string, salt: string, now: number): number {
    const r = this.db.prepare('INSERT INTO accounts (name, pass_hash, salt, created) VALUES (?, ?, ?, ?)').run(name, hash, salt, now);
    return Number(r.lastInsertRowid);
  }
  accountByName(name: string): AccountRow | undefined {
    return this.db.prepare('SELECT * FROM accounts WHERE name = ?').get(name) as AccountRow | undefined;
  }
  accountById(id: number): AccountRow | undefined {
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined;
  }
  listAccounts(search: string, limit: number): AccountRow[] {
    return this.db.prepare("SELECT * FROM accounts WHERE name LIKE ? ESCAPE '\\' ORDER BY created DESC LIMIT ?").all(`%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`, limit) as unknown as AccountRow[];
  }
  setPassword(id: number, hash: string, salt: string): void {
    this.db.prepare('UPDATE accounts SET pass_hash = ?, salt = ? WHERE id = ?').run(hash, salt, id);
    this.db.prepare('DELETE FROM sessions WHERE account_id = ?').run(id);
  }
  /** Writes a consistent copy of the whole database to `file` (which must not exist). */
  backupTo(file: string): void {
    this.db.prepare('VACUUM INTO ?').run(file);
  }
  setRating(id: number, rating: number): void {
    this.db.prepare('UPDATE accounts SET rating = ?, rated_games = rated_games + 1 WHERE id = ?').run(rating, id);
  }
  createSession(token: string, accountId: number, expires: number): void {
    this.db.prepare('INSERT INTO sessions (token, account_id, expires) VALUES (?, ?, ?)').run(token, accountId, expires);
  }
  sessionAccount(token: string, now: number): number | undefined {
    const row = this.db.prepare('SELECT account_id FROM sessions WHERE token = ? AND expires > ?').get(token, now) as { account_id: number } | undefined;
    return row?.account_id;
  }
  deleteSession(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  purgeSessions(now: number): void {
    this.db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now);
  }

  // ---- profiles
  getProfile(accountId: number): Profile {
    const row = this.db.prepare('SELECT json FROM profiles WHERE account_id = ?').get(accountId) as { json: string } | undefined;
    if (!row) throw new Error(`no profile for account ${accountId}`);
    return JSON.parse(row.json) as Profile;
  }
  putProfile(accountId: number, profile: Profile): void {
    this.db
      .prepare('INSERT INTO profiles (account_id, json) VALUES (?, ?) ON CONFLICT(account_id) DO UPDATE SET json = excluded.json')
      .run(accountId, JSON.stringify(profile));
  }
  /** Reads a profile, lets `fn` change it, and writes the result, all in one transaction. */
  withProfile<R>(accountId: number, fn: (p: Profile) => { profile: Profile; result: R }): R {
    return this.tx(() => {
      const { profile, result } = fn(this.getProfile(accountId));
      this.putProfile(accountId, profile);
      return result;
    });
  }

  // ---- decks
  listDecks(accountId: number): DeckRow[] {
    const rows = this.db.prepare('SELECT id, name, card_ids, updated FROM decks WHERE account_id = ? ORDER BY updated').all(accountId) as Array<{
      id: string; name: string; card_ids: string; updated: number;
    }>;
    return rows.map((r) => ({ id: r.id, name: r.name, cardIds: JSON.parse(r.card_ids) as string[], updated: r.updated }));
  }
  getDeck(accountId: number, id: string): DeckRow | undefined {
    return this.listDecks(accountId).find((d) => d.id === id);
  }
  putDeck(accountId: number, deck: DeckRow): void {
    this.db
      .prepare(
        `INSERT INTO decks (account_id, id, name, card_ids, updated) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(account_id, id) DO UPDATE SET name = excluded.name, card_ids = excluded.card_ids, updated = excluded.updated`,
      )
      .run(accountId, deck.id, deck.name, JSON.stringify(deck.cardIds), deck.updated);
  }
  deleteDeck(accountId: number, id: string): void {
    this.db.prepare('DELETE FROM decks WHERE account_id = ? AND id = ?').run(accountId, id);
  }

  // ---- listings
  insertListing(sellerId: number, cardId: string, price: number, now: number, expires: number): number {
    const r = this.db
      .prepare("INSERT INTO listings (seller_id, card_id, price, created, expires, status) VALUES (?, ?, ?, ?, ?, 'active')")
      .run(sellerId, cardId, price, now, expires);
    return Number(r.lastInsertRowid);
  }
  listing(id: number): ListingRow | undefined {
    return this.db.prepare('SELECT * FROM listings WHERE id = ?').get(id) as ListingRow | undefined;
  }
  activeListings(): ListingRow[] {
    return this.db.prepare("SELECT * FROM listings WHERE status = 'active' ORDER BY price, id").all() as unknown as ListingRow[];
  }
  activeListingCount(sellerId: number): number {
    const r = this.db.prepare("SELECT COUNT(*) AS n FROM listings WHERE seller_id = ? AND status = 'active'").get(sellerId) as { n: number };
    return r.n;
  }
  setListingStatus(id: number, status: ListingRow['status']): void {
    this.db.prepare('UPDATE listings SET status = ? WHERE id = ?').run(status, id);
  }
  expiredListings(now: number): ListingRow[] {
    return this.db.prepare("SELECT * FROM listings WHERE status = 'active' AND expires <= ?").all(now) as unknown as ListingRow[];
  }

  // ---- matches and errors
  insertMatch(m: Pick<MatchRow, 'id' | 'kind' | 'seed' | 'p0' | 'p1' | 'config' | 'created'>): void {
    this.db
      .prepare('INSERT INTO matches (id, kind, seed, p0, p1, config, created) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(m.id, m.kind, m.seed, m.p0, m.p1, m.config, m.created);
  }
  finishMatch(id: string, actions: unknown[], winner: string, reason: string, turns: number, ended: number): void {
    this.db
      .prepare('UPDATE matches SET actions = ?, winner = ?, reason = ?, turns = ?, ended = ? WHERE id = ?')
      .run(JSON.stringify(actions), winner, reason, turns, ended, id);
  }
  abandonUnfinishedMatches(now: number): number {
    const r = this.db.prepare("UPDATE matches SET winner = 'abandoned', reason = 'server restart', ended = ? WHERE ended IS NULL").run(now);
    return Number(r.changes);
  }
  match(id: string): MatchRow | undefined {
    return this.db.prepare('SELECT * FROM matches WHERE id = ?').get(id) as MatchRow | undefined;
  }
  recentMatches(limit: number): MatchRow[] {
    return this.db.prepare('SELECT * FROM matches ORDER BY created DESC LIMIT ?').all(limit) as unknown as MatchRow[];
  }
  insertClientError(accountId: number | null, at: number, message: string, stack: string | null, url: string | null, ua: string | null): void {
    this.db.prepare('INSERT INTO client_errors (account_id, at, message, stack, url, ua) VALUES (?, ?, ?, ?, ?, ?)').run(accountId, at, message, stack, url, ua);
  }
  recentClientErrors(limit: number): unknown[] {
    return this.db.prepare('SELECT * FROM client_errors ORDER BY id DESC LIMIT ?').all(limit);
  }
  counts(): Record<string, number> {
    const n = (sql: string) => (this.db.prepare(sql).get() as { n: number }).n;
    return {
      accounts: n('SELECT COUNT(*) AS n FROM accounts'),
      sessions: n('SELECT COUNT(*) AS n FROM sessions'),
      decks: n('SELECT COUNT(*) AS n FROM decks'),
      matches: n('SELECT COUNT(*) AS n FROM matches'),
      activeListings: n("SELECT COUNT(*) AS n FROM listings WHERE status = 'active'"),
      clientErrors: n('SELECT COUNT(*) AS n FROM client_errors'),
    };
  }
}
