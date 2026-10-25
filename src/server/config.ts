/** Every setting comes from the environment so a deployment needs no code changes. */
export interface Config {
  port: number;
  host: string;
  /** SQLite file, or ':memory:' for tests. */
  dbPath: string;
  /** Built client (vite build output) served at '/'. Empty disables static serving. */
  staticDir: string;
  /** Token for /api/admin/*. Empty disables the admin API. */
  adminToken: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Delay between an AI seat's actions so a human can follow them. */
  aiDelayMs: number;
  /** How long a player may take on one decision before the server acts for them. */
  turnTimerMs: number;
  /** How long a disconnected player is given before an AI plays their seat. */
  awayGraceMs: number;
  /** How long a queued player waits for a human opponent before an AI fills the seat. */
  queueFillMs: number;
  sessionDays: number;
}

const num = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number (got "${raw}")`);
  return n;
};

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const level = process.env.LOG_LEVEL ?? 'info';
  if (!['debug', 'info', 'warn', 'error'].includes(level)) throw new Error(`LOG_LEVEL must be debug, info, warn or error (got "${level}")`);
  return {
    port: num('PORT', 3000),
    host: process.env.HOST ?? '0.0.0.0',
    dbPath: process.env.DB_PATH ?? 'data/frontline.db',
    staticDir: process.env.STATIC_DIR ?? 'dist',
    adminToken: process.env.ADMIN_TOKEN ?? '',
    logLevel: level as Config['logLevel'],
    aiDelayMs: num('AI_DELAY_MS', 700),
    turnTimerMs: num('TURN_TIMER_MS', 120_000),
    awayGraceMs: num('AWAY_GRACE_MS', 20_000),
    queueFillMs: num('QUEUE_FILL_MS', 10_000),
    sessionDays: num('SESSION_DAYS', 30),
    ...overrides,
  };
}
