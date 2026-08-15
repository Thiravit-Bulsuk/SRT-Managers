#!/bin/bash
# Update Backend Configuration for Docker-based Parser

set -e

ENV_FILE="/Users/koy/Documents/SRT Managers/server/.env"
DOCKER_WRAPPER="/Users/koy/Documents/SRT Managers/dji-parser-docker.sh"

echo "🔧 Updating Backend Configuration"
echo "=================================="
echo ""

# Make wrapper executable
chmod +x "$DOCKER_WRAPPER"
echo "✅ Docker wrapper script ready"
echo ""

# Backup existing .env
if [ -f "$ENV_FILE" ]; then
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%s)"
    echo "✅ Backed up existing .env"
fi

# Update .env
echo "Updating $ENV_FILE..."
cat > "$ENV_FILE" << EOF
PORT=3001
DJI_APP_KEY=e60bfac6a6a9d0a146924dff
TEMP_DIR=./tmp
DJI_PARSER_COMMAND=bash
DJI_PARSER_ARGS=$DOCKER_WRAPPER --in {input} --key {key} --json
EOF

echo "✅ .env updated with Docker configuration"
echo ""
echo "📝 Configuration:"
echo "   Parser Command: bash"
echo "   Parser Script: $DOCKER_WRAPPER"
echo ""
echo "✅ Ready to use Docker-based parser!"
echo ""
echo "Next steps:"
echo "1. Make sure Docker Desktop is running"
echo "2. Build the Docker image (if not done):"
echo "   bash /Users/koy/Documents/SRT\\ Managers/build-docker-parser.sh"
echo ""
echo "3. Restart the backend:"
echo "   cd '/Users/koy/Documents/SRT Managers/server'"
echo "   pkill -f 'node server.js' || true"
echo "   node server.js"
echo ""
echo "4. Test with:"
echo "   curl -X POST -F 'file=@/Users/koy/Documents/SRT\\ Managers/DJIFlightRecord_2026-08-14_[06-10-03]\\ 2.txt' http://localhost:3001/api/flight-record/parse"
