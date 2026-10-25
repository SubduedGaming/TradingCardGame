import type { Action, GameEvent, Observation, PlayerId } from '../engine';

export type AiTier = 'recruit' | 'veteran' | 'commander' | 'marshal';
export const AI_TIERS: readonly AiTier[] = ['recruit', 'veteran', 'commander', 'marshal'];

export type ClientMsg =
  | { type: 'queue'; mode: 'ai'; deckId: string; level: AiTier; opponent: string }
  | { type: 'queue'; mode: 'pvp'; deckId: string }
  | { type: 'leaveQueue' }
  | { type: 'action'; matchId: string; action: Action }
  | { type: 'ping' };

export interface OpponentInfo {
  name: string;
  kind: 'human' | 'ai';
  level?: AiTier;
  rating?: number;
}

export interface RewardView {
  lines: string[];
  total: number;
  wb: number;
}

export type ServerMsg =
  | { type: 'hello'; accountId: number; name: string }
  | { type: 'queued'; mode: 'pvp'; fillMs: number }
  | { type: 'matchStart'; matchId: string; seat: PlayerId; opponent: OpponentInfo; rated: boolean; rematch?: undefined }
  | { type: 'state'; matchId: string; seq: number; obs: Observation; legal: Action[]; acting: PlayerId; events: GameEvent[]; away: boolean }
  | {
      type: 'gameOver';
      matchId: string;
      winner: PlayerId | 'draw';
      reason: 'hq' | 'concede' | 'turnLimit';
      rewards: RewardView | null;
      rating: { before: number; after: number } | null;
    }
  | { type: 'error'; message: string }
  | { type: 'pong' };
