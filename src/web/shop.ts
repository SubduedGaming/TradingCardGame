import type { Card } from '../engine/types';
import { RARITIES } from '../engine/types';
import { WW2_CARDS } from '../cards/ww2';
import { dailyStock } from '../economy/market';
import {
  EconomyError, PACK_PRICE, SELL_VALUE, buyListing, buyPack, distinctOwned, extras, sellCards, sellExtras, sellValue,
  type Profile,
} from '../economy/profile';
import { cardFace } from './cardview';
import { clear, h } from './dom';
import { loadProfile, saveProfile } from './storage';
import { RARITY_LABEL } from './text';

type Tab = 'packs' | 'market' | 'sell';

export function mountShop(root: HTMLElement, onExit: () => void): void {
  let profile: Profile = loadProfile()!;
  let tab: Tab = 'packs';
  let reveal: { cards: Card[]; isNew: boolean[] } | null = null;
  let message = '';
  let search = '';

  const update = (p: Profile) => {
    profile = p;
    saveProfile(p);
  };

  const guard = (fn: () => void) => {
    try {
      fn();
      message = '';
    } catch (e) {
      if (!(e instanceof EconomyError)) throw e;
      message = e.message;
    }
    render();
  };

  function packsTab(): HTMLElement {
    const free = profile.freePacks > 0;
    const box = h(
      'div',
      { class: 'pack-box' },
      h('div', { class: 'pack-art' }, 'Standard', h('br'), 'Pack', h('br'), h('small', null, 'Set 1 · WW2')),
      h('p', { class: 'muted' }, '5 cards: 3 Commons, 1 Uncommon or better, 1 wildcard. A Rare or better is guaranteed every 8 packs.'),
      h(
        'button',
        {
          class: 'btn primary big',
          disabled: !free && profile.wb < PACK_PRICE,
          onclick: () =>
            guard(() => {
              const r = buyPack(profile, Date.now());
              update(r.profile);
              reveal = { cards: r.cards, isNew: r.isNew };
            }),
        },
        free ? 'Open your free pack' : `Open a pack — ${PACK_PRICE} WB`,
      ),
      h('p', { class: 'muted small' }, `${profile.packsOpened} opened · next Rare guaranteed within ${Math.max(1, 8 - profile.pity.rare)} pack(s)`),
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
    const now = Date.now();
    const grid = h('div', { class: 'market-grid' });
    for (const l of dailyStock(now)) {
      const sold = profile.marketBought.includes(l.id);
      grid.append(
        h(
          'div',
          { class: 'listing' },
          cardFace(l.card),
          h('span', { class: 'price' }, `${l.price} WB`),
          h(
            'button',
            { class: 'btn small', disabled: sold || profile.wb < l.price, onclick: () => guard(() => update(buyListing(profile, l, Date.now()))) },
            sold ? 'Sold' : 'Buy',
          ),
        ),
      );
    }
    return h(
      'div',
      null,
      h('p', { class: 'muted' }, 'Today\'s stock from traders. It rotates every day. Selling cards to other players arrives with online play.'),
      grid,
    );
  }

  function sellTab(): HTMLElement {
    const ex = extras(profile);
    const exWb = ex.reduce((n, e) => n + sellValue(profile, e.card.id, e.copies), 0);
    const exCopies = ex.reduce((n, e) => n + e.copies, 0);
    const owned = WW2_CARDS.filter((c) => (profile.collection[c.id] ?? 0) > 0 && c.name.toLowerCase().includes(search.toLowerCase())).sort(
      (a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || a.name.localeCompare(b.name),
    );
    const grid = h('div', { class: 'sell-grid' });
    for (const c of owned) {
      const n = profile.collection[c.id]!;
      const sellable = sellValue(profile, c.id, 1);
      grid.append(
        h(
          'div',
          { class: 'listing' },
          cardFace(c),
          h(
            'div',
            { class: 'sell-row' },
            h('span', null, `Owned ${n}`),
            h(
              'button',
              {
                class: 'btn small',
                title: 'Starter army copies sell for half value',
                onclick: () => {
                  if (n <= 1 && !confirm(`Sell your last ${c.name} for ${sellable} WB?`)) return;
                  guard(() => update(sellCards(profile, c.id, 1, Date.now()).profile));
                },
              },
              `Sell 1 · ${sellable} WB`,
            ),
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
            disabled: exCopies === 0,
            title: 'Sells copies beyond what any army can use (Common/Uncommon 3, Rare/Epic 2, Legendary 1)',
            onclick: () => guard(() => {
              const r = sellExtras(profile, Date.now());
              update(r.profile);
              message = `Sold ${r.sold} extra cards for ${r.earned} WB.`;
            }),
          },
          exCopies === 0 ? 'No extras to sell' : `Sell ${exCopies} extra cards · ${exWb} WB`,
        ),
        h('span', { class: 'muted small' }, `Buyback: ${RARITIES.map((r) => `${RARITY_LABEL[r]} ${SELL_VALUE[r]}`).join(' · ')}`),
      ),
      grid,
    );
  }

  function render(): void {
    const tabBtn = (id: Tab, label: string) =>
      h('button', { class: `btn ${tab === id ? 'on' : ''}`, onclick: () => { tab = id; message = ''; render(); } }, label);
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
          h('span', { class: 'wallet' }, `${profile.wb} WB`),
          h('span', { class: 'muted' }, `${distinctOwned(profile)} of ${WW2_CARDS.length} cards collected`),
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
