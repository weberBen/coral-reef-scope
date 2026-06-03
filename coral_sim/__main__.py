"""python -m coral_sim <config.yaml> — génère le terrain et l'affiche."""

import sys

from .terrain import get_terrain, load_config
from .terrain.io import save_terrain
from .viz import show_terrain

if len(sys.argv) < 2:
    print("Usage: python -m coral_sim <config.yaml>")
    sys.exit(1)

config = load_config(sys.argv[1])

# Générer le terrain
terrain = get_terrain(config)
save_terrain(config["terrain"]["output"], terrain)

# Visualiser
show_terrain(terrain, config.get("viz", {}))
