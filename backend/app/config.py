import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS_DIR = Path(os.environ.get("ASSETS_DIR", ROOT / "data")).resolve()
STATIC_DIR = Path(os.environ.get("STATIC_DIR", ROOT / "frontend" / "dist")).resolve()

# Optional oversized SQLite (GitHub 100MB limit). Prefer data/, else data-large/.
_DB_CANDIDATES = [
    ASSETS_DIR / "variants_index.db",
    ROOT / "data-large" / "variants_index.db",
]


def resolve_variants_db() -> Path | None:
    for p in _DB_CANDIDATES:
        if p.exists() and p.is_file():
            return p
    return None


SPECIES = "Apis mellifera"
PIPELINE_VERSION = "Slurm Batch v4.2"
ASSEMBLY = "Amel_HAv3.1"

LINEAGE_COLORS = {
    "A": "#E4572E",
    "C": "#2E86AB",
    "M": "#F2C14E",
    "O": "#76B041",
    "Y": "#8E44AD",
    "Unassigned": "#9AA0A6",
}

COUNTRY_COORDS = {
    "France": (46.2, 2.2),
    "Italy": (41.9, 12.5),
    "South Africa": (-30.6, 22.9),
    "Ireland": (53.1, -7.7),
    "Switzerland": (46.8, 8.2),
    "North America": (39.8, -98.5),
    "Sweden": (60.1, 18.6),
    "Spain": (40.4, -3.7),
    "Kenya": (-0.02, 37.9),
    "Finland": (61.9, 25.7),
    "China": (35.9, 104.2),
    "Morocco": (31.8, -7.1),
    "New Caledonia": (-21.3, 165.5),
    "Germany": (51.2, 10.5),
    "United Kingdom": (54.0, -2.5),
    "Portugal": (39.4, -8.2),
    "Poland": (51.9, 19.1),
    "Uganda": (1.4, 32.3),
    "Slovenia": (46.1, 14.8),
    "Saudi Arabia": (23.9, 45.1),
    "Egypt": (26.8, 30.8),
    "mudanjiang": (44.6, 129.6),
    "Turkey": (39.0, 35.2),
    "huichun": (42.9, 130.4),
    "Yemen": (15.6, 48.5),
    "Syria": (34.8, 38.9),
    "Kyrgyzstan": (41.2, 74.8),
    "Madagascar": (-18.8, 46.9),
    "Slovakia": (48.7, 19.7),
    "Croatia": (45.1, 15.2),
    "Jordan": (31.2, 36.5),
    "Israel": (31.0, 34.9),
    "Ethiopia": (9.1, 40.5),
    "Tanzania": (-6.4, 34.9),
    "Zambia": (-13.1, 27.8),
    "Malawi": (-13.3, 34.3),
    "Netherlands": (52.1, 5.3),
    "Belgium": (50.5, 4.5),
    "Austria": (47.5, 14.5),
    "Hungary": (47.2, 19.5),
    "Romania": (45.9, 24.9),
    "Bulgaria": (42.7, 25.5),
    "Greece": (39.1, 21.8),
    "Denmark": (56.3, 9.5),
    "Norway": (60.5, 8.5),
    "Russia": (61.5, 105.3),
    "Japan": (36.2, 138.3),
    "Australia": (-25.3, 133.8),
    "Brazil": (-14.2, -51.9),
    "Chile": (-35.7, -71.5),
    "Argentina": (-38.4, -63.6),
    "USA": (37.1, -95.7),
    "United States": (37.1, -95.7),
    "Canada": (56.1, -106.3),
}
