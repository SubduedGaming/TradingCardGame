# 04 — Economy, Collection and Market

Status: draft v0.2. All numbers are starting points to tune against telemetry. Currency is called **War Bonds (WB)**. It is **soft currency only**: no real-money purchases are planned (hobby project).

## 1. Goals
1. Winning feels rewarding; losing is not punished into stagnation.
2. Collection grows steadily as new sets are added, without devaluing old cards.
3. The market is useful but cannot be gamed into runaway inflation.
4. The system works fully offline (local) first, then moves behind a server without design changes.

## 2. Income

| Source | Reward |
|---|---|
| Win vs Easy AI | 40 WB |
| Win vs Normal AI | 60 WB |
| Win vs Hard AI | 90 WB |
| Win vs ghost army / PvP | 70 WB + 0.5 × opponent-rating-delta bonus (max +40) |
| Loss (any) | 15 WB |
| Draw | 25 WB |
| First win of the day | +50% (rounded up) |
| Daily login | 20 WB |

**Anti-farm:** rewards vs AI decay after 10 AI wins in a rolling hour (×0.5) and 20 (×0.25), resetting hourly. Prevents "leave the bot running" income. PvP is not decayed.

## 3. Sinks

| Sink | Cost |
|---|---|
| Standard Pack | 100 WB |
| Market tax | 8% of sale price, removed from the economy |
| Deck slot (beyond 3 free) | 150 WB each |
| Card upgrade ("Veteran", cosmetic only) | 50–400 WB by rarity |
| Re-roll a Daily Contract | 10 WB |

Target ratio: an average player earns ~**350 WB/day** (5–6 matches) and spends ~**95%** of it. Monitor net WB in circulation per active player; if it grows >10% week over week, raise sinks.

## 4. Booster packs

A **Standard Pack** has **5 cards**:

| Slot | Distribution |
|---|---|
| 1–3 | Common (100%) |
| 4 | Uncommon 78% · Rare 18% · Epic 3.5% · Legendary 0.5% |
| 5 (wildcard) | Common 55% · Uncommon 30% · Rare 11.5% · Epic 3% · Legendary 0.5% |

Expected per pack: 3.55 Commons, 1.08 Uncommons, 0.295 Rares, 0.065 Epics, 0.01 Legendaries. That is a Legendary roughly once per 100 packs and an Epic once per ~15. Within a tier every card is equally likely, so one specific Legendary of the 15 is about 1 in 1,500 packs without pity.

**Pity rules** (per player, per pack type):
- At least one **Rare or better** in every 8 packs.
- At least one **Epic or better** in every 40 packs.
- At least one **Legendary** in every 120 packs.
- A pack never contains duplicates of a Legendary the player already owns until they've seen all Legendaries in the set (soft "dupe protection").

Pack contents are generated with a seeded RNG recorded in the player's ledger so results are verifiable server-side.

**Set-targeted packs:** each set has its own pack. The shop sells the newest set's pack plus an "All Sets" pack at +20% price.

## 5. Selling to the system (NPC buyback)

| Rarity | Sell value |
|---|---|
| Common | 5 WB |
| Uncommon | 15 WB |
| Rare | 50 WB |
| Epic | 150 WB |
| Legendary | 500 WB |

Starter Army cards are marked `starter: true`; selling the *last copy* of a starter card is allowed (players may rebuild), but they sell at half value to discourage "sell starter → buy packs" loops on day one.

## 6. Player market

### 6.1 Rules
- Players list cards at a **fixed price** (no auctions in v1).
- **Price bounds** per rarity prevent absurd listings:

| Rarity | Min price | Max price |
|---|---|---|
| Common | 8 | 60 |
| Uncommon | 25 | 200 |
| Rare | 80 | 800 |
| Epic | 300 | 2500 |
| Legendary | 1000 | 10000 |

  The floor is above NPC sell value so selling to players always beats selling to the system; the ceiling stops runaway scarcity speculation.
- Max **20 active listings** per player.
- Listings expire after 14 days and return the card.
- Buyer pays price; seller receives price × 0.92. The 8% is burned.
- Cards in a saved deck can't be listed (the UI prompts to remove from deck).

### 6.2 Anti-abuse
- No direct player-to-player gifting or trades (prevents win-trading and alt-account funnels).
- Purchases and listings are recorded in an append-only **ledger** (see doc 06).
- Rate limits: 30 market actions per minute per account.
- Price history is public; suspicious patterns (A buys from B repeatedly at max price) are flagged.

### 6.3 Pre-server (offline) market
Until the server exists, a **simulated market** with NPC sellers keeps the UI testable: each rarity has a rotating stock at base prices that changes daily. The `MarketService` interface is the same.

## 7. Dust / duplicate handling
Duplicates beyond the deck copy limit are surfaced in the collection screen with a "Sell extras" button (keeps the best N per card). Bulk-sell is one click and shows the total.

## 8. Progression and goals
- **Daily contracts** (3 per day): e.g. "Win a match using 3+ Armour units: 60 WB". Re-rollable.
- **Rank ladder** vs AI tiers: each tier is a named AI opponent with a themed deck. Beating a tier the first time gives a one-off bonus (100 WB + a free pack).
- **Collection milestones:** own N distinct cards of a set → one-off rewards.

## 9. Economy of new sets
- A new set arrives with its own pack and cards; old sets' packs remain purchasable.
- Old-set cards keep their value because (a) the army points cap stops pure power creep, (b) every set is designed to *add options*, not outclass earlier cards, and (c) the "All Sets" pack gives older cards new life.
- Set rotation is **not** planned. If power creep becomes a problem, ban-and-rebalance via data patches (doc 02 §8) rather than rotating.

## 10. Starting state
- New account: Starter Army (30 cards), 200 WB, one free Standard Pack, three deck slots.
- Tutorial matches (3 scripted opponents) grant 50 WB each, first time only.

## 11. Telemetry to collect (for tuning)
- WB earned/spent per day, per source and sink.
- Pack opens per player per day; time to first Rare / Legendary.
- Win rates per card, per nation, per archetype.
- Market: listings, average sale time, price-to-floor ratio.
- Match length, first-player win rate, concede rate.

## 12. Implemented

`src/economy` (pure logic, tested) and `src/server` (the account's profile is stored server-side as JSON, with an append-only ledger of the last 500 entries). The browser holds no economy state.

- **Done:** War Bonds income per AI tier (Recruit 40, Veteran 60, Commander 90, Marshal 120) and PvP (70 + up to 40 for facing a higher rating), first win of the day (+50%, rounded up), daily login (+20), anti-farm decay for AI wins (x0.5 after 10 wins in an hour, x0.25 after 20; not applied to PvP); Standard Pack with the documented slot odds, pity (Rare 8, Epic 40, Legendary 120) and Legendary dupe protection, the seed stored in the ledger; NPC buyback with starter copies at half value; "sell extras"; starter army (30 cards of a chosen nation), 200 WB and one free pack; armies can only use owned cards (checked by the server before a match); NPC traders with a daily stock; the **player market**: fixed-price listings within the rarity bounds, 8% tax, 20 listings per account, 14-day expiry, cards reserved by a saved army cannot be listed.
- **Not built:** deck slots beyond 3 (decks are unlimited for now), cosmetic upgrades, daily contracts, the AI-tier ladder bonus, collection milestones, tutorial matches, set-targeted / "All Sets" packs, the ledger as a separate table, price history and abuse flags.
- **Note:** a conceded match pays the loss reward (15 WB); leaving a match from the menu is not possible while it is running.
