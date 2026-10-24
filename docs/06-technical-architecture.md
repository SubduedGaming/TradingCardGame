# 06 — Technical Architecture

Status: draft v0.2.

## 1. Stack
- **Language:** TypeScript everywhere (strict mode).
- **Workspace:** pnpm/npm workspaces monorepo (move into this layout when the second package is added).
- **Client:** Vite + React for menus, deck builder, shop; match board starts in DOM/CSS and moves to PixiJS only if animation needs it.
- **State (client UI):** Zustand (or similar); the engine owns the *game* state.
- **Local persistence:** IndexedDB (via `idb`) behind service interfaces.
- **Tests:** Vitest. Property-based tests with `fast-check` for the engine.
- **Server (phase 6):** Node + Fastify, Postgres, WebSocket for live matches. Same engine package as the client.

## 2. Repository layout (target)

```
/docs                       design documents
/packages
  /engine                   pure rules engine, no IO, no DOM
  /cards                    card data per set (JSON/TS) + validators
  /ai                       bots, evaluation, search, simulation harness
  /services                 InventoryService, MarketService interfaces + local impls
/apps
  /web                      React client
  /server                   Fastify API + match server (later)
  /sim                      CLI: headless AI-vs-AI simulation and balance reports
```

Until the second package exists, the current `src/engine` layout is fine; moving to workspaces later is mechanical.

## 3. Engine design principles
1. **Pure and deterministic:** `apply(state, action) → { state, events }`. No `Date`, no `Math.random`; all randomness from a **seeded PRNG** (e.g. mulberry32/sfc32) stored in state.
2. **Immutable state** (structural sharing via small helper or Immer in the engine's internal reducers; the external contract is plain JSON).
3. **JSON-serialisable state:** the full game state can be saved, sent over the wire, hashed.
4. **Event log:** every state change emits typed events (`UnitDeployed`, `DamageDealt`, `CardDrawn`, …). UI animation, replays, and logs consume events, never diffs.
5. **Rules are data-driven:** the engine knows primitives and keywords (doc 02); sets are registered data (`registerSet(ww2)`), not code branches.
6. **No UI knowledge:** the engine never imports React/DOM.

### 3.1 Core API

```ts
createGame(config: GameConfig): GameState            // decks, seed, dataVersion, first player
legalActions(state: GameState, player: 0 | 1): Action[]
apply(state: GameState, action: Action): { state: GameState; events: GameEvent[] }
observation(state: GameState, player: 0 | 1): Observation   // hides opponent's hand/deck order
isTerminal(state: GameState): { winner: 0 | 1 | null } | null
hashState(state: GameState): string
```

### 3.2 State machine
`phase` field: `start → upkeep → production → draw → main → combat → end`. Phases with no choices (start, upkeep, production, draw, end) are auto-advanced by `apply`; the player acts only in `main` and `combat`. Action `endMain` moves to `combat`; `endTurn` ends combat.

Action set:

```ts
type Action =
  | { type: 'construct'; cardIndex: number; slot: number }
  | { type: 'deploy'; cardIndex: number; lane: number; row: 'front' | 'rear' }
  | { type: 'order'; cardIndex: number; targets: TargetRef[] }
  | { type: 'redeploy'; unitUid: string; lane: number; row: 'front' | 'rear' }
  | { type: 'attack'; unitUid: string; target: TargetRef }
  | { type: 'endMain' }
  | { type: 'endTurn' }
  | { type: 'mulligan'; keep: boolean }
  | { type: 'concede' };
```

(The `Action` type in `src/engine/types.ts` is a first sketch and will be replaced by this.)

### 3.3 Effects interpreter
- Each card's `effects` is an array of `{ trigger, condition?, do, target, ... }`.
- A small **interpreter** maps `do` to a handler (`damage`, `heal`, `draw`, …). Handlers are pure `(state, ctx) → { state, events }`.
- Triggers are dispatched from a single `emit(event)` pipeline; a queue enforces active-player-first ordering (doc 01 §10).
- Static (`whileInPlay`) effects are computed via a **modifier layer** when reading stats (`effectiveAttack(unit)`), never by mutating base stats.

### 3.4 Targeting
`TargetRef = { kind: 'unit'|'building'|'hq'|'lane'|'player'; uid?: string; lane?: number; player?: 0|1 }`. `legalActions` enumerates concrete targets, so UI and AI share one source of truth.

### 3.5 Determinism and replay
- A match is fully described by `(config, actions[])`. Replaying actions reproduces the log exactly. The server stores this for each rated match.
- `dataVersion` is in `config` so replays use the card data they were played with.

## 4. Data model (cards)
- Cards live in `packages/cards/<set>/*.ts` as typed objects (so the compiler checks them) and are also exportable as JSON.
- A `validate-cards` script checks: unique IDs, valid keyword names, cost shapes, points/rarity table, nation doctrine counts, set totals. It runs in CI.
- Art is referenced by key; images are loaded from `/assets/<set>/<id>.webp`. Placeholder art is generated from card type/nation until real art exists.

## 5. Services (persistence boundary)

All player progression is behind interfaces so local and server implementations are interchangeable:

```ts
interface InventoryService {
  getCollection(): Promise<CollectionEntry[]>
  getWallet(): Promise<{ warBonds: number }>
  openPack(packTypeId: string): Promise<PackResult>
  sellCards(items: { cardId: string; qty: number }[]): Promise<SaleResult>
  getDecks(): Promise<Deck[]>
  saveDeck(deck: Deck): Promise<void>
  reportMatchResult(result: MatchResult): Promise<Rewards>
}

interface MarketService {
  browse(filter: MarketFilter): Promise<Listing[]>
  list(cardId: string, price: number): Promise<Listing>
  buy(listingId: string): Promise<PurchaseResult>
  cancel(listingId: string): Promise<void>
}
```

- **Local implementation:** IndexedDB, with a ledger table (append-only) so the same accounting logic runs locally and on the server.
- **Server implementation:** REST/WS endpoints with the same shapes.
- All mutating operations are **idempotent** (client supplies an operation id) and recorded in the ledger.

### 5.1 Ledger
Append-only record: `{ id, accountId, type, delta, balanceAfter, refs, createdAt, seed? }`. Wallet balance and collection are derived views (and cached). This makes audits, rollback of exploit periods, and analytics straightforward.

## 6. Server design (phase 6+)

- **Auth:** accounts with email/OAuth login; session tokens; no gameplay on the client is trusted.
- **Authoritative match server:** clients send actions; the server validates with `legalActions`, applies, and broadcasts events and per-player observations. Hidden info never leaves the server unmasked.
- **Result reporting:** because the server ran the match, rewards are computed server-side. For **offline single-player** matches (pre-server), results are local-only; when the server arrives, local progress is **not** auto-trusted. Offer a one-time import with a cap, or begin everyone on the server with their starter army.
- **Matchmaking service:** queue + filler logic from doc 05.
- **Database:** Postgres tables for accounts, ledger, collections, decks, listings, matches (action log), ratings.
- **Scaling:** match processes are cheap (pure functions on small JSON). Single node can host thousands of concurrent matches; shard by match id later if needed.

## 7. Security and anti-cheat
- Server-side engine validation for all PvP and any reward-bearing match.
- Rate limiting per account on market and pack operations.
- Pack RNG seeded and recorded in the ledger; the server never accepts a client-provided result.
- Input validation on every endpoint (schemas via zod).
- No secrets in the client bundle.

## 8. Testing strategy
- **Unit tests** per primitive effect and per keyword.
- **Rules tests** from the rulebook: every example in doc 01 becomes a test.
- **Property tests:** random legal play to completion never throws; state invariants hold (resources ≤ cap, slots ≤ limits, total cards conserved across zones).
- **Replay tests:** recorded action logs reproduce identical final state hashes.
- **Card data tests:** `validate-cards` plus a "smoke game" per card (play it in a scripted scenario).
- **Simulation regression:** nightly sweep (doc 05 §9).

## 9. Performance targets
- `legalActions` < 1 ms for typical states.
- AI Veteran turn < 200 ms; Commander < 1.5 s (run in a Web Worker so the UI stays responsive).
- Simulation harness: ≥ 2,000 games/min on a laptop (Veteran vs Veteran).

## 10. Build order (concrete)
1. `engine`: state, `createGame`, phases, resources, draw (with tests).
2. `engine`: deploy/construct/lane combat/win check.
3. `cards`: keywords one by one with tests; then ww2 set data + validator.
4. `ai`: random bot → Recruit → Veteran; `sim` CLI + first balance report.
5. `web`: match view driven by event log; then deck builder; then shop/collection.
6. `services` local implementations; economy loop end to end.
7. Server, accounts, ledger, market; ghost armies; live PvP.

## 11. Types changes needed now
`src/engine/types.ts` is a first sketch. Planned changes: add `neutral` to `Nation`; add `phase` to `GameState`; replace the sketch `Action` with §3.2; add `Lane { front, rear }` for unit slots; add `status` flags (`fresh`, `grounded`, `suppressed`) and `keywords` on units in play.
