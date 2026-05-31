#!/usr/bin/env bash
set -euo pipefail

PORTS=(3000 4001)

for port in "${PORTS[@]}"; do
  pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "⚠ Port $port is in use by PID(s): $(echo "$pids" | tr '\n' ' ')"
    for pid in $pids; do
      kill "$pid" 2>/dev/null && echo "  ✓ Killed process $pid" || echo "  ✗ Failed to kill process $pid"
    done
    # Wait briefly for ports to be released
    sleep 0.5
  fi
done

exec npx next dev
