import type { Card, Nation, Rarity } from '../engine/types';
import { RARITIES } from '../engine/types';
import { BUILDINGS_MAX, BUILDINGS_MIN, COPY_LIMIT_BY_RARITY, DECK_MAX, DECK_MIN, ORDERS_MAX, POINTS_CAP, validateDeck } from '../engine/deck';
import { chooseDoctrine, nationCounts, DOCTRINE_MIN_CARDS } from '../engine/doctrine';
import { WW2_CARDS } from '../cards/ww2';
import { buildNationDeck } from '../ai/decks';
import { CARD_BY_ID, deleteDeck, loadDecks, resolveDeck, saveDeck, type SavedDeck } from './storage';
import { costPips, inspectOnHover, inspector } from './cardview';
import { clear, h } from './dom';
import { DOCTRINE_INFO, NATION_LABEL, RARITY_LABEL, artUrl, cardTypeLine } from './text';

const NATIONS: Nation[] = ['usa', 'uk', 'ussr', 'germany', 'japan', 'neutral'];
const TYPE_ORDER = { building: 0, unit: 1, order: 2 } as const;
const costTotal = (c: Card) => Object.values(c.cost).reduce((a, b) => a + b, 0);

function newId(): string {
  return `deck-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function mountDeckBuilder(root: HTMLElement, onExit: () => void, startId?: string): void {
  const sortedCards = [...WW2_CARDS].sort(
    (a, b) =>
      NATIONS.indexOf(a.nation) - NATIONS.indexOf(b.nation) ||
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      costTotal(a) - costTotal(b) ||
      a.name.localeCompare(b.name),
  );

  let deckId = startId ?? newId();
  const existing = loadDecks().find((d) => d.id === deckId);
  let deckName = existing?.name ?? 'New army';
  const counts = new Map<string, number>();
  for (const id of existing?.cardIds ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  let dirty = false;
  let message = '';

  const filters = { nation: 'all', type: 'all', rarity: 'all', search: '', onlyInDeck: false };

  const deckCards = (): Card[] =>
    [...counts.entries()].flatMap(([id, n]) => {
      const card = CARD_BY_ID.get(id);
      return card ? Array.from({ length: n }, () => card) : [];
    });

  function add(card: Card): void {
    const n = counts.get(card.id) ?? 0;
    if (n >= COPY_LIMIT_BY_RARITY[card.rarity]) return;
    if (deckCards().length >= DECK_MAX) return;
    counts.set(card.id, n + 1);
    dirty = true;
    refresh();
  }
  function remove(card: Card): void {
    const n = counts.get(card.id) ?? 0;
    if (n <= 1) counts.delete(card.id);
    else counts.set(card.id, n - 1);
    dirty = true;
    refresh();
  }

  // ---- collection
  const listEl = h('div', { class: 'collection' });
  function renderList(): void {
    clear(listEl);
    const q = filters.search.trim().toLowerCase();
    const shown = sortedCards.filter(
      (c) =>
        (filters.nation === 'all' || c.nation === filters.nation) &&
        (filters.type === 'all' || c.type === filters.type) &&
        (filters.rarity === 'all' || c.rarity === filters.rarity) &&
        (!filters.onlyInDeck || counts.has(c.id)) &&
        (q === '' || c.name.toLowerCase().includes(q)),
    );
    for (const card of shown) {
      const n = counts.get(card.id) ?? 0;
      const limit = COPY_LIMIT_BY_RARITY[card.rarity];
      const tile = h(
        'div',
        { class: `ctile rarity-${card.rarity} ${n > 0 ? 'in-deck' : ''}`, onclick: () => add(card) },
        h('img', { src: artUrl(card.id), loading: 'lazy', alt: '' }),
        h('div', { class: 'ctile-name' }, card.name),
        h('div', { class: 'ctile-meta' }, costPips(card.cost), h('span', { class: 'pts' }, `${card.points}p`)),
        h('div', { class: 'ctile-type' }, cardTypeLine(card).replace('Unit — ', '')),
        n > 0 ? h('div', { class: 'count-badge' }, `${n}/${limit}`) : null,
      );
      listEl.append(inspectOnHover(tile, card));
    }
    if (shown.length === 0) listEl.append(h('p', { class: 'muted' }, 'No cards match these filters.'));
    countEl.textContent = `${shown.length} of ${WW2_CARDS.length} cards`;
  }
  const countEl = h('span', { class: 'muted' });

  // ---- deck panel
  const deckEl = h('div', { class: 'deckpanel' });
  function renderDeck(): void {
    clear(deckEl);
    const cards = deckCards();
    const errors = validateDeck(cards);
    const points = cards.reduce((a, c) => a + c.points, 0);
    const buildings = cards.filter((c) => c.type === 'building').length;
    const orders = cards.filter((c) => c.type === 'order').length;
    const doctrine = chooseDoctrine(cards);
    const nc = [...nationCounts(cards).entries()].sort((a, b) => b[1] - a[1]);

    const meter = (label: string, value: number, min: number, max: number, bad: boolean) =>
      h('div', { class: `meter ${bad ? 'bad' : ''}` }, h('span', null, label), h('strong', null, `${value}`), h('span', { class: 'muted' }, min > 0 ? `${min}–${max}` : `max ${max}`));

    deckEl.append(
      h('input', {
        class: 'deck-name',
        value: deckName,
        maxlength: 40,
        oninput: (e: Event) => {
          deckName = (e.target as HTMLInputElement).value;
          dirty = true;
        },
      }),
      h(
        'div',
        { class: 'meters' },
        meter('Cards', cards.length, DECK_MIN, DECK_MAX, cards.length < DECK_MIN || cards.length > DECK_MAX),
        meter('Points', points, 0, POINTS_CAP, points > POINTS_CAP),
        meter('Buildings', buildings, BUILDINGS_MIN, BUILDINGS_MAX, buildings < BUILDINGS_MIN || buildings > BUILDINGS_MAX),
        meter('Orders', orders, 0, ORDERS_MAX, orders > ORDERS_MAX),
      ),
      h(
        'div',
        { class: 'doctrine-box' },
        doctrine && doctrine !== 'neutral'
          ? h('span', null, h('strong', null, `${DOCTRINE_INFO[doctrine].name} `), `(${NATION_LABEL[doctrine]}): ${DOCTRINE_INFO[doctrine].text}`)
          : h('span', { class: 'muted' }, `No doctrine yet. Put ${DOCTRINE_MIN_CARDS}+ cards of one nation in the deck (${nc.map(([n, c]) => `${NATION_LABEL[n]} ${c}`).join(', ') || 'none so far'}).`),
      ),
    );

    const groups: Array<[string, Card['type']]> = [['Buildings', 'building'], ['Units', 'unit'], ['Orders', 'order']];
    for (const [title, type] of groups) {
      const entries = [...counts.entries()]
        .flatMap(([id, n]) => {
          const c = CARD_BY_ID.get(id);
          return c && c.type === type ? [{ c, n }] : [];
        })
        .sort((a, b) => costTotal(a.c) - costTotal(b.c) || a.c.name.localeCompare(b.c.name));
      if (entries.length === 0) continue;
      deckEl.append(h('h4', null, `${title} (${entries.reduce((a, e) => a + e.n, 0)})`));
      for (const { c, n } of entries) {
        const row = h(
          'div',
          { class: `deckrow rarity-${c.rarity}` },
          h('span', { class: 'n' }, `${n}×`),
          h('span', { class: 'nm' }, c.name),
          costPips(c.cost),
          h('button', { class: 'mini', title: 'Add one', onclick: () => add(c) }, '+'),
          h('button', { class: 'mini', title: 'Remove one', onclick: () => remove(c) }, '−'),
        );
        deckEl.append(inspectOnHover(row, c));
      }
    }
    if (cards.length === 0) deckEl.append(h('p', { class: 'muted' }, 'Click cards in the collection to add them.'));

    deckEl.append(
      errors.length > 0
        ? h('ul', { class: 'errors' }, ...errors.map((e) => h('li', null, e.replace(/^ww2\.[a-z]+\./, '').replace(/-/g, ' '))))
        : h('p', { class: 'ok' }, 'This army is legal.'),
    );
    if (message) deckEl.append(h('p', { class: 'notice' }, message));
  }

  function refresh(): void {
    renderList();
    renderDeck();
  }

  function save(): void {
    const ids = deckCards().map((c) => c.id);
    const deck: SavedDeck = { id: deckId, name: deckName.trim() || 'Unnamed army', cardIds: ids };
    saveDeck(deck);
    dirty = false;
    const errors = validateDeck(resolveDeck(ids));
    message = errors.length > 0 ? 'Saved, but the army is not legal yet, so it cannot be used in a match.' : 'Saved.';
    renderDeck();
    renderSaved();
  }

  const savedEl = h('div', { class: 'saved' });
  function renderSaved(): void {
    clear(savedEl);
    const decks = loadDecks();
    savedEl.append(h('strong', null, 'Saved armies: '));
    if (decks.length === 0) savedEl.append(h('span', { class: 'muted' }, 'none yet'));
    for (const d of decks) {
      savedEl.append(
        h(
          'span',
          { class: `chip ${d.id === deckId ? 'on' : ''}` },
          h('button', { class: 'chip-main', onclick: () => load(d) }, d.name),
          h(
            'button',
            {
              class: 'chip-x',
              title: 'Delete',
              onclick: () => {
                if (!confirm(`Delete "${d.name}"?`)) return;
                deleteDeck(d.id);
                if (d.id === deckId) reset();
                renderSaved();
              },
            },
            '×',
          ),
        ),
      );
    }
  }

  function load(d: SavedDeck): void {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    deckId = d.id;
    deckName = d.name;
    counts.clear();
    for (const id of d.cardIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    dirty = false;
    message = '';
    refresh();
    renderSaved();
  }
  function reset(): void {
    deckId = newId();
    deckName = 'New army';
    counts.clear();
    dirty = false;
    message = '';
    refresh();
    renderSaved();
  }

  const nationSelect = h(
    'select',
    { id: 'autofill-nation' },
    ...NATIONS.filter((n) => n !== 'neutral').map((n) => h('option', { value: n }, NATION_LABEL[n])),
  );

  const select = (key: 'nation' | 'type' | 'rarity', options: Array<[string, string]>) =>
    h(
      'select',
      {
        onchange: (e: Event) => {
          filters[key] = (e.target as HTMLSelectElement).value;
          renderList();
        },
      },
      ...options.map(([v, l]) => h('option', { value: v }, l)),
    );

  const toolbar = h(
    'div',
    { class: 'toolbar' },
    h('input', {
      type: 'search',
      placeholder: 'Search cards…',
      oninput: (e: Event) => {
        filters.search = (e.target as HTMLInputElement).value;
        renderList();
      },
    }),
    select('nation', [['all', 'All nations'], ...NATIONS.map((n): [string, string] => [n, NATION_LABEL[n]])]),
    select('type', [['all', 'All types'], ['building', 'Buildings'], ['unit', 'Units'], ['order', 'Orders']]),
    select('rarity', [['all', 'All rarities'], ...RARITIES.map((r: Rarity): [string, string] => [r, RARITY_LABEL[r]])]),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e: Event) => { filters.onlyInDeck = (e.target as HTMLInputElement).checked; renderList(); } }), 'In army'),
    countEl,
  );

  const actions = h(
    'div',
    { class: 'row wrap' },
    h('button', { class: 'btn primary', onclick: save }, 'Save'),
    h('button', { class: 'btn', onclick: () => { if (!dirty || confirm('Discard this army and start a new one?')) reset(); } }, 'New'),
    h('button', { class: 'btn', onclick: () => { counts.clear(); dirty = true; refresh(); } }, 'Clear'),
    nationSelect,
    h(
      'button',
      {
        class: 'btn',
        title: 'Replace the army with a random legal army of the chosen nation',
        onclick: () => {
          const nation = (nationSelect as HTMLSelectElement).value as Nation;
          const cards = buildNationDeck(nation, { rng: (Math.random() * 2 ** 31) | 0 });
          counts.clear();
          for (const c of cards) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
          dirty = true;
          refresh();
        },
      },
      'Auto-fill',
    ),
    h('button', { class: 'btn', onclick: () => { if (!dirty || confirm('Leave without saving?')) onExit(); } }, 'Back'),
  );

  clear(root);
  root.append(
    h(
      'div',
      { class: 'army' },
      h('header', { class: 'army-head' }, h('h1', null, 'Army'), savedEl),
      toolbar,
      h('div', { class: 'army-body' }, listEl, h('aside', { class: 'side' }, inspector.el, actions, deckEl)),
    ),
  );
  renderSaved();
  refresh();
}
