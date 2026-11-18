#!/bin/sh
set -eu

case "${GOOGLE_MAPS_API_KEY:-}" in
  ''|*[!A-Za-z0-9_-]*)
    echo 'A valid GOOGLE_MAPS_API_KEY secret is required.' >&2
    exit 1
    ;;
esac

printf "window.GOOGLE_MAPS_API_KEY = '%s';\n" "$GOOGLE_MAPS_API_KEY" > /usr/share/nginx/html/config.js