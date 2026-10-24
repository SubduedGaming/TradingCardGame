import type { Ctx, LaneIndex, PlayerId, Row, UnitCard, UnitInPlay } from './types';
import { newUid } from './zones';

/**
 * The single path by which a unit enters the board (deploy or summon). Places it Fresh, applies the
 * owner's on-entry doctrine bonus and emits `unitDeployed`. The slot must be free.
 */
export function enterBoard(
  ctx: Ctx,
  player: PlayerId,
  card: UnitCard,
  lane: LaneIndex,
  row: Row,
): UnitInPlay {
  const p = ctx.state.players[player];
  const unit: UnitInPlay = {
    uid: newUid(ctx.state),
    owner: player,
    card,
    hp: card.hp,
    maxHp: card.hp,
    fresh: true,
    hasAttacked: false,
    redeployed: false,
    grounded: false,
    tenacityUsed: false,
    tempKeywords: [],
    extraKeywords: [],
    tempAttack: 0,
  };
  p.lanes[lane][row] = unit;

  switch (p.doctrine) {
    case 'uk': // Resolve: +1 HP when deployed while your HQ has 10 HP or less.
      if (p.hq <= 10) {
        unit.hp += 1;
        unit.maxHp += 1;
      }
      break;
    case 'germany': // Combined Arms: the first Armour unit each turn gains Blitz.
      if (card.role === 'armour' && !p.combinedArmsUsed) {
        unit.tempKeywords.push('blitz');
        p.combinedArmsUsed = true;
      }
      break;
    case 'japan': // Spirit of Resilience: units gain Tenacity.
      if (!card.keywords.includes('tenacity')) unit.extraKeywords.push('tenacity');
      break;
    default:
      break;
  }

  ctx.events.push({ type: 'unitDeployed', player, uid: unit.uid, cardId: card.id, lane, row });
  return unit;
}
