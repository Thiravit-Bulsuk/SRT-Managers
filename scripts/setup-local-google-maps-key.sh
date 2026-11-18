#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${GOOGLE_MAPS_ENV_FILE:-${REPO_ROOT}/.env}"
OUTPUT_FILE="${REPO_ROOT}/public/config.js"
KEY="${GOOGLE_MAPS_API_KEY:-}"
POSITIONAL=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage:"
      echo "  GOOGLE_MAPS_API_KEY='YOUR_KEY' ./scripts/setup-local-google-maps-key.sh"
      echo "  ./scripts/setup-local-google-maps-key.sh 'YOUR_KEY'"
      echo "  ./scripts/setup-local-google-maps-key.sh --env-file .env"
      echo "  ./scripts/setup-local-google-maps-key.sh --output public/config.js --env-file .env"
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

if [[ -z "${KEY}" && ${#POSITIONAL[@]} -gt 0 ]]; then
  KEY="${POSITIONAL[0]}"
fi

if [[ -z "${KEY}" && -f "${ENV_FILE}" ]]; then
  ENV_KEY="$(grep -E '^GOOGLE_MAPS_API_KEY=' "${ENV_FILE}" | head -n 1 | cut -d= -f2- | tr -d '\r' | sed "s/^['\"]//; s/['\"]$//")"
  if [[ -n "${ENV_KEY}" ]]; then
    KEY="${ENV_KEY}"
  fi
fi

if [[ -z "${KEY}" ]]; then
  echo "No Google Maps API key found. Provide GOOGLE_MAPS_API_KEY, a positional argument, or a .env file."
  echo "Usage: GOOGLE_MAPS_API_KEY='YOUR_KEY' ./scripts/setup-local-google-maps-key.sh"
  echo "       ./scripts/setup-local-google-maps-key.sh 'YOUR_KEY'"
  echo "       ./scripts/setup-local-google-maps-key.sh --env-file .env"
  exit 1
fi

case "${KEY}" in
  YOUR_*|REPLACE_*|example*|demo_*)
    echo "Refusing to use placeholder value: ${KEY}"
    echo "Open .env and replace it with your real Google Maps API key."
    exit 1
    ;;
esac

if [[ ${#KEY} -lt 20 ]]; then
  echo "This does not look like a valid Google Maps API key: ${KEY}"
  echo "Open .env and replace it with your real Google Maps API key."
  exit 1
fi

mkdir -p "$(dirname "${OUTPUT_FILE}")"
printf "window.GOOGLE_MAPS_API_KEY = '%s';\n" "${KEY}" > "${OUTPUT_FILE}"

echo "Generated ${OUTPUT_FILE} for local testing."
echo "Run: python3 -m http.server 8000"
echo "Then open: http://localhost:8000/public/index.html"
