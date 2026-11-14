from __future__ import annotations

import csv
import json
import sqlite3
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any

from .chroms import NUCLEAR_CHROMS, chrom_label, is_nuclear
from .config import ASSETS_DIR, COUNTRY_COORDS, LINEAGE_COLORS, resolve_variants_db


def _load_json(name: str) -> Any:
    with (ASSETS_DIR / name).open(encoding="utf-8") as f:
        return json.load(f)


def _load_text(name: str) -> str:
    return (ASSETS_DIR / name).read_text(encoding="utf-8")


class DataStore:
    def __init__(self) -> None:
        self.samples: list[dict] = _load_json("samples_metadata_2360.json")
        self.admixture: dict = _load_json("admixture_cohort_2360.json")
        self.popgen: dict = _load_json("popgen_metrics_summary_2360.json")
        self.ld_decay: dict = _load_json("cohort_2360_ld_decay.json")
        self.sweeps: list[dict] = _load_json("selective_sweeps_top5pct.json")
        self.gene_cards: list[dict] = _load_json("gene_cards_summary.json")
        self.chrom_sizes: list[dict] = _load_json("chrom_sizes.json")
        self.manifest: list[dict] = _load_json("dataset_manifest.json")
        self.jbrowse_config: dict = _load_json("jbrowse2_config.json")
        self.tree_newick: str = _load_text("cohort_2360_nj.tree").strip()

        self.gene_by_symbol: dict[str, dict] = {}
        self.gene_by_id: dict[str, dict] = {}
        for g in self.gene_cards:
            self.gene_by_symbol[str(g.get("symbol", "")).lower()] = g
            self.gene_by_id[str(g.get("gene_id", "")).lower()] = g

        # Only 16 nuclear chromosomes (hide mitochondrial NC_001566.1)
        size_map = {c["chrom"]: c for c in self.chrom_sizes}
        self.main_chroms = []
        for chrom in NUCLEAR_CHROMS:
            row = size_map.get(chrom)
            if not row:
                continue
            self.main_chroms.append(
                {
                    **row,
                    "label": chrom_label(chrom),
                    "chr_index": NUCLEAR_CHROMS.index(chrom) + 1,
                }
            )
        self._chrom_offsets = self._build_chrom_offsets()
        self._variants_db = resolve_variants_db()
        self._variants_tsv = ASSETS_DIR / "variants_summary_top.tsv"
        self._variants_fallback: list[dict] | None = None
        self._allele_map = self._load_allele_map()
        self._vcf_path = ASSETS_DIR / "cohort_2360_clean.vcf.gz"

    def _build_chrom_offsets(self) -> dict[str, dict]:
        offset = 0
        gap = 2_000_000
        mapping: dict[str, dict] = {}
        for chrom in self.main_chroms:
            name = chrom["chrom"]
            mapping[name] = {
                "offset": offset,
                "length": chrom["length"],
                "label": chrom.get("label") or chrom_label(name),
            }
            offset += chrom["length"] + gap
        return mapping

    def _load_allele_map(self) -> dict[tuple[str, int], tuple[str, str]]:
        """Optional sidecar: data/variants_alleles.tsv with chrom,pos,ref,alt."""
        path = ASSETS_DIR / "variants_alleles.tsv"
        mapping: dict[tuple[str, int], tuple[str, str]] = {}
        if not path.exists():
            return mapping
        with path.open(encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                try:
                    key = (row["chrom"], int(row["pos"]))
                    mapping[key] = (row["ref"], row["alt"])
                except Exception:
                    continue
        return mapping

    def _lookup_alleles(self, chrom: str, pos: int) -> tuple[str | None, str | None]:
        hit = self._allele_map.get((chrom, int(pos)))
        if hit:
            return hit
        # Live VCF lookup when cohort VCF + index are present
        if self._vcf_path.exists() and (ASSETS_DIR / "cohort_2360_clean.vcf.gz.tbi").exists():
            try:
                import pysam  # type: ignore

                with pysam.VariantFile(str(self._vcf_path)) as vf:
                    for rec in vf.fetch(chrom, pos - 1, pos):
                        if int(rec.pos) == int(pos):
                            alt = rec.alts[0] if rec.alts else None
                            return rec.ref, alt
            except Exception:
                return None, None
        return None, None

    def overview_stats(self) -> dict:
        return {
            "n_samples": len(self.samples),
            "n_snps": 4_788_741,
            "n_genes": len(self.gene_cards),
            "n_sweep_windows": len(self.sweeps),
            "species": "Apis mellifera",
            "assembly": "Amel_HAv3.1",
            "pipeline_version": "Slurm Batch v4.2",
        }

    def lineage_counts(self) -> list[dict]:
        counts = Counter(s.get("lineage") or "Unassigned" for s in self.samples)
        total = sum(counts.values()) or 1
        return [
            {
                "lineage": k,
                "count": v,
                "percent": round(100 * v / total, 1),
                "color": LINEAGE_COLORS.get(k, "#888"),
            }
            for k, v in sorted(counts.items(), key=lambda x: -x[1])
        ]

    def caste_counts(self) -> list[dict]:
        counts = Counter(s.get("type") or "Unknown" for s in self.samples)
        total = sum(counts.values()) or 1
        colors = {"Worker": "#2E86AB", "Drone": "#F2C14E", "Unknown": "#999"}
        return [
            {
                "caste": k,
                "count": v,
                "percent": round(100 * v / total, 1),
                "color": colors.get(k, "#888"),
            }
            for k, v in sorted(counts.items(), key=lambda x: -x[1])
        ]

    def sample_map(self) -> list[dict]:
        groups: dict[tuple, dict] = {}
        for s in self.samples:
            country = s.get("country") or "Unknown"
            lineage = s.get("lineage") or "Unassigned"
            key = (country, lineage)
            if key not in groups:
                latlon = COUNTRY_COORDS.get(country)
                if not latlon:
                    continue
                groups[key] = {
                    "country": country,
                    "continent": s.get("continent"),
                    "lineage": lineage,
                    "lat": latlon[0],
                    "lon": latlon[1],
                    "count": 0,
                    "color": LINEAGE_COLORS.get(lineage, "#888"),
                }
            groups[key]["count"] += 1
        return list(groups.values())

    def filter_options(self) -> dict:
        return {
            "lineages": sorted(
                {s.get("lineage") or "Unassigned" for s in self.samples}
            ),
            "castes": sorted({s.get("type") or "Unknown" for s in self.samples}),
            "countries": sorted(
                {s.get("country") for s in self.samples if s.get("country")}
            ),
            "instruments": sorted(
                {
                    s.get("instrument")
                    for s in self.samples
                    if s.get("instrument")
                }
            ),
        }

    def query_samples(
        self,
        lineages: list[str] | None = None,
        castes: list[str] | None = None,
        countries: list[str] | None = None,
        instruments: list[str] | None = None,
        q: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        rows = self.samples
        if lineages:
            rows = [
                s
                for s in rows
                if (s.get("lineage") or "Unassigned") in lineages
            ]
        if castes:
            rows = [s for s in rows if (s.get("type") or "Unknown") in castes]
        if countries:
            rows = [s for s in rows if s.get("country") in countries]
        if instruments:
            rows = [s for s in rows if s.get("instrument") in instruments]
        if q:
            q_lower = q.lower()
            rows = [
                s
                for s in rows
                if q_lower in str(s.get("sample_id", "")).lower()
                or q_lower in str(s.get("sample_alias", "")).lower()
                or q_lower in str(s.get("strain", "")).lower()
            ]

        total = len(rows)
        start = max(0, (page - 1) * page_size)
        end = start + page_size
        page_rows = rows[start:end]

        depths = [float(s.get("mean_depth") or 0) for s in rows]
        hist = self._histogram(depths, bins=30, hi=80)
        mapping_ok = sum(
            1 for s in rows if float(s.get("mapping_rate") or 0) >= 80
        )
        q30_ok = sum(1 for s in rows if float(s.get("q30_rate") or 0) >= 85)

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": page_rows,
            "qc": {
                "depth_hist": hist,
                "mapping_pass_rate": round(100 * mapping_ok / total, 1)
                if total
                else 0,
                "q30_pass_rate": round(100 * q30_ok / total, 1) if total else 0,
                "mean_depth": round(sum(depths) / total, 2) if total else 0,
            },
        }

    @staticmethod
    def _histogram(values: list[float], bins: int = 30, hi: float = 80) -> list[dict]:
        if not values:
            return []
        step = hi / bins
        counts = [0] * bins
        for v in values:
            idx = min(bins - 1, int(max(0, v) / step)) if step else 0
            counts[idx] += 1
        return [
            {
                "bin_start": round(i * step, 2),
                "bin_end": round((i + 1) * step, 2),
                "count": c,
            }
            for i, c in enumerate(counts)
        ]

    def pca_scatter(self) -> list[dict]:
        return [
            {
                "sample_id": s["sample_id"],
                "sample_alias": s.get("sample_alias"),
                "lineage": s.get("lineage") or "Unassigned",
                "type": s.get("type"),
                "country": s.get("country"),
                "pc1": s.get("pc1"),
                "pc2": s.get("pc2"),
                "pc3": s.get("pc3"),
                "mean_depth": s.get("mean_depth"),
                "color": LINEAGE_COLORS.get(
                    s.get("lineage") or "Unassigned", "#888"
                ),
            }
            for s in self.samples
        ]

    def admixture_payload(self, k: int = 5) -> dict:
        key = f"K{k}"
        matrix = self.admixture["k_results"].get(key)
        if matrix is None:
            raise KeyError(f"admixture K={k} not found")
        samples = self.admixture["samples"]
        meta = {s["sample_id"]: s for s in self.samples}
        rows = []
        for i, sid in enumerate(samples):
            m = meta.get(sid, {})
            rows.append(
                {
                    "sample_id": sid,
                    "lineage": m.get("lineage") or "Unassigned",
                    "type": m.get("type"),
                    "country": m.get("country"),
                    "proportions": matrix[i],
                }
            )
        # sort by dominant component then lineage for cleaner bars
        rows.sort(
            key=lambda r: (
                r["lineage"],
                -max(r["proportions"]) if r["proportions"] else 0,
            )
        )
        return {
            "k": k,
            "available_k": list(range(2, 13)),
            "total_samples": self.admixture["total_samples"],
            "items": rows,
        }

    def popgen_summary(self) -> dict:
        return self.popgen

    def tree_payload(self) -> dict:
        meta = {
            s["sample_id"]: {
                "lineage": s.get("lineage") or "Unassigned",
                "type": s.get("type"),
                "color": LINEAGE_COLORS.get(
                    s.get("lineage") or "Unassigned", "#888"
                ),
            }
            for s in self.samples
        }
        return {"newick": self.tree_newick, "sample_meta": meta}

    def sweeps_payload(
        self,
        comparison: str | None = None,
        chrom: str | None = None,
        gene: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        rows = self.sweeps
        if comparison:
            rows = [r for r in rows if r.get("comparison") == comparison]
        if chrom:
            rows = [r for r in rows if r.get("chrom") == chrom]
        if gene:
            g = gene.lower()
            rows = [
                r
                for r in rows
                if g in str(r.get("candidate_gene_names", "")).lower()
                or g in str(r.get("candidate_gene_ids", "")).lower()
            ]
        total = len(rows)
        start = max(0, (page - 1) * page_size)
        items = rows[start : start + page_size]
        comparisons = sorted({r.get("comparison") for r in self.sweeps})
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": items,
            "comparisons": comparisons,
            "manhattan": self._manhattan_points(rows if (comparison or chrom or gene) else self.sweeps),
            "threshold": self._fst_threshold(),
        }

    def _fst_threshold(self) -> float:
        vals = sorted(
            float(r["weighted_fst"])
            for r in self.sweeps
            if r.get("weighted_fst") is not None
        )
        if not vals:
            return 0.0
        # already top 5%; use min as threshold line
        return vals[0]

    def _manhattan_points(self, rows: list[dict]) -> list[dict]:
        points = []
        for r in rows:
            chrom = r.get("chrom")
            if not is_nuclear(str(chrom)):
                continue
            info = self._chrom_offsets.get(chrom)
            if not info:
                continue
            x = info["offset"] + int(r.get("bin_start") or 0)
            points.append(
                {
                    "chrom": chrom,
                    "label": info.get("label") or chrom_label(str(chrom)),
                    "bin_start": r.get("bin_start"),
                    "bin_end": r.get("bin_end"),
                    "x": x,
                    "weighted_fst": r.get("weighted_fst"),
                    "comparison": r.get("comparison"),
                    "genes": r.get("candidate_gene_names"),
                }
            )
        return points

    def chrom_axis(self) -> list[dict]:
        return [
            {
                "chrom": c["chrom"],
                "label": c.get("label") or chrom_label(c["chrom"]),
                "offset": self._chrom_offsets[c["chrom"]]["offset"],
                "length": c["length"],
                "mid": self._chrom_offsets[c["chrom"]]["offset"] + c["length"] / 2,
            }
            for c in self.main_chroms
            if c["chrom"] in self._chrom_offsets and is_nuclear(c["chrom"])
        ]

    def ld_decay_payload(self, max_kb: float = 20.0) -> dict:
        clipped = {}
        for name, obj in self.ld_decay.items():
            pts = [p for p in (obj.get("points") or []) if float(p.get("dist_kb", 0)) <= max_kb]
            clipped[name] = {**obj, "points": pts}
        return clipped

    def get_gene(self, query: str) -> dict | None:
        q = query.lower().strip()
        return self.gene_by_symbol.get(q) or self.gene_by_id.get(q)

    def search_genes(self, q: str, limit: int = 20) -> list[dict]:
        q = q.lower().strip()
        if not q:
            return []
        hits = []
        for g in self.gene_cards:
            if (
                q in str(g.get("symbol", "")).lower()
                or q in str(g.get("gene_id", "")).lower()
            ):
                hits.append(g)
                if len(hits) >= limit:
                    break
        return hits

    def genes_in_region(self, chrom: str, start: int, end: int) -> list[dict]:
        hits = []
        for g in self.gene_cards:
            if g.get("chrom") != chrom:
                continue
            gs, ge = int(g.get("start") or 0), int(g.get("end") or 0)
            if ge < start or gs > end:
                continue
            hits.append(g)
        return hits

    def _load_variants_fallback(self) -> list[dict]:
        if self._variants_fallback is not None:
            return self._variants_fallback
        rows: list[dict] = []
        if self._variants_tsv.exists():
            with self._variants_tsv.open(encoding="utf-8") as f:
                for r in csv.DictReader(f, delimiter="\t"):
                    rows.append(
                        {
                            "chrom": r["chrom"],
                            "pos": int(r["pos"]),
                            "id": r["id"],
                            "n_chr": int(float(r["n_chr"])),
                            "ref_freq": float(r["ref_freq"]),
                            "alt_freq": float(r["alt_freq"]),
                        }
                    )
        self._variants_fallback = rows
        return rows

    def query_variants(
        self,
        chrom: str,
        start: int,
        end: int,
        page: int = 1,
        page_size: int = 100,
    ) -> dict:
        if end < start:
            start, end = end, start
        if end - start > 5_000_000:
            end = start + 5_000_000

        items: list[dict] = []
        total = 0

        if self._variants_db and self._variants_db.exists():
            con = sqlite3.connect(f"file:{self._variants_db}?mode=ro", uri=True)
            con.row_factory = sqlite3.Row
            cur = con.cursor()
            total = cur.execute(
                "SELECT COUNT(*) FROM variants WHERE chrom=? AND pos BETWEEN ? AND ?",
                (chrom, start, end),
            ).fetchone()[0]
            offset = max(0, (page - 1) * page_size)
            rows = cur.execute(
                """
                SELECT chrom, pos, id, n_chr, ref_freq, alt_freq
                FROM variants
                WHERE chrom=? AND pos BETWEEN ? AND ?
                ORDER BY pos
                LIMIT ? OFFSET ?
                """,
                (chrom, start, end, page_size, offset),
            ).fetchall()
            con.close()
            raw_items = [
                {
                    "chrom": r["chrom"],
                    "pos": r["pos"],
                    "id": r["id"],
                    "n_chr": r["n_chr"],
                    "ref_freq": r["ref_freq"],
                    "alt_freq": r["alt_freq"],
                    "af": r["alt_freq"],
                }
                for r in rows
            ]
        else:
            matched = [
                r
                for r in self._load_variants_fallback()
                if r["chrom"] == chrom and start <= r["pos"] <= end
            ]
            total = len(matched)
            offset = max(0, (page - 1) * page_size)
            raw_items = matched[offset : offset + page_size]

        items = []
        for r in raw_items:
            ref, alt = self._lookup_alleles(r["chrom"], int(r["pos"]))
            # Fall back: parse ID formats like NC_037638.1:3536:G:A
            if ref is None or alt is None:
                parts = str(r.get("id") or "").replace("_", ":").split(":")
                if len(parts) >= 4 and parts[-2].isalpha() and parts[-1].isalpha():
                    ref = ref or parts[-2]
                    alt = alt or parts[-1]
            items.append(
                {
                    **r,
                    "af": r.get("alt_freq"),
                    "ref": ref,
                    "alt": alt,
                }
            )

        genes = self.genes_in_region(chrom, start, end)
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "chrom": chrom,
            "start": start,
            "end": end,
            "items": items,
            "genes": genes[:20],
            "source": "sqlite" if self._variants_db else "tsv_fallback",
            "chrom_label": chrom_label(chrom),
        }

    def jbrowse_config_resolved(self) -> dict:
        cfg = json.loads(json.dumps(self.jbrowse_config))
        assembly = cfg.get("assembly", {})
        assembly_name = assembly.get("name", "Amel_HAv3.1")
        fasta_ok = (ASSETS_DIR / "genome.fa").exists() and (
            ASSETS_DIR / "genome.fa.fai"
        ).exists()
        vcf_ok = (ASSETS_DIR / "cohort_2360_clean.vcf.gz").exists() and (
            ASSETS_DIR / "cohort_2360_clean.vcf.gz.tbi"
        ).exists()

        if fasta_ok:
            assembly["sequence"] = {
                "type": "ReferenceSequenceTrack",
                "trackId": f"{assembly_name}-ReferenceSequenceTrack",
                "adapter": {
                    "type": "IndexedFastaAdapter",
                    "fastaLocation": {"uri": "/data-files/genome.fa"},
                    "faiLocation": {"uri": "/data-files/genome.fa.fai"},
                },
            }
        else:
            assembly["sequence"] = {
                "type": "ReferenceSequenceTrack",
                "trackId": f"{assembly_name}-ReferenceSequenceTrack",
                "adapter": {
                    "type": "ChromSizesAdapter",
                    "chromSizesLocation": {
                        "uri": "/data-files/amel_HAv3.1.chrom.sizes"
                    },
                },
            }
        cfg["assembly"] = assembly

        tracks = []
        for track in cfg.get("tracks", []):
            adapter = track.get("adapter", {})
            ttype = track.get("type")
            if ttype == "VariantTrack" and not vcf_ok:
                continue
            for key in ("gffGzLocation", "vcfGzLocation", "location"):
                if key in adapter and isinstance(adapter[key], dict):
                    uri = adapter[key].get("uri", "")
                    name = Path(uri).name
                    adapter[key]["uri"] = f"/data-files/{name}"
            if "index" in adapter and isinstance(adapter["index"], dict):
                loc = adapter["index"].get("location", {})
                if "uri" in loc:
                    loc["uri"] = f"/data-files/{Path(loc['uri']).name}"
            track["assemblyNames"] = [assembly_name]
            tracks.append(track)
        cfg["tracks"] = tracks
        return cfg

    def asset_status(self) -> dict:
        critical = [
            "genome.fa",
            "genome.fa.fai",
            "genes.sorted.gtf.gz",
            "genes.sorted.gtf.gz.tbi",
            "cohort_2360_clean.vcf.gz",
            "cohort_2360_clean.vcf.gz.tbi",
            "variants_summary_top.tsv",
        ]
        status = {}
        for name in critical:
            p = ASSETS_DIR / name
            status[name] = {
                "exists": p.exists(),
                "is_symlink": p.is_symlink(),
                "size_bytes": p.stat().st_size if p.exists() else 0,
            }
        db = self._variants_db
        status["variants_index.db"] = {
            "exists": bool(db and db.exists()),
            "is_symlink": bool(db and db.is_symlink()),
            "size_bytes": db.stat().st_size if db and db.exists() else 0,
            "path": str(db) if db else None,
        }
        return status


@lru_cache(maxsize=1)
def get_store() -> DataStore:
    return DataStore()
