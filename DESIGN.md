# WW2 Army Card Game — Design Draft v0.1

A digital, single-player-first card game. Build an army of buildings and units, win matches against AI, earn currency, open packs, trade on a market. Set 1 is World War II.

## 1. Pillars
1. **Economy on the board.** Resources come from Building cards you place, not from a land/mana deck.
2. **Army identity.** Your collection is an army; composition (nations, roles) defines how you play.
3. **Data-driven sets.** New sets are data files, not engine changes.
4. **Never wait for an opponent.** AI (later: ghost armies) fills every seat.

## 2. Match rules (baseline)
- 2 players. Each starts with a **Command Post** (HQ, 20 HP) and a 30-card deck, 5-card opening hand.
- **Win:** reduce the enemy Command Post to 0 HP.
- **Board:** 3 lanes. Each player has a front slot per lane for units, plus up to 6 building slots behind the lines.
- **Turn:** (1) draw, (2) collect resources from buildings, (3) play cards (max 1 Building per turn, any number of Units/Orders you can afford), (4) combat, (5) end.
- **Resources are banked**, cap 10 per type.
- **Combat:** each unit attacks the opposing unit in its lane; if none, it hits the building/HQ per its targeting rules. Units have Attack, HP, and a Role.

## 3. Resources
| Resource | Typical source | Typical use |
|---|---|---|
| Manpower | Barracks, Recruitment Office | Infantry |
| Steel | Steel Mill, Foundry | Armour, artillery, defences |
| Fuel | Oil Derrick, Refinery | Vehicles, aircraft |
| Supplies | Depot, Rail Yard | Support units, Orders |

## 4. Card types
- **Building:** produces resources and/or has a passive (Bunker, Anti-Air, Radar, Hospital).
- **Unit:** costs resources, has Role, Attack, HP, keywords.
- **Order:** one-shot effect (Airstrike, Smoke Screen, Sabotage).

### Roles and counters
Infantry > Artillery > (static defences) ; Armour > Infantry ; Anti-Tank/Air > Armour ; Fighters > Bombers. Exact numbers come from playtesting.

## 5. Nations (set 1)
United States, United Kingdom, Soviet Union, Germany, Japan. Each card has a nation tag.
- Decks are not locked to one nation in v1 (nation = flavour + synergy keywords), so the collection stays flexible.
- Presentation: historical military units, equipment and unit insignia only. **No Nazi party symbols or hate iconography**; keep the framing as a military/strategy game. Check regional rules (e.g. Germany) before any release.

## 6. Economy
- **Earn:** win = full payout, loss = reduced payout, bonus for harder AI.
- **Spend:** booster packs (fixed price, rarity table), player market (later), unit upgrades.
- **Sinks:** pack prices, 5–10% market tax, upgrades. Without sinks, currency inflates.
- **Duplicates:** sell to the system at a fixed floor price per rarity.
- **Army cap:** a points cost per card limits deck strength regardless of collection depth.
- All inventory/currency operations go through an `InventoryService` interface (local first, server later).

## 7. AI and matchmaking
1. Heuristic AI at 3 difficulty levels (score = economy + board + HQ HP).
2. Later: **ghost armies** — saved snapshots of player decks piloted by AI.
3. Later: live PvP; fall back to a ghost after ~10s with no match.

## 8. Technical plan
- TypeScript, web. Pure deterministic engine (`state + action -> state + events`), seeded RNG, no UI/IO.
- Cards: data files (JSON/TS) built from effect primitives + triggers. Sets are modules registered at startup.
- Local persistence in IndexedDB at first; the server implements the same `InventoryService` later.
- Server must re-run the engine to validate results before paying out currency.

## 9. Roadmap
1. Engine types + rules + tests (text-mode game).
2. Set 1 card data (~60 cards: 12 buildings, 36 units, 12 orders).
3. Heuristic AI; AI-vs-AI simulations for balance.
4. Web UI: match view, army builder.
5. Local economy: rewards, packs, selling.
6. Server, accounts, market, ghost armies.
7. Live PvP with AI fallback.

## 10. Open questions
- Exact army size/points cap.
- Air units: lane-ignoring or restricted to hitting specific targets?
- Does each unit also require upkeep (Supplies per turn)?
- Order cards: draw from the same deck or a separate order hand?
- Art pipeline (generated vs commissioned vs stylised vector).
