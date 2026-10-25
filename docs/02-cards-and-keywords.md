# 02 — Cards, Keywords and Deck Building

Status: draft v0.2.

## 1. Card anatomy

Every card has:

| Field | Description |
|---|---|
| `id` | Stable unique string, e.g. `ww2.unit.rifle-squad`. Never reused or changed after release. |
| `name` | Display name. |
| `set` | Set code, e.g. `ww2`. |
| `type` | `building`, `unit`, or `order`. |
| `nation` | `usa`, `uk`, `ussr`, `germany`, `japan`, or `neutral`. |
| `rarity` | `common`, `uncommon`, `rare`, `epic`, `legendary`. |
| `points` | Army-cap cost (see §5). |
| `cost` | Resources to play (buildings, units, orders). |
| `text` | Rules text, generated from keywords and effects where possible. |
| `art` | Asset key. |
| `flavour` | Optional historical line. |

Type-specific:
- **Building:** `hp`, `produces`, `keywords`, optional `effects`.
- **Unit:** `role`, `attack`, `hp`, `keywords`, optional `effects`.
- **Order:** `effects`.

## 2. Roles (units)

| Role | Identity | Typical resources |
|---|---|---|
| Infantry | Cheap, flexible, weak to Armour | Manpower |
| Armour | Tough frontline, strong vs Infantry | Steel + Fuel |
| Artillery | Ranged, hits from the Rear, fragile | Steel + Supplies |
| Anti-Tank | Piercing answer to Armour | Steel (+ Manpower) |
| Air | Flying, ignores lanes, costs Fuel upkeep | Fuel (+ Steel) |
| Support | Heals, buffs, cost reduction | Manpower + Supplies |

Rock-paper-scissors tendencies (not hard rules): Infantry beat Artillery (rush it) and Anti-Tank; Armour beats Infantry; Anti-Tank and Air beat Armour; Fighters beat Bombers; Anti-Air beats Air; Artillery beats static defences and Infantry blobs.

## 3. Rarity

Five tiers, each much scarcer than the one below: Legendary is the hardest to get, then Epic, Rare, Uncommon and Common. The scarcity applies both to how many cards of that tier exist (docs/08) and to how often they drop from packs (docs/04).

| Rarity | Cards in a 420-card set | Pack drop (per card slot) | Points | Copy limit | Typical power |
|---|---|---|---|---|---|
| Common | 190 | very frequent | 2 | 3 | Efficient, simple |
| Uncommon | 115 | frequent | 3 | 3 | Tactical keywords |
| Rare | 65 | uncommon | 5 | 2 | Strong, unusual effects |
| Epic | 35 | rare | 7 | 2 | Build-around effects |
| Legendary | 15 | very rare | 10 | 1 | Game-defining |

Rarity changes *complexity and flair* and gets a larger power budget (`RARITY_PREMIUM` in `src/cards/budget.ts`), but a higher tier is not strictly better than a lower one: it unlocks plays commons can't.

## 4. Nation doctrines

A **doctrine** is a passive bonus unlocked when a deck contains at least **10 cards of one nation** (neutral cards don't count). Only one doctrine is active per deck: the nation with the most cards. If two nations tie for the most, no doctrine is active until the player picks one explicitly (`GameConfig.doctrines`); choosing a nation the deck does not qualify for is an error.

| Nation | Doctrine | Effect | Fantasy |
|---|---|---|---|
| USA | **Industrial Might** | Your first Building each turn costs 1 less Supplies (min 0 Su, still ≥1 total). | Production and logistics |
| UK | **Resolve** | Units start with +1 HP when deployed while your HQ has ≤ 10 HP. | Stubborn defence, intelligence |
| USSR | **Mass Mobilisation** | Your Infantry cost 1 less Manpower if you control 3+ units (min 1). | Swarms and attrition |
| Germany | **Combined Arms** | Your first Armour unit deployed each turn gains Blitz. | Fast, tight combos |
| Japan | **Spirit of Resilience** | Units gain Tenacity if they don't already have it, once per game each. | Fight-to-the-end durability |

Doctrines are chosen to make a nation's deck play differently without locking it to a single colour. Mixed-nation decks are allowed, and doctrines are the reward for focusing.

## 5. Deck (army) building rules

| Rule | Value |
|---|---|
| Deck size | min 30, max 40 |
| Copy limits | by rarity (§3) |
| **Army points cap** | **100** |
| Building count | min 6, max 12 (so every deck has an economy) |
| Order count | max 10 |
| Starter army | 30 cards, 60 points, all Neutral |

Each card has a `points` value by rarity (table in §3). A 30-card deck of all Commons costs 60 points; the cap makes it impossible to run a full deck of rares, epics and legendaries, so collection depth increases *options*, not just raw power.

Example: 13 Common (26) + 10 Uncommon (30) + 4 Rare (20) + 2 Epic (14) + 1 Legendary (10) = 100 points, 30 cards.

## 6. Keyword glossary

### Unit keywords
| Keyword | Rules text |
|---|---|
| **Armour X** | Damage from each hit this unit takes is reduced by X, minimum 1. |
| **Blitz** | Can attack the turn it is deployed. |
| **Piercing** | Ignores Armour. |
| **Ranged** | Can attack from the Rear. Attacks from Ranged are not countered. |
| **Indirect** | Ranged, and can target any lane. |
| **Precision** | Ranged, and can choose either enemy unit in its lane. |
| **Siege X** | +X damage against buildings and HQ. |
| **Flying** | Ignores Front/Rear and Guard; can only be targeted by Anti-Air; not countered by ground units. |
| **Anti-Air** | Can target Flying units. |
| **Fighter** | Flying and Anti-Air; deals +2 damage to Flying units. |
| **Tenacity** | The first time this unit would be destroyed, it survives with 1 HP instead. Once per game. |
| **Dug In** | +1 Armour during the opponent's turn. |
| **Heavy** | Cannot be Redeployed. |
| **Upkeep (R X)** | At your Upkeep, pay X of resource R or the unit is Grounded this turn. |
| **Mass** | +1 ATK while you control three or more units. |
| **Salvo** | Attack deals its damage to every enemy unit in the target lane (each applies Armour separately). |
| **Rally** | Other friendly Infantry in the same lane have +1 ATK. |

### Building keywords
| Keyword | Rules text |
|---|---|
| **Guard** | Enemy Breakthrough attacks must target a Guard building before other buildings or the HQ. |
| **Produces** | Adds listed resources during the Production phase. |
| **AA X** | At the start of the opponent's Combat phase, deals X damage to one enemy Flying unit (owner chooses). |

### Statuses
| Status | Effect | Cleared |
|---|---|---|
| **Fresh** | Cannot attack. | End of the owner's turn. |
| **Grounded** | Cannot attack (unpaid Upkeep). | Next Upkeep. |

## 7. Effect system

Cards are described as data: **triggers** (when) + **conditions** (if) + **effects** (what) + **targets** (who). This is the contract between content and engine; sets add data, not code.

### Triggers
`onPlay`, `onDeploy`, `onDestroyed`, `onDamaged`, `startOfTurn`, `endOfTurn`, `startOfOpponentCombat`, `onAttack`, `whileInPlay` (static).

### Effect primitives
| Primitive | Parameters |
|---|---|
| `damage` | target, amount, `ignoresArmour?` |
| `heal` | target, amount |
| `draw` | player, count |
| `discard` | player, count / filter, `random?` |
| `gainResource` | player, resource, amount |
| `modifyStat` | target, stat, amount, duration (`turn`/`permanent`/`whileInPlay`) |
| `grantKeyword` | target, keyword, duration |
| `destroy` | target |
| `summon` | card id, slot, player |
| `setStatus` | target, status |
| `reveal` | player, zone |
| `search` | player, zone, filter, destination |

### Targets
`self`, `thisLane`, `adjacentLane`, `anyLane`, `enemyUnit`, `friendlyUnit`, `enemyBuilding`, `friendlyBuilding`, `enemyHQ`, `allEnemyUnits`, `allFriendlyInfantry`, filters by `role`/`nation`/`keyword`/`rarity`.

### Example (JSON-ish)
```json
{
  "id": "ww2.order.air-raid",
  "type": "order",
  "cost": { "supplies": 2, "fuel": 1 },
  "effects": [
    { "do": "damage", "target": { "any": ["enemyUnit", "enemyBuilding"] }, "amount": 3 }
  ]
}
```

## 8. Naming, IDs and versioning

- IDs are `set.type.kebab-name` and **never change**.
- Rebalancing edits card data in place; the data carries a `dataVersion`. Match logs store the `dataVersion` they used so old replays remain reproducible.
- Errata: a card may be rebalanced via patch; players do not lose owned copies when stats change.
- A card is never deleted; deprecated cards are flagged `retired: true` and keep working in saved decks with a warning.

## 9. Content guidelines (set 1 historical theme)

- Use real equipment, units and operations. Flavour text should be historical and not celebratory of any regime.
- **Do not depict swastikas, SS runes, or other Nazi party symbols.** Wehrmacht-era vehicles use neutral markings (e.g. plain cross or none) or none at all. Do not depict atrocities.
- Nation-themed cards represent *militaries and equipment*, not ideologies.
- Keep a regional-compliance checklist before any public release (e.g. Germany's rules on Nazi symbols, various storefronts' policies on WW2 content).
