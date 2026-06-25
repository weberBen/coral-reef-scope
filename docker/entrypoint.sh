#!/bin/sh
set -e

REEF_OUTPUT="${REEF_OUTPUT:-data/reef.glb}"

mkdir -p "$(dirname "$REEF_OUTPUT")"

if [ ! -f "$REEF_OUTPUT" ] || [ "${FORCE_REGENERATE:-0}" = "1" ]; then
    echo "[entrypoint] Generating reef GLB..."
    python tools/reef_export.py \
        --lat "${REEF_LAT:--17.52}" \
        --lon "${REEF_LON:--149.83}" \
        --radius "${REEF_RADIUS:-4}" \
        --resolution "${REEF_RESOLUTION:-0.0003}" \
        --label "${REEF_LABEL:-Moorea Nord}" \
        --location "${REEF_LOCATION:-French Polynesia}" \
        --cache-dir "${REEF_CACHE_DIR:-cache}" \
        -o "$REEF_OUTPUT"
    echo "[entrypoint] Reef exported: $REEF_OUTPUT"
else
    echo "[entrypoint] Reef already exists: $REEF_OUTPUT"
fi

exec "$@"
