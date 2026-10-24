export type PlayerId = 0 | 1;

export type ResourceType = 'manpower' | 'steel' | 'fuel' | 'supplies';
export type Resources = Record<ResourceType, number>;
export const RESOURCE_TYPES: readonly ResourceType[] = ['manpower', 'steel', 'fuel', 'supplies'];

export type Nation = 'usa' | 'uk' | 'ussr' | 'germany' | 'japan' | 'neutral';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Role = 'infantry' | 'armour' | 'artillery' | 'antiTank' | 'air' | 'support';

/** Boolean keywords. Parameterised keywords (Armour X, Siege X, Upkeep, AA X) are numeric card fields. */
export type Keyword =
  | 'blitz'
  | 'piercing'
  | 'ranged'
  | 'indirect'
  | 'precision'
  | 'flying'
  | 'antiAir'
  | 'fighter'
  | 'tenacity'
  | 'dugIn'
  | 'heavy'
  | 'mass'
  | 'salvo'
  | 'rally'
  | 'guard';

export type LaneIndex = 0 | 1 | 2;
export const LANES: readonly LaneIndex[] = [0, 1, 2];
export type Row = 'front' | 'rear';
export const ROWS: readonly Row[] = ['front', 'rear'];

// ---------------------------------------------------------------- constants

export const BUILDING_SLOTS = 6;
export const RESOURCE_CAP = 10;
export const HQ_HP = 20;
export const OPENING_HAND = 5;
export const MULLIGAN_MIN_HAND = 3;
export const HAND_LIMIT = 8;
export const TURN_LIMIT = 30;
export const HQ_INCOME: Partial<Resources> = { manpower: 1, supplies: 1 };
export const SECOND_PLAYER_BONUS: Partial<Resources> = { supplies: 1 };
export const REDEPLOY_COST: Partial<Resources> = { supplies: 1 };

// ------------------------------------------------------------------ effects

export type Trigger = 'onPlay' | 'onDeploy' | 'startOfTurn' | 'endOfTurn';

export type ChosenKind =
  | 'enemyUnit'
  | 'friendlyUnit'
  | 'enemyBuilding'
  | 'enemyUnitOrBuilding'
  | 'friendlyLane'
  | 'enemyLane';

export type TargetSpec =
  | { kind: 'self' }
  | { kind: 'chosen'; of: ChosenKind }
  /** Friendly unit with the most missing HP, in the source's lane or anywhere. */
  | { kind: 'autoAlly'; scope: 'lane' | 'any' }
  | { kind: 'allEnemyFrontUnits' };

export type EffectOp =
  | { do: 'damage'; target: TargetSpec; amount: number; ignoresArmour?: boolean }
  | { do: 'heal'; target: TargetSpec; amount: number }
  | { do: 'draw'; count: number }
  | { do: 'gain'; resource: ResourceType; amount: number }
  /** Permanently raises max HP (and current HP). */
  | { do: 'addMaxHp'; target: TargetSpec; amount: number }
  /** Grants a keyword until end of turn. */
  | { do: 'grantKeyword'; target: TargetSpec; keyword: Keyword }
  | { do: 'destroyBuilding'; target: TargetSpec; maxHp?: number }
  /** Enemy Ranged units cannot attack into the chosen lane until the caster's next turn. */
  | { do: 'smoke'; target: TargetSpec };

export type Effect = { trigger: Trigger } & EffectOp;

// -------------------------------------------------------------------- cards

interface CardBase {
  id: string;
  name: string;
  set: string;
  nation: Nation;
  rarity: Rarity;
  /** Points counted against the army cap. */
  points: number;
}

export interface BuildingCard extends CardBase {
  type: 'building';
  cost: Partial<Resources>;
  hp: number;
  produces: Partial<Resources>;
  keywords: Keyword[];
  /** AA X: damages an enemy Flying unit at the start of the opponent's Combat phase. */
  aa?: number;
  effects?: Effect[];
}

export interface UnitCard extends CardBase {
  type: 'unit';
  role: Role;
  cost: Partial<Resources>;
  attack: number;
  hp: number;
  armour?: number;
  siege?: number;
  /** Paid at Upkeep; if unpaid the unit is Grounded for the turn. */
  upkeep?: Partial<Resources>;
  keywords: Keyword[];
  effects?: Effect[];
}

export interface OrderCard extends CardBase {
  type: 'order';
  cost: Partial<Resources>;
  effects: Effect[];
}

export type Card = BuildingCard | UnitCard | OrderCard;

// -------------------------------------------------------------------- state

export interface UnitInPlay {
  uid: string;
  owner: PlayerId;
  card: UnitCard;
  hp: number;
  maxHp: number;
  fresh: boolean;
  hasAttacked: boolean;
  redeployed: boolean;
  grounded: boolean;
  tenacityUsed: boolean;
  /** Keywords granted until end of turn. */
  tempKeywords: Keyword[];
}

export interface BuildingInPlay {
  uid: string;
  owner: PlayerId;
  card: BuildingCard;
  hp: number;
  maxHp: number;
}

export interface Lane {
  front: UnitInPlay | null;
  rear: UnitInPlay | null;
}

export interface PlayerState {
  hq: number;
  resources: Resources;
  deck: Card[];
  hand: Card[];
  discard: Card[];
  lanes: [Lane, Lane, Lane];
  buildings: BuildingInPlay[];
  constructedThisTurn: boolean;
  fatigue: number;
  /** smoke[l] is true while enemy Ranged units may not attack into this player's lane l. */
  smoke: [boolean, boolean, boolean];
  mulliganDone: boolean;
}

export type Phase = 'mulligan' | 'main' | 'combat' | 'discard' | 'ended';

export interface GameState {
  dataVersion: string;
  /** PRNG state (mulberry32). */
  rng: number;
  /** Global turn counter; 0 until the first turn starts. */
  turn: number;
  first: PlayerId;
  active: PlayerId;
  phase: Phase;
  players: [PlayerState, PlayerState];
  winner: PlayerId | 'draw' | null;
  nextUid: number;
}

// ------------------------------------------------------------------ actions

export type TargetRef =
  | { kind: 'unit'; uid: string }
  | { kind: 'building'; uid: string }
  | { kind: 'hq'; player: PlayerId }
  | { kind: 'lane'; lane: LaneIndex };

export type Action =
  | { type: 'mulligan'; player: PlayerId; keep: boolean }
  | { type: 'construct'; player: PlayerId; cardIndex: number }
  | { type: 'deploy'; player: PlayerId; cardIndex: number; lane: LaneIndex; row: Row }
  | { type: 'order'; player: PlayerId; cardIndex: number; targets: TargetRef[] }
  | { type: 'redeploy'; player: PlayerId; unitUid: string; lane: LaneIndex; row: Row }
  | { type: 'attack'; player: PlayerId; unitUid: string; target: TargetRef }
  | { type: 'discard'; player: PlayerId; cardIndex: number }
  | { type: 'endMain'; player: PlayerId }
  | { type: 'endTurn'; player: PlayerId }
  | { type: 'concede'; player: PlayerId };

// ------------------------------------------------------------------- events

export type GameEvent =
  | { type: 'mulligan'; player: PlayerId; kept: boolean }
  | { type: 'turnStarted'; player: PlayerId; turn: number }
  | { type: 'phaseChanged'; phase: Phase }
  | { type: 'unitAdvanced'; player: PlayerId; lane: LaneIndex; uid: string }
  | { type: 'upkeep'; player: PlayerId; uid: string; paid: boolean }
  | { type: 'resourcesProduced'; player: PlayerId; gained: Resources }
  | { type: 'resourcesGained'; player: PlayerId; gained: Resources }
  | { type: 'cardDrawn'; player: PlayerId; cardId: string }
  | { type: 'fatigue'; player: PlayerId; damage: number }
  | { type: 'buildingConstructed'; player: PlayerId; uid: string; cardId: string }
  | { type: 'unitDeployed'; player: PlayerId; uid: string; cardId: string; lane: LaneIndex; row: Row }
  | { type: 'unitRedeployed'; player: PlayerId; uid: string; lane: LaneIndex; row: Row }
  | { type: 'orderPlayed'; player: PlayerId; cardId: string }
  | { type: 'attack'; player: PlayerId; uid: string; target: TargetRef }
  | { type: 'damage'; target: TargetRef; amount: number }
  | { type: 'healed'; uid: string; amount: number }
  | { type: 'tenacity'; uid: string }
  | { type: 'unitDestroyed'; player: PlayerId; uid: string; cardId: string }
  | { type: 'buildingDestroyed'; player: PlayerId; uid: string; cardId: string }
  | { type: 'discarded'; player: PlayerId; cardId: string }
  | { type: 'turnEnded'; player: PlayerId }
  | { type: 'gameEnded'; winner: PlayerId | 'draw'; reason: 'hq' | 'concede' | 'turnLimit' };

/** Mutable working context used while resolving a single action. */
export interface Ctx {
  state: GameState;
  events: GameEvent[];
}
