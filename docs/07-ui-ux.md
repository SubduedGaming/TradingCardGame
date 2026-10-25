# 07 — UI / UX

Status: draft v0.2. Desktop-first web; layouts must degrade to tablet/phone landscape.

## 1. Principles
1. **Board state at a glance.** Resources, HQ HP, lane contents and building income should be readable without opening anything.
2. **Show the rules, don't hide them.** Legal targets are highlighted; illegal drops explain why on hover ("Not enough Fuel").
3. **Events drive animation.** The UI animates the engine's event log, so replays and the AI's turn play out clearly.
4. **Fast by default.** AI turns are skippable/speed-adjustable; no forced long animations.

## 2. Screens

| Screen | Purpose |
|---|---|
| **Home** | Play (vs AI / matchmaking later), daily contracts, War Bonds, news. |
| **Army** (deck builder) | Collection browser, deck list, points meter, curve and resource charts, validation messages. |
| **Shop** | Buy packs, pack opening animation. |
| **Market** | Browse/buy/list cards (phase 6; simulated in earlier phases). |
| **Collection** | All owned cards, filters, "sell extras". |
| **Match** | The game board. |
| **Results** | Outcome, rewards, contract progress, quick "play again". |
| **Settings** | Audio, speed, accessibility, keybinds. |

## 3. Match screen layout

```
┌──────────────────────────────────────────────────────────────┐
│ Opponent: name · HQ ♥ 20 · Hand 5 · Deck 22 · Resources ▢▢▢▢ │
│ Enemy buildings:  [B][B][B][ ][ ][ ]                         │
│ ┌────────── Lane 1 ──────────┬── Lane 2 ──┬── Lane 3 ──────┐ │
│ │ Enemy Rear   Enemy Front   │            │                │ │
│ │ Your  Front  Your  Rear    │            │                │ │
│ └────────────────────────────┴────────────┴────────────────┘ │
│ Your buildings:   [B][B][ ][ ][ ][ ]                         │
│ You: HQ ♥ 20 · Mp 3 St 1 Fu 0 Su 2 · Phase: Main · [End Turn]│
│ Hand:  [card][card][card][card][card]                        │
└──────────────────────────────────────────────────────────────┘
```

- Resource bar shows **current / cap** and **+income** per type (derived from buildings).
- Cards in hand dim if unaffordable; hovering shows which resource is missing.
- Dragging a card highlights legal slots (green) and shows deployment preview.
- Combat: clicking a ready unit shows its legal targets; clicking a target resolves. A "Skip combat" button ends the phase.
- A compact **event log** panel is available; each entry is clickable to highlight the involved cards.
- Phase indicator and **Next action hint** (optional, for tutorial mode).

## 4. Card frame

```
┌──────────────────────────┐
│ Name                 [Cost]│  ← cost pips per resource type
│ ┌──────────────────────┐ │
│ │        art           │ │
│ └──────────────────────┘ │
│ ROLE · NATION            │
│ Keywords / rules text    │
│ ATK ⚔            HP ♥    │  (buildings: HP + production icons)
│ ◆ rarity gem   points    │
└──────────────────────────┘
```

- Nation shown by flag-style roundel / colour band (no ideological symbols; see doc 02 §9).
- Resource icons are distinct in **shape and colour** (accessibility): Manpower (soldier silhouette), Steel (ingot), Fuel (drop), Supplies (crate).
- Keywords are tooltips linking to the glossary.

## 5. Deck builder (Army screen)
- Left: collection grid with filters (type, role, nation, cost, keyword, rarity, owned).
- Right: deck list grouped by type, with copy counts.
- Header meters: **Points x / 100**, **cards x / 30–40**, **buildings**, validation badges.
- Charts: cost curve; resource demand vs expected supply (warns if Fuel-heavy with no Fuel source); role breakdown.
- Doctrine banner appears when ≥10 cards of one nation.
- "Test hand" button draws a sample opening hand and first 3 turns of income.
- Auto-build helper: suggests a legal filler to reach 30 cards.

## 6. Pack opening
- One pack at a time or "open all" with a summary grid.
- Cards flip individually; rarity cue (glow, sound) escalates.
- New cards flagged "NEW"; duplicates show "owned: N" and a quick "sell extras".

## 7. Market UI
- Table view with filters and sort (price, rarity, set); price history sparkline per card.
- Listing dialog enforces price bounds; shows net after 8% tax.
- Clear indication of the buyer's balance after purchase.

## 8. Feedback and clarity
- Damage numbers float on hits; Armour reductions are displayed ("−2 armour").
- Keywords that change the target (Flying, Indirect) show a distinct targeting line.
- Opponent's turn is narrated in the log; each action pauses briefly (speed setting: slow/normal/fast/instant).

## 9. Accessibility
- Full keyboard play (tab through hand/slots, enter to select, esc to cancel).
- Colour-blind safe palette; resources and rarities never rely on colour alone.
- Scalable UI text; reduced-motion setting disables flourishes.
- Screen-reader labels for board elements and an accessible event log.

## 10. Audio and art direction
- Art style: stylised illustration (flat/halftone propaganda-poster-inspired but neutral, non-ideological), consistent colour per resource and nation.
- Placeholder: generated frames with silhouettes until art is produced.
- Audio: restrained; UI clicks, deploy/hit sounds, a short stinger for victory/defeat; music optional.

## 11. Onboarding
- Three tutorial matches (doc 05 §10) with guided prompts.
- Contextual tooltips on first encounters with a mechanic (Guard, Upkeep, Breakthrough).
- In-game rulebook screen with searchable keywords, auto-generated from keyword data so it never goes stale.

## Implemented (`src/web`)

A framework-free TypeScript client (Vite). It no longer runs the rules itself: it talks to the game server over HTTP (`/api`) and a WebSocket (`/ws`) and draws what the server sends (see docs/09 to run it).

- **Accounts:** register (name, password, starter nation) or sign in; the session token is kept in `localStorage` and the socket reconnects by itself.
- **Menu:** wallet, rating, daily login bonus, army choice (with ownership and deck-rule problems listed), opponent nation, difficulty (Recruit, Veteran, Commander, Marshal), Play vs AI, Play online (PvP, with a searching overlay and Cancel), Armies, Shop, sound toggle, sign out.
- **Match:** the layout from section 3, driven by the server's observation and event stream. Playable hand cards are outlined and unaffordable ones dimmed with the reason on hover. Orders, buildings and units with chosen targets ask for confirmation. The side panel shows the hovered card and a battle log from the events. Mulligan, discard and concede are included. After a reconnect the server re-sends the match in progress.
- **Event-by-event animation:** units lunge when they attack, tiles flash on hits, floating damage/heal numbers appear over the target, destroyed units fade out as ghosts, and the HQ shakes when hit. `prefers-reduced-motion` turns these off.
- **Sound:** synthesised with the Web Audio API (no audio files): deploy, construct, order, attack, hit, HQ hit, destroy, tenacity, turn start, draw, win, lose, click, coin, pack. One toggle on the menu and in the match.
- **Army builder:** filterable collection, the deck rules from docs/02 section 5 with live doctrine detection, armies stored on the server (so they follow the account), Auto-fill.
- **Shop:** pack opening with NEW tags, the traders' daily stock, the player market (list a spare card, cancel, buy), sell one card or all extras.
- **Error reporting:** uncaught client errors are sent to the server (`/api/admin/errors`).
- **Not built yet:** tutorial matches, daily contracts, the in-game rulebook screen, keyboard-only play, an animation speed setting, ghost-army opponents.
