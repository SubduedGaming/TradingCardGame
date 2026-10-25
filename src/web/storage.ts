import type { Card } from '../engine/types';
import { WW2_CARDS } from '../cards/ww2';
import type { Profile } from '../economy/profile';

export interface SavedDeck {
  id: string;
  name: string;
  cardIds: string[];
}

const KEY = 'frontline.decks.v1';
const SETTINGS_KEY = 'frontline.settings.v1';

export const CARD_BY_ID: ReadonlyMap<string, Card> = new Map(WW2_CARDS.map((c) => [c.id, c]));

export function resolveDeck(ids: string[]): Card[] {
  return ids.flatMap((id) => {
    const card = CARD_BY_ID.get(id);
    return card ? [card] : [];
  });
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode or quota): decks simply last for this session
  }
}

let memory: SavedDeck[] | null = null;

export function loadDecks(): SavedDeck[] {
  memory ??= read<SavedDeck[]>(KEY, []);
  return memory;
}

export function saveDeck(deck: SavedDeck): void {
  const decks = loadDecks().filter((d) => d.id !== deck.id);
  decks.push(deck);
  memory = decks;
  write(KEY, decks);
}

export function deleteDeck(id: string): void {
  memory = loadDecks().filter((d) => d.id !== id);
  write(KEY, memory);
}

export interface Settings {
  deckId: string;
  opponent: string;
  level: 'recruit' | 'veteran' | 'commander';
  fast: boolean;
}

export function loadSettings(): Settings {
  return { deckId: 'preset:usa', opponent: 'random', level: 'veteran', fast: false, ...read<Partial<Settings>>(SETTINGS_KEY, {}) };
}

export function saveSettings(s: Settings): void {
  write(SETTINGS_KEY, s);
}

const PROFILE_KEY = 'frontline.profile.v1';
let profileMemory: Profile | null | undefined;

export function loadProfile(): Profile | null {
  if (profileMemory === undefined) {
    const p = read<Profile | null>(PROFILE_KEY, null);
    profileMemory = p && p.version === 1 ? p : null;
  }
  return profileMemory;
}

export function saveProfile(profile: Profile): void {
  profileMemory = profile;
  write(PROFILE_KEY, profile);
}
