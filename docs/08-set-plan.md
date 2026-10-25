# 08 — Set Plan: 420 Cards per Set

Status: draft v0.1. Every set targets **420 cards** (the floor is 400), with a steep rarity pyramid. The quotas below are enforced in code (`src/cards/plan.ts`, `src/cards/set-plan.test.ts`): a batch that overshoots a quota fails the tests.

## 1. Rarity pyramid

Legendary is the hardest to get, then Epic, Rare, Uncommon and Common. This is true of how many cards exist at each tier *and* of pack drop rates (docs/04 §4).

| Tier | Cards | Share | Per nation | Neutral |
|---|---|---|---|---|
| Common | 190 | 45% | 31 | 35 |
| Uncommon | 115 | 27% | 19 | 20 |
| Rare | 65 | 15% | 11 | 10 |
| Epic | 35 | 8% | 6 | 5 |
| Legendary | 15 | 4% | 3 | 0 |
| **Total** | **420** | | **70** | **70** |

Neutral cards have no Legendaries: the top tier is nation-defining. Commons outnumber Legendaries 12 to 1.

## 2. Card types

| Scope | Buildings | Units | Orders | Total |
|---|---|---|---|---|
| Each nation (x5) | 12 | 42 | 16 | 70 |
| Neutral | 16 | 44 | 10 | 70 |
| **Set** | **76** | **254** | **90** | **420** |

## 3. Unit roles

| Scope | Infantry | Armour | Artillery + Anti-Tank | Air | Support | Total |
|---|---|---|---|---|---|---|
| Each nation | 11 | 9 | 9 | 8 | 5 | 42 |
| Neutral | 10 | 8 | 12 | 6 | 8 | 44 |

## 4. What makes 420 cards distinct

A set of 420 cannot be stat shuffles. Each card must be one of:
1. **A real piece of equipment or unit** with its own identity: its role, cost and keywords come from what it historically did (a Sturmgeschuetz is cheap, tough and has no rotating turret, so it is a defensive Anti-Tank unit, not a second Panzer).
2. **A historical variant** of an existing line (M4 Sherman, then the Firefly with a Piercing gun, then the Easy Eight with more HP). Variants count towards the 420 and are each a separate card with their own budget.
3. **A mechanical niche**: a keyword or effect no other card of that tier does.

New keywords and effects are added to the engine only when a batch needs them, each with tests (no unused mechanics). Candidates, in the order they will be needed:
- death and attack triggers (`onDestroyed`, `onAttack`),
- aura effects (a unit or building that buffs friends in its lane),
- conditional effects (bonus while the HQ is damaged, while outnumbered, on the first turn),
- reveal and hidden-information effects (needed to restore the original Enigma Intercept).

## 5. Power budget

Every card is scored by `src/cards/budget.ts`:
- **Cost** is the sum of resource amounts weighted by scarcity (Manpower 1, Steel 1, Supplies 1, Fuel 1.25).
- **Power** is stats (ATK + HP), Armour (worth more on a sturdier body), keywords, effects, discounts, minus Upkeep.
- **Expected power** is a fitted line through set 1, plus a rarity premium: Common 0, Uncommon +0.5, Rare +1, Epic +1.8, Legendary +3.
- A card passes if its power is within a band of the expected value (units -2.5 to +3, buildings and orders tighter). Expensive units are allowed to be disproportionately strong.

The budget test runs for every card, so a weak or broken card cannot land. It checks cost efficiency only: matchup balance still needs simulation (docs/05 §9), which needs the AI harness.

## 6. Batches

Cards are written and checked in batches by nation, so each batch is small enough to review.

| Batch | Scope | New cards | Already in set 1 |
|---|---|---|---|
| 1 | Neutral | 50 | 20 |
| 2 | USA | 59 | 11 |
| 3 | UK | 61 | 9 |
| 4 | USSR | 60 | 10 |
| 5 | Germany | 62 | 8 |
| 6 | Japan | 65 | 5 |

Per batch:
1. Check the remaining quota per tier, type and role (`remaining()` in `plan.ts`).
2. Add any engine mechanic the batch needs, with tests, before the cards that use it.
3. Write the cards; each must pass `validateCard`, the budget band and the per-card play test.
4. Run the mixed-deck random games with the batch included.
5. When the AI exists: simulate matchups and tune.

## 7. What is not covered yet

- **Art.** 420 cards means 420 pieces of art per set. This is not needed for the engine, but it is the largest cost of the project once the UI starts, so decide the art pipeline before the UI.
- **Matchup balance.** The budget only keeps cards cost-efficient. Balance between nations and roles needs the AI and the simulator.
- **Collection size.** A full 420-card collection takes thousands of packs. The economy (docs/04) leans on the NPC buyback and the player market for this; tune with telemetry.
