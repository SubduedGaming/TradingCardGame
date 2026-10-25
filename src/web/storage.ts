import type { Card } from '../engine/types';
import { WW2_CARDS } from '../cards/ww2';
import type { AiTier } from '../shared/protocol';

export const CARD_BY_ID: ReadonlyMap<string, Card> = new Map(WW2_CARDS.map((c) => [c.id, c]));

export function resolveDeck(ids: string[]): Card[] {
  return ids.flatMap((id) => {
    const card = CARD_BY_ID.get(id);
    return card ? [card] : [];
  });
}

const SETTINGS_KEY = 'frontline.settings.v2';

export interface Settings {
  deckId: string;
  opponent: string;
  level: AiTier;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { deckId: 'starter', opponent: 'random', level: 'veteran', ...(raw ? (JSON.parse(raw) as Partial<Settings>) : {}) };
  } catch {
    return { deckId: 'starter', opponent: 'random', level: 'veteran' };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings last for this visit */
  }
}
