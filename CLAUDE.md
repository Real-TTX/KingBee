# CLAUDE.md

Guidance for working in this repository. Keep it in sync with the code.

## What King Bee is

A fast 3D swarm strategy game in the browser: bees fly straight from flowers, each player redirects the stream with three arrows into their hive,
hornets punish the hive they reach. Modes: battle against the AI, solo, puzzles (12 levels, all checked by a solver) and online play for up to 4.
The names, characters and art are our own — do not copy other games.

King Bee is a **plugin of MatGame** (`../MatGame`, the master of the Mat games: portal, accounts/guests, admin, discovery for the apps; read
`../MatGame/docs/KONZEPT.md` and `../MatGame/docs/PROTOCOL.md`). There is no stand-alone server or image any more.
The whole game runs in the browser (`src/game`, a deterministic lockstep simulation); the server part only keeps the online lobbies and relays the
arrow inputs in fixed frames.

Stack: three.js r187 + Vite (client), ASP.NET Core **.NET 10** Razor class library + SignalR (plugin), MatGame SDK (C# `MatGame.Sdk` by project
reference to the sibling repository, JS copied into `src/matgame`).

## Build / run / test

- `npm ci`, `npm run verify` (solver checks every puzzle and map), `node tools/test-lockstep.mjs` (two clients stay bit-identical), `npm run build`
  (writes the client into `server/KingBee.Module/wwwroot`, git-ignored), `dotnet build KingBee.slnx` (needs `../MatGame`).
- Run: `./scripts/redeploy.ps1` rebuilds and starts the local MatGame stack (`../MatGame/scripts/redeploy.ps1`): http://localhost:2770/kingbee/.
  `npm run dev` serves the client with hot reload at http://localhost:5173/kingbee/ and proxies `/kingbee/hub`, `/kingbee/api`, `/api/matgame` to that stack.
- Other tools: `node tools/sim-battle.mjs normal` (AI vs AI balancing), `node tools/gen-puzzle.mjs …` (puzzle search).
- CI (`.github/workflows/build.yml`): checks out KingBee and MatGame side by side, runs verify, the lockstep test, both builds, then sends
  `repository_dispatch` (`game-updated`) to Real-TTX/MatGame when the secret `MATGAME_DISPATCH_TOKEN` is set. MatGame builds the image with every game.
  The job `windows` (push only) publishes the Windows app (`dotnet publish app/KingBee.App -c Release -r win-x64`: one self-installing `KingBee.exe`)
  and `kingbee-update.json` (version, channel, build number, SHA-256) into the rolling release `release-channel` (main) / `nightly-channel` (dev).
- Windows app locally: `npm run build`, then `dotnet run --project app/KingBee.App` (a local build never offers to install or update;
  `MATGAME_WEBROOT=<folder containing kingbee/>` serves the files from disk, `MATGAME_DEVTOOLS=1` opens the dev tools in other builds).

## Rules (from the owner's guidelines — keep them)

- **Git:** branches `main` (release) and `dev` (nightly). Commits only under the owner's name; **no Co-Authored-By or other contributor lines**, no generated-by lines in PRs.
- **Versions:** `Directory.Build.props` (`KingBeeMajor`/`KingBeeMinor`, keep `package.json` "version" on the same major.minor): release
  `<major>.<minor>.<build>-<date>`, nightly `nightly-<build>-<date>`, local `local-<date>` (CI sets Channel/BuildNumber/BuildDate).
  `MatGameDefaultServer` there is the master the app shell offers first.
- **Lockstep determinism:** everything under `src/game` must give the same result on every engine (V8 in Edge/Chrome/WebView2, JavaScriptCore on iOS):
  integers and the shared seeded RNG (`rng.js`) only — **no `Math.sin/cos/tan/atan2/pow/exp/log/hypot`, no `Math.random` while simulating (only
  to pick the seed of a local game, `battle.js`), no floats that depend on the engine, no iteration over object keys whose order could differ, no time**. `tools/test-lockstep.mjs` must stay green. Rendering (`src/render`) may use anything.
- **Base path:** the client lives at `/kingbee/` on the master and at the same path in the app shell (`https://kingbee.matgame.app/kingbee/`,
  files from embedded resources). Vite `base: '/kingbee/'`; never load anything from a CDN or from an absolute path outside `/kingbee/`
  (the only absolute paths are the master's host API `/api/matgame/...`, through the SDK).
- **Offline first:** battle, solo and puzzles must work with no server at all (in the app `connect()` returns `server: null`). Only Online needs the master.
- **Online needs a session of the master** (account or guest): the hub is mapped with the host's policy (`GameAccounts.AnyScheme`); a seat takes the
  account's name unless the player typed another one. Browser: cookie + antiforgery (SDK); app: device token (SDK, `accessTokenFactory`).
- **The SDK copy** (`src/matgame`) is never edited here: change `../MatGame/sdk/js` and run `node ../MatGame/tools/sdk-copy.js src/matgame`
  (`matgame.version` lists the SHA-256 of every file).
- UI language German; code, comments and identifiers English. The look is KingBee's own cartoon style (Lilita One + Nunito, honey, thick brown outlines).

## Map

```
src/
  game/          simulation, battle + waves, AI, puzzles, maps, lockstep (deterministic, no graphics)
  render/        three.js: scene, models, scenery, particles, the queen sequence
  ui/            SVG logo, icons, map preview, help art
  main.js        menus, online lobby (account/guest, sign-in dialog, server panel + badge in the app), HUD, input, game loop
  net.js         online through the SDK: onlineContext() (connect), createNet() (OnlineTransport → /kingbee/hub), Net (events room/gameStart/frame/desync/playerLeft/closed)
  matgame/       copy of the MatGame JS SDK
public/img/      cover.png and icon.svg of the portal card (GameInfo.Cover / Icon)
server/KingBee.Module/
  KingBeeModule.cs           IGameModule: GameInfo (id kingbee, protocol 1), services (RoomManager, FrameLoop, SignalR), routes below /kingbee:
                             / (index.html, no-cache; /kingbee → /kingbee/), /{**path} (index.html for extension-less paths), /hub, /api/info; stats for the portal
  Multiplayer/Rooms.cs       rooms, seats, settings, RoomManager (in memory)
  Multiplayer/GameHub.cs     lobby + lockstep relay (version check and session check on connect)
  Multiplayer/FrameLoop.cs   the 50 ms clock
  Pages/Admin/KingBee/       read-only list of the rooms in MatGame's /Admin (host layout, SDK admin kit)
app/KingBee.App/ the Windows app: MatGame.Shell (../MatGame/src/MatGame.Shell: WebView2, bridge, self-install, updates) with server/KingBee.Module/wwwroot
                 embedded as web/kingbee/** (served at https://kingbee.matgame.invalid/kingbee/); no ILocalGame (offline needs no server logic)
tools/           solver, generator, lockstep test, AI balancing
```

## Protocol (hub `/kingbee/hub`)

Client → server: `ListRooms`, `CreateRoom(name)`, `JoinRoom(code, name)`, `LeaveRoom`, `UpdateRoom(settings)`, `SetSeat(seat, type)`, `SetName(name)`,
`MoveToSeat(seat)`, `StartGame`, `Input([kind, x, y, dir])`, `ReportHash(frame, hash)`, `ReportGameOver`.
Server → client: `Room(RoomView)`, `GameStart(GameStart)`, `Frame(frame, inputs)`, `Desync(frame)`, `PlayerLeft(seat, name)`.
`GET /kingbee/api/info` → `{ game, version, rooms, playing, players }`. Invitation links: `<master>/kingbee/?raum=ABCD`.
