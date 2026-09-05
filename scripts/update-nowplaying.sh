#!/bin/bash
# Updates the now-playing JSON file with current track info
# Called by Liquidsoap's on_metadata callback

TITLE="$1"
ARTIST="$2"

NOWPLAYING_FILE="/opt/radio/nowplaying.json"

# Escape quotes for JSON
TITLE=$(echo "$TITLE" | sed 's/"/\\"/g')
ARTIST=$(echo "$ARTIST" | sed 's/"/\\"/g')

echo "{\"title\":\"$TITLE\",\"artist\":\"$ARTIST\",\"timestamp\":\"$(date -Iseconds)\"}" > "$NOWPLAYING_FILE"

# Also emit to socket (if web app is running)
if command -v curl &> /dev/null; then
    curl -s -X POST http://localhost:3000/api/nowplaying \
         -H "Content-Type: application/json" \
         -d "{\"title\":\"$TITLE\",\"artist\":\"$ARTIST\"}" > /dev/null 2>&1 &
fi
