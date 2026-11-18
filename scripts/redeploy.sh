#!/usr/bin/env sh
# King Bee runs inside MatGame: rebuilds and starts the local MatGame stack (../MatGame next to this repository). --clean drops its volumes.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
matgame="$here/../../MatGame/scripts/redeploy.sh"
if [ ! -f "$matgame" ]; then
  echo "MatGame fehlt: $matgame (das Repository Real-TTX/MatGame neben KingBee auschecken)." >&2
  exit 1
fi
sh "$matgame" "$@"
echo "King Bee: http://localhost:2770/kingbee/"
