# King Bee

3D-Browserspiel: Lenke Bienenschwärme mit Pfeilen in deinen Stock und halte die Hornissen fern.
Ist der Stock voll, schlüpft die neue Königin. Allein gegen die KI, als Puzzle oder online mit Freunden.

## Starten (Docker)

```bash
docker compose up -d --build
```

Dann im Browser: http://localhost:7461

Anderer Port: `KINGBEE_PORT=7500 docker compose up -d`

Mitspieler im selben Netzwerk öffnen `http://<IP-dieses-Rechners>:7461`, gehen auf **Online** und
treten mit dem 4-stelligen Raum-Code bei (oder über den Einladungslink `/?raum=CODE`).

## Entwicklung

```bash
npm install
npm run dev                                   # Vite-Devserver (Frontend, Hot Reload)
dotnet run --project server/KingBee.Server    # Backend auf :5080 (für Online); Vite leitet /api und /hubs dorthin weiter
```

## Werkzeuge

```bash
npm run verify                          # prüft alle Puzzles (lösbar, Mindestzahl Pfeile) und Kampf-Karten
node tools/test-lockstep.mjs            # zwei simulierte Clients müssen bit-identisch bleiben
node tools/sim-battle.mjs normal        # KI gegen KI auf allen Karten (Balancing)
node tools/gen-puzzle.mjs 12 40 5 2 3   # sucht schwere Startaufstellungen für ein Puzzle
```

## Multiplayer: wie es funktioniert

Deterministischer **Lockstep**: Die Spielsimulation (inkl. KI) rechnet nur mit Ganzzahlen und einem
Zufallsgenerator mit festem Startwert. Der Server simuliert nichts, er ist nur der Taktgeber. Alle 50 ms
schickt er jedem Client im Raum einen Frame mit den gesammelten Pfeil-Eingaben. Jeder Client wendet sie
zu Beginn des Frames an und rechnet dann 3 Ticks. So entsteht bei allen exakt dasselbe Spiel. Zur Kontrolle
melden die Clients regelmäßig eine Prüfsumme, und der Server meldet Abweichungen.

| Teil | Datei |
|---|---|
| SignalR-Hub (Räume, Plätze, Start, Eingaben) | `server/KingBee.Server/Multiplayer/GameHub.cs` |
| Takt (Frames alle 50 ms) | `server/KingBee.Server/Multiplayer/FrameLoop.cs` |
| Raumverwaltung | `server/KingBee.Server/Multiplayer/Rooms.cs` |
| Client-Verbindung | `src/net.js` |
| Eingaben anwenden, Prüfsumme | `src/game/lockstep.js` |

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/game/` | Spiellogik ohne Grafik: Simulation, Kampfmodus + Wellen, KI, Puzzles, Karten, Lockstep |
| `src/render/` | Three.js: Szene, Modelle, Landschaft, Partikel, Schlüpf-Sequenz der Königin |
| `src/ui/` | Logo, Icon-Set (SVG), Karten-Vorschau |
| `src/main.js` | Menüs, Online-Lobby, HUD, Eingabe, Game-Loop |
| `server/KingBee.Server` | ASP.NET Core (.NET 10): liefert das Spiel aus, Online-Lobbys per SignalR |
