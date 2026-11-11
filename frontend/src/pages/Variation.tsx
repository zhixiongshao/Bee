import { useState } from 'react'
import { api } from '../api'
import PageHeader from '../components/PageHeader'
import { useAsync } from '../hooks/useAsync'
import { downloadCsv } from '../utils/export'

export default function Variation() {
  const chroms = useAsync(() => api.chromosomes(), [])
  const [chrom, setChrom] = useState('NC_037638.1')
  const [start, setStart] = useState(3000)
  const [end, setEnd] = useState(10000)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState({
    chrom: 'NC_037638.1',
    start: 3000,
    end: 10000,
    page: 1,
  })

  const { data, error, loading } = useAsync(
    () => api.variants(query),
    [JSON.stringify(query)],
  )

  function runSearch() {
    setPage(1)
    setQuery({ chrom, start: Number(start), end: Number(end), page: 1 })
  }

  return (
    <div className="stack">
      <PageHeader
        title="Variation"
        subtitle="按基因组区间检索 SNP 频率，并联动展示区间内基因卡片。"
      />

      <div className="panel panel-pad">
        <div className="filters">
          <div className="field">
            <label>Chromosome</label>
            <select value={chrom} onChange={(e) => setChrom(e.target.value)}>
              {(chroms.data?.items || [{ chrom: 'NC_037638.1' }]).map((c: any) => (
                <option key={c.chrom} value={c.chrom}>
                  {c.chrom} ({c.length?.toLocaleString?.() ?? ''})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Start</label>
            <input
              type="number"
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>End</label>
            <input type="number" value={end} onChange={(e) => setEnd(Number(e.target.value))} />
          </div>
          <button className="btn" onClick={runSearch}>
            Query region
          </button>
          {data?.items?.length ? (
            <button
              className="btn secondary"
              type="button"
              onClick={() =>
                downloadCsv(`variants_${query.chrom}_${query.start}_${query.end}.csv`, data.items)
              }
            >
              Export table
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel panel-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3 className="section-title">SNP Table</h3>
            <span className="muted">
              {data ? `${data.total.toLocaleString()} variants` : ''}
            </span>
          </div>
          {loading ? <div className="loading">查询中…</div> : null}
          {error ? <div className="error">{error}</div> : null}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Pos</th>
                  <th>Ref</th>
                  <th>Alt</th>
                  <th>AF</th>
                  <th>N_CHR</th>
                  <th>Ref freq</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items || []).map((v: any) => (
                  <tr key={v.id}>
                    <td>{v.id}</td>
                    <td>{v.pos}</td>
                    <td>{v.ref ?? '—'}</td>
                    <td>{v.alt ?? '—'}</td>
                    <td>{v.af ?? v.alt_freq}</td>
                    <td>{v.n_chr}</td>
                    <td>{v.ref_freq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button
              className="btn secondary"
              disabled={page <= 1}
              onClick={() => {
                const next = page - 1
                setPage(next)
                setQuery((q) => ({ ...q, page: next }))
              }}
            >
              Prev
            </button>
            <span className="muted">Page {page}</span>
            <button
              className="btn secondary"
              disabled={!data || page * data.page_size >= data.total}
              onClick={() => {
                const next = page + 1
                setPage(next)
                setQuery((q) => ({ ...q, page: next }))
              }}
            >
              Next
            </button>
          </div>
        </div>

        <div className="panel panel-pad">
          <h3 className="section-title">Gene Card Side Panel</h3>
          {(data?.genes || []).length === 0 ? (
            <p className="muted">当前区间未命中基因</p>
          ) : (
            <div className="stack">
              {(data?.genes || []).map((g: any) => (
                <div
                  key={g.gene_id}
                  style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}
                >
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{g.symbol}</div>
                  <div className="muted">
                    {g.chrom}:{g.start}-{g.end} ({g.strand}) · exons {g.exon_count}
                  </div>
                  <div className="chips" style={{ marginTop: 8 }}>
                    {String(g.kegg_pathways || '')
                      .split('|')
                      .filter(Boolean)
                      .slice(0, 4)
                      .map((p: string) => (
                        <span className="chip" key={p}>
                          {p}
                        </span>
                      ))}
                  </div>
                  <div className="chips" style={{ marginTop: 6 }}>
                    {String(g.go_terms || '')
                      .split('|')
                      .filter(Boolean)
                      .slice(0, 6)
                      .map((p: string) => (
                        <span className="chip" key={p}>
                          {p}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
