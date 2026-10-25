import type { Card } from '../engine/types';
import { RARITIES } from '../engine/types';
import { WW2_CARDS } from '../cards/ww2';
import { PRICE_BOUNDS } from '../economy/market';
import { PACK_PRICE, SELL_VALUE } from '../economy/profile';
import { COPY_LIMIT_BY_RARITY } from '../engine/deck';
import type { MarketView } from '../server/service';
import { api, session } from './api';
import { cardFace } from './cardview';
import { clear, h } from './dom';
import { sound } from './sound';
import { CARD_BY_ID } from './storage';
import { RARITY_LABEL } from './text';

type Tab = 'packs' | 'market' | 'sell';

export function mountShop(root: HTMLElement, onExit: () => void): void {
  let tab: Tab = 'packs';
  let reveal: { cards: Card[]; isNew: boolean[] } | null = null;
  let message = '';
  let search = '';
  let market: MarketView | null = null;
  let busy = false;

  const me = () => session.me!;

  /** Runs an API call, shows its error if it fails, and redraws. */
  async function run(fn: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      await fn();
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    busy = false;
    render();
  }

  async function loadMarket(): Promise<void> {
    try {
      market = await api.market();
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    render();
  }

  function packsTab(): HTMLElement {
    const p = me().profile;
    const free = p.freePacks > 0;
    const box = h(
      'div',
      { class: 'pack-box' },
      h('div', { class: 'pack-art' }, 'Standard', h('br'), 'Pack', h('br'), h('small', null, 'Set 1 · WW2')),
      h('p', { class: 'muted' }, '5 cards: 3 Commons, 1 Uncommon or better, 1 wildcard. A Rare or better is guaranteed every 8 packs.'),
      h(
        'button',
        {
          class: 'btn primary big',
          disabled: busy || (!free && p.wb < PACK_PRICE),
          onclick: () =>
            void run(async () => {
              const r = await api.openPack();
              reveal = { cards: r.cards.map((id) => CARD_BY_ID.get(id)!), isNew: r.isNew };
              message = '';
              sound.play('pack');
            }),
        },
        free ? 'Open your free pack' : `Open a pack — ${PACK_PRICE} WB`,
      ),
      h('p', { class: 'muted small' }, `${p.packsOpened} opened · next Rare guaranteed within ${Math.max(1, 8 - p.pity.rare)} pack(s)`),
    );
    const out = h('div', null, box);
    if (reveal) {
      const r = reveal;
      out.append(
        h('h3', { style: 'margin:14px 0 8px' }, 'You received'),
        h(
          'div',
          { class: 'reveal' },
          ...r.cards.map((c, i) => {
            const face = cardFace(c);
            if (r.isNew[i]) face.append(h('span', { class: 'new-tag' }, 'NEW'));
            return face;
          }),
        ),
      );
    }
    return out;
  }

  function marketTab(): HTMLElement {
    if (!market) return h('p', { class: 'muted' }, 'Loading the market…');
    const m = market;
    const wb = me().profile.wb;
    const npc = h('div', { class: 'market-grid' });
    for (const l of m.npc) {
      npc.append(
        h(
          'div',
          { class: 'listing' },
          cardFace(l.card),
          h('span', { class: 'price' }, `${l.price} WB`),
          h('button', { class: 'btn small', disabled: busy || l.sold || wb < l.price, onclick: () => void run(async () => { await api.buyNpc(l.id); sound.play('coin'); await refreshMarket(); }) }, l.sold ? 'Sold' : 'Buy'),
        ),
      );
    }
    const players = h('div', { class: 'market-grid' });
    for (const l of m.players) {
      const card = CARD_BY_ID.get(l.cardId)!;
      players.append(
        h(
          'div',
          { class: 'listing' },
          cardFace(card),
          h('span', { class: 'price' }, `${l.price} WB`),
          h('span', { class: 'muted small' }, l.mine ? 'Your listing' : `Seller: ${l.seller}`),
          l.mine
            ? h('button', { class: 'btn small', disabled: busy, onclick: () => void run(async () => { await api.cancelListing(l.id); await refreshMarket(); }) }, 'Cancel listing')
            : h('button', { class: 'btn small', disabled: busy || wb < l.price, onclick: () => void run(async () => { await api.buyListing(l.id); sound.play('coin'); await refreshMarket(); }) }, 'Buy'),
        ),
      );
    }
    return h(
      'div',
      null,
      h('h3', { style: 'margin:0 0 6px' }, 'Players\' listings'),
      h('p', { class: 'muted small' }, 'Fixed prices. The seller receives 92%; 8% is removed from the economy. Listings expire after 14 days and return the card.'),
      m.players.length > 0 ? players : h('p', { class: 'muted' }, 'No player listings yet. List a spare card from the Sell cards tab.'),
      h('h3', { style: 'margin:18px 0 6px' }, 'Traders (rotates daily)'),
      npc,
    );
  }

  async function refreshMarket(): Promise<void> {
    market = await api.market();
  }

  function sellTab(): HTMLElement {
    const p = me().profile;
    const usedByDecks = new Map<string, number>();
    for (const d of me().decks) {
      const per = new Map<string, number>();
      for (const id of d.cardIds) per.set(id, (per.get(id) ?? 0) + 1);
      for (const [id, n] of per) usedByDecks.set(id, Math.max(usedByDecks.get(id) ?? 0, n));
    }
    let extraCopies = 0;
    let extraWb = 0;
    for (const [id, n] of Object.entries(p.collection)) {
      const c = CARD_BY_ID.get(id);
      if (!c) continue;
      const extra = n - COPY_LIMIT_BY_RARITY[c.rarity];
      if (extra > 0) {
        extraCopies += extra;
        extraWb += extra * SELL_VALUE[c.rarity];
      }
    }
    const owned = WW2_CARDS.filter((c) => (p.collection[c.id] ?? 0) > 0 && c.name.toLowerCase().includes(search.toLowerCase())).sort(
      (a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || a.name.localeCompare(b.name),
    );
    const grid = h('div', { class: 'sell-grid' });
    for (const c of owned) {
      const n = p.collection[c.id]!;
      const spare = n - (usedByDecks.get(c.id) ?? 0);
      const { min, max } = PRICE_BOUNDS[c.rarity];
      grid.append(
        h(
          'div',
          { class: 'listing' },
          cardFace(c),
          h(
            'div',
            { class: 'sell-row' },
            h('span', null, `Owned ${n}${spare < n ? ` · ${n - spare} in armies` : ''}`),
            h(
              'button',
              {
                class: 'btn small',
                disabled: busy,
                title: 'Starter army copies sell for half value',
                onclick: () => {
                  if (n <= 1 && !confirm(`Sell your last ${c.name} to the army surplus store?`)) return;
                  void run(async () => { const r = await api.sell(c.id, 1); message = `Sold ${c.name} for ${r.earned} WB.`; sound.play('coin'); });
                },
              },
              `Sell · ${SELL_VALUE[c.rarity]} WB`,
            ),
          ),
          h(
            'button',
            {
              class: 'btn small',
              disabled: busy || spare < 1,
              title: spare < 1 ? 'This card is used by a saved army. Remove it from the army to list it.' : `List for ${min}-${max} WB`,
              onclick: () => {
                const raw = prompt(`List ${c.name} for how many War Bonds? (${min}-${max})`, String(Math.round((min + max) / 8)));
                if (raw === null) return;
                const price = Number(raw);
                void run(async () => { await api.listCard(c.id, price); message = `Listed ${c.name} for ${price} WB.`; });
              },
            },
            'List on market',
          ),
        ),
      );
    }
    return h(
      'div',
      null,
      h(
        'div',
        { class: 'row wrap', style: 'margin-bottom:10px' },
        h('input', { type: 'search', placeholder: 'Search your cards…', value: search, oninput: (e: Event) => { search = (e.target as HTMLInputElement).value; render(); } }),
        h(
          'button',
          {
            class: 'btn primary',
            disabled: busy || extraCopies === 0,
            title: 'Sells copies beyond what any army can use (Common/Uncommon 3, Rare/Epic 2, Legendary 1)',
            onclick: () => void run(async () => { const r = await api.sellExtras(); message = `Sold ${r.sold} extra cards for ${r.earned} WB.`; sound.play('coin'); }),
          },
          extraCopies === 0 ? 'No extras to sell' : `Sell ${extraCopies} extra cards · up to ${extraWb} WB`,
        ),
        h('span', { class: 'muted small' }, `Buyback: ${RARITIES.map((r) => `${RARITY_LABEL[r]} ${SELL_VALUE[r]}`).join(' · ')}`),
      ),
      grid,
    );
  }

  function render(): void {
    const tabBtn = (id: Tab, label: string) =>
      h('button', { class: `btn ${tab === id ? 'on' : ''}`, onclick: () => { tab = id; message = ''; if (id === 'market') void loadMarket(); render(); } }, label);
    const body = tab === 'packs' ? packsTab() : tab === 'market' ? marketTab() : sellTab();
    clear(root);
    root.append(
      h(
        'div',
        { class: 'shop' },
        h(
          'div',
          { class: 'shop-head' },
          h('h1', null, 'Shop'),
          h('span', { class: 'wallet' }, `${me().profile.wb} WB`),
          h('span', { class: 'muted' }, `${Object.keys(me().profile.collection).length} of ${WW2_CARDS.length} cards collected`),
          h('div', { class: 'tabs' }, tabBtn('packs', 'Packs'), tabBtn('market', 'Market'), tabBtn('sell', 'Sell cards')),
          h('button', { class: 'btn', onclick: onExit }, 'Back'),
        ),
        message ? h('p', { class: 'notice' }, message) : null,
        body,
      ),
    );
  }

  render();
}
