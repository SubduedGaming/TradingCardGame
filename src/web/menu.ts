import type { Card, Nation } from '../engine/types';
import { validateDeck } from '../engine/deck';
import { chooseDoctrine } from '../engine/doctrine';
import { buildNationDeck } from '../ai/decks';
import { loadDecks, loadSettings, resolveDeck, saveSettings } from './storage';
import { clear, h } from './dom';
import { DOCTRINE_INFO, NATION_LABEL } from './text';
import type { MatchConfig } from './match';

const PLAYABLE: Exclude<Nation, 'neutral'>[] = ['usa', 'uk', 'ussr', 'germany', 'japan'];

export interface MenuActions {
  play: (cfg: MatchConfig) => void;
  army: (deckId?: string) => void;
}

/** Each nation's ready-made starter army; fixed seeds make it the same deck every time. */
function presetDeck(nation: Nation): Card[] {
  return buildNationDeck(nation, { rng: 1000 + PLAYABLE.indexOf(nation as never) });
}

export function mountMenu(root: HTMLElement, actions: MenuActions): void {
  const settings = loadSettings();
  const saved = loadDecks();

  const deckOptions: Array<{ id: string; label: string; cards: Card[]; custom: boolean }> = [
    ...PLAYABLE.map((n) => ({ id: `preset:${n}`, label: `${NATION_LABEL[n]} (starter army)`, cards: presetDeck(n), custom: false })),
    ...saved.map((d) => ({ id: d.id, label: `${d.name} (yours)`, cards: resolveDeck(d.cardIds), custom: true })),
  ];
  if (!deckOptions.some((o) => o.id === settings.deckId)) settings.deckId = deckOptions[0]!.id;

  const deckSel = h(
    'select',
    { id: 'deck', onchange: () => { settings.deckId = (deckSel as HTMLSelectElement).value; update(); } },
    ...deckOptions.map((o) => h('option', { value: o.id, selected: o.id === settings.deckId }, o.label)),
  );
  const foeSel = h(
    'select',
    { id: 'foe', onchange: () => { settings.opponent = (foeSel as HTMLSelectElement).value; saveSettings(settings); } },
    h('option', { value: 'random', selected: settings.opponent === 'random' }, 'Random nation'),
    ...PLAYABLE.map((n) => h('option', { value: n, selected: settings.opponent === n }, NATION_LABEL[n])),
  );
  const levelSel = h(
    'select',
    { id: 'level', onchange: () => { settings.level = (levelSel as HTMLSelectElement).value as 'recruit' | 'veteran'; saveSettings(settings); } },
    h('option', { value: 'recruit', selected: settings.level === 'recruit' }, 'Recruit — forgiving, makes mistakes'),
    h('option', { value: 'veteran', selected: settings.level === 'veteran' }, 'Veteran — plays the best move it sees'),
  );

  const info = h('div', { class: 'deck-info' });
  const playBtn = h('button', { class: 'btn primary big', onclick: start }, 'Play match');
  const editBtn = h('button', { class: 'btn', onclick: () => actions.army(settings.deckId.startsWith('preset:') ? undefined : settings.deckId) }, 'Edit armies');

  function current() {
    return deckOptions.find((o) => o.id === settings.deckId)!;
  }

  function update(): void {
    saveSettings(settings);
    const opt = current();
    const errors = validateDeck(opt.cards);
    const doctrine = chooseDoctrine(opt.cards);
    clear(info);
    info.append(
      h('p', null, `${opt.cards.length} cards`, doctrine && doctrine !== 'neutral' ? ` · Doctrine: ${DOCTRINE_INFO[doctrine].name} — ${DOCTRINE_INFO[doctrine].text}` : ' · No doctrine'),
    );
    if (errors.length > 0) info.append(h('ul', { class: 'errors' }, ...errors.map((e) => h('li', null, e))));
    (playBtn as HTMLButtonElement).disabled = errors.length > 0;
  }

  function start(): void {
    const opt = current();
    const nation = (settings.opponent === 'random' ? PLAYABLE[Math.floor(Math.random() * PLAYABLE.length)]! : settings.opponent) as Nation;
    const seed = (Math.random() * 2 ** 31) | 0;
    actions.play({
      humanDeck: opt.cards,
      aiDeck: buildNationDeck(nation, { rng: (seed ^ 0x5bd1e995) | 0 }),
      level: settings.level,
      fast: settings.fast,
      seed,
      opponentName: `${NATION_LABEL[nation]} (${settings.level === 'veteran' ? 'Veteran' : 'Recruit'})`,
    });
  }

  clear(root);
  root.append(
    h(
      'div',
      { class: 'menu' },
      h('h1', null, 'Front Line'),
      h('p', { class: 'tag' }, 'A World War II army card game. Build an army, deploy across three lanes, break the enemy Command Post.'),
      h(
        'div',
        { class: 'panel' },
        h('label', null, 'Your army', deckSel),
        info,
        h('label', null, 'Opponent', foeSel),
        h('label', null, 'Difficulty', levelSel),
        h('div', { class: 'row' }, playBtn, editBtn),
      ),
      h('p', { class: 'muted small' }, 'Set 1 · 420 cards · single player'),
    ),
  );
  update();
}
