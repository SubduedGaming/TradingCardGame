import type { ClientMsg, ServerMsg } from '../shared/protocol';
import { auth } from './api';

type Listener = (msg: ServerMsg) => void;
type StatusListener = (connected: boolean) => void;

/**
 * The game socket. It reconnects by itself with a growing pause; on reconnect the server re-sends the
 * match in progress, so a dropped connection costs the player nothing but a moment.
 */
class Connection {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private retry = 0;
  private wanted = false;
  private timer: number | undefined;
  private ping: number | undefined;
  connected = false;

  start(): void {
    this.wanted = true;
    if (this.ws || !auth.token) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(auth.token)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.connected = true;
      this.statusListeners.forEach((l) => l(true));
      window.clearInterval(this.ping);
      this.ping = window.setInterval(() => this.send({ type: 'ping' }), 25_000);
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(String(e.data)) as ServerMsg;
        this.listeners.forEach((l) => l(msg));
      } catch (err) {
        console.error('bad server message', err);
      }
    };
    ws.onclose = () => {
      this.ws = null;
      window.clearInterval(this.ping);
      if (this.connected) this.statusListeners.forEach((l) => l(false));
      this.connected = false;
      if (this.wanted && auth.token) {
        this.retry += 1;
        this.timer = window.setTimeout(() => this.start(), Math.min(10_000, 500 * 2 ** Math.min(this.retry, 5)));
      }
    };
    ws.onerror = () => ws.close();
  }

  stop(): void {
    this.wanted = false;
    window.clearTimeout(this.timer);
    window.clearInterval(this.ping);
    this.ws?.close();
    this.ws = null;
  }

  send(msg: ClientMsg): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  onStatus(l: StatusListener): () => void {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }
}

export const connection = new Connection();
