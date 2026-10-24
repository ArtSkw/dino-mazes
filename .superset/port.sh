#!/usr/bin/env bash
# Per-workspace dev-server port, shared across all Dino Mazes worktrees.
# Usage: port.sh get|claim|release|stop
set -euo pipefail

ws="$(cd "$(dirname "$0")/.." && pwd -P)"
allocations="${SUPERSET_HOME_DIR:-$HOME/.superset}/port-allocations"
dir="$allocations/dino-mazes"
# Clear of the main checkout's 5173 and of other projects' ranges (Storybook: 5173-5272).
first=5300
last=5399
mkdir -p "$dir"

listening() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null; }

owned() {
  for slot in "$dir"/*; do
    if [ -f "$slot/owner" ] && [ "$(cat "$slot/owner")" = "$ws" ]; then
      basename "$slot"
      return 0
    fi
  done
  return 1
}

# True if another project's allocator holds this port.
taken_elsewhere() {
  local other
  for other in "$allocations"/*/"$1"; do
    [ -e "$other" ] && [ "$other" != "$dir/$1" ] && return 0
  done
  return 1
}

claim() {
  for ((port = first; port <= last; port++)); do
    slot="$dir/$port"
    # Reclaim slots whose workspace was deleted without running teardown.
    if [ -f "$slot/owner" ] && [ ! -d "$(cat "$slot/owner")" ]; then
      rm -rf "$slot"
    fi
    if taken_elsewhere "$port" || listening "$port" >/dev/null; then continue; fi
    if mkdir "$slot" 2>/dev/null; then
      echo "$ws" >"$slot/owner"
      echo "$port"
      return 0
    fi
  done
  echo "No free port in $first-$last" >&2
  return 1
}

# Kill the dev server on this workspace's port, but only if it runs from this worktree.
stop() {
  port="$(owned)" || return 0
  for pid in $(listening "$port"); do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    if [ "$cwd" = "$ws" ]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

case "${1:-get}" in
  get) owned || claim ;;
  claim) owned || claim ;;
  release)
    if port="$(owned)"; then rm -rf "${dir:?}/$port"; fi
    ;;
  stop) stop ;;
  *)
    echo "Usage: $0 get|claim|release|stop" >&2
    exit 2
    ;;
esac
