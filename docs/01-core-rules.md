# 01 — Core Rules

Status: draft v0.2. All numeric values are **tunable constants** (see §16) and should be revisited after AI-vs-AI simulation.

## 1. Overview

Two players each command an army built from three card types: **Buildings** (produce resources), **Units** (fight), and **Orders** (one-shot effects). Each player has a **Command Post** (HQ). Reduce the enemy HQ to 0 HP to win.

Design intent: matches last roughly 8–12 turns per player (~10 minutes vs AI). Economy and aggression pull against each other: every building you place is a target, and every unit you keep home is an attacker you didn't send.

## 2. Zones

| Zone | Visibility | Notes |
|---|---|---|
| Deck | Hidden, ordered | 30–40 cards. Drawn from the top. |
| Hand | Owner only | Max 8 at end of turn. |
| Lanes | Public | 3 lanes, each with a **Front** and **Rear** slot per player. |
| Building row | Public | Up to 6 building slots per player. |
| Command Post | Public | HQ HP (start 20), always present. |
| Discard | Public | Destroyed units/buildings and used Orders. Face up, unordered. |
| Resource bank | Public | Four counters, cap 10 each. |

There is no exile zone in set 1.

## 3. Setup

1. Each player's deck is validated (see doc 02 §5) and shuffled with the match seed.
2. A coin flip (seeded) decides who goes **first**.
3. Each player draws **5 cards**.
4. **Mulligan** (once, simultaneous): a player may shuffle their hand back and draw **one fewer** card (min 3). Order of mulligan decisions is hidden until both are made.
5. **Second-player compensation:** the second player draws on their first turn (the first player does not) and starts with **1 Supplies** banked.
6. Each HQ is placed with 20 HP. HQ generates **1 Manpower and 1 Supplies** at the start of its owner's turn (Production phase).

## 4. Resources

Four types: **Manpower (Mp), Steel (St), Fuel (Fu), Supplies (Su)**.

- **Banked:** unspent resources carry over between turns.
- **Cap:** 10 per type. Production above the cap is lost.
- **Spending:** costs are paid from the bank at the moment a card is played. Costs are exact; there is no converting one resource into another except via card effects (e.g. Lend-Lease).
- **Cost reduction** effects never reduce a card's total cost below 1 resource (an Order or Unit always costs at least 1 of something) unless the card says "free".
- Production is always applied in the Production phase, so a building constructed this turn first produces at the start of its owner's **next** turn. There is no separate "under construction" state.

## 5. Turn structure

A turn has six phases, in order. The active player is the only one who may take actions (no reaction window in set 1; see §14).

1. **Start phase** — ready all units; advance Rear units into empty Front slots (§7); "at the start of your turn" triggers resolve (active player chooses order).
2. **Upkeep phase** — pay **Upkeep** for each unit that has it (§ doc 02). Units whose Upkeep is unpaid are **Grounded** until your next turn (cannot attack).
3. **Production phase** — HQ and each of your buildings add their resources to the bank (cap applies).
4. **Draw phase** — draw 1 card. (First player skips this on turn 1.) Drawing from an empty deck causes **Fatigue** (§12).
5. **Main phase** — any number of the following actions, in any order:
   - **Construct:** play one **Building** (max 1 per turn). Pay its cost, place it in a free building slot.
   - **Deploy:** play a **Unit** into a free Front or Rear slot in any lane. Pay its cost. It is **Fresh** (cannot attack this turn) unless it has **Blitz**.
   - **Order:** play an **Order**, pay its cost, resolve its effect, put it in the discard.
   - **Redeploy:** pay **1 Supplies**, move one of your non-Fresh, non-Heavy units to a free slot in a different lane (any row). The unit cannot attack this turn. Once per unit per turn.
6. **Combat phase** — the active player may make **Assaults** (§8). Each ready, non-Fresh, non-Grounded, non-Suppressed unit may attack **once**. The player may skip combat.
7. **End phase** — "at the end of your turn" triggers resolve; "until end of turn" effects expire; **Suppressed** status on the active player's units is removed; discard down to 8 cards (player's choice).

> Main-phase actions after combat: the Main phase is *before* Combat. There is no second Main phase. Deploy first, then fight.

## 6. Board layout

```
        Lane 1          Lane 2          Lane 3
  [ Enemy Rear  ] [ Enemy Rear  ] [ Enemy Rear  ]
  [ Enemy Front ] [ Enemy Front ] [ Enemy Front ]
  ------------------------------------------------
  [ Your Front  ] [ Your Front  ] [ Your Front  ]
  [ Your Rear   ] [ Your Rear   ] [ Your Rear   ]

  Enemy buildings (6) + HQ         Your buildings (6) + HQ
```

- Each lane holds up to **2 units per side** (one Front, one Rear). Max 6 units per player.
- A unit may be deployed to any free slot. Deploying to the Rear is a choice; Rear units are protected by the Front unit but non-Ranged Rear units cannot attack.
- Lanes are independent. Units do not move between lanes except via Redeploy.
- Buildings are not in lanes. They can only be reached by **Breakthrough**, **Siege/Air** attacks, or Orders.

## 7. Advance

At the start of its owner's turn, in every lane where the Front slot is empty and the Rear slot holds a unit, that unit moves to the Front. This is automatic and is not Redeploy. Advance happens only at the owner's Start phase, so a Rear unit stays in the Rear during the enemy's turn even if its Front partner dies in combat.

## 8. Combat

### 8.1 Declaring an Assault
For each ready unit (in the order the active player chooses, one at a time), the player declares an **attack** and the target is determined by the rules below. Resolve each attack fully before declaring the next. A unit that is destroyed before it attacks cannot attack.

### 8.2 Legal targets

Let **A** be the attacker in lane *L*.

1. **Flying attacker:** may target any enemy unit in lane *L*, any enemy building, or the HQ (Flying ignores Front/Rear protection and Guard). Ground defenders in that lane cannot counter it unless they have Anti-Air.
2. **Ranged attacker** (Front or Rear): targets the enemy Front unit in lane *L* if present, otherwise the enemy Rear unit in lane *L*, otherwise **Breakthrough** (below). **Indirect** units may instead pick lane *L′* for any lane. **Precision** units may pick either enemy unit in lane *L*.
3. **Melee attacker** (non-Ranged): must be in the Front slot. Targets enemy Front unit in lane *L*, otherwise enemy Rear unit in lane *L*, otherwise Breakthrough.
4. A **Flying** enemy unit can only be targeted by attackers with **Anti-Air** (or Flying attackers). If the only enemy unit in the lane is Flying and A lacks Anti-Air, A treats the lane as empty (Breakthrough).
5. **Breakthrough:** if the lane has no legal enemy unit target, the attacker may choose the enemy **HQ** or any one enemy **building**. If any enemy building has **Guard**, Breakthrough must target a Guard building first (Flying ignores Guard).

### 8.3 Damage

- **Base damage** = attacker's current ATK.
- **Armour:** the target's Armour X reduces damage from each hit by X, to a **minimum of 1**. **Piercing** attackers ignore Armour.
- **Siege X:** adds X damage when the target is a building or HQ (before building/HQ have no Armour, so this is applied directly).
- Buildings and the HQ have no Armour and never counter.
- Damage is permanent for the match (units/buildings do not regenerate) unless a card heals them. Healing cannot exceed printed max HP.
- Damage is dealt simultaneously with counter-damage (§8.4); a unit at 0 HP is destroyed after both are applied.

### 8.4 Counter-damage

After the attack's damage resolves, the defender counters (deals its own ATK, reduced by the attacker's Armour unless the defender has Piercing) **only if** it is still alive-at-impact and:
- The attacker is a **melee ground** unit, or
- Both the attacker and the defender are **Flying** (dogfight).

Ranged attackers and Flying attackers against ground units are never countered. Counter-damage can trigger Last Stand/Tenacity-style effects normally.

### 8.5 Destruction
A unit or building at 0 HP is destroyed after the attack that dealt the damage is fully resolved (damage, counter-damage, and any "when damaged" triggers). It goes to its owner's discard. Its slot is free. "When destroyed" triggers resolve at that point.

### 8.6 No carryover
Excess damage does not carry over to other targets or to the HQ.

## 9. Orders

- Played in the Main phase only (set 1). Pay cost, choose targets, resolve in printed order, discard.
- If a required target becomes illegal before resolution (not possible without reactions in set 1), the Order fizzles.
- Orders that "destroy" or "deal damage" use the same rules as combat damage except Armour **does** reduce Order damage unless the Order says "ignores Armour".

## 10. Timing and trigger resolution

- Effects resolve immediately, in the order they occur. There is no stack.
- If several triggers fire at the same time, the **active player** resolves theirs first (in an order they choose), then the opponent.
- After each action and each trigger, the engine runs a **state check**: destroy units/buildings at 0 HP, check for HQ at 0 HP, check for game end. If both HQs reach 0 simultaneously, the game is a **draw**.
- Triggers created during state check go to the back of the queue.

## 11. Hidden information

- Opponent's hand size and deck size are public; contents are not.
- Deck order is hidden from both players.
- Cards revealed by effects (Radar, Enigma Intercept) are shown to the effect's controller only; the log records the reveal without the content for the opponent.

## 12. Deck exhaustion (Fatigue)

If a player must draw and has no cards, their HQ takes **Fatigue damage**: 1 the first time, 2 the second, 3 the third, and so on (the counter persists for the match). Fatigue damage ignores everything.

## 13. Game end and stalls

- **Win:** the opposing HQ reaches 0 HP.
- **Draw:** both HQs reach 0 simultaneously.
- **Turn limit:** at the end of turn **30** (global, 15 each), if no one has won, the player with **more HQ HP** wins; equal HP is a draw. This should be rare with Fatigue in play, but it guarantees termination.
- **Concede:** a player may concede at any time; the opponent wins.

## 14. Deferred: Reactions

Set 1 has no interrupt/reaction windows. This keeps the AI, networking, and UX simple. A future set may add **Reaction Orders** (played during the opponent's Combat phase). The engine's action loop is designed to allow a `priority` field later (see doc 06).

## 15. Worked example

Turn 3 (Player A, second turn each):
1. Start: Rear Rifle Squad advances to empty Front in lane 2.
2. Production: A has Barracks (+1 Mp) and Steel Mill (+1 St), plus HQ (+1 Mp, +1 Su). Bank: Mp 4, St 1, Su 3, Fu 0.
3. Draw 1.
4. Main: Constructs Oil Derrick (2 Su). Deploys Light Tank (2 St, 1 Fu)? Not enough Steel/Fuel — plays Rifle Squad (1 Mp) in lane 3 Front instead, and Mortar Team (1 Mp, 1 Su) in lane 3 Rear.
5. Combat: Rifle Squad (lane 2) attacks the enemy Front unit. Enemy has an Armour 1 Light Tank (2/3). Damage = max(1, 2−1) = 1. Counter: tank ATK 2 − Rifle's Armour 0 = 2; Rifle Squad (2 HP) dies. A should have attacked the tank with something Piercing, or skipped. (This is intentional: infantry are a bad answer to armour.)
6. End: no discard needed.

## 16. Tunable constants

| Constant | Initial | Notes |
|---|---|---|
| HQ HP | 20 | Core pacing lever. |
| HQ income | 1 Mp + 1 Su | Keeps a deckless first turn playable. |
| Resource cap | 10 | Per type. |
| Opening hand | 5 | |
| Hand limit | 8 | |
| Building slots | 6 | |
| Lanes | 3 | |
| Unit slots per lane | 2 per side | |
| Max Constructs per turn | 1 | |
| Redeploy cost | 1 Su | |
| Turn limit | 30 (global) | |
| Fatigue | +1 per draw | |
| Second player bonus | +1 Su, draws turn 1 | Tune with AI-vs-AI first-player win rate (target 47–53%). |

## 17. FAQ / edge cases

- **Can a Fresh unit be targeted?** Yes. Fresh only restricts attacking.
- **Can I play a Building with no free slot?** No. You may not replace a building. (Sabotage-style effects free slots.)
- **What if a Front unit is destroyed during my attack and its Rear partner is untouched?** The Rear unit stays Rear until the enemy's own Start phase (§7 — it advances at *its owner's* Start phase). During my continued Assault, the lane's next target is the Rear unit (§8.2).
- **Do buildings count as destroyed if their slot is overwritten?** Slots are never overwritten.
- **Can a unit attack an enemy building when a unit is in the lane?** No, unless Flying, or the card says otherwise (Siege units still follow lane targeting; they just deal extra damage once they reach a building).
- **Do Orders trigger Counter-damage?** No. Counter-damage is a combat rule.
- **Does Tenacity prevent HQ loss?** No, it only applies to units.
