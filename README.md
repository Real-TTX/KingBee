<div align="center">

<img src="docs/images/logo.png" alt="King Bee" width="620">

### Lenke den Schwarm. Füll deinen Stock. Lass die Königin schlüpfen.

Ein schnelles 3D-Strategiespiel im Browser: Hunderte Bienen schwirren über das Spielfeld,
du lenkst sie mit Pfeilen in deinen Bienenstock und schickst die Hornissen zur Konkurrenz.
Ist dein Stock voll, **schlüpft die neue Königin**.

[![Build & Publish](https://github.com/Real-TTX/KingBee/actions/workflows/docker-image.yml/badge.svg)](https://github.com/Real-TTX/KingBee/actions/workflows/docker-image.yml)
![Three.js](https://img.shields.io/badge/Three.js-r187-black?logo=threedotjs)
![.NET](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet)
![SignalR](https://img.shields.io/badge/Multiplayer-SignalR-ffb000)
![Docker](https://img.shields.io/badge/Docker-amd64%20%7C%20arm64-2496ED?logo=docker&logoColor=white)

<img src="docs/images/battle.png" alt="Schwarm-Kampf gegen drei KI-Gegner" width="900">

</div>

---

## Was ist King Bee?

Aus Blüten schwärmen ununterbrochen Bienen. Sie fliegen stur geradeaus und biegen an Wänden ab.
Du hast nur **drei Pfeile**, um den Strom umzuleiten, und deine Gegner haben auch drei.
Wer die meisten Bienen in seinen Stock lotst, gewinnt. Wer eine Hornisse in den Stock lässt, verliert ein Drittel seines Volkes.

<table>
<tr>
<td width="50%"><img src="docs/images/menu.png" alt="Hauptmenü"></td>
<td width="50%"><img src="docs/images/queen.png" alt="Die Königin schlüpft"></td>
</tr>
<tr>
<td align="center"><b>Hauptmenü</b>: die KI spielt im Hintergrund schon mal vor</td>
<td align="center"><b>Sieg</b>: die neue Königin schlüpft aus deinem Stock</td>
</tr>
<tr>
<td width="50%"><img src="docs/images/event.png" alt="Ereignis-Rad"></td>
<td width="50%"><img src="docs/images/event-move.png" alt="Alle umziehen"></td>
</tr>
<tr>
<td align="center"><b>Ereignis</b>: das Spiel hält an, das Rad dreht sich in der Mitte</td>
<td align="center"><b>Alle umziehen!</b>: die Bienenstöcke fliegen auf neue Plätze</td>
</tr>
<tr>
<td width="50%"><img src="docs/images/puzzle.png" alt="Puzzle-Modus"></td>
<td width="50%"><img src="docs/images/online-lobby.png" alt="Online-Lobby"></td>
</tr>
<tr>
<td align="center"><b>Puzzle</b>: 12 Level, jedes per Solver als lösbar geprüft</td>
<td align="center"><b>Online</b>: Raum erstellen, Code teilen, losspielen</td>
</tr>
</table>

## Spielmodi

| Modus | Worum geht's |
|---|---|
| **Schwarm-Kampf** | Du gegen 1–3 KI-Gegner (Leicht / Normal / Schwer) auf 6 Karten. Erster mit vollem Stock gewinnt, sonst der Führende bei Zeitende. |
| **Solo** | Fülle deinen Stock, bevor die Zeit abläuft. Die anderen Stöcke gehören Wildbienen. |
| **Online** | Bis zu 4 Spieler, freie Plätze mit KI auffüllen. Beitritt per 4-Buchstaben-Code oder Einladungslink, beim ersten Mal wird nach deinem Namen gefragt. |
| **Puzzle** | Pfeile legen, Start drücken: Jede Biene muss heim, keine darf gefressen werden. 12 Level mit steigender Schwierigkeit. |

## Die Regeln in 30 Sekunden

- **Bienen** fliegen geradeaus. An einer Wand biegen sie **rechts** ab, sonst links, sonst kehren sie um.
- **Pfeile** schicken alles, was darüber fliegt, in ihre Richtung. Jeder hat 3, ein vierter ersetzt den ältesten.
- **Hornissen** fressen Bienen und beschädigen Pfeile. Erreicht eine einen Stock, verliert der Besitzer **ein Drittel** seiner Bienen.
- **Löcher** verschlucken alles, was hineinfliegt.
- **Goldbienen** zählen 10 Punkte. **Blütenbienen** (rosa) bringen einen Bonus: Nektar, Raubzug, Wachsschild oder Duftspur.

### Ereignisse

Regelmäßig **hält das Spiel kurz an** und in der Bildmitte dreht sich das Ereignis-Rad. Jedes Ereignis hat eine eigene Animation,
danach geht es weiter. Wie oft das passiert, stellst du vor dem Spiel ein: **Aus, Selten, Normal, Oft oder Chaos**.

| Ereignis | Effekt |
|---|---|
| Schwarmzeit | Die Blüten sprudeln über vor Bienen |
| Hornissen-Alarm | Ein ganzes Nest fliegt aus |
| Rückenwind | Alles fliegt doppelt so schnell |
| Zeitlupe | Honigregen: alles fliegt ganz langsam |
| Goldfieber | Viele Goldbienen |
| Windstoß | Alle Pfeile werden vom Brett geweht |
| Imker-Rauch | Alle Hornissen verschwinden |
| Wirbelwind | Alle Tiere drehen um |
| **Alle umziehen!** | Die Bienenstöcke heben ab und landen auf zufälligen neuen Plätzen |
| Blütenwechsel | Die Blüten schicken ihre Bienen 12 Sekunden lang in neue Richtungen |
| Verkehrte Welt | Alle Pfeile drehen sich in die Gegenrichtung |
| Pfeilregen | 15 Sekunden lang 5 statt 3 Pfeile für alle |

Fliegt eine Hornisse in deinen Stock, ist das nicht zu übersehen: roter Bildschirmrand, großes „Autsch!“, wackelnde Punkteanzeige und auf dem Handy Vibration.

### Steuerung

| Aktion | Maus / Tastatur | Touch |
|---|---|---|
| Pfeil legen | Feld anvisieren + <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> oder Pfeiltasten, oder ziehen | Über das Feld in die Richtung wischen (mit Vorschau) |
| Pfeil drehen | Klick auf eigenen Pfeil | Tippen |
| Pfeil entfernen | Rechtsklick | – |
| Puzzle starten / stoppen | <kbd>Leertaste</kbd> | Button |
| Pause / Ton | <kbd>Esc</kbd> / <kbd>M</kbd> | Buttons |

<div align="center">
<img src="docs/images/mobile.png" alt="King Bee auf dem Handy" width="260">
<br><sub>Auf dem Handy im Hochformat dreht sich das Brett, damit die Felder groß genug zum Wischen sind</sub>
</div>

## Schnellstart

**Fertiges Image** (wird bei jedem Push auf `main` gebaut, für amd64 und arm64):

```bash
docker run -d --name kingbee -p 7461:8080 ghcr.io/real-ttx/kingbee:latest
```

**Selbst bauen** mit Docker Compose:

```bash
docker compose up -d --build        # http://localhost:7461
KINGBEE_PORT=7500 docker compose up -d   # anderer Port
```

Mitspieler im selben Netz öffnen `http://<IP-dieses-Rechners>:7461`, gehen auf **Online** und treten mit dem Raum-Code bei.

**Entwicklung:**

```bash
npm install
npm run dev                                   # Frontend mit Hot Reload (Vite)
dotnet run --project server/KingBee.Server    # Backend auf :5080, Vite leitet /api und /hubs dorthin
```

## Wie der Multiplayer funktioniert

King Bee nutzt **deterministischen Lockstep**. Die Simulation (inklusive KI) rechnet ausschließlich mit
Ganzzahlen und einem Zufallsgenerator mit gemeinsamem Startwert. Deshalb muss der Server das Spiel nicht
selbst simulieren: Er ist nur der **Taktgeber**.

```mermaid
sequenceDiagram
    participant A as Spieler A
    participant S as Server (SignalR)
    participant B as Spieler B
    A->>S: Pfeil (x, y, Richtung)
    B->>S: Pfeil (x, y, Richtung)
    loop alle 50 ms
        S-->>A: Frame n + alle Eingaben
        S-->>B: Frame n + alle Eingaben
        Note over A,B: Eingaben anwenden, 3 Ticks rechnen,<br/>beide haben exakt denselben Zustand
    end
    A->>S: Prüfsumme (alle 20 Frames)
    B->>S: Prüfsumme
    S-->>A: Warnung nur bei Abweichung
```

Das hält den Server winzig, der Netzwerkverkehr ist minimal (nur Pfeil-Eingaben) und alle sehen garantiert dasselbe Spiel.
Ein Test prüft, dass zwei unabhängige Clients über tausende Frames bit-identisch bleiben.

## Qualität & Werkzeuge

```bash
npm run verify                          # Solver prüft jedes Puzzle: lösbar und nicht mit weniger Pfeilen
node tools/test-lockstep.mjs            # zwei Clients müssen bit-identisch bleiben
node tools/sim-battle.mjs normal        # KI gegen KI auf allen Karten (Balancing)
node tools/gen-puzzle.mjs 12 40 5 2 3   # sucht knifflige Startaufstellungen für ein Puzzle
```

Die GitHub Action führt Verifier, Lockstep-Test und beide Builds aus und veröffentlicht danach das Multi-Arch-Image auf `ghcr.io`.

## Projektaufbau

```
src/
  game/       Spiellogik ohne Grafik: Simulation, Kampf + Wellen, KI, Puzzles, Karten, Lockstep
  render/     Three.js: Szene, Modelle, Landschaft, Partikel, Schlüpf-Sequenz
  ui/         SVG-Logo, Icon-Set, Karten-Vorschau
  main.js     Menüs, Online-Lobby, HUD, Eingabe, Game-Loop
  net.js      SignalR-Verbindung
server/KingBee.Server/
  Multiplayer/GameHub.cs     Räume, Plätze, Start, Eingaben, Prüfsummen
  Multiplayer/FrameLoop.cs   der 50-ms-Takt
  Program.cs                 liefert das Spiel aus, /api/health, /hubs/game
tools/        Solver, Generator, Tests
```

**Technik:** Three.js · Vite · WebAudio (alle Sounds werden live erzeugt, keine Audiodateien) ·
ASP.NET Core 10 · SignalR · Docker (Multi-Stage, amd64 + arm64)

<div align="center">
<br>
<sub>Lang lebe die Königin.</sub>
</div>
