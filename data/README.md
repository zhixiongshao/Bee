# Data assets packaged for GitHub / Render

These files are small enough for normal git push (<100MB each).

Full SNP SQLite index lives in `../data-large/variants_index.db` (gitignored).
Without it, Variation queries fall back to `variants_summary_top.tsv`.
