#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

root="${SUPERSET_ROOT_PATH:?SUPERSET_ROOT_PATH is not set}"

# Copy gitignored env files (.env.local holds the ElevenLabs key for tools/audio).
# Existing files are left alone so re-running setup never clobbers local edits.
for src in "$root"/.env "$root"/.env.*; do
  [ -f "$src" ] || continue
  name="$(basename "$src")"
  if [ -e "$name" ]; then
    echo "Keeping existing $name"
  else
    cp "$src" "$name"
    echo "Copied $name from main checkout"
  fi
done

# The gitignored art inputs (reference images, ~370 MB of source art and audio takes)
# are linked, not copied: the art and audio tools read them, and takes stay in one place.
for rel in art/references art/source; do
  if [ -e "$rel" ] || [ -L "$rel" ]; then
    echo "Keeping existing $rel"
  elif [ -d "$root/$rel" ]; then
    ln -s "$root/$rel" "$rel"
    echo "Linked $rel to main checkout"
  fi
done

npm ci --no-audit --no-fund

port="$(./.superset/port.sh claim)"
echo "Dev server port for this workspace: $port"
