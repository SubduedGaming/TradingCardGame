import { loadConfig } from './config';
import { createApp } from './app';
import { Logger } from './log';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const log = new Logger(cfg.logLevel);
  const app = createApp(cfg, { log });

  process.on('uncaughtException', (e) => log.error('uncaught exception', e));
  process.on('unhandledRejection', (e) => log.error('unhandled rejection', e));

  const port = await app.listen();
  log.info('server listening', { port, host: cfg.host, db: cfg.dbPath, static: cfg.staticDir || null, admin: Boolean(cfg.adminToken), node: process.version });

  const stop = async (signal: string) => {
    log.info('shutting down', { signal });
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop('SIGINT'));
  process.on('SIGTERM', () => void stop('SIGTERM'));
  // The desktop app asks for a clean stop over the process channel (signals do not exist on Windows).
  process.on('message', (m) => {
    if (m === 'stop') void stop('parent');
  });
}

main().catch((e) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'server failed to start', error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
