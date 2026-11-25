import { useMemo, useState } from 'react'
import { api } from '../api'
import PageHeader from '../components/PageHeader'
import ChartActions from '../components/ChartActions'
import { useAsync } from '../hooks/useAsync'

export default function Sweeps() {
  const [comparison, setComparison] = useState('')
  const [chrom, setChrom] = useState('')
  const [gene, setGene] = useState('')
  const [page, setPage] = useState(1)
  const [selectedGene, setSelectedGene] = useState<any>(null)

  const chroms = useAsync(() => api.chromosomes(), [])
  const { data, error, loading } = useAsync(
    () =>
      api.sweeps({
        comparison: comparison || undefined,
        chrom: chrom || undefined,
        gene: gene || undefined,
        page,
        page_size: 40,
      }),
    [comparison, chrom, gene, page],
  )

  const manhattan = useMemo(() => {
    const points = data?.manhattan || []
    const axis = data?.chrom_axis || []
    const thr = data?.threshold
    const thrText =
      thr != null ? `Top 5% (Fst = ${Number(thr).toFixed(2)})` : 'Top 5%'
    const chromIdx = Object.fromEntries(
      axis.map((c: any, i: number) => [c.chrom, i]),
    )
    const oddColor = '#0f3d38'
    const evenColor = '#c9a227'
    const xMax =
      axis.length > 0
        ? axis[axis.length - 1].offset + axis[axis.length - 1].length
        : undefined
    return {
      tooltip: {
        confine: true,
        appendToBody: true,
        extraCssText:
          'max-width:320px;white-space:normal;word-break:break-word;line-height:1.35;',
        formatter: (p: any) => {
          const genes = String(p.data[6] || '')
            .split(';')
            .filter(Boolean)
          const geneText =
            genes.length > 8
              ? `${genes.slice(0, 8).join('; ')} … (+${genes.length - 8})`
              : genes.join('; ')
          return `${p.data[7] || p.data[3]}<br/>${p.data[4]}-${p.data[5]}<br/>Fst=${p.data[1]}${
            geneText ? `<br/>${geneText}` : ''
          }`
        },
      },
      grid: { left: 55, right: 20, top: 36, bottom: 56 },
      xAxis: {
        type: 'value',
        name: 'Chromosome',
        nameLocation: 'middle',
        nameGap: 32,
        min: 0,
        max: xMax,
        axisTick: {
          customValues: axis.map((c: any) => c.mid),
        },
        axisLabel: {
          customValues: axis.map((c: any) => c.mid),
          hideOverlap: false,
          interval: 0,
          formatter: (v: number) => {
            const hit = axis.find((c: any) => Math.abs(c.mid - v) < 1)
            return hit?.label || ''
          },
        },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'weighted Fst' },
      series: [
        {
          type: 'scatter',
          symbolSize: 5,
          data: points.map((p: any) => {
            const label =
              axis.find((c: any) => c.chrom === p.chrom)?.label || p.chrom
            return [
              p.x,
              p.weighted_fst,
              p.comparison,
              p.chrom,
              p.bin_start,
              p.bin_end,
              p.genes,
              label,
            ]
          }),
          itemStyle: {
            color: (params: any) => {
              const idx = chromIdx[params.data[3]] ?? 0
              return idx % 2 === 0 ? oddColor : evenColor
            },
          },
          markLine: {
            symbol: 'none',
            silent: true,
            data: [
              ...(thr != null
                ? [
                    {
                      yAxis: thr,
                      name: thrText,
                      lineStyle: { type: 'dashed', color: '#d4a017', width: 2 },
                      label: {
                        formatter: thrText,
                        position: 'insideEndTop',
                        color: '#8a6500',
                      },
                    },
                  ]
                : []),
              ...axis.slice(1).map((c: any) => ({
                xAxis: c.offset,
                lineStyle: {
                  type: 'solid',
                  color: 'rgba(19,33,31,0.12)',
                  width: 1,
                },
                label: { show: false },
              })),
            ],
          },
        },
      ],
    }
  }, [data])

  async function openGene(symbol: string, row?: any) {
    try {
      const g = await api.gene(symbol)
      const hasKegg = Boolean(String(g?.kegg_pathways || '').trim())
      const hasGo = Boolean(String(g?.go_terms || '').trim())
      // Gene-level annot missing: fall back to window-aggregated pathways
      setSelectedGene({
        ...g,
        kegg_pathways: hasKegg ? g.kegg_pathways : row?.kegg_pathways || '',
        go_terms: hasGo ? g.go_terms : row?.go_terms || '',
        annot_source:
          hasKegg || hasGo
            ? 'gene'
            : row?.kegg_pathways || row?.go_terms
              ? 'window'
              : 'none',
      })
    } catch {
      setSelectedGene({ symbol, error: '未找到基因卡片' })
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="Selective Sweeps"
        subtitle="全基因组选择清除窗口、候选基因与 KEGG/GO 注释联动检索。"
      />

      <div className="panel panel-pad">
        <div className="filters">
          <div className="field">
            <label>Comparison</label>
            <select
              value={comparison}
              onChange={(e) => {
                setPage(1)
                setComparison(e.target.value)
              }}
            >
              <option value="">All</option>
              {(data?.comparisons || []).map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Chromosome</label>
            <select
              value={chrom}
              onChange={(e) => {
                setPage(1)
                setChrom(e.target.value)
              }}
            >
              <option value="">All</option>
              {(chroms.data?.items || []).map((c: any) => (
                <option key={c.chrom} value={c.chrom}>
                  {c.label || c.chrom}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ minWidth: 180 }}>
            <label>Gene</label>
            <input
              value={gene}
              placeholder="symbol / LOC id"
              onChange={(e) => {
                setPage(1)
                setGene(e.target.value)
              }}
            />
          </div>
        </div>
      </div>

      <div className="panel panel-pad">
        <h3 className="section-title">Genome-Wide Sweeps (Manhattan)</h3>
        {loading ? <div className="loading">加载中…</div> : null}
        {error ? <div className="error">{error}</div> : null}
        <ChartActions
          option={manhattan}
          height={340}
          title="Genome-Wide Sweeps"
          filename="sweeps_manhattan"
          exportData={data?.items || []}
          notMerge
        />
      </div>

      <div className="grid-2">
        <div className="panel panel-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3 className="section-title">Candidate Sweep Regions</h3>
            <span className="muted">{data?.total ?? 0} windows</span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Comparison</th>
                  <th>Chrom</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Fst</th>
                  <th>Genes</th>
                  <th>Pathways</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items || []).map((r: any, idx: number) => (
                  <tr key={`${r.chrom}-${r.bin_start}-${idx}`}>
                    <td>{r.comparison}</td>
                    <td>{r.chrom}</td>
                    <td>{r.bin_start}</td>
                    <td>{r.bin_end}</td>
                    <td>{r.weighted_fst}</td>
                    <td>
                      <div className="chips">
                        {String(r.candidate_gene_names || '')
                          .split(';')
                          .filter(Boolean)
                          .slice(0, 4)
                          .map((g: string) => (
                            <button
                              key={g}
                              className="chip"
                              style={{ cursor: 'pointer', border: 0 }}
                              onClick={() => openGene(g, r)}
                            >
                              {g}
                            </button>
                          ))}
                      </div>
                    </td>
                    <td>
                      <div className="chips">
                        {String(r.kegg_pathways || '')
                          .split('|')
                          .filter(Boolean)
                          .map((p: string) => (
                            <span className="chip" key={p}>
                              {p.split(':').slice(1).join(':') || p}
                            </span>
                          ))}
                        {!String(r.kegg_pathways || '').trim() && (
                          <span className="muted">No KEGG pathway annotated</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button className="btn secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </button>
            <span className="muted">Page {page}</span>
            <button
              className="btn secondary"
              disabled={!data || page * data.page_size >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>

        <div className="panel panel-pad">
          <h3 className="section-title">Gene Card</h3>
          {!selectedGene ? (
            <p className="muted">暂无选中基因</p>
          ) : selectedGene.error ? (
            <div className="error">{selectedGene.error}</div>
          ) : (
            <div className="stack">
              <div>
                <div className="stat-value" style={{ fontSize: 28 }}>
                  {selectedGene.symbol}
                </div>
                <div className="muted">Gene ID {selectedGene.gene_id}</div>
              </div>
              <div>
                {selectedGene.chrom}:{selectedGene.start}-{selectedGene.end} (
                {selectedGene.strand}) · exons {selectedGene.exon_count}
              </div>
              {selectedGene.annot_source === 'window' && (
                <div className="muted">该基因暂无独立注释，以下为窗口候选基因汇总</div>
              )}
              <div>
                <div className="section-title">KEGG</div>
                <div className="chips">
                  {String(selectedGene.kegg_pathways || '')
                    .split('|')
                    .filter(Boolean)
                    .map((p: string) => (
                      <span className="chip" key={p}>
                        {p}
                      </span>
                    ))}
                  {!String(selectedGene.kegg_pathways || '').trim() && (
                    <span className="muted">No KEGG pathway annotated</span>
                  )}
                </div>
              </div>
              <div>
                <div className="section-title">GO</div>
                <div className="chips">
                  {String(selectedGene.go_terms || '')
                    .split('|')
                    .filter(Boolean)
                    .map((p: string) => (
                      <span className="chip" key={p}>
                        {p}
                      </span>
                    ))}
                  {!String(selectedGene.go_terms || '').trim() && (
                    <span className="muted">No GO terms annotated</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
