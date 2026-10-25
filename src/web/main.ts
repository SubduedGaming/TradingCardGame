import './style.css';
import type { ClientMsg } from '../shared/protocol';
import { api, auth, session } from './api';
import { mountDeckBuilder } from './deckbuilder';
import { h } from './dom';
import { mountLogin } from './login';
import { mountMatch } from './match';
import { mountMenu } from './menu';
import { connection } from './net';
import { mountShop } from './shop';

const app = document.getElementById('app')!;
let dispose: (() => void) | null = null;
let lastQueue: ClientMsg | null = null;
let activeMatch: string | null = null;

function show(mount: (root: HTMLElement) => (() => void) | void): void {
  dispose?.();
  dispose = null;
  const root = h('div', { class: 'screen' });
  app.replaceChildren(root);
  dispose = mount(root) ?? null;
}

function login(notice = ''): void {
  activeMatch = null;
  connection.stop();
  session.me = null;
  show((root) => mountLogin(root, () => void enter(), notice));
}

/** Loads the account, opens the game socket and shows the menu. */
async function enter(): Promise<void> {
  try {
    await api.me();
  } catch {
    login();
    return;
  }
  connection.start();
  menu();
}

function menu(): void {
  activeMatch = null;
  show((root) =>
    mountMenu(root, {
      queue: (msg) => {
        lastQueue = msg;
        connection.send(msg);
      },
      army,
      shop,
      signOut: () => {
        void api.logout().finally(() => login());
      },
    }),
  );
}

function army(deckId?: string): void {
  show((root) => mountDeckBuilder(root, menu, deckId));
}

function shop(): void {
  show((root) => mountShop(root, menu));
}

// The server starts matches (including one resumed after a reconnect); the screen follows.
connection.on((msg) => {
  if (msg.type !== 'matchStart' || msg.matchId === activeMatch) return;
  activeMatch = msg.matchId;
  show((root) =>
    mountMatch(root, {
      matchId: msg.matchId,
      seat: msg.seat,
      opponent: msg.opponent,
      rated: msg.rated,
      onExit: () => void api.me().catch(() => undefined).finally(menu),
      onRematch: () => {
        // rewards and rating changed: refresh the wallet, then queue the same kind of game again
        activeMatch = null;
        void api.me().catch(() => undefined).finally(() => {
          if (lastQueue) connection.send(lastQueue);
        });
      },
    }),
  );
});

auth.onLost = () => login('Your session expired. Please sign in again.');

window.addEventListener('error', (e) => api.reportError(e.message, e.error instanceof Error ? e.error.stack : undefined));
window.addEventListener('unhandledrejection', (e) =>
  api.reportError(String(e.reason instanceof Error ? e.reason.message : e.reason), e.reason instanceof Error ? e.reason.stack : undefined),
);

if (auth.token) void enter();
else login();
