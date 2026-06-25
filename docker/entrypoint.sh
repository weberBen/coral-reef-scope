#!/bin/sh
set -e

CONFIG_FILE="${CONFIG_FILE:-config.yaml}"
DATA_DIR=$(python -c "import yaml; print(yaml.safe_load(open('$CONFIG_FILE')).get('data_dir', 'data'))")
TERRAIN_OUTPUT=$(python -c "import yaml; c=yaml.safe_load(open('$CONFIG_FILE')); print(c['terrain']['output'])")
TERRAIN_FILE="$DATA_DIR/$TERRAIN_OUTPUT"

mkdir -p "$DATA_DIR"

if [ ! -f "$TERRAIN_FILE" ] || [ "${FORCE_REGENERATE:-0}" = "1" ]; then
    echo "[entrypoint] Generating terrain from $CONFIG_FILE..."
    python -m coral_sim.terrain "$CONFIG_FILE"
    echo "[entrypoint] Terrain generated: $TERRAIN_FILE"
else
    echo "[entrypoint] Terrain already exists: $TERRAIN_FILE"
fi

exec "$@"
