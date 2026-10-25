# 09 — Running, testing and debugging

## 0. Windows desktop app (no command line)

**Get the installer.** On GitHub open the repository's *Actions* tab, choose *Windows installer*, press *Run workflow*, and when it finishes download `front-line-server-installer` (a zip containing `Front-Line-Server-Setup-<version>.exe`). Pushing a tag such as `v0.1.0` also publishes the installer as a GitHub Release.

**Install.** Double-click the installer. It installs for your user (no administrator needed), adds a desktop and Start-menu shortcut and opens the app. Windows may show a blue "unknown publisher" SmartScreen box because the installer is not code-signed: choose *More info* then *Run anyway*.

**Use it.** The *Front Line Server* window has:
- **Server tab:** a status light, *Play in my browser*, *Stop server*, *Restart*, the addresses to give players, settings (port, let other devices connect, start the server when the app opens, open the app when you sign in to Windows), your data folder and the admin token.
- **Admin console tab:** the live admin screen: Overview (players online, matches, the addresses), Players (search, give War Bonds, reset daily bonuses, set a password), Matches, Logs, Problems (server and browser errors) and *Back up the database now*.
- Closing the window keeps the server running in the system tray (next to the clock). Right-click the tray icon to open, stop or quit.

**Let friends in.** On your home network they open the second address shown (for example `http://192.168.1.20:3000`). The first time, Windows Firewall may ask; allow it, or press *Allow through Windows Firewall* in Settings. For friends outside your home, forward the port on your router to this computer and share your public address (the app cannot do that for you).

**Where things live.** Data (accounts, the database, backups) is in `%APPDATA%\Front Line Server\data`, logs in `%APPDATA%\Front Line Server\logs`; the buttons in the app open these folders. Uninstalling keeps your data.

**Not verified yet.** The desktop app was exercised on macOS (server start/stop/restart, port change, port-in-use message, admin console, backup). The Windows installer, firewall button, tray and start-with-Windows are built from the same code but have not been run on Windows by the author.

## 1. Running from source (developers)

### Requirements
Node 22.5 or newer (developed on 26; `node:sqlite` is built in). `npm install` once.

## 2. Ways to run

**Production style (one port, what a deployment looks like):**
```bash
npm run build          # type-check, build the client to dist/, bundle the server to dist-server/
ADMIN_TOKEN=choose-a-secret npm start     # http://localhost:3000
```
`npm run serve` does both. The database is created at `data/frontline.db` (set `DB_PATH` to move it). Stop with Ctrl-C (it shuts down cleanly).

**Development (hot reload):** two terminals: `npm run dev:server` (port 3000, debug logs, admin token `dev`) and `npm run dev` (Vite on 5173, proxying `/api` and `/ws` to 3000). Open http://localhost:5173.

**Docker:** `docker build -t frontline .` then `docker run -p 3000:3000 -v frontline-data:/data -e ADMIN_TOKEN=secret frontline`.

## 3. Configuration (environment)
| Variable | Default | Meaning |
|---|---|---|
| `PORT`, `HOST` | 3000, 0.0.0.0 | listen address |
| `DB_PATH` | data/frontline.db | SQLite file |
| `STATIC_DIR` | dist | built client; empty = API only |
| `ADMIN_TOKEN` | (empty = admin API off) | secret for `/api/admin/*` |
| `LOG_LEVEL` | info | debug, info, warn, error |
| `AI_DELAY_MS` | 700 | pause between an AI seat's actions |
| `TURN_TIMER_MS` | 120000 | time for one decision before the server acts |
| `AWAY_GRACE_MS` | 20000 | disconnected player grace before an AI takes the seat |
| `QUEUE_FILL_MS` | 10000 | wait for a human before an AI fills the seat |
| `SESSION_DAYS` | 30 | login lifetime |

Tip for testing: `AI_DELAY_MS=100 QUEUE_FILL_MS=3000` makes everything quicker.

## 4. New-player test script
Use a clean database (stop the server, delete `data/`, start again). Tick each box.

1. **Register.** Open the site, choose *New player*, enter a name and a password of 8+ characters, pick a starter nation. You land on the menu with 200 WB, a 30-card starter army and "free pack waiting".
2. **Wrong input.** Sign out; try a wrong password and a taken name: clear error messages, no crash.
3. **Free pack.** Shop > Open your free pack: 5 cards with NEW tags, the pack sound, collection count rises (28 to about 33). A second pack costs 100 WB.
4. **Army.** Armies: open the starter army, swap a card for one from the pack, save. Try an illegal army (too few cards): the problems are listed and it cannot be used for a match.
5. **First AI match.** Menu > Recruit > Play vs AI: mulligan, build, deploy, attack, end turn. Watch the animations and sounds (toggle Sound). Win or concede: the result screen lists each reward line and the new balance.
6. **Harder tiers.** Play Veteran, Commander, Marshal (the Marshal thinks for a second or two per turn).
7. **Market.** Shop > Sell cards: sell one card, then *Sell extras*. List a spare card on the market; a card used by a saved army is refused. Buy a trader's card.
8. **Second player / PvP.** Open a private window, register a second account, both click *Play online*: they are matched, the result is rated, both see the rating change. Click *Play online* with only one player: after about 10 s an AI joins (unrated).
9. **Reconnect.** In a match, reload the page: the match returns. Close the tab for more than 20 s while it is your turn: an AI plays your seat; reopen to take it back.
10. **Rewards.** Check first-win-of-day (+50%), and the anti-farm decay after 10 AI wins in an hour.

## 5. Debugging
- **Logs:** JSON lines on stdout (`request`, `match created`, `match ended`, `socket open`, errors with stack). Filter with `grep`, or `jq` if installed. `LOG_LEVEL=debug` adds every WebSocket message.
- **Health:** `curl localhost:3000/api/health`.
- **Admin API** (replace `$T` with your `ADMIN_TOKEN`):
```bash
curl -H "x-admin-token: $T" localhost:3000/api/admin/stats
curl -H "x-admin-token: $T" localhost:3000/api/admin/errors
curl -H "x-admin-token: $T" localhost:3000/api/admin/matches
curl -H "x-admin-token: $T" localhost:3000/api/admin/match/<id>
curl -H "x-admin-token: $T" localhost:3000/api/admin/account/<name>
curl -H "x-admin-token: $T" -H 'content-type: application/json' -d '{"name":"Tester1","wb":1000}' localhost:3000/api/admin/grant
curl -H "x-admin-token: $T" -H 'content-type: application/json' -d '{"name":"Tester1"}' localhost:3000/api/admin/reset-daily
```
- **Client errors** (uncaught exceptions in the browser) appear under `/api/admin/errors` as `client`.
- **Replaying a match:** `/api/admin/match/<id>` returns the seed, decks and the full action list; replaying them with `createGame` + `apply` reproduces the match exactly (the test suite does this).
- **Reset a player:** delete the account's rows via SQLite (`sqlite3 data/frontline.db`) or just delete `data/` for a clean slate.

## 6. Checks before you ship a change
```bash
npm run typecheck && npm test && npm run build
```
`npm run balance` (slow) re-runs the nation sweep; `TIER=commander` uses the Commander agent.

## 7. Known limits
Single process and a single SQLite file. AI turns for Commander and Marshal run on the server's main thread. No ghost armies, tutorial, daily contracts, password reset or email. Turn-limit rate in simulation is about 19% (target 15%).
