import './style.css';
import { h } from './dom';
import { mountMenu } from './menu';
import { mountMatch, type MatchConfig } from './match';
import { mountDeckBuilder } from './deckbuilder';
import { mountShop } from './shop';
import { mountWelcome } from './welcome';
import { loadProfile, saveProfile } from './storage';
import { recordMatch } from '../economy/profile';

const app = document.getElementById('app')!;
let dispose: (() => void) | null = null;

function show(mount: (root: HTMLElement) => (() => void) | void): void {
  dispose?.();
  dispose = null;
  const root = h('div', { class: 'screen' });
  app.replaceChildren(root);
  dispose = mount(root) ?? null;
}

function menu(): void {
  if (!loadProfile()) {
    show((root) => mountWelcome(root, menu));
    return;
  }
  show((root) => mountMenu(root, { play: startMatch, army, shop }));
}

function army(deckId?: string): void {
  show((root) => mountDeckBuilder(root, menu, deckId));
}

function shop(): void {
  show((root) => mountShop(root, menu));
}

/** Pays the match reward exactly once and returns the lines the result screen shows. */
function settle(result: 'win' | 'loss' | 'draw', level: MatchConfig['level']): string[] {
  const profile = loadProfile();
  if (!profile) return [];
  const { profile: next, reward } = recordMatch(profile, result, level, Date.now());
  saveProfile(next);
  return [...reward.lines, `Total: +${reward.total} WB (now ${next.wb} WB)`];
}

function startMatch(cfg: MatchConfig): void {
  show((root) =>
    mountMatch(root, cfg, menu, () => startMatch({ ...cfg, seed: (Math.random() * 2 ** 31) | 0 }), (result) => settle(result, cfg.level)),
  );
}

menu();
