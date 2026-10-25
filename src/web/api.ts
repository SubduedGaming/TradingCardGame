import type { MarketView, MeView } from '../server/service';

const TOKEN_KEY = 'frontline.token';

export class ApiFailure extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let token: string | null = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  /* storage unavailable: the player signs in each visit */
}

export const auth = {
  get token(): string | null {
    return token;
  },
  set(value: string | null): void {
    token = value;
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
  /** Called when the server says the session is no longer valid. */
  onLost: (() => {}) as () => void,
};

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiFailure(0, 'Cannot reach the server. Check your connection and try again.');
  }
  let data: { error?: string } & Record<string, unknown> = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    if (res.status === 401 && token) {
      auth.set(null);
      auth.onLost();
    }
    throw new ApiFailure(res.status, data.error ?? `The server answered ${res.status}.`);
  }
  return data as T;
}

/** The signed-in player's data, kept in memory and refreshed from every API answer that carries it. */
export const session: { me: MeView | null } = { me: null };

export function applyMe<T extends { me?: MeView }>(answer: T): T {
  if (answer.me) session.me = answer.me;
  return answer;
}

export const api = {
  register: async (name: string, password: string, nation: string) => {
    const r = await request<{ token: string; me: MeView }>('POST', '/api/register', { name, password, nation });
    auth.set(r.token);
    return applyMe(r);
  },
  login: async (name: string, password: string) => {
    const r = await request<{ token: string; me: MeView }>('POST', '/api/login', { name, password });
    auth.set(r.token);
    return applyMe(r);
  },
  logout: async () => {
    try {
      await request('POST', '/api/logout', {});
    } finally {
      auth.set(null);
      session.me = null;
    }
  },
  me: async () => applyMe(await request<{ me: MeView }>('GET', '/api/me')),
  daily: async () => applyMe(await request<{ amount: number; me: MeView }>('POST', '/api/daily', {})),
  openPack: async () => applyMe(await request<{ cards: string[]; isNew: boolean[]; me: MeView }>('POST', '/api/packs/open', {})),
  sell: async (cardId: string, copies: number) => applyMe(await request<{ earned: number; me: MeView }>('POST', '/api/sell', { cardId, copies })),
  sellExtras: async () => applyMe(await request<{ earned: number; sold: number; me: MeView }>('POST', '/api/sell-extras', {})),
  saveDeck: async (id: string, name: string, cardIds: string[]) =>
    applyMe(await request<{ problems: string[]; me: MeView }>('PUT', `/api/decks/${encodeURIComponent(id)}`, { name, cardIds })),
  deleteDeck: async (id: string) => applyMe(await request<{ me: MeView }>('DELETE', `/api/decks/${encodeURIComponent(id)}`)),
  market: () => request<MarketView>('GET', '/api/market'),
  buyNpc: async (id: string) => applyMe(await request<{ me: MeView }>('POST', '/api/market/npc/buy', { id })),
  listCard: async (cardId: string, price: number) => applyMe(await request<{ id: number; me: MeView }>('POST', '/api/market/list', { cardId, price })),
  cancelListing: async (id: number) => applyMe(await request<{ me: MeView }>('POST', '/api/market/cancel', { id })),
  buyListing: async (id: number) => applyMe(await request<{ me: MeView }>('POST', '/api/market/buy', { id })),
  reportError: (message: string, stack?: string) => {
    void request('POST', '/api/client-error', { message, stack, url: location.pathname + location.hash }).catch(() => undefined);
  },
};
