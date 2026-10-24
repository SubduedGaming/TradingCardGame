import type { Card, Effect, Rarity } from './types';

export const DECK_MIN = 30;
export const DECK_MAX = 40;
export const POINTS_CAP = 100;
export const BUILDINGS_MIN = 6;
export const BUILDINGS_MAX = 12;
export const ORDERS_MAX = 10;

export const POINTS_BY_RARITY: Record<Rarity, number> = {
  common: 2,
  uncommon: 3,
  rare: 5,
  legendary: 8,
};

export const COPY_LIMIT_BY_RARITY: Record<Rarity, number> = {
  common: 3,
  uncommon: 3,
  rare: 2,
  legendary: 1,
};

function effectErrors(card: Card, effects: Effect[]): string[] {
  const errors: string[] = [];
  const isOrder = card.type === 'order';
  const isUnit = card.type === 'unit';
  for (const e of effects) {
    if (e.trigger === 'onPlay' && !isOrder) {
      errors.push(`${card.id}: onPlay effects are only supported on orders`);
    }
    if (e.trigger === 'onDeploy' && !isUnit) {
      errors.push(`${card.id}: onDeploy effects are only supported on units`);
    }
    if (isOrder && e.trigger !== 'onPlay') {
      errors.push(`${card.id}: orders only have onPlay effects`);
    }
    if (!('target' in e)) continue;
    const t = e.target;
    if (t.kind === 'chosen' && e.trigger !== 'onPlay' && e.trigger !== 'onDeploy') {
      errors.push(`${card.id}: chosen targets are only supported on onPlay and onDeploy effects`);
    }
    if (t.kind === 'chosen' && (t.of === 'resource') !== (e.do === 'gainChosen')) {
      errors.push(`${card.id}: only gainChosen takes a chosen resource, and it requires one`);
    }
    if (e.do === 'gainChosen' && t.kind !== 'chosen') {
      errors.push(`${card.id}: gainChosen needs a chosen resource target`);
    }
    if (t.kind === 'self' && isOrder) {
      errors.push(`${card.id}: orders have no source for a self target`);
    }
    if (t.kind === 'autoAlly' && t.scope === 'lane' && !isUnit) {
      errors.push(`${card.id}: lane-scoped autoAlly needs a unit source`);
    }
    if (e.do === 'smoke' && t.kind !== 'chosen') {
      errors.push(`${card.id}: smoke must use a chosen lane`);
    }
  }
  return errors;
}

/** Static checks on a card definition. Returns a list of problems (empty if the card is valid). */
export function validateCard(card: Card): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9]+\.(building|unit|order)\.[a-z0-9-]+$/.test(card.id)) {
    errors.push(`${card.id}: id must look like set.type.kebab-name`);
  } else if (card.id.split('.')[1] !== card.type) {
    errors.push(`${card.id}: id type segment does not match card type '${card.type}'`);
  }
  if (card.points !== POINTS_BY_RARITY[card.rarity]) {
    errors.push(`${card.id}: ${card.rarity} cards cost ${POINTS_BY_RARITY[card.rarity]} points`);
  }
  const costTotal = Object.values(card.cost).reduce((a, b) => a + b, 0);
  if (costTotal < 1) errors.push(`${card.id}: cost must be at least 1 resource`);
  if (Object.values(card.cost).some((v) => v < 0)) errors.push(`${card.id}: negative cost`);

  if (card.type === 'unit') {
    if (card.hp < 1) errors.push(`${card.id}: hp must be at least 1`);
    if (card.attack < 0) errors.push(`${card.id}: attack cannot be negative`);
    if (card.keywords.includes('guard')) errors.push(`${card.id}: only buildings can have guard`);
  }
  if (card.type === 'building') {
    if (card.hp < 1) errors.push(`${card.id}: hp must be at least 1`);
    for (const k of card.keywords) {
      if (k !== 'guard') errors.push(`${card.id}: buildings only support the guard keyword (got ${k})`);
    }
  }
  if (card.type === 'order' && !card.effects.some((e) => e.trigger === 'onPlay')) {
    errors.push(`${card.id}: orders need an onPlay effect`);
  }
  if (card.type !== 'order') {
    for (const d of card.discounts ?? []) {
      if (d.amount < 1) errors.push(`${card.id}: discounts must reduce cost by at least 1`);
    }
  }
  errors.push(...effectErrors(card, card.type === 'order' ? card.effects : (card.effects ?? [])));
  return errors;
}

/** Army rules from docs/02 section 5. Returns a list of problems (empty if the deck is legal). */
export function validateDeck(cards: Card[]): string[] {
  const errors: string[] = [];
  if (cards.length < DECK_MIN || cards.length > DECK_MAX) {
    errors.push(`deck must have ${DECK_MIN}-${DECK_MAX} cards (has ${cards.length})`);
  }

  const points = cards.reduce((sum, c) => sum + c.points, 0);
  if (points > POINTS_CAP) errors.push(`deck costs ${points} points (cap ${POINTS_CAP})`);

  const copies = new Map<string, { card: Card; n: number }>();
  for (const c of cards) {
    const entry = copies.get(c.id);
    if (entry) entry.n += 1;
    else copies.set(c.id, { card: c, n: 1 });
  }
  for (const { card, n } of copies.values()) {
    const limit = COPY_LIMIT_BY_RARITY[card.rarity];
    if (n > limit) errors.push(`${card.id}: ${n} copies (limit ${limit} for ${card.rarity})`);
  }

  const buildings = cards.filter((c) => c.type === 'building').length;
  if (buildings < BUILDINGS_MIN || buildings > BUILDINGS_MAX) {
    errors.push(`deck must have ${BUILDINGS_MIN}-${BUILDINGS_MAX} buildings (has ${buildings})`);
  }
  const orders = cards.filter((c) => c.type === 'order').length;
  if (orders > ORDERS_MAX) errors.push(`deck has ${orders} orders (max ${ORDERS_MAX})`);
  return errors;
}
