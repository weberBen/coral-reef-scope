"""python -m coral_sim.terrain <config.yaml> — generate terrain according to the configured source."""

import sys

from . import get_terrain, load_config, resolve_path
from .io import save_terrain

if len(sys.argv) < 2:
    print("Usage: python -m coral_sim.terrain <config.yaml>")
    sys.exit(1)

config = load_config(sys.argv[1])
terrain = get_terrain(config)
save_terrain(resolve_path(config, config["terrain"]["output"]), terrain)
