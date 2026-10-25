import type { BuildingInPlay, Card, UnitInPlay } from '../engine/types';
import { RESOURCE_TYPES } from '../engine/types';
import { keywordsOf } from '../engine/stats';
import { h } from './dom';
import { KEYWORD_INFO, NATION_LABEL, RARITY_LABEL, RESOURCE_SHORT, artUrl, cardRules, cardTypeLine } from './text';

/** Cost as coloured pips: one per resource point. */
export function costPips(cost: Partial<Record<(typeof RESOURCE_TYPES)[number], number>>): HTMLElement {
  const wrap = h('span', { class: 'pips' });
  for (const r of RESOURCE_TYPES) {
    const n = cost[r] ?? 0;
    if (n > 0) wrap.append(h('span', { class: `pip pip-${r}`, title: r }, `${n}${RESOURCE_SHORT[r]}`));
  }
  return wrap;
}

function art(cardId: string): HTMLElement {
  return h('div', { class: 'art', style: `background-image:url(${artUrl(cardId)})` });
}

/** Full-size card face, used in the hand, the collection and the inspector. */
export function cardFace(card: Card, opts: { rules?: boolean; className?: string } = {}): HTMLElement {
  const stats =
    card.type === 'unit'
      ? h('div', { class: 'stats' }, h('span', { class: 'atk' }, `${card.attack}`), h('span', { class: 'hp' }, `${card.hp}`))
      : card.type === 'building'
        ? h('div', { class: 'stats' }, h('span', { class: 'hp' }, `${card.hp}`))
        : null;
  const rules = cardRules(card);
  const prod =
    card.type === 'building'
      ? h('div', { class: 'produces' }, '+', costPips(card.produces))
      : null;
  return h(
    'div',
    { class: `card rarity-${card.rarity} type-${card.type} nation-${card.nation} ${opts.className ?? ''}` },
    h('div', { class: 'card-head' }, h('span', { class: 'card-name' }, card.name), costPips(card.cost)),
    art(card.id),
    h('div', { class: 'card-type' }, `${cardTypeLine(card)} · ${NATION_LABEL[card.nation]}`),
    opts.rules === false ? null : h('div', { class: 'rules' }, ...rules.map((line) => h('p', null, line))),
    prod,
    h('div', { class: 'card-foot' }, h('span', { class: 'rar' }, `${RARITY_LABEL[card.rarity]} · ${card.points} pts`), stats),
  );
}

export interface TileOpts {
  classes?: string[];
  onclick?: () => void;
}

/** A unit on the board. */
export function unitTile(unit: UnitInPlay, attack: number, armour: number, opts: TileOpts = {}): HTMLElement {
  const kws = [...keywordsOf(unit)];
  const damaged = unit.hp < unit.maxHp;
  const status: string[] = [];
  if (unit.fresh) status.push('Fresh');
  if (unit.grounded) status.push('Grounded');
  if (unit.hasAttacked) status.push('Spent');
  return h(
    'div',
    {
      class: ['tile', 'unit', `rarity-${unit.card.rarity}`, unit.owner === 0 ? 'mine' : 'theirs', ...(opts.classes ?? [])].join(' '),
      'data-uid': unit.uid,
      onclick: opts.onclick,
    },
    art(unit.card.id),
    h('div', { class: 'tile-name' }, unit.card.name),
    h(
      'div',
      { class: 'tile-kw' },
      ...(armour > 0 ? [h('span', { class: 'kw', title: 'Armour' }, `Arm ${armour}`)] : []),
      ...kws.map((k) => h('span', { class: 'kw', title: KEYWORD_INFO[k].text }, KEYWORD_INFO[k].name)),
    ),
    status.length > 0 ? h('div', { class: 'tile-status' }, status.join(' · ')) : null,
    h('div', { class: 'stats' }, h('span', { class: 'atk' }, `${attack}`), h('span', { class: `hp ${damaged ? 'damaged' : ''}` }, `${unit.hp}`)),
  );
}

export function buildingTile(b: BuildingInPlay, opts: TileOpts = {}): HTMLElement {
  return h(
    'div',
    {
      class: ['tile', 'building', `rarity-${b.card.rarity}`, b.owner === 0 ? 'mine' : 'theirs', ...(opts.classes ?? [])].join(' '),
      'data-uid': b.uid,
      onclick: opts.onclick,
    },
    art(b.card.id),
    h('div', { class: 'tile-name' }, b.card.name),
    h(
      'div',
      { class: 'tile-kw' },
      ...(b.card.keywords.includes('guard') ? [h('span', { class: 'kw', title: KEYWORD_INFO.guard.text }, 'Guard')] : []),
      ...RESOURCE_TYPES.filter((r) => (b.card.produces[r] ?? 0) > 0).map((r) =>
        h('span', { class: `kw res-${r}` }, `+${b.card.produces[r]} ${RESOURCE_SHORT[r]}`),
      ),
    ),
    h('div', { class: 'stats' }, h('span', { class: `hp ${b.hp < b.maxHp ? 'damaged' : ''}` }, `${b.hp}`)),
  );
}

/** Side-panel preview that follows the pointer over any card. */
export const inspector = {
  el: h('div', { class: 'inspector' }, h('p', { class: 'muted' }, 'Hover a card to read it.')),
  show(card: Card | null): void {
    this.el.replaceChildren(card ? cardFace(card, { className: 'big' }) : h('p', { class: 'muted' }, 'Hover a card to read it.'));
  },
};

/** Wires hover-to-inspect on an element. */
export function inspectOnHover<T extends HTMLElement>(el: T, card: Card): T {
  el.addEventListener('mouseenter', () => inspector.show(card));
  return el;
}
