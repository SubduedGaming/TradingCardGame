import type { Card, ChosenKind, Effect, Keyword, Nation, Rarity, Resources, ResourceType, TargetSpec } from '../engine/types';
import { RESOURCE_TYPES } from '../engine/types';

export const RESOURCE_LABEL: Record<ResourceType, string> = {
  manpower: 'Manpower',
  steel: 'Steel',
  fuel: 'Fuel',
  supplies: 'Supplies',
};
export const RESOURCE_SHORT: Record<ResourceType, string> = { manpower: 'Mp', steel: 'St', fuel: 'Fu', supplies: 'Su' };

export const NATION_LABEL: Record<Nation, string> = {
  usa: 'United States',
  uk: 'United Kingdom',
  ussr: 'Soviet Union',
  germany: 'Germany',
  japan: 'Japan',
  neutral: 'Neutral',
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

export const KEYWORD_INFO: Record<Keyword, { name: string; text: string }> = {
  blitz: { name: 'Blitz', text: 'Can attack the turn it is deployed.' },
  piercing: { name: 'Piercing', text: 'Ignores Armour.' },
  ranged: { name: 'Ranged', text: 'Can attack from the Rear. Its attacks are not countered.' },
  indirect: { name: 'Indirect', text: 'Ranged, and can target any lane.' },
  precision: { name: 'Precision', text: 'Ranged, and can choose either enemy unit in its lane.' },
  flying: { name: 'Flying', text: 'Ignores Front/Rear and Guard. Can only be targeted by Anti-Air. Not countered by ground units.' },
  antiAir: { name: 'Anti-Air', text: 'Can target Flying units.' },
  fighter: { name: 'Fighter', text: 'Flying and Anti-Air. Deals +2 damage to Flying units.' },
  tenacity: { name: 'Tenacity', text: 'The first time this unit would be destroyed, it survives with 1 HP instead. Once per game.' },
  dugIn: { name: 'Dug In', text: '+1 Armour during the opponent\'s turn.' },
  heavy: { name: 'Heavy', text: 'Cannot be redeployed.' },
  mass: { name: 'Mass', text: '+1 ATK while you control three or more units.' },
  salvo: { name: 'Salvo', text: 'Its attack damages every enemy unit in the target lane.' },
  rally: { name: 'Rally', text: 'The friendly Infantry in the same lane has +1 ATK.' },
  guard: { name: 'Guard', text: 'Breakthrough attacks must target this building first (Flying ignores Guard).' },
};

export const DOCTRINE_INFO: Record<Exclude<Nation, 'neutral'>, { name: string; text: string }> = {
  usa: { name: 'Industrial Might', text: 'Your first Building each turn costs 1 less Supplies.' },
  uk: { name: 'Resolve', text: 'Units start with +1 HP when deployed while your HQ has 14 HP or less.' },
  ussr: { name: 'Mass Mobilisation', text: 'Your Infantry cost 1 less Manpower while you control 3+ units.' },
  germany: { name: 'Combined Arms', text: 'Your first Armour or Air unit deployed each turn gains Blitz.' },
  japan: { name: 'Spirit of Resilience', text: 'Your first Infantry costing 2 or less deployed each turn gains Tenacity.' },
};

export function costText(cost: Partial<Resources>): string {
  const parts = RESOURCE_TYPES.filter((r) => (cost[r] ?? 0) > 0).map((r) => `${cost[r]} ${RESOURCE_SHORT[r]}`);
  return parts.length > 0 ? parts.join(' ') : 'Free';
}

const CHOSEN: Record<ChosenKind, string> = {
  enemyUnit: 'a chosen enemy unit',
  friendlyUnit: 'a chosen friendly unit',
  enemyBuilding: 'a chosen enemy building',
  friendlyBuilding: 'a chosen friendly building',
  enemyUnitOrBuilding: 'a chosen enemy unit or building',
  friendlyLane: 'a chosen friendly lane',
  enemyLane: 'a chosen enemy lane',
  resource: 'a chosen resource',
};

function targetText(t: TargetSpec): string {
  switch (t.kind) {
    case 'self':
      return 'this unit';
    case 'chosen':
      return CHOSEN[t.of];
    case 'autoAlly':
      return t.scope === 'lane' ? 'the most damaged friendly unit in this lane' : 'the most damaged friendly unit';
    case 'allEnemyFrontUnits':
      return 'every enemy Front unit';
    case 'allFriendlyUnits':
      return 'all friendly units';
  }
}

function effectBody(e: Effect): string {
  switch (e.do) {
    case 'damage':
      if (e.target.kind === 'chosen' && e.target.of === 'enemyLane') {
        return `Deal ${e.amount} damage to every enemy unit in a chosen lane${e.ignoresArmour ? ' (ignores Armour)' : ''}`;
      }
      return `Deal ${e.amount} damage to ${targetText(e.target)}${e.ignoresArmour ? ' (ignores Armour)' : ''}`;
    case 'heal':
      return `Restore ${e.amount} HP to ${targetText(e.target)}`;
    case 'draw':
      return `Draw ${e.count} card${e.count === 1 ? '' : 's'}`;
    case 'gain':
      return `Gain ${e.amount} ${RESOURCE_LABEL[e.resource]}`;
    case 'gainChosen':
      return `Gain ${e.amount} of a chosen resource`;
    case 'addMaxHp':
      return `${targetText(e.target)} permanently gains +${e.amount} HP`;
    case 'modifyAttack':
      return `${targetText(e.target)} gains +${e.amount} ATK this turn`;
    case 'grantKeyword':
      return `${targetText(e.target)} gains ${KEYWORD_INFO[e.keyword].name} this turn`;
    case 'destroyBuilding':
      return e.maxHp !== undefined
        ? `Destroy ${targetText(e.target)} with ${e.maxHp} HP or less`
        : `Destroy ${targetText(e.target)}`;
    case 'smoke':
      return 'Enemy Ranged units cannot attack into a chosen lane until your next turn';
    case 'discardRandom':
      return `Your opponent discards ${e.count} random card${e.count === 1 ? '' : 's'}`;
    case 'summonFromDeck':
      return `Put up to ${e.count} ${e.role} unit${e.count === 1 ? '' : 's'} from your deck onto empty slots`;
  }
}

const TRIGGER_PREFIX: Record<Effect['trigger'], string> = {
  onPlay: '',
  onDeploy: 'Deploy: ',
  startOfTurn: 'Start of your turn: ',
  endOfTurn: 'End of your turn: ',
};

export function effectText(e: Effect): string {
  return `${TRIGGER_PREFIX[e.trigger]}${effectBody(e)}.`;
}

/** Rules text lines for a card: keywords, numeric abilities, effects, discounts. */
export function cardRules(card: Card): string[] {
  const lines: string[] = [];
  if (card.type === 'order') {
    for (const e of card.effects) lines.push(effectText(e));
    return lines;
  }
  for (const k of card.keywords) lines.push(`${KEYWORD_INFO[k].name}: ${KEYWORD_INFO[k].text}`);
  if (card.type === 'unit') {
    if (card.armour) lines.push(`Armour ${card.armour}: each hit against it deals ${card.armour} less (minimum 1).`);
    if (card.siege) lines.push(`Siege ${card.siege}: +${card.siege} damage against buildings and HQ.`);
    const upkeep = costText(card.upkeep ?? {});
    if (card.upkeep && upkeep !== 'Free') lines.push(`Upkeep ${upkeep}: if unpaid at your upkeep, it is Grounded for the turn.`);
  } else if (card.aa) {
    lines.push(`AA ${card.aa}: damages an enemy Flying unit at the start of the opponent's Combat phase.`);
  }
  for (const e of card.effects ?? []) lines.push(effectText(e));
  for (const d of card.discounts ?? []) {
    const what = d.applies === 'order' ? 'Orders' : d.applies === 'building' ? 'Buildings' : `${d.applies.role} units`;
    const when = d.minUnits ? ` while you control ${d.minUnits}+ units` : '';
    lines.push(`${d.oncePerTurn ? 'First ' : ''}${what} you play${d.oncePerTurn ? ' each turn' : ''} cost ${d.amount} less ${RESOURCE_LABEL[d.resource]}${when}.`);
  }
  if (card.type === 'building') {
    const prod = costText(card.produces);
    if (prod !== 'Free') lines.unshift(`Produces ${prod} each turn.`);
  }
  return lines;
}

export function cardTypeLine(card: Card): string {
  if (card.type === 'unit') return `Unit — ${card.role === 'antiTank' ? 'Anti-Tank' : card.role[0]!.toUpperCase() + card.role.slice(1)}`;
  return card.type === 'building' ? 'Building' : 'Order';
}

export function artUrl(cardId: string): string {
  return `${import.meta.env.BASE_URL}ww2/${cardId}.webp`;
}
