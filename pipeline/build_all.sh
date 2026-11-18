#!/usr/bin/env bash
# Rebuild the knowledge graph and all web-app data from sources/ and content/.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -I pipeline/validate_content.py
python3 -I pipeline/build_graph.py
python3 -I pipeline/build_library.py
