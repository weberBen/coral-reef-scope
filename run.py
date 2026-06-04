"""Point d'entrée principal — raccourci pour python -m coral_sim."""

import sys

from coral_sim.terrain import get_terrain, load_config, resolve_path
from coral_sim.terrain.io import save_terrain
from coral_sim.viz import show_terrain

if len(sys.argv) < 2:
    print("Usage: python run.py <config.yaml>")
    sys.exit(1)

config = load_config(sys.argv[1])

terrain = get_terrain(config)
save_terrain(resolve_path(config, config["terrain"]["output"]), terrain)

show_terrain(terrain, config.get("viz", {}))
