#!/bin/bash
# Docker-based DJI Parser Wrapper
# This script wraps Docker calls to work like a CLI parser

# Usage: dji-parser-docker.sh --in <file> --key <app_key> --json

INPUT_FILE=""
APP_KEY=""
JSON_OUTPUT=false
IMAGE_NAME="dji-parser"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --in)
            INPUT_FILE="$2"
            shift 2
            ;;
        --key|--app_key|--sdk_key)
            APP_KEY="$2"
            shift 2
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Validate inputs
if [ -z "$INPUT_FILE" ] || [ -z "$APP_KEY" ]; then
    echo '{"error": "Missing --in or --key argument", "ok": false}'
    exit 1
fi

if [ ! -f "$INPUT_FILE" ]; then
    echo "{\"error\": \"File not found: $INPUT_FILE\", \"ok\": false}"
    exit 1
fi

# Get directory and filename
INPUT_DIR=$(dirname "$INPUT_FILE")
INPUT_NAME=$(basename "$INPUT_FILE")

# Check if Docker image exists
if ! docker images --quiet "$IMAGE_NAME" | grep -q .; then
    echo "{\"error\": \"Docker image not found: $IMAGE_NAME. Run: bash build-docker-parser.sh\", \"ok\": false}"
    exit 1
fi

# Run Docker container
docker run --rm \
    -v "$INPUT_DIR":/data \
    -e SDK_KEY="$APP_KEY" \
    "$IMAGE_NAME" \
    "/data/$INPUT_NAME"
