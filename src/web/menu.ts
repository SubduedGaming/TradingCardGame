import type { Card, Nation } from '../engine/types';
import { validateDeck } from '../engine/deck';
import { chooseDoctrine } from '../engine/doctrine';
import { buildNationDeck } from '../ai/decks';
import { claimDaily, distinctOwned, missingCards } from '../economy/profile';
import { WW2_CARDS } from '../cards/ww2';
import { CARD_BY_ID, loadDecks, loadProfile, loadSettings, resolveDeck, saveProfile, saveSettings } from './storage';
import { clear, h } from './dom';
import { DOCTRINE_INFO, NATION_LABEL } from './text';
import type { MatchConfig } from './match';

const LEVEL_NAME = { recruit: 'Recruit', veteran: 'Veteran', commander: 'Commander' } as const;
const PLAYABLE: Exclude<Nation, 'neutral'>[] = ['usa', 'uk', 'ussr', 'germany', 'japan'];

export interface MenuActions {
  play: (cfg: MatchConfig) => void;
  army: (deckId?: string) => void;
  shop: () => void;
}

export function mountMenu(root: HTMLElement, actions: MenuActions): void {
  const settings = loadSettings();
  let profile = loadProfile()!;
  const daily = claimDaily(profile, Date.now());
  if (daily.amount > 0) {
    profile = daily.profile;
    saveProfile(profile);
  }

  const decks = loadDecks().map((d) => ({ id: d.id, label: d.name, ids: d.cardIds, cards: resolveDeck(d.cardIds) }));
  if (decks.length > 0 && !decks.some((o) => o.id === settings.deckId)) settings.deckId = decks[0]!.id;

  const deckSel = h(
    'select',
    { id: 'deck', onchange: () => { settings.deckId = (deckSel as HTMLSelectElement).value; update(); } },
    ...decks.map((o) => h('option', { value: o.id, selected: o.id === settings.deckId }, o.label)),
  );
  const foeSel = h(
    'select',
    { id: 'foe', onchange: () => { settings.opponent = (foeSel as HTMLSelectElement).value; saveSettings(settings); } },
    h('option', { value: 'random', selected: settings.opponent === 'random' }, 'Random nation'),
    ...PLAYABLE.map((n) => h('option', { value: n, selected: settings.opponent === n }, NATION_LABEL[n])),
  );
  const levelSel = h(
    'select',
    { id: 'level', onchange: () => { settings.level = (levelSel as HTMLSelectElement).value as typeof settings.level; saveSettings(settings); update(); } },
    h('option', { value: 'recruit', selected: settings.level === 'recruit' }, 'Recruit — forgiving, makes mistakes (win: 40 WB)'),
    h('option', { value: 'veteran', selected: settings.level === 'veteran' }, 'Veteran — plays the best move it sees (win: 60 WB)'),
    h('option', { value: 'commander', selected: settings.level === 'commander' }, 'Commander — plans whole turns and guards its HQ (win: 90 WB)'),
  );

  const info = h('div', { class: 'deck-info' });
  const playBtn = h('button', { class: 'btn primary big', onclick: start }, 'Play match');

  function current() {
    return decks.find((o) => o.id === settings.deckId);
  }

  function problems(): string[] {
    const opt = current();
    if (!opt) return ['You have no saved army. Open Armies to build one.'];
    const errors = validateDeck(opt.cards);
    for (const m of missingCards(profile, opt.ids)) {
      errors.push(`${CARD_BY_ID.get(m.id)?.name ?? m.id}: you own ${m.have} of the ${m.need} in this army`);
    }
    return errors;
  }

  function update(): void {
    saveSettings(settings);
    const opt = current();
    const errors = problems();
    clear(info);
    if (opt) {
      const doctrine = chooseDoctrine(opt.cards);
      info.append(h('p', null, `${opt.cards.length} cards`, doctrine && doctrine !== 'neutral' ? ` · Doctrine: ${DOCTRINE_INFO[doctrine].name} — ${DOCTRINE_INFO[doctrine].text}` : ' · No doctrine'));
    }
    if (errors.length > 0) {
      const shown = errors.slice(0, 3);
      info.append(
        h('ul', { class: 'errors' }, ...shown.map((e) => h('li', null, e)), errors.length > shown.length ? h('li', null, `…and ${errors.length - shown.length} more. Open Armies to fix this army.`) : null),
      );
    }
    (playBtn as HTMLButtonElement).disabled = errors.length > 0;
  }

  function start(): void {
    const opt = current();
    if (!opt || problems().length > 0) return;
    const nation = (settings.opponent === 'random' ? PLAYABLE[Math.floor(Math.random() * PLAYABLE.length)]! : settings.opponent) as Nation;
    const seed = (Math.random() * 2 ** 31) | 0;
    actions.play({
      humanDeck: opt.cards,
      aiDeck: buildNationDeck(nation, { rng: (seed ^ 0x5bd1e995) | 0 }),
      level: settings.level,
      fast: settings.fast,
      seed,
      opponentName: `${NATION_LABEL[nation]} (${LEVEL_NAME[settings.level]})`,
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
        { class: 'row', style: 'justify-content:center;margin-bottom:14px' },
        h('span', { class: 'wallet' }, `${profile.wb} WB`),
        h('span', { class: 'muted' }, `${distinctOwned(profile)} of ${WW2_CARDS.length} cards`),
        profile.freePacks > 0 ? h('span', { class: 'notice' }, 'Free pack waiting!') : null,
      ),
      daily.amount > 0 ? h('p', { class: 'notice' }, `Daily login bonus: +${daily.amount} WB`) : null,
      h(
        'div',
        { class: 'panel' },
        h('label', null, 'Your army', deckSel),
        info,
        h('label', null, 'Opponent', foeSel),
        h('label', null, 'Difficulty', levelSel),
        h(
          'div',
          { class: 'row' },
          playBtn,
          h('button', { class: 'btn', onclick: () => actions.army(current()?.id) }, 'Armies'),
          h('button', { class: 'btn', onclick: actions.shop }, 'Shop'),
        ),
      ),
      h('p', { class: 'muted small' }, 'Set 1 · 420 cards · single player'),
    ),
  );
  update();
}
