import type { Card, Nation } from '../engine/types';
import { chooseDoctrine } from '../engine/doctrine';
import { veteranAgent } from './agents';
import { commanderAgent } from './commander';
import { buildNationDeck } from './decks';
import { playMatch } from './sim';
import { NATIONS } from '../cards/plan';

export interface MatrixCell {
  games: number;
  /** Wins for the row nation. */
  wins: number;
  draws: number;
}

export interface CardStat {
  card: Card;
  /** Games (any seat) where the card was in a deck. */
  games: number;
  wins: number;
}

export interface BalanceReport {
  games: number;
  matrix: Record<string, Record<string, MatrixCell>>;
  nationWinRate: Record<string, number>;
  firstPlayerWinRate: number;
  avgTurns: number;
  turnLimitRate: number;
  cardStats: Map<string, CardStat>;
}

/**
 * Nation-vs-nation balance sweep: the chosen tier (Veteran by default) against itself, a fresh random deck per game and seat,
 * seats alternating so first-player advantage cancels. `gamesPerPair` counts games per nation pair.
 */
export function runBalance(
  gamesPerPair: number,
  baseSeed = 1,
  useDoctrines = true,
  tier: 'veteran' | 'commander' = 'veteran',
): BalanceReport {
  const agent = tier === 'commander' ? commanderAgent() : veteranAgent();
  const matrix: BalanceReport['matrix'] = {};
  for (const a of NATIONS) {
    matrix[a] = {};
    for (const b of NATIONS) matrix[a]![b] = { games: 0, wins: 0, draws: 0 };
  }
  const cardStats = new Map<string, CardStat>();
  let games = 0;
  let firstWins = 0;
  let decided = 0;
  let turns = 0;
  let turnLimit = 0;

  let seed = baseSeed;
  for (let i = 0; i < NATIONS.length; i++) {
    for (let j = i + 1; j < NATIONS.length; j++) {
      const a: Nation = NATIONS[i]!;
      const b: Nation = NATIONS[j]!;
      for (let g = 0; g < gamesPerPair; g++, seed++) {
        const rngA = { rng: seed * 31 + 1 };
        const rngB = { rng: seed * 37 + 2 };
        const deckA = buildNationDeck(a, rngA);
        const deckB = buildNationDeck(b, rngB);
        const swap = g % 2 === 1;
        const seats = [
          { deck: deckA, agent, doctrine: useDoctrines ? chooseDoctrine(deckA) : null },
          { deck: deckB, agent, doctrine: useDoctrines ? chooseDoctrine(deckB) : null },
        ] as const;
        const r = playMatch(seed, swap ? [seats[1], seats[0]] : [seats[0], seats[1]]);
        games += 1;
        turns += r.turns;
        if (r.reason === 'turnLimit') turnLimit += 1;
        matrix[a]![b]!.games += 1;
        matrix[b]![a]!.games += 1;
        let winnerDeck: Card[] | null = null;
        if (r.winner === 'draw') {
          matrix[a]![b]!.draws += 1;
          matrix[b]![a]!.draws += 1;
        } else {
          const seatOfA = swap ? 1 : 0;
          const aWon = r.winner === seatOfA;
          matrix[aWon ? a : b]![aWon ? b : a]!.wins += 1;
          winnerDeck = aWon ? deckA : deckB;
          decided += 1;
          if (r.winner === r.final.first) firstWins += 1;
        }
        for (const [deck, won] of [[deckA, winnerDeck === deckA], [deckB, winnerDeck === deckB]] as const) {
          for (const card of new Map(deck.map((c) => [c.id, c])).values()) {
            const s = cardStats.get(card.id) ?? { card, games: 0, wins: 0 };
            s.games += 1;
            if (won) s.wins += 1;
            cardStats.set(card.id, s);
          }
        }
      }
    }
  }

  const nationWinRate: Record<string, number> = {};
  for (const n of NATIONS) {
    let w = 0;
    let t = 0;
    for (const o of NATIONS) {
      if (o === n) continue;
      const c = matrix[n]![o]!;
      w += c.wins;
      t += c.games - c.draws;
    }
    nationWinRate[n] = t === 0 ? 0 : w / t;
  }
  return {
    games,
    matrix,
    nationWinRate,
    firstPlayerWinRate: decided === 0 ? 0 : firstWins / decided,
    avgTurns: turns / games,
    turnLimitRate: turnLimit / games,
    cardStats,
  };
}

/** Human-readable report: nation matrix, rates, and the strongest and weakest cards by win rate. */
export function formatReport(report: BalanceReport, minGames = 30, top = 12): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const lines: string[] = [];
  lines.push(`${report.games} games | first player ${pct(report.firstPlayerWinRate)} | avg ${report.avgTurns.toFixed(1)} turns | turn limit ${pct(report.turnLimitRate)}`);
  lines.push('nation win rates: ' + NATIONS.map((n) => `${n} ${pct(report.nationWinRate[n]!)}`).join(', '));
  lines.push('matrix (row beats column):');
  for (const a of NATIONS) {
    lines.push(
      '  ' + a.padEnd(8) + NATIONS.map((b) => {
        const c = report.matrix[a]![b]!;
        return a === b ? '   -  ' : pct(c.wins / Math.max(1, c.games - c.draws)).padStart(6);
      }).join(' '),
    );
  }
  const rated = [...report.cardStats.values()].filter((s) => s.games >= minGames).map((s) => ({ ...s, rate: s.wins / s.games }));
  rated.sort((x, y) => y.rate - x.rate);
  const fmt = (s: (typeof rated)[number]) => `  ${s.card.name} (${s.card.nation}, ${s.card.rarity}) ${pct(s.rate)} over ${s.games}`;
  lines.push('strongest cards:', ...rated.slice(0, top).map(fmt));
  lines.push('weakest cards:', ...rated.slice(-top).reverse().map(fmt));
  return lines.join('\n');
}

/** Card win rates for one nation (cards with at least `minGames` games), strongest first. */
export function nationCardRates(report: BalanceReport, nation: Nation, minGames = 40): { name: string; rarity: string; rate: number; games: number }[] {
  return [...report.cardStats.values()]
    .filter((s) => s.card.nation === nation && s.games >= minGames)
    .map((s) => ({ name: s.card.name, rarity: s.card.rarity, rate: s.wins / s.games, games: s.games }))
    .sort((a, b) => b.rate - a.rate);
}
