#!/usr/bin/env python3
"""Extract REF/ALT alleles from cohort VCF into data/variants_alleles.tsv.

Usage:
  python scripts/extract_alleles_from_vcf.py \\
    --vcf /path/to/cohort_2360_clean.vcf.gz \\
    --out data/variants_alleles.tsv
"""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vcf", required=True)
    parser.add_argument("--out", default="data/variants_alleles.tsv")
    parser.add_argument("--limit", type=int, default=0, help="0 = all")
    args = parser.parse_args()

    try:
        import pysam
    except ImportError as e:
        raise SystemExit("pip install pysam first") from e

    vcf = Path(args.vcf)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    n = 0
    with pysam.VariantFile(str(vcf)) as vf, out.open("w", encoding="utf-8") as fh:
        fh.write("chrom\tpos\tref\talt\n")
        for rec in vf:
            if not rec.alts:
                continue
            fh.write(f"{rec.contig}\t{rec.pos}\t{rec.ref}\t{rec.alts[0]}\n")
            n += 1
            if args.limit and n >= args.limit:
                break
    print(f"wrote {n} alleles -> {out}")


if __name__ == "__main__":
    main()
