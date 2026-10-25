import { randomUUID } from 'node:crypto';
import type { Action, Card, GameEvent, GameState, PlayerId } from '../engine/types';
import { IllegalActionError, apply, createGame, isLegal, legalActions, observation } from '../engine/game';
import { agentFor } from '../ai';
import { forcedChoice, type Agent } from '../ai/agents';
import { actingSeat } from '../ai/sim';
import { recordMatch } from '../economy/profile';
import type { AiTier, OpponentInfo, RewardView, ServerMsg } from '../shared/protocol';
import type { Config } from './config';
import type { Logger } from './log';
import type { GameService } from './service';

export interface Conn {
  send(msg: ServerMsg): void;
  close(): void;
}

export type SeatSpec =
  | { kind: 'human'; accountId: number; name: string; rating: number; deckIds: string[]; cards: Card[] }
  | { kind: 'ai'; name: string; level: AiTier; cards: Card[] };

export type RoomKind = 'ai' | 'pvp' | 'pvp-filled';

const K_FACTOR = 32;

/** Elo rating change for player A. `score` is 1 for a win, 0.5 for a draw, 0 for a loss. */
export function eloAfter(ratingA: number, ratingB: number, score: number): number {
  const expected = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  return Math.round(ratingA + K_FACTOR * (score - expected));
}

interface HumanState {
  conn: Conn | null;
  awaySince: number | null;
  timeouts: number;
}

/**
 * One authoritative match. Clients only send actions; the room validates them against the engine, applies
 * them and sends each player their own observation, so hidden information never leaves the server.
 */
export class Room {
  readonly id = randomUUID();
  state: GameState;
  readonly actions: Action[] = [];
  private seq = 0;
  private humans: [HumanState, HumanState] = [
    { conn: null, awaySince: null, timeouts: 0 },
    { conn: null, awaySince: null, timeouts: 0 },
  ];
  private agents: [Agent | null, Agent | null];
  private timer: NodeJS.Timeout | undefined;
  private ended = false;
  private startedAt = Date.now();

  constructor(
    readonly kind: RoomKind,
    readonly seats: [SeatSpec, SeatSpec],
    readonly seed: number,
    private deps: { cfg: Config; log: Logger; service: GameService; onEnd: (room: Room) => void },
  ) {
    this.state = createGame({ seed, decks: [seats[0].cards, seats[1].cards] });
    this.agents = [seats[0].kind === 'ai' ? agentFor(seats[0].level) : null, seats[1].kind === 'ai' ? agentFor(seats[1].level) : null];
    const store = deps.service.store;
    store.insertMatch({
      id: this.id,
      kind,
      seed,
      p0: seats[0].kind === 'human' ? seats[0].accountId : null,
      p1: seats[1].kind === 'human' ? seats[1].accountId : null,
      config: JSON.stringify({ decks: seats.map((s) => s.cards.map((c) => c.id)), seats: seats.map((s) => ({ kind: s.kind, name: s.name })) }),
      created: this.startedAt,
    });
    deps.log.info('match created', { matchId: this.id, kind, seats: seats.map((s) => s.name) });
  }

  get rated(): boolean {
    return this.kind === 'pvp';
  }

  humanSeats(): PlayerId[] {
    return ([0, 1] as const).filter((s) => this.seats[s].kind === 'human');
  }

  seatOf(accountId: number): PlayerId | null {
    for (const s of [0, 1] as const) {
      const seat = this.seats[s];
      if (seat.kind === 'human' && seat.accountId === accountId) return s;
    }
    return null;
  }

  private opponentInfo(seat: PlayerId): OpponentInfo {
    const other = this.seats[seat === 0 ? 1 : 0];
    return other.kind === 'human'
      ? { name: other.name, kind: 'human', rating: other.rating }
      : { name: other.name, kind: 'ai', level: other.level };
  }

  /** Binds (or rebinds, after a reconnect) a connection to a human seat and sends the current state. */
  attach(seat: PlayerId, conn: Conn): void {
    const h = this.humans[seat];
    if (h.conn && h.conn !== conn) h.conn.send({ type: 'error', message: 'This match was opened in another window.' });
    h.conn = conn;
    h.awaySince = null;
    conn.send({ type: 'matchStart', matchId: this.id, seat, opponent: this.opponentInfo(seat), rated: this.rated });
    if (this.ended) return;
    this.sendState(seat, []);
    this.schedule();
  }

  detach(seat: PlayerId, conn: Conn): void {
    const h = this.humans[seat];
    if (h.conn !== conn) return;
    h.conn = null;
    h.awaySince = Date.now();
    this.deps.log.info('player left match', { matchId: this.id, seat });
    this.schedule();
  }

  private viewEvents(seat: PlayerId, events: GameEvent[]): GameEvent[] {
    // The identity of a card the opponent draws is private.
    return events.filter((e) => !(e.type === 'cardDrawn' && e.player !== seat));
  }

  private sendState(seat: PlayerId, events: GameEvent[]): void {
    const conn = this.humans[seat].conn;
    if (!conn) return;
    const acting = actingSeat(this.state);
    conn.send({
      type: 'state',
      matchId: this.id,
      seq: this.seq,
      obs: observation(this.state, seat),
      legal: this.state.winner === null ? legalActions(this.state, seat) : [],
      acting,
      events: this.viewEvents(seat, events),
      away: this.seats[seat === 0 ? 1 : 0].kind === 'human' && this.humans[seat === 0 ? 1 : 0].conn === null,
    });
  }

  /** A human's action: only their own, only when legal. Returns an error message or null. */
  submit(seat: PlayerId, action: Action): string | null {
    if (this.ended) return 'The match is over.';
    if (action.player !== seat) return 'That is not your seat.';
    if (action.type !== 'concede' && actingSeat(this.state) !== seat) return 'It is not your turn.';
    if (!isLegal(this.state, action)) return 'That action is not legal right now.';
    this.humans[seat].timeouts = 0;
    this.play(action);
    return null;
  }

  private play(action: Action): void {
    let result: { state: GameState; events: GameEvent[] };
    try {
      result = apply(this.state, action);
    } catch (e) {
      if (e instanceof IllegalActionError) {
        this.deps.log.warn('illegal action reached apply', { matchId: this.id, action });
        return;
      }
      throw e;
    }
    this.state = result.state;
    this.actions.push(action);
    this.seq += 1;
    for (const s of this.humanSeats()) this.sendState(s, result.events);
    if (this.state.winner !== null) {
      const end = result.events.find((e) => e.type === 'gameEnded');
      this.finish(end && end.type === 'gameEnded' ? end.reason : 'hq');
      return;
    }
    this.schedule();
  }

  // ---------------------------------------------------------------- turn driver

  /** Decides who moves next and arranges for it: an AI after a short pause, a human before a timeout. */
  schedule(): void {
    clearTimeout(this.timer);
    if (this.ended || this.state.winner !== null) return;
    const seat = actingSeat(this.state);
    const spec = this.seats[seat];
    const { cfg } = this.deps;

    if (spec.kind === 'ai') {
      this.timer = setTimeout(() => this.runAgent(seat, this.agents[seat]!), cfg.aiDelayMs);
      return;
    }
    const h = this.humans[seat];
    if (h.conn === null) {
      // The player is gone: after a grace period an AI plays their seat until they come back.
      const since = h.awaySince ?? Date.now();
      const wait = Math.max(0, cfg.awayGraceMs - (Date.now() - since));
      this.timer = setTimeout(() => {
        this.agents[seat] ??= agentFor('veteran');
        this.deps.log.info('AI taking over an absent seat', { matchId: this.id, seat });
        this.runAgent(seat, this.agents[seat]!);
      }, wait + (wait === 0 ? cfg.aiDelayMs : 0));
      return;
    }
    this.timer = setTimeout(() => this.onTimeout(seat), cfg.turnTimerMs);
  }

  private runAgent(seat: PlayerId, agent: Agent): void {
    if (this.ended || this.state.winner !== null || actingSeat(this.state) !== seat) return;
    try {
      this.play(agent.choose(this.state, seat, { rng: (this.seed ^ (this.actions.length * 2654435761)) | 0 }));
    } catch (e) {
      this.deps.log.error('AI failed to choose an action', e, { matchId: this.id, seat });
      // Never leave a match hanging on a bug: fall back to the safe forced action.
      this.play(this.safeAction(seat));
    }
  }

  private safeAction(seat: PlayerId): Action {
    const s = this.state;
    const forced = forcedChoice(s, seat);
    if (forced) return forced;
    return s.phase === 'main' ? { type: 'endMain', player: seat } : { type: 'endTurn', player: seat };
  }

  private onTimeout(seat: PlayerId): void {
    if (this.ended || actingSeat(this.state) !== seat) return;
    const h = this.humans[seat];
    h.timeouts += 1;
    this.deps.log.info('turn timer expired', { matchId: this.id, seat, timeouts: h.timeouts });
    this.play(h.timeouts >= 3 ? { type: 'concede', player: seat } : this.safeAction(seat));
  }

  // ---------------------------------------------------------------- ending

  private finish(reason: 'hq' | 'concede' | 'turnLimit'): void {
    if (this.ended) return;
    this.ended = true;
    clearTimeout(this.timer);
    const winner = this.state.winner!;
    const { service, log } = this.deps;
    const store = service.store;
    const now = Date.now();
    const rewards: [RewardView | null, RewardView | null] = [null, null];
    const rating: [{ before: number; after: number } | null, { before: number; after: number } | null] = [null, null];

    try {
      store.tx(() => {
        const resultFor = (s: PlayerId) => (winner === 'draw' ? 'draw' : winner === s ? 'win' : 'loss') as 'win' | 'loss' | 'draw';
        const humans = this.humanSeats();
        const ratings = ([0, 1] as const).map((s) => {
          const seat = this.seats[s];
          return seat.kind === 'human' ? store.accountById(seat.accountId)!.rating : 0;
        });
        for (const s of humans) {
          const seat = this.seats[s] as Extract<SeatSpec, { kind: 'human' }>;
          const other = this.seats[s === 0 ? 1 : 0];
          const level = this.kind === 'pvp' ? 'pvp' : other.kind === 'ai' ? other.level : 'veteran';
          const gap = this.kind === 'pvp' ? ratings[s === 0 ? 1 : 0]! - ratings[s]! : 0;
          const r = store.withProfile(seat.accountId, (p) => {
            const out = recordMatch(p, resultFor(s), level, now, gap);
            return { profile: out.profile, result: { reward: out.reward, wb: out.profile.wb } };
          });
          rewards[s] = { lines: r.reward.lines, total: r.reward.total, wb: r.wb };
          if (this.kind === 'pvp') {
            const score = winner === 'draw' ? 0.5 : winner === s ? 1 : 0;
            const before = ratings[s]!;
            const after = eloAfter(before, ratings[s === 0 ? 1 : 0]!, score);
            store.setRating(seat.accountId, after);
            rating[s] = { before, after };
          }
        }
        store.finishMatch(this.id, this.actions, String(winner), reason, this.state.turn, now);
      });
    } catch (e) {
      log.error('failed to settle a match', e, { matchId: this.id });
    }

    for (const s of this.humanSeats()) {
      this.humans[s].conn?.send({ type: 'gameOver', matchId: this.id, winner, reason, rewards: rewards[s], rating: rating[s] });
    }
    log.info('match ended', { matchId: this.id, winner, reason, turns: this.state.turn, actions: this.actions.length, ms: now - this.startedAt });
    this.deps.onEnd(this);
  }

  /** Server shutdown: tell players and stop the timers. The match record stays unfinished and is marked abandoned on the next start. */
  dispose(): void {
    clearTimeout(this.timer);
    this.ended = true;
  }
}
