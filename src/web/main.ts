import './style.css';
import { h } from './dom';
import { mountMenu } from './menu';
import { mountMatch, type MatchConfig } from './match';
import { mountDeckBuilder } from './deckbuilder';

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
  show((root) => mountMenu(root, { play: startMatch, army: army }));
}

function army(deckId?: string): void {
  show((root) => mountDeckBuilder(root, menu, deckId));
}

function startMatch(cfg: MatchConfig): void {
  show((root) =>
    mountMatch(root, cfg, menu, () => startMatch({ ...cfg, seed: (Math.random() * 2 ** 31) | 0 })),
  );
}

menu();
