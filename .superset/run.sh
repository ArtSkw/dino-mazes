#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d node_modules ] || npm ci --no-audit --no-fund

port="$(./.superset/port.sh get)"
# Something outside Superset (e.g. `npm run dev` in the main checkout) grabbed our port.
if lsof -nP -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
  ./.superset/port.sh release
  port="$(./.superset/port.sh claim)"
fi

# Label the port in Superset's Port Panel (generated per workspace, gitignored).
printf '{ "ports": [{ "port": %s, "label": "Dino Mazes dev server" }] }\n' "$port" >.superset/ports.json

echo "Dev server: http://localhost:$port/"
exec npm run dev -- --port "$port" --strictPort
