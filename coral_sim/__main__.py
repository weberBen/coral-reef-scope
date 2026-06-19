"""python -m coral_sim <config.yaml> — generate terrain and display it."""

import sys

from .terrain import get_terrain, load_config, resolve_path
from .terrain.io import save_terrain
from .viz import show_terrain

if len(sys.argv) < 2:
    print("Usage: python -m coral_sim <config.yaml>")
    sys.exit(1)

config = load_config(sys.argv[1])

# Generate terrain
terrain = get_terrain(config)
save_terrain(resolve_path(config, config["terrain"]["output"]), terrain)

# Visualize
show_terrain(terrain, config.get("viz", {}))
