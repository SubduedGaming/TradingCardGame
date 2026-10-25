type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface RecentError {
  at: number;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

/** Structured JSON-lines logger. Errors are also kept in memory for the admin API. */
export class Logger {
  readonly recentErrors: RecentError[] = [];
  /** The last log lines, for the admin screen. */
  readonly recentLines: string[] = [];
  constructor(
    private level: Level = 'info',
    private sink: (line: string) => void = (line) => console.log(line),
  ) {}

  private write(level: Level, msg: string, fields?: Record<string, unknown>): void {
    if (ORDER[level] < ORDER[this.level]) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
    this.recentLines.push(line);
    if (this.recentLines.length > 500) this.recentLines.shift();
    this.sink(line);
  }

  debug(msg: string, fields?: Record<string, unknown>): void { this.write('debug', msg, fields); }
  info(msg: string, fields?: Record<string, unknown>): void { this.write('info', msg, fields); }
  warn(msg: string, fields?: Record<string, unknown>): void { this.write('warn', msg, fields); }

  error(msg: string, err?: unknown, fields?: Record<string, unknown>): void {
    const e = err instanceof Error ? err : err === undefined ? undefined : new Error(String(err));
    this.recentErrors.push({ at: Date.now(), message: `${msg}${e ? `: ${e.message}` : ''}`, stack: e?.stack, context: fields });
    if (this.recentErrors.length > 100) this.recentErrors.shift();
    this.write('error', msg, { ...fields, error: e?.message, stack: e?.stack });
  }
}
