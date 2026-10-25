# WW2 Army Card Game — Design Index

A digital, single-player-first card game. Build an army of buildings and units, win matches against AI, earn War Bonds, open packs and trade on a market. Set 1 is World War II with historical nations (USA, UK, USSR, Germany, Japan). Later: ghost armies and live PvP, with AI filling any empty seat.

## Documents

| # | Doc | Contents |
|---|---|---|
| 01 | [Core rules](docs/01-core-rules.md) | Zones, setup, turn phases, resources, lanes, combat, targeting, timing, end conditions, tunable constants |
| 02 | [Cards and keywords](docs/02-cards-and-keywords.md) | Card anatomy, roles, rarity, nation doctrines, deck rules, keyword glossary, effect system |
| 03 | [Set 1: WW2](docs/03-set1-ww2.md) | Starter army and the 63-card launch core (the set grows to 420, see 08) |
| 04 | [Economy](docs/04-economy.md) | War Bonds, packs, pity, NPC buyback, player market, anti-abuse |
| 05 | [AI and matchmaking](docs/05-ai-and-matchmaking.md) | Difficulty tiers, evaluation, ghost armies, queue/filler logic, balance simulation |
| 06 | [Technical architecture](docs/06-technical-architecture.md) | Engine API, effect interpreter, services, server, testing, build order |
| 07 | [UI / UX](docs/07-ui-ux.md) | Screens, match layout, card frame, deck builder, accessibility |
| 08 | [Set plan](docs/08-set-plan.md) | 420 cards per set, five-tier rarity pyramid, quotas, power budget, batches |

## Core design in one paragraph
Each player has a Command Post (20 HP). Buildings produce four banked resources (Manpower, Steel, Fuel, Supplies); units cost those resources and fight in three lanes, each with a Front and Rear slot. Armour, Piercing, Ranged, Flying and Anti-Air create a readable counter web. Units that find an empty lane break through to hit the HQ or a building. Win by destroying the enemy Command Post.

## Decisions made (see docs for detail)
- Combat model: army on a 3-lane board, Front/Rear slots, banked resources, one Building per turn.
- Win condition: destroy the enemy Command Post.
- Air units: Flying, ignore lanes/Guard, pay Fuel Upkeep.
- Army cap: 100 points, 30–40 cards, copy limits by rarity.
- Orders: Main phase only; no reactions in set 1.
- Currency: soft currency only (War Bonds); no real-money purchases.
- Content: historical equipment and military units; no Nazi party symbols or hate iconography.

## Open questions
- Final numbers: HQ HP, costs, stats and drop rates all need simulation (doc 05 §9).
- Whether to add Reaction Orders in set 2 (doc 01 §14).
- Art pipeline (generated, commissioned or stylised vector).
- Server hosting and whether to import offline progress when accounts launch (doc 06 §6).
- Regional compliance review for WW2 content before any public release.

## Roadmap
1. Engine: state, phases, resources, lanes, combat, keywords, with tests.
2. Set 1 data and validator.
3. AI (Recruit, Veteran) and simulation harness; first balance pass.
4. Web UI: match view, deck builder, shop.
5. Local economy loop.
6. Server, accounts, ledger, market, ghost armies.
7. Live PvP with AI fallback.
