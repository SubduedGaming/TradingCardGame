# 05 — AI, Matchmaking and Balance Simulation

Status: draft v0.2.

## 1. Role of the AI
The AI has three jobs: (1) the single-player opponent, (2) the "seat filler" for matchmaking when no human is available, and (3) a **balance instrument** that plays thousands of games to tune the card set. The same engine API drives all three, so AI strength improvements help all of them.

## 2. Engine interface the AI uses
- `legalActions(state, player): Action[]` — all legal actions in the Main phase and Combat phase.
- `apply(state, action): { state, events }` — pure, deterministic.
- `cloneState`, `hashState` — for search and transposition tables.
- Hidden information: the AI never reads the opponent's hand or deck directly. It receives an **observation** (public state + its own hand) and uses *determinisation* (sampling plausible opponent hands) when searching.

## 3. Difficulty tiers

| Tier | Behaviour | Target win rate vs starter army |
|---|---|---|
| **Recruit** (Easy) | Random legal action with a priority bias (build economy early, then deploy affordable units, attack when it deals damage without dying). 15% chance to make a deliberate "mistake" (skip an attack, play a worse card). | Starter wins ~70% |
| **Veteran** (Normal) | Greedy 1-ply: scores every legal action by the evaluation function (§4) and picks the best, sequencing a full turn. Remembers opponent's played nations. | Starter wins ~45% |
| **Commander** (Hard) | Beam search over whole-turn action sequences, evaluating resulting states plus a 1-turn opponent response by sampling plausible plays (determinised). | Starter wins ~15% |
| **Marshal** (later) | MCTS with learned or tuned rollouts (ISMCTS). Optional, post-launch. | n/a |

Each difficulty also uses a different **deck** (§6) so tiers feel distinct, not just smarter.

## 4. Evaluation function

For a state `s` from player `p`'s view:

```
score(s) =
    w_hq    * (hp_hq(p) - hp_hq(opp))                       // life race
  + w_inc   * (income(p) - income(opp))                     // economy, weighted by turn
  + w_board * (boardValue(p) - boardValue(opp))             // units + buildings
  + w_hand  * (playableHandValue(p) - estimatedHand(opp))   // cards that can be used
  + w_tempo * (spendableResources(p) - spendableResources(opp))
  - w_risk  * exposedLethal(p)                               // can opponent kill me next turn
  + w_win   * (opp HQ dead) - w_win * (my HQ dead)
```

- `boardValue(unit) = (ATK*α + HP*β + keywordBonus) * roleCounterModifier(vs enemy composition)`.
- `income` weights shrink late-game (turn > 10) as the match shifts to damage.
- Weights start hand-tuned and are later optimised by **self-play tuning** (CMA-ES / hill climbing on weights over simulated matches).

## 5. Turn planning
A turn is a sequence of Main-phase actions followed by Combat. The AI plans in order:
1. **Economy decision:** choose a Construct (or none) using projected resource needs for the best cards in hand.
2. **Deploy plan:** choose a set of affordable units/orders maximising `score` after deployment (knapsack-style search with pruning).
3. **Assault plan:** for each ready unit, choose attack (or hold) based on trade value, lethal checks, and defensive needs.
4. **Safety check:** reject plans that leave the AI exposed to lethal if a safer alternative scores within a margin.

Commander tier searches steps 2–3 jointly with beam width ~20 and evaluates leaves with a 1-turn opponent response.

## 6. AI decks and opponents
- A roster of named AI opponents with themed decks, one per nation plus neutral:
  - *Recruit tier:* "Raw Recruits" (neutral), "Home Guard" (UK, defensive), "Peasant Levy" (USSR, swarm).
  - *Veteran tier:* "Afrika Korps" (Germany armour), "Marine Raiders" (USA, balanced), "Imperial Guard" (Japan).
  - *Commander tier:* nation decks near the 100-point cap with a doctrine.
- AI decks are built from the same cards and obey the same deck rules, so AI cannot cheat on composition. The AI plays by the same rules (no resource or draw bonuses) at all difficulties.
- Opponent decks are fixed data (not tied to the player's collection) so they can be balanced and referred to in daily contracts.

## 7. Ghost armies (phase 2)
A **ghost** is a snapshot of a real player's saved deck (and optionally their play style profile) piloted by Veteran or Commander AI.

- Snapshots are taken when a player saves a deck that has been used in ≥ 3 matches.
- Snapshots are anonymised: the opponent sees the player's display name and rating *only if the owner opted in*; otherwise "Ghost Army".
- Ghosts earn the owner a small passive reward when they win vs players (≤ 10 WB per win, cap 100 WB/day) to give owners a reason to opt in.
- Style profile (optional): aggression, economy preference, preferred lane. Learned from the owner's match history by simple frequency stats, then used to bias the AI's weights.

## 8. Matchmaking (phase 3)

### 8.1 Rating
Glicko-2 per player, separate ratings for PvE-ladder (vs AI) and PvP. New players start at 1500 with high deviation.

### 8.2 Queue algorithm
1. Player enters the queue with a deck.
2. Server looks for human opponents within a rating window starting at ±100 and expanding by +50 every 3 seconds, up to ±400.
3. If no human match is found within **10 seconds**, the server assigns a **filler**:
   - Preferred: a ghost army of a player near the player's rating.
   - Fallback: a named AI opponent whose tier matches.
4. The seat label shows **"Ghost Army"** or **"AI"** (transparent). Rewards are the same regardless.
5. If a human enters the queue while a filler match is *not yet started*, matching is re-evaluated.

### 8.3 Rating updates
- Matches vs humans update both players' PvP ratings.
- Matches vs ghosts update the player's PvP rating at **half weight** and the ghost owner's rating by a small passive amount (optional).
- Matches vs AI do not change PvP rating; they update the PvE ladder progress.

### 8.4 Anti-abuse
- Win-trading: detect repeated pairings of the same two accounts with alternating results; reduce rewards.
- AI farming: diminishing returns (doc 04 §2).
- Disconnection: a player who disconnects forfeits after 60 seconds; the AI cannot take over mid-match for rated PvP (it would blur the rating). For casual matches the AI **may** take over the disconnected seat.

## 9. Balance simulation

### 9.1 Harness
- A headless runner plays N matches with fixed seeds between two AI agents + two decks.
- Outputs: win rate by seat, by deck, by card; average turns; average resources spent; per-card "played vs won" statistics.
- CI job runs a nightly 10,000-match sweep and reports regressions in first-player win rate (target 47–53%) and deck archetype win rates (target 45–55% for archetypes at equal skill).

### 9.2 What to watch
- Cards with play-rate vs win-rate outliers (>±8% from deck baseline).
- Match length distribution (target median 9 turns each; flag >15% matches ending by turn limit).
- Starved economies: matches where one player is stuck with 0 Fuel for 5+ turns.
- Air/Armour/Infantry matchup matrix.

### 9.3 Tuning loop
1. Simulate. 2. Identify outliers. 3. Adjust card data or constants. 4. Re-simulate with the same seeds. 5. Update `dataVersion`. Never tune by feel alone.

### 9.4 Implemented (v0.1)

- **Agents** (`src/ai/agents.ts`): Recruit (random legal play with a bias and 15% mistakes) and Veteran (greedy 1-ply by `src/ai/evaluate.ts`). Both read only their own hand and public state. Commander and Marshal are not built yet.
- **Simulator** (`src/ai/sim.ts`): `playMatch`, `playSeries` (seats alternate), deterministic per seed. **Decks** (`src/ai/decks.ts`): legal single-nation decks that reach the doctrine threshold.
- **Harness** (`src/ai/balance.ts`): `npm run balance` (`GAMES=300` per pair, `NODOCTRINE=1`, `NATIONS=japan,...` for card outliers).
- **Findings and changes.** The first sweep showed doctrines as a large imbalance source (Japan +9.6 points). Tuned: UK Resolve only at HQ 14 or less, Germany Combined Arms also covers Air, Japan Tenacity only for the first Infantry costing 2 or less each turn; nerfs to Pavlov's House, Siberian Division, Shock Regiment, Kwantung Army Regiment, Jungle Fighters and Type 99 LMG Team; buffs to Panzer II and Kradschuetzen.
- **Latest result** (3000 games, Veteran mirror): first player 49.0%, USA 50.8, UK 46.3, USSR 51.8, Germany 45.2, Japan 55.8; turn-limit rate 17.4%. Japan and Germany are still outside 45-55%, and the turn-limit rate is above the 15% target. The Veteran is greedy and undervalues armour, air and orders, so further tuning should wait for the Commander tier.

## 10. Tutorial AI
Three scripted opponents that teach: (1) economy and deploying, (2) lanes and combat/Armour, (3) Orders and Air. They play deliberately weak, fixed lines and explain each step in on-screen prompts.
