#!/usr/bin/env bash
# NEX Truth-Law 24h burn-in · scheduler for T+6h/T+12h/T+24h snapshots.
# Started at T+0 by a foreground invocation. Observation only.
# Reads baseline from data/burnin/burnin-manifest.json.
set -eu
BURNIN_DIR="/c/Users/Victus/trades/data/burnin"
LOG="$BURNIN_DIR/scheduler.log"
SNAP="/c/Users/Victus/trades/scripts/burnin-snapshot.mjs"
ENVFILE="/c/Users/Victus/trades/.env.local"
T0_EPOCH="$1"
echo "[$(date -u +%FT%TZ)] scheduler-start · T0_EPOCH=$T0_EPOCH · PID=$$" >> "$LOG"
# Snapshot at each checkpoint · sleep to target
for tag in "T+6h:21600" "T+12h:43200" "T+24h:86400"; do
  LABEL="${tag%%:*}"
  OFFSET="${tag##*:}"
  TARGET=$((T0_EPOCH + OFFSET))
  NOW=$(date -u +%s)
  WAIT=$((TARGET - NOW))
  if [ "$WAIT" -gt 0 ]; then
    echo "[$(date -u +%FT%TZ)] sleeping $WAIT s until $LABEL (target $(date -u -d @$TARGET +%FT%TZ))" >> "$LOG"
    sleep "$WAIT"
  fi
  echo "[$(date -u +%FT%TZ)] firing $LABEL snapshot" >> "$LOG"
  # Run snapshot · capture stdout and any exit code
  if node --env-file="$ENVFILE" "$SNAP" >> "$LOG" 2>&1; then
    echo "[$(date -u +%FT%TZ)] $LABEL · snapshot exit 0" >> "$LOG"
  else
    RC=$?
    echo "[$(date -u +%FT%TZ)] $LABEL · snapshot exit $RC" >> "$LOG"
  fi
done
echo "[$(date -u +%FT%TZ)] scheduler-complete · all 3 checkpoints fired" >> "$LOG"
