"""Nuclear chromosome helpers for Amel_HAv3.1 (16 linkage groups)."""

from __future__ import annotations

# NC_037638.1 .. NC_037653.1  => Chr1 .. Chr16
NUCLEAR_CHROMS: list[str] = [f"NC_0376{38 + i}.1" for i in range(16)]
CHROM_TO_LABEL: dict[str, str] = {
    chrom: f"Chr{i + 1}" for i, chrom in enumerate(NUCLEAR_CHROMS)
}
LABEL_TO_CHROM: dict[str, str] = {v: k for k, v in CHROM_TO_LABEL.items()}
MT_CHROM = "NC_001566.1"

LINEAGE_COLORS = {
    "A": "#E4572E",
    "C": "#2E86AB",
    "M": "#F2C14E",
    "O": "#76B041",
    "Y": "#8E44AD",
    "Unassigned": "#9AA0A6",
}


def chrom_label(chrom: str) -> str:
    return CHROM_TO_LABEL.get(chrom, chrom)


def is_nuclear(chrom: str) -> bool:
    return chrom in CHROM_TO_LABEL
