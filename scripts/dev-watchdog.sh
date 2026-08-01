#!/bin/bash
cd /home/z/my-project
while true; do
  npx next dev -p 3000 2>&1
  echo "[$(date)] Server exited, restarting in 2s..." >&2
  sleep 2
done
