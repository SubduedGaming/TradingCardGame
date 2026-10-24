export type ResourceType = 'manpower' | 'steel' | 'fuel' | 'supplies';
export type Resources = Record<ResourceType, number>;

export type Nation = 'usa' | 'uk' | 'ussr' | 'germany' | 'japan' | 'neutral';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Role = 'infantry' | 'armour' | 'artillery' | 'air' | 'support';

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
  hp: number;
  produces: Partial<Resources>;
}

export interface UnitCard extends CardBase {
  type: 'unit';
  role: Role;
  cost: Partial<Resources>;
  attack: number;
  hp: number;
  keywords: string[];
}

export interface OrderCard extends CardBase {
  type: 'order';
  cost: Partial<Resources>;
  effect: string;
}

export type Card = BuildingCard | UnitCard | OrderCard;

export const LANE_COUNT = 3;
export const BUILDING_SLOTS = 6;
export const RESOURCE_CAP = 10;
export const HQ_HP = 20;

export interface UnitInPlay {
  uid: string;
  card: UnitCard;
  hp: number;
}

export interface BuildingInPlay {
  uid: string;
  card: BuildingCard;
  hp: number;
}

export interface PlayerState {
  hqHp: number;
  resources: Resources;
  deck: Card[];
  hand: Card[];
  discard: Card[];
  lanes: (UnitInPlay | null)[];
  buildings: BuildingInPlay[];
}

export interface GameState {
  seed: number;
  turn: number;
  active: 0 | 1;
  players: [PlayerState, PlayerState];
  winner: 0 | 1 | null;
}

export type Action =
  | { type: 'playBuilding'; cardIndex: number }
  | { type: 'playUnit'; cardIndex: number; lane: number }
  | { type: 'playOrder'; cardIndex: number; target?: number }
  | { type: 'endTurn' };
