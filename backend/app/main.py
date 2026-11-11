from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import ASSETS_DIR, STATIC_DIR
from .data_loader import get_store

app = FastAPI(
    title="Apis mellifera WGS Portal",
    version="0.1.0",
    description="Bee cohort genomics portal API (2360 samples)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    get_store()


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "assets": str(ASSETS_DIR),
        "static": str(STATIC_DIR),
        "static_exists": STATIC_DIR.exists(),
    }


@app.get("/api/overview/stats")
def overview_stats():
    store = get_store()
    stats = store.overview_stats()
    return {
        **stats,
        "lineage": store.lineage_counts(),
        "caste": store.caste_counts(),
        "map_points": store.sample_map(),
        "asset_status": store.asset_status(),
    }


@app.get("/api/samples/filters")
def sample_filters():
    return get_store().filter_options()


@app.get("/api/samples")
def list_samples(
    lineage: list[str] | None = Query(default=None),
    caste: list[str] | None = Query(default=None),
    country: list[str] | None = Query(default=None),
    instrument: list[str] | None = Query(default=None),
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
):
    return get_store().query_samples(
        lineages=lineage,
        castes=caste,
        countries=country,
        instruments=instrument,
        q=q,
        page=page,
        page_size=page_size,
    )


@app.get("/api/samples/pca_scatter")
def pca_scatter():
    return {"items": get_store().pca_scatter()}


@app.get("/api/samples/{sample_id}")
def sample_detail(sample_id: str):
    store = get_store()
    for s in store.samples:
        if s["sample_id"] == sample_id:
            return s
    raise HTTPException(404, f"sample not found: {sample_id}")


@app.get("/api/popgen/admixture")
def popgen_admixture(k: int = Query(5, ge=2, le=12)):
    try:
        return get_store().admixture_payload(k)
    except KeyError as e:
        raise HTTPException(404, str(e)) from e


@app.get("/api/popgen/summary")
def popgen_summary():
    store = get_store()
    return {
        **store.popgen_summary(),
        "chrom_axis": store.chrom_axis(),
    }


@app.get("/api/popgen/ld_decay")
def popgen_ld():
    return get_store().ld_decay_payload()


@app.get("/api/popgen/tree")
def popgen_tree():
    return get_store().tree_payload()


@app.get("/api/sweeps")
def sweeps(
    comparison: str | None = None,
    chrom: str | None = None,
    gene: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
):
    store = get_store()
    payload = store.sweeps_payload(
        comparison=comparison,
        chrom=chrom,
        gene=gene,
        page=page,
        page_size=page_size,
    )
    payload["chrom_axis"] = store.chrom_axis()
    return payload


@app.get("/api/genes/search")
def gene_search(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=100)):
    return {"items": get_store().search_genes(q, limit=limit)}


@app.get("/api/genes/{gene_id}")
def gene_detail(gene_id: str):
    g = get_store().get_gene(gene_id)
    if not g:
        raise HTTPException(404, f"gene not found: {gene_id}")
    return g


@app.get("/api/variants/region")
def variants_region(
    chrom: str,
    start: int = Query(..., ge=1),
    end: int = Query(..., ge=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
):
    return get_store().query_variants(
        chrom=chrom, start=start, end=end, page=page, page_size=page_size
    )


@app.get("/api/chromosomes")
def chromosomes(main_only: bool = True):
    store = get_store()
    rows = store.main_chroms if main_only else store.chrom_sizes
    return {"items": rows}


@app.get("/api/download/manifest")
def download_manifest():
    store = get_store()
    items = []
    for row in store.manifest:
        name = row.get("file_name")
        path = ASSETS_DIR / name
        items.append(
            {
                **row,
                "download_url": f"/api/download/file/{name}",
                "available": path.exists(),
            }
        )
    return {"items": items}


@app.get("/api/download/file/{file_name}")
def download_file(file_name: str):
    safe = Path(file_name).name
    path = ASSETS_DIR / safe
    if not path.exists() or not path.is_file():
        raise HTTPException(404, f"file not found: {safe}")
    return FileResponse(path, filename=safe)


@app.get("/api/jbrowse/config")
def jbrowse_config():
    store = get_store()
    return {
        "config": store.jbrowse_config_resolved(),
        "asset_status": store.asset_status(),
    }


# Genomic/data files must NOT use /assets — Vite emits JS/CSS to /assets/*
if ASSETS_DIR.exists():
    app.mount("/data-files", StaticFiles(directory=str(ASSETS_DIR)), name="data_files")

# Serve Vite build assets explicitly
_frontend_assets = STATIC_DIR / "assets"
if _frontend_assets.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(_frontend_assets)),
        name="frontend_assets",
    )


@app.get("/")
def root_index():
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"ok": True, "message": "API running. Build frontend to serve UI."}


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("data-files/"):
        raise HTTPException(404, "Not found")
    candidate = STATIC_DIR / full_path
    if candidate.exists() and candidate.is_file():
        return FileResponse(candidate)
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    raise HTTPException(404, "Frontend not built")
