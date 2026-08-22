#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"
python3 "$DIR/scripts/grts_service.py" start
sleep 0.5
if command -v open >/dev/null 2>&1; then
    open "$DIR/extension/dashboard.html"
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$DIR/extension/dashboard.html"
fi
