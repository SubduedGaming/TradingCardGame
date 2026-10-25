import { randomBytes } from 'node:crypto';
import type { Action, Nation } from '../engine/types';
import { buildNationDeck } from '../ai/decks';
import { CARD_POOL } from '../economy/profile';
import type { AiTier, ClientMsg } from '../shared/protocol';
import type { Config } from './config';
import type { Logger } from './log';
import { Room, type Conn, type SeatSpec } from './rooms';
import type { AccountRow } from './store';
import { ApiError, type GameService } from './service';

const NATIONS: Exclude<Nation, 'neutral'>[] = ['usa', 'uk', 'ussr', 'germany', 'japan'];
const NATION_NAME: Record<string, string> = { usa: 'United States', uk: 'United Kingdom', ussr: 'Soviet Union', germany: 'Germany', japan: 'Japan' };
const TIER_NAME: Record<AiTier, string> = { recruit: 'Recruit', veteran: 'Veteran', commander: 'Commander', marshal: 'Marshal' };

interface QueueEntry {
  account: AccountRow;
  conn: Conn;
  deckIds: string[];
  since: number;
}

/** Owns every live match, the matchmaking queue and the connection bookkeeping. */
export class Hub {
  private rooms = new Map<string, Room>();
  private roomOf = new Map<number, Room>();
  private connOf = new Map<number, Conn>();
  private queue: QueueEntry[] = [];
  private tick: NodeJS.Timeout;

  constructor(
    private cfg: Config,
    private log: Logger,
    readonly service: GameService,
  ) {
    this.tick = setInterval(() => this.matchmake(), Math.max(50, Math.min(1000, Math.floor(cfg.queueFillMs / 4))));
    this.tick.unref();
  }

  stats(): { rooms: number; queued: number; connections: number; roomList: Array<{ id: string; kind: string; seats: string[]; turn: number; actions: number }> } {
    return {
      rooms: this.rooms.size,
      queued: this.queue.length,
      connections: this.connOf.size,
      roomList: [...this.rooms.values()].map((r) => ({ id: r.id, kind: r.kind, seats: r.seats.map((s) => s.name), turn: r.state.turn, actions: r.actions.length })),
    };
  }

  // ------------------------------------------------------------ connections

  connect(account: AccountRow, conn: Conn): void {
    const old = this.connOf.get(account.id);
    this.connOf.set(account.id, conn);
    if (old && old !== conn) old.send({ type: 'error', message: 'You signed in from another window.' });
    conn.send({ type: 'hello', accountId: account.id, name: account.name });
    const room = this.roomOf.get(account.id);
    if (room) {
      const seat = room.seatOf(account.id);
      if (seat !== null) room.attach(seat, conn);
    }
  }

  disconnect(account: AccountRow, conn: Conn): void {
    if (this.connOf.get(account.id) === conn) this.connOf.delete(account.id);
    this.queue = this.queue.filter((q) => q.conn !== conn);
    const room = this.roomOf.get(account.id);
    const seat = room?.seatOf(account.id);
    if (room && seat !== null && seat !== undefined) room.detach(seat, conn);
  }

  handle(account: AccountRow, conn: Conn, msg: ClientMsg): void {
    switch (msg.type) {
      case 'ping':
        conn.send({ type: 'pong' });
        return;
      case 'leaveQueue':
        this.queue = this.queue.filter((q) => q.account.id !== account.id);
        return;
      case 'queue':
        this.enqueue(account, conn, msg);
        return;
      case 'action': {
        const room = this.roomOf.get(account.id);
        if (!room || room.id !== msg.matchId) {
          conn.send({ type: 'error', message: 'That match is not active.' });
          return;
        }
        const err = room.submit(room.seatOf(account.id)!, msg.action as Action);
        if (err) conn.send({ type: 'error', message: err });
        return;
      }
    }
  }

  // ------------------------------------------------------------ starting matches

  private armyFor(account: AccountRow, deckId: string): { deckIds: string[]; cards: ReturnType<typeof cardsOf> } {
    const deck = this.service.store.getDeck(account.id, deckId);
    if (!deck) throw new ApiError(400, 'Choose one of your saved armies');
    const problems = this.service.deckProblems(account.id, deck.cardIds);
    if (problems.length > 0) throw new ApiError(400, `That army cannot be used: ${problems[0]}${problems.length > 1 ? ` (+${problems.length - 1} more)` : ''}`);
    return { deckIds: deck.cardIds, cards: cardsOf(deck.cardIds) };
  }

  private enqueue(account: AccountRow, conn: Conn, msg: Extract<ClientMsg, { type: 'queue' }>): void {
    try {
      if (this.roomOf.has(account.id)) throw new ApiError(400, 'You are already in a match.');
      this.queue = this.queue.filter((q) => q.account.id !== account.id);
      const army = this.armyFor(account, msg.deckId);
      if (msg.mode === 'ai') {
        this.startAiMatch(account, conn, army.cards, msg.level, msg.opponent);
      } else {
        this.queue.push({ account, conn, deckIds: army.deckIds, since: Date.now() });
        conn.send({ type: 'queued', mode: 'pvp', fillMs: this.cfg.queueFillMs });
        this.matchmake();
      }
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      conn.send({ type: 'error', message: e.message });
    }
  }

  private newSeed(): number {
    return randomBytes(4).readInt32LE();
  }

  private humanSeat(account: AccountRow, cards: SeatSpec['cards'], deckIds: string[]): SeatSpec {
    return { kind: 'human', accountId: account.id, name: account.name, rating: account.rating, deckIds, cards };
  }

  private aiSeat(level: AiTier, nationName: string, cards: SeatSpec['cards']): SeatSpec {
    return { kind: 'ai', name: `${nationName} (${TIER_NAME[level]})`, level, cards };
  }

  private aiOpponentDeck(opponent: string, seed: number) {
    const nation = (NATIONS as string[]).includes(opponent) ? (opponent as Exclude<Nation, 'neutral'>) : NATIONS[Math.abs(seed) % NATIONS.length]!;
    return { nation, cards: buildNationDeck(nation, { rng: (seed ^ 0x5bd1e995) | 0 }) };
  }

  private startAiMatch(account: AccountRow, conn: Conn, cards: SeatSpec['cards'], level: AiTier, opponent: string): void {
    if (!(level in TIER_NAME)) throw new ApiError(400, 'Unknown difficulty');
    const seed = this.newSeed();
    const foe = this.aiOpponentDeck(opponent, seed);
    const human = this.humanSeat(account, cards, []);
    const ai = this.aiSeat(level, NATION_NAME[foe.nation]!, foe.cards);
    const humanFirst = (seed & 1) === 0;
    this.openRoom('ai', humanFirst ? [human, ai] : [ai, human], seed, new Map([[account.id, conn]]));
  }

  /** Pairs queued players of similar rating, widening the window with waiting time, and fills with an AI after the wait. */
  private matchmake(): void {
    const now = Date.now();
    const used = new Set<QueueEntry>();
    const sorted = [...this.queue].sort((a, b) => a.since - b.since);
    for (const a of sorted) {
      if (used.has(a)) continue;
      const window = (e: QueueEntry) => 100 + 50 * ((now - e.since) / 1000);
      let best: QueueEntry | null = null;
      for (const b of sorted) {
        if (b === a || used.has(b)) continue;
        const gap = Math.abs(a.account.rating - b.account.rating);
        if (gap <= Math.max(window(a), window(b)) && (!best || gap < Math.abs(a.account.rating - best.account.rating))) best = b;
      }
      if (best) {
        used.add(a);
        used.add(best);
        this.startPvp(a, best);
      } else if (now - a.since >= this.cfg.queueFillMs) {
        used.add(a);
        this.startFilled(a);
      }
    }
    if (used.size > 0) this.queue = this.queue.filter((q) => !used.has(q));
  }

  private startPvp(a: QueueEntry, b: QueueEntry): void {
    const seed = this.newSeed();
    const first = (seed & 1) === 0;
    const sa = this.humanSeat(a.account, cardsOf(a.deckIds), a.deckIds);
    const sb = this.humanSeat(b.account, cardsOf(b.deckIds), b.deckIds);
    this.openRoom('pvp', first ? [sa, sb] : [sb, sa], seed, new Map([[a.account.id, a.conn], [b.account.id, b.conn]]));
  }

  private startFilled(a: QueueEntry): void {
    const seed = this.newSeed();
    const level: AiTier = a.account.rating >= 1300 ? 'commander' : 'veteran';
    const foe = this.aiOpponentDeck('random', seed);
    const human = this.humanSeat(a.account, cardsOf(a.deckIds), a.deckIds);
    const ai = this.aiSeat(level, NATION_NAME[foe.nation]!, foe.cards);
    this.openRoom('pvp-filled', (seed & 1) === 0 ? [human, ai] : [ai, human], seed, new Map([[a.account.id, a.conn]]));
  }

  private openRoom(kind: Room['kind'], seats: [SeatSpec, SeatSpec], seed: number, conns: Map<number, Conn>): void {
    const room = new Room(kind, seats, seed, {
      cfg: this.cfg,
      log: this.log,
      service: this.service,
      onEnd: (r) => this.closeRoom(r),
    });
    this.rooms.set(room.id, room);
    const humans = room.humanSeats();
    for (const seat of humans) {
      const spec = seats[seat] as Extract<SeatSpec, { kind: 'human' }>;
      this.roomOf.set(spec.accountId, room);
      room.attach(seat, conns.get(spec.accountId)!);
    }
  }

  private closeRoom(room: Room): void {
    this.rooms.delete(room.id);
    for (const seat of room.humanSeats()) {
      const spec = room.seats[seat];
      if (spec.kind === 'human' && this.roomOf.get(spec.accountId) === room) this.roomOf.delete(spec.accountId);
    }
  }

  shutdown(): void {
    clearInterval(this.tick);
    for (const room of this.rooms.values()) room.dispose();
    this.rooms.clear();
  }
}

function cardsOf(ids: string[]) {
  return ids.map((id) => CARD_POOL.get(id)!);
}
