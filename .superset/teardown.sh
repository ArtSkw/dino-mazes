#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

./.superset/port.sh stop
./.superset/port.sh release
