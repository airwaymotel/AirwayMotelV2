#!/bin/bash
cd /home/z/my-project

# Start the dev server
npx next dev -p 3000 &
SERVER_PID=$!

# Keep-alive loop - ping every 5s to prevent idle kill
while kill -0 $SERVER_PID 2>/dev/null; do
  sleep 5
  curl -s --max-time 3 http://127.0.0.1:3000/ > /dev/null 2>&1
done

echo "Server died, restarting..."
exec bash "$0"
