#!/usr/bin/env bash
# Optional: enable full 4.7M SNP SQLite index for local/full deploy.
# WARNING: variants_index.db is ~543MB and exceeds GitHub's 100MB file limit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/data-large/variants_index.db"
DST="$ROOT/data/variants_index.db"

if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC"
  exit 1
fi

cp -f "$SRC" "$DST"
echo "Copied variants_index.db into data/ for local full Variation queries."
echo "Do NOT git-add this file unless you use Git LFS."
