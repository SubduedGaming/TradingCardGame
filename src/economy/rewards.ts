export type AiLevel = 'recruit' | 'veteran' | 'commander' | 'marshal';
export type MatchResult = 'win' | 'loss' | 'draw';

/** War Bonds for a win by AI tier (docs/04 section 2). */
export const WIN_REWARD: Record<AiLevel, number> = { recruit: 40, veteran: 60, commander: 90, marshal: 120 };
/** Win against another player (docs/04 section 2): base, plus half the rating gap to a stronger opponent, up to +40. */
export const PVP_WIN_REWARD = 70;
export const PVP_BONUS_MAX = 40;
export const LOSS_REWARD = 15;
export const DRAW_REWARD = 25;
export const DAILY_LOGIN_REWARD = 20;
const HOUR = 3_600_000;

export interface RewardInput {
  result: MatchResult;
  /** The AI tier faced, or 'pvp' for a rated match against another player. */
  level: AiLevel | 'pvp';
  /** For 'pvp': opponent rating minus own rating. */
  ratingGap?: number;
  now: number;
  /** Timestamps of this player's wins against the AI so far (any age). */
  recentAiWins: number[];
  /** True if the player already won a match today. */
  wonToday: boolean;
}

export interface Reward {
  total: number;
  /** Human-readable breakdown lines. */
  lines: string[];
}

/** Win-farming decay: x0.5 after 10 AI wins in the last hour, x0.25 after 20. */
export function farmMultiplier(recentAiWins: number[], now: number): number {
  const inHour = recentAiWins.filter((t) => now - t < HOUR).length;
  return inHour >= 20 ? 0.25 : inHour >= 10 ? 0.5 : 1;
}

export function matchReward(input: RewardInput): Reward {
  if (input.result === 'loss') return { total: LOSS_REWARD, lines: [`Loss: +${LOSS_REWARD} WB`] };
  if (input.result === 'draw') return { total: DRAW_REWARD, lines: [`Draw: +${DRAW_REWARD} WB`] };

  const pvp = input.level === 'pvp';
  const bonus = pvp ? Math.min(PVP_BONUS_MAX, Math.max(0, Math.round((input.ratingGap ?? 0) * 0.5))) : 0;
  const base = pvp ? PVP_WIN_REWARD + bonus : WIN_REWARD[input.level as AiLevel];
  const mult = pvp ? 1 : farmMultiplier(input.recentAiWins, input.now);
  const lines = [bonus > 0 ? `Win: +${PVP_WIN_REWARD} WB, +${bonus} WB for beating a higher-rated player` : `Win: +${base} WB`];
  let total = base;
  if (mult < 1) {
    total = Math.ceil(base * mult);
    lines.push(`Many recent wins: reduced to ${total} WB (x${mult})`);
  }
  if (!input.wonToday) {
    const first = Math.ceil(total * 0.5);
    total += first;
    lines.push(`First win of the day: +${first} WB`);
  }
  return { total, lines };
}

/** Local calendar day as YYYY-MM-DD; used for daily login and first-win-of-day. */
export function dayKey(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
