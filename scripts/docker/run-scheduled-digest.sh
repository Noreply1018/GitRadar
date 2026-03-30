#!/usr/bin/env bash

set -euo pipefail

LOCK_DIR="/app/data/runtime/locks"
LOCK_FILE="${LOCK_DIR}/daily-digest.lock"
NOW="$(date -Iseconds)"

mkdir -p "${LOCK_DIR}"

(
  flock -n 9 || {
    echo "[${NOW}] Skip scheduled digest because another run is still active."
    exit 0
  }

  echo "[${NOW}] Scheduled digest run started."
  npm run generate:digest:send
  echo "[$(date -Iseconds)] Scheduled digest run completed."
) 9>"${LOCK_FILE}"
