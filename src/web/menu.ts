import { chooseDoctrine } from '../engine/doctrine';
import { validateDeck } from '../engine/deck';
import { missingCards } from '../economy/profile';
import { AI_TIERS, type AiTier, type ClientMsg } from '../shared/protocol';
import { WW2_CARDS } from '../cards/ww2';
import { api, session } from './api';
import { connection } from './net';
import { CARD_BY_ID, loadSettings, resolveDeck, saveSettings } from './storage';
import { clear, h } from './dom';
import { sound } from './sound';
import { DOCTRINE_INFO, NATION_LABEL } from './text';

const NATIONS = ['usa', 'uk', 'ussr', 'germany', 'japan'] as const;
const TIER_TEXT: Record<AiTier, string> = {
  recruit: 'Recruit — forgiving, makes mistakes (win: 40 WB)',
  veteran: 'Veteran — plays the best move it sees (win: 60 WB)',
  commander: 'Commander — plans whole turns and guards its HQ (win: 90 WB)',
  marshal: 'Marshal — simulates the opponent\'s replies (win: 120 WB)',
};

export interface MenuActions {
  /** Ask the server for a match. The match screen opens when the server answers. */
  queue: (msg: ClientMsg) => void;
  army: (deckId?: string) => void;
  shop: () => void;
  signOut: () => void;
}

export function mountMenu(root: HTMLElement, actions: MenuActions): () => void {
  const settings = loadSettings();
  let notice = '';
  let searching = false;
  let online = connection.connected;
  const me = () => session.me!;

  const decks = () => me().decks.map((d) => ({ id: d.id, label: d.name, ids: d.cardIds, cards: resolveDeck(d.cardIds) }));
  if (!decks().some((d) => d.id === settings.deckId)) settings.deckId = decks()[0]?.id ?? 'starter';

  function problems(): string[] {
    const d = decks().find((x) => x.id === settings.deckId);
    if (!d) return ['You have no saved army. Open Armies to build one.'];
    const errors = validateDeck(d.cards);
    for (const m of missingCards(me().profile as never, d.ids)) errors.push(`${CARD_BY_ID.get(m.id)?.name ?? m.id}: you own ${m.have} of the ${m.need} in this army`);
    return errors;
  }

  function start(mode: 'ai' | 'pvp'): void {
    if (problems().length > 0 || searching) return;
    if (!connection.connected) {
      notice = 'Not connected to the server yet. Wait a moment and try again.';
      render();
      return;
    }
    saveSettings(settings);
    notice = '';
    if (mode === 'ai') actions.queue({ type: 'queue', mode: 'ai', deckId: settings.deckId, level: settings.level, opponent: settings.opponent });
    else {
      searching = true;
      actions.queue({ type: 'queue', mode: 'pvp', deckId: settings.deckId });
    }
    render();
  }

  function render(): void {
    const m = me();
    const errors = problems();
    const deck = decks().find((d) => d.id === settings.deckId);
    const doctrine = deck ? chooseDoctrine(deck.cards) : null;

    const deckSel = h(
      'select',
      { id: 'deck', onchange: (e: Event) => { settings.deckId = (e.target as HTMLSelectElement).value; saveSettings(settings); render(); } },
      ...decks().map((d) => h('option', { value: d.id, selected: d.id === settings.deckId }, d.label)),
    );
    const foeSel = h(
      'select',
      { id: 'foe', onchange: (e: Event) => { settings.opponent = (e.target as HTMLSelectElement).value; saveSettings(settings); } },
      h('option', { value: 'random', selected: settings.opponent === 'random' }, 'Random nation'),
      ...NATIONS.map((n) => h('option', { value: n, selected: settings.opponent === n }, NATION_LABEL[n])),
    );
    const levelSel = h(
      'select',
      { id: 'level', onchange: (e: Event) => { settings.level = (e.target as HTMLSelectElement).value as AiTier; saveSettings(settings); } },
      ...AI_TIERS.map((t) => h('option', { value: t, selected: settings.level === t }, TIER_TEXT[t])),
    );
    const shownErrors = errors.slice(0, 3);

    clear(root);
    root.append(
      h(
        'div',
        { class: 'menu' },
        h('h1', null, 'Front Line'),
        h(
          'div',
          { class: 'status-line' },
          h('strong', null, m.account.name),
          h('span', { class: 'wallet' }, `${m.profile.wb} WB`),
          h('span', { class: 'muted' }, `Rating ${m.account.rating} · ${Object.keys(m.profile.collection).length} of ${WW2_CARDS.length} cards`),
          h('span', { class: `online ${online ? '' : 'off'}` }, online ? '● online' : '● connecting…'),
        ),
        m.profile.freePacks > 0 ? h('p', { class: 'notice' }, 'You have a free pack waiting in the Shop!') : null,
        notice ? h('p', { class: 'notice' }, notice) : null,
        h(
          'div',
          { class: 'panel' },
          h('label', null, 'Your army', deckSel),
          h('div', { class: 'deck-info' }, h('p', null, `${deck?.cards.length ?? 0} cards`, doctrine && doctrine !== 'neutral' ? ` · Doctrine: ${DOCTRINE_INFO[doctrine].name} — ${DOCTRINE_INFO[doctrine].text}` : ' · No doctrine'),
            errors.length > 0 ? h('ul', { class: 'errors' }, ...shownErrors.map((e) => h('li', null, e)), errors.length > shownErrors.length ? h('li', null, `…and ${errors.length - shownErrors.length} more. Open Armies to fix this army.`) : null) : null),
          h('label', null, 'Opponent (vs AI)', foeSel),
          h('label', null, 'Difficulty (vs AI)', levelSel),
          h(
            'div',
            { class: 'row wrap', style: 'justify-content:center' },
            h('button', { class: 'btn primary big', id: 'play-ai', disabled: errors.length > 0 || searching, onclick: () => start('ai') }, 'Play vs AI'),
            h('button', { class: 'btn primary big', id: 'play-pvp', disabled: errors.length > 0 || searching, onclick: () => start('pvp') }, 'Play online'),
          ),
          h(
            'div',
            { class: 'row wrap', style: 'justify-content:center' },
            h('button', { class: 'btn', onclick: () => actions.army(deck?.id) }, 'Armies'),
            h('button', { class: 'btn', onclick: actions.shop }, 'Shop'),
            h('button', { class: 'btn', onclick: () => { sound.setMuted(!sound.muted); render(); } }, sound.muted ? 'Sound: off' : 'Sound: on'),
            h('button', { class: 'btn', onclick: actions.signOut }, 'Sign out'),
          ),
        ),
        h('p', { class: 'muted small' }, 'Set 1 · 420 cards · Online play fills empty seats with an AI after a short wait.'),
      ),
    );
    if (searching) {
      root.append(
        h(
          'div',
          { class: 'overlay' },
          h(
            'div',
            { class: 'modal searching' },
            h('div', { class: 'spinner' }),
            h('h2', null, 'Looking for an opponent…'),
            h('p', { class: 'muted' }, 'You are matched with a player of similar rating. If nobody is found in a few seconds, an AI joins instead (an unrated game).'),
            h('button', { class: 'btn', onclick: () => { connection.send({ type: 'leaveQueue' }); searching = false; render(); } }, 'Cancel'),
          ),
        ),
      );
    }
  }

  const offStatus = connection.onStatus((c) => {
    online = c;
    if (!c) searching = false;
    render();
  });
  const offMsg = connection.on((msg) => {
    if (msg.type === 'error') {
      searching = false;
      notice = msg.message;
      render();
    }
  });

  render();
  // the daily bonus is claimed once per day when the menu opens
  void api.daily().then((r) => {
    if (r.amount > 0) {
      notice = `Daily login bonus: +${r.amount} WB`;
      sound.play('coin');
    }
    render();
  }).catch(() => undefined);

  return () => {
    offStatus();
    offMsg();
  };
}

export type { AiTier };
