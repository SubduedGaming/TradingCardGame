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
| **Marshal** | Determinised Monte-Carlo (PIMC) over Commander's best turn plans, rolled out with Veteran agents (§9.6). | n/a |

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

*Implemented (v1):* a single rating (Elo, K=32, start 1000, shown on the menu), a rating window that widens with waiting time, and after `QUEUE_FILL_MS` (10 s) an AI of the chosen tier fills the seat. Filler games are unrated and the seat is labelled as an AI. Ghost armies are not built. Matches are stored with seed and action log and can be replayed.

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

- **Agents** (`src/ai/agents.ts`): Recruit (random legal play with a bias and 15% mistakes) and Veteran (greedy 1-ply by `src/ai/evaluate.ts`). Both read only their own hand and public state. Commander and Marshal are described in §9.5 and §9.6.
- **Simulator** (`src/ai/sim.ts`): `playMatch`, `playSeries` (seats alternate), deterministic per seed. **Decks** (`src/ai/decks.ts`): legal single-nation decks that reach the doctrine threshold.
- **Harness** (`src/ai/balance.ts`): `npm run balance` (`GAMES=300` per pair, `NODOCTRINE=1`, `NATIONS=japan,...` for card outliers).
- **Findings and changes.** The first sweep showed doctrines as a large imbalance source (Japan +9.6 points). Tuned: UK Resolve only at HQ 14 or less, Germany Combined Arms also covers Air, Japan Tenacity only for the first Infantry costing 2 or less each turn; nerfs to Pavlov's House, Siberian Division, Shock Regiment, Kwantung Army Regiment, Jungle Fighters and Type 99 LMG Team; buffs to Panzer II and Kradschuetzen.
- **Latest result** (3000 games, Veteran mirror): first player 49.0%, USA 50.8, UK 46.3, USSR 51.8, Germany 45.2, Japan 55.8; turn-limit rate 17.4%. Japan and Germany are still outside 45-55%, and the turn-limit rate is above the 15% target. The Veteran is greedy and undervalues armour, air and orders, so further tuning should wait for the Commander tier.

### 9.5 Commander (implemented)

`src/ai/commander.ts`: beam search (width 10) over whole-turn action sequences, replayed one action at a time. Each finished turn is scored after the opponent's best counter-attack with the units they already have on the board (greedy, from public information only; their hand is never read). It takes about 0.25 s per full match headless.

- Measured against Veteran with identical decks across all five nations (200 games, seats alternating): Commander wins 63%. A wider beam (24) gave 64%, so width 10 is used.
- `TIER=commander npm run balance` sweeps nation balance with Commander in both seats.
- Commander sweep (1500 games, before the third tuning pass): USA 50.7, UK 44.5, USSR 53.8, Germany 48.2, Japan 52.8, first player 49.0%, turn-limit rate 18.9%.
- Third tuning pass (from the Commander sweep): UK Resolve now applies at HQ 16 or less; Vickers Light Tank, Valentine, Royal Engineers and the 25-pounder gained a point of HP or ATK; Shock Regiment, Naval Landing Force and Kwantung Army Regiment lost a point.
- After the third pass (1500 games): USA 51.0, UK 45.4, USSR 53.6, Germany 48.1, Japan 51.9, first player 49.0%, turn-limit rate 19.4%. All five nations are inside the 45-55% target; UK and USSR sit at its edges and each has one lopsided matchup (UK loses 38% to USSR).
- Known gap: turn-limit rate stays near 19-20%, above the 15% target, so games are slightly too grindy. 

### 9.6 Marshal (implemented)

`src/ai/marshal.ts`: **perfect-information Monte-Carlo over whole-turn plans** (PIMC), not full ISMCTS.

1. Commander's beam search (`planTurns`, width 8) proposes its 4 best distinct turn plans.
2. Six worlds are sampled that are consistent with what the Marshal can see: the opponent's hand and deck are re-drawn from a plausible deck of their nation (their doctrine, else the commonest nation among cards seen) minus the cards already on their board or in their discard pile, and the order of the Marshal's own deck is reshuffled. The true hidden cards are never read.
3. Each plan is played in each world (as far as it stays legal) and then rolled out two more turns with Veteran agents in both seats; the position is scored by `evaluate`, or +/-1000 on a win or loss.
4. The plan with the best mean is played.

Limits, stated plainly: it does not model what the opponent knows about us, rollouts are greedy, and the opponent's nation is a guess on turn 1. Measured over 40 games against Commander with random nation decks and alternating seats: Marshal won 30, lost 10. It takes about 1.5 s per match headless; on the server it runs on the main thread (moving it to a worker is future work).

## 10. Tutorial AI
Three scripted opponents that teach: (1) economy and deploying, (2) lanes and combat/Armour, (3) Orders and Air. They play deliberately weak, fixed lines and explain each step in on-screen prompts.
