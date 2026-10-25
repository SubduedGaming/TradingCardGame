import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMsg } from '../shared/protocol';
import type { Config } from './config';
import { Hub } from './hub';
import { Logger } from './log';
import { ApiError, GameService } from './service';
import { Store, type AccountRow } from './store';
import type { Conn } from './rooms';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

/** Sliding-window counter per key. */
class RateLimiter {
  private hits = new Map<string, number[]>();
  allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (v.every((t) => now - t >= windowMs)) this.hits.delete(k);
    return true;
  }
}

type Handler = (ctx: Ctx) => Promise<unknown> | unknown;
interface Ctx {
  req: IncomingMessage;
  body: Record<string, unknown>;
  params: string[];
  account: AccountRow;
  token: string;
  ip: string;
}
interface Route {
  method: string;
  re: RegExp;
  auth: boolean;
  /** Limit per minute for this route per account (or IP when signed out). */
  limit?: number;
  handler: Handler;
}

export interface App {
  server: Server;
  hub: Hub;
  service: GameService;
  store: Store;
  log: Logger;
  listen(): Promise<number>;
  close(): Promise<void>;
}

export function createApp(cfg: Config, deps: { log?: Logger; store?: Store; now?: () => number } = {}): App {
  const log = deps.log ?? new Logger(cfg.logLevel);
  const store = deps.store ?? new Store(cfg.dbPath);
  const service = new GameService(store, log, deps.now);
  const hub = new Hub(cfg, log, service);
  const limiter = new RateLimiter();
  const startedAt = Date.now();
  const abandoned = store.abandonUnfinishedMatches(Date.now());
  if (abandoned > 0) log.warn('marked unfinished matches as abandoned', { count: abandoned });

  const num = (v: unknown, name: string): number => {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new ApiError(400, `${name} must be a number`);
    return v;
  };
  const str = (v: unknown, name: string): string => {
    if (typeof v !== 'string') throw new ApiError(400, `${name} must be text`);
    return v;
  };
  const withMe = (accountId: number, extra: object = {}) => ({ ...extra, me: service.me(accountId) });

  const routes: Route[] = [];
  const route = (method: string, path: string, auth: boolean, handler: Handler, limit?: number) => {
    routes.push({ method, re: new RegExp(`^${path.replace(/:[a-z]+/g, '([^/]+)')}$`), auth, limit, handler });
  };

  route('GET', '/api/health', false, () => ({ ok: true, uptimeSec: Math.round((Date.now() - startedAt) / 1000), db: store.counts() }));
  route('POST', '/api/register', false, async (c) => {
    const r = await service.register(str(c.body.name, 'name'), str(c.body.password, 'password'), str(c.body.nation, 'nation'));
    return { token: r.token, me: service.me(r.accountId) };
  }, 10);
  route('POST', '/api/login', false, async (c) => {
    const r = await service.login(str(c.body.name, 'name'), str(c.body.password, 'password'));
    return { token: r.token, me: service.me(r.accountId) };
  }, 10);
  route('POST', '/api/logout', true, (c) => (service.logout(c.token), { ok: true }));
  route('GET', '/api/me', true, (c) => ({ me: service.me(c.account.id) }));
  route('POST', '/api/daily', true, (c) => withMe(c.account.id, service.claimDaily(c.account.id)), 30);
  route('POST', '/api/packs/open', true, (c) => withMe(c.account.id, service.openPack(c.account.id)), 30);
  route('POST', '/api/sell', true, (c) => withMe(c.account.id, service.sell(c.account.id, str(c.body.cardId, 'cardId'), num(c.body.copies, 'copies'))), 60);
  route('POST', '/api/sell-extras', true, (c) => withMe(c.account.id, service.sellExtras(c.account.id)), 30);
  route('PUT', '/api/decks/:id', true, (c) => {
    service.saveDeck(c.account.id, c.params[0]!, str(c.body.name, 'name'), c.body.cardIds);
    return withMe(c.account.id, { problems: service.deckProblems(c.account.id, c.body.cardIds as string[]) });
  }, 60);
  route('DELETE', '/api/decks/:id', true, (c) => (service.deleteDeck(c.account.id, c.params[0]!), withMe(c.account.id)), 60);
  route('GET', '/api/market', true, (c) => service.market(c.account.id));
  route('POST', '/api/market/npc/buy', true, (c) => (service.buyNpcListing(c.account.id, str(c.body.id, 'id')), withMe(c.account.id)), 30);
  route('POST', '/api/market/list', true, (c) => withMe(c.account.id, service.listCard(c.account.id, str(c.body.cardId, 'cardId'), num(c.body.price, 'price'))), 30);
  route('POST', '/api/market/cancel', true, (c) => (service.cancelListing(c.account.id, num(c.body.id, 'id')), withMe(c.account.id)), 30);
  route('POST', '/api/market/buy', true, (c) => (service.buyPlayerListing(c.account.id, num(c.body.id, 'id')), withMe(c.account.id)), 30);
  route('POST', '/api/client-error', false, (c) => {
    const message = String(c.body.message ?? '').slice(0, 500);
    const account = service.accountForToken(String(c.req.headers.authorization ?? '').replace(/^Bearer /, ''));
    store.insertClientError(account?.id ?? null, Date.now(), message, String(c.body.stack ?? '').slice(0, 4000) || null, String(c.body.url ?? '').slice(0, 300) || null, String(c.req.headers['user-agent'] ?? '').slice(0, 200) || null);
    log.warn('client error', { accountId: account?.id, message });
    return { ok: true };
  }, 20);

  // Admin API for debugging a deployment. Disabled unless ADMIN_TOKEN is set.
  const admin = (c: Ctx) => {
    if (!cfg.adminToken || c.req.headers['x-admin-token'] !== cfg.adminToken) throw new ApiError(404, 'Not found');
  };
  route('GET', '/api/admin/stats', false, (c) => {
    admin(c);
    return { uptimeSec: Math.round((Date.now() - startedAt) / 1000), db: store.counts(), live: hub.stats(), node: process.version, memoryMb: Math.round(process.memoryUsage().rss / 1048576) };
  });
  route('GET', '/api/admin/errors', false, (c) => (admin(c), { server: log.recentErrors, client: store.recentClientErrors(50) }));
  route('GET', '/api/admin/matches', false, (c) => (admin(c), { matches: store.recentMatches(30).map(({ actions: _a, config: _c, ...m }) => m) }));
  route('GET', '/api/admin/match/:id', false, (c) => (admin(c), store.match(c.params[0]!) ?? (() => { throw new ApiError(404, 'No such match'); })()));
  route('GET', '/api/admin/account/:name', false, (c) => {
    admin(c);
    const a = store.accountByName(decodeURIComponent(c.params[0]!));
    if (!a) throw new ApiError(404, 'No such account');
    const { pass_hash: _h, salt: _s, ...pub } = a;
    return { account: pub, profile: store.getProfile(a.id), decks: store.listDecks(a.id) };
  });
  route('POST', '/api/admin/grant', false, (c) => (admin(c), service.grant(str(c.body.name, 'name'), num(c.body.wb, 'wb'))));
  route('POST', '/api/admin/reset-daily', false, (c) => (admin(c), service.resetDaily(str(c.body.name, 'name')), { ok: true }));

  const readBody = (req: IncomingMessage): Promise<Record<string, unknown>> =>
    new Promise((resolveBody, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (d: Buffer) => {
        size += d.length;
        if (size > 200_000) {
          reject(new ApiError(413, 'Request too large'));
          req.destroy();
        } else chunks.push(d);
      });
      req.on('end', () => {
        if (chunks.length === 0) return resolveBody({});
        try {
          const v = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
          resolveBody(v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
        } catch {
          reject(new ApiError(400, 'Request body is not valid JSON'));
        }
      });
      req.on('error', reject);
    });

  const sendJson = (res: ServerResponse, status: number, body: unknown) => {
    const text = JSON.stringify(body);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(text);
  };

  const staticRoot = cfg.staticDir ? resolve(cfg.staticDir) : '';
  const serveStatic = (req: IncomingMessage, res: ServerResponse): boolean => {
    if (!staticRoot || !existsSync(staticRoot) || (req.method !== 'GET' && req.method !== 'HEAD')) return false;
    const url = new URL(req.url ?? '/', 'http://x');
    let file = normalize(join(staticRoot, decodeURIComponent(url.pathname)));
    if (file !== staticRoot && !file.startsWith(staticRoot + sep)) return false;
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(staticRoot, 'index.html'); // single-page app fallback
    if (!existsSync(file)) return false;
    const ext = extname(file);
    const immutable = file.includes(`${sep}assets${sep}`) || ext === '.webp';
    res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream', 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
    return true;
  };

  const server = createServer((req, res) => {
    const started = Date.now();
    const id = randomBytes(4).toString('hex');
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0]!.trim();
    const path = (req.url ?? '/').split('?')[0]!;
    void (async () => {
      let status = 200;
      try {
        if (!path.startsWith('/api/')) {
          if (!serveStatic(req, res)) {
            status = 404;
            res.writeHead(404, { 'content-type': 'text/plain' });
            res.end('Not found');
          }
          return;
        }
        const r = routes.find((x) => x.method === req.method && x.re.test(path));
        if (!r) throw new ApiError(404, 'No such endpoint');
        const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '');
        let account: AccountRow | undefined;
        if (r.auth) {
          account = service.accountForToken(token);
          if (!account) throw new ApiError(401, 'Please sign in again');
        }
        const key = account ? `acct:${account.id}:${r.re.source}` : `ip:${ip}:${r.re.source}`;
        if (!limiter.allow(`ip:${ip}`, 600, 60_000) || (r.limit !== undefined && !limiter.allow(key, r.limit, 60_000))) {
          throw new ApiError(429, 'Too many requests. Wait a moment and try again.');
        }
        const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
        const params = r.re.exec(path)!.slice(1).map(decodeURIComponent);
        const out = await r.handler({ req, body, params, account: account as AccountRow, token, ip });
        sendJson(res, 200, out);
      } catch (e) {
        if (e instanceof ApiError) {
          status = e.status;
          sendJson(res, e.status, { error: e.message });
        } else {
          status = 500;
          log.error('request failed', e, { id, method: req.method, path });
          if (!res.headersSent) sendJson(res, 500, { error: 'Something went wrong on the server.', requestId: id });
        }
      } finally {
        if (path.startsWith('/api/') || status >= 400) log.info('request', { id, method: req.method, path, status, ms: Date.now() - started, ip });
      }
    })();
  });

  // WebSocket: /ws?token=...
  const wss = new WebSocketServer({ noServer: true, maxPayload: 20_000 });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    const account = service.accountForToken(url.searchParams.get('token') ?? undefined);
    if (!account) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => bindSocket(ws, account));
  });

  const bindSocket = (ws: WebSocket, account: AccountRow) => {
    const conn: Conn = {
      send: (msg) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
      },
      close: () => ws.close(),
    };
    log.info('socket open', { accountId: account.id });
    const alive = { v: true };
    ws.on('pong', () => (alive.v = true));
    const heartbeat = setInterval(() => {
      if (!alive.v) return ws.terminate();
      alive.v = false;
      ws.ping();
    }, 30_000);
    heartbeat.unref();
    hub.connect(account, conn);
    ws.on('message', (data) => {
      if (!limiter.allow(`ws:${account.id}`, 240, 10_000)) {
        conn.send({ type: 'error', message: 'Slow down.' });
        return;
      }
      try {
        const msg = JSON.parse(String(data)) as ClientMsg;
        if (!msg || typeof msg.type !== 'string') throw new Error('bad message');
        hub.handle(account, conn, msg);
      } catch (e) {
        log.warn('bad socket message', { accountId: account.id, error: String(e) });
        conn.send({ type: 'error', message: 'The server could not understand that message.' });
      }
    });
    ws.on('close', () => {
      clearInterval(heartbeat);
      hub.disconnect(account, conn);
      log.info('socket closed', { accountId: account.id });
    });
    ws.on('error', (e) => log.warn('socket error', { accountId: account.id, error: String(e) }));
  };

  const housekeeping = setInterval(() => {
    try {
      store.purgeSessions(Date.now());
      service.expireListings();
    } catch (e) {
      log.error('housekeeping failed', e);
    }
  }, 60_000);
  housekeeping.unref();

  return {
    server,
    hub,
    service,
    store,
    log,
    listen: () =>
      new Promise((ok, fail) => {
        server.once('error', fail);
        server.listen(cfg.port, cfg.host, () => ok((server.address() as { port: number }).port));
      }),
    close: async () => {
      clearInterval(housekeeping);
      hub.shutdown();
      for (const c of wss.clients) c.terminate();
      await new Promise<void>((ok) => server.close(() => ok()));
      store.close();
    },
  };
}
