import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { useAsync } from '../hooks/useAsync'
import { chromLabel } from '../utils/chroms'

export default function LinearGenomeBrowser({
  defaultChrom = 'NC_037638.1',
  defaultStart = 1,
  defaultEnd = 100000,
}: {
  defaultChrom?: string
  defaultStart?: number
  defaultEnd?: number
}) {
  const chroms = useAsync(() => api.chromosomes(), [])
  const [chrom, setChrom] = useState(defaultChrom)
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(defaultEnd)
  const [query, setQuery] = useState({
    chrom: defaultChrom,
    start: defaultStart,
    end: defaultEnd,
  })
  const [hover, setHover] = useState<any>(null)

  const { data, error, loading } = useAsync(
    () =>
      api.variants({
        chrom: query.chrom,
        start: query.start,
        end: query.end,
        page: 1,
        page_size: 500,
      }),
    [JSON.stringify(query)],
  )

  const [width, setWidth] = useState(960)
  const height = 320
  const pad = 36
  const plotLeft = pad
  const plotRight = width - pad
  const plotW = plotRight - plotLeft
  const span = Math.max(1, query.end - query.start)

  const geneY = 78
  const geneH = 18
  const varBaseY = 280
  const varMaxH = 90

  const genes = data?.genes || []
  const variants = data?.items || []

  const geneRects = useMemo(
    () =>
      genes.map((g: any, i: number) => {
        const x1 = plotLeft + ((Math.max(g.start, query.start) - query.start) / span) * plotW
        const x2 = plotLeft + ((Math.min(g.end, query.end) - query.start) / span) * plotW
        const lane = i % 2
        return {
          ...g,
          x: x1,
          w: Math.max(3, x2 - x1),
          y: geneY + lane * 28,
          label: g.symbol || g.gene_id,
        }
      }),
    [genes, query, span, plotLeft, plotW],
  )

  const varPoints = useMemo(
    () =>
      variants.map((v: any) => ({
        ...v,
        x: plotLeft + ((v.pos - query.start) / span) * plotW,
        y: varBaseY - Math.min(varMaxH, (Number(v.af) || 0) * varMaxH),
      })),
    [variants, query, span, plotLeft, plotW],
  )

  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setWidth(Math.max(320, el.clientWidth - 8))
    })
    ro.observe(el)
    setWidth(Math.max(320, el.clientWidth - 8))
    return () => ro.disconnect()
  }, [])

  function run() {
    const s = Number(start)
    const e = Number(end)
    setQuery({ chrom, start: Math.min(s, e), end: Math.max(s, e) })
  }

  function zoom(factor: number) {
    const mid = (query.start + query.end) / 2
    const half = Math.max(500, ((query.end - query.start) / 2) * factor)
    const ns = Math.max(1, Math.floor(mid - half))
    const ne = Math.floor(mid + half)
    setStart(ns)
    setEnd(ne)
    setQuery({ chrom: query.chrom, start: ns, end: ne })
  }

  return (
    <div className="stack">
      <div className="filters">
        <div className="field">
          <label>Chromosome</label>
          <select value={chrom} onChange={(e) => setChrom(e.target.value)}>
            {(chroms.data?.items || [{ chrom: defaultChrom, label: chromLabel(defaultChrom) }]).map(
              (c: any) => (
                <option key={c.chrom} value={c.chrom}>
                  {c.label || chromLabel(c.chrom)} ({c.chrom})
                </option>
              ),
            )}
          </select>
        </div>
        <div className="field">
          <label>Start</label>
          <input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>End</label>
          <input type="number" value={end} onChange={(e) => setEnd(Number(e.target.value))} />
        </div>
        <button className="btn" type="button" onClick={run}>
          Go
        </button>
        <button className="btn secondary" type="button" onClick={() => zoom(0.5)}>
          Zoom in
        </button>
        <button className="btn secondary" type="button" onClick={() => zoom(2)}>
          Zoom out
        </button>
      </div>

      {loading ? <div className="loading">加载区间轨道…</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <div className="tree-wrap" style={{ padding: 8 }} ref={wrapRef}>
        <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
          <text x={pad} y={20} fill="#5b6b67" fontSize="12">
            {chromLabel(query.chrom)} ({query.chrom}):{query.start.toLocaleString()}-
            {query.end.toLocaleString()}
          </text>
          <line
            x1={plotLeft}
            x2={plotRight}
            y1={36}
            y2={36}
            stroke="#0f3d38"
            strokeWidth="2"
          />

          <text x={pad} y={58} fill="#0f3d38" fontSize="12" fontWeight="700">
            Gene models ({geneRects.length})
          </text>
          {geneRects.map((g: any) => (
            <g
              key={g.gene_id}
              onMouseEnter={() =>
                setHover({
                  kind: 'gene',
                  title: g.label,
                  detail: `${g.chrom}:${g.start}-${g.end} (${g.strand}) · exons ${g.exon_count}`,
                })
              }
              onMouseLeave={() => setHover(null)}
            >
              <rect
                x={g.x}
                y={g.y}
                width={g.w}
                height={geneH}
                rx={3}
                fill="#1f6b5f"
                opacity={0.92}
              />
              {g.w > 36 ? (
                <text
                  x={g.x + 4}
                  y={g.y + 13}
                  fill="#fffcf6"
                  fontSize="10"
                  fontWeight="600"
                >
                  {String(g.label).slice(0, Math.max(3, Math.floor(g.w / 7)))}
                </text>
              ) : null}
            </g>
          ))}

          <text x={pad} y={150} fill="#0f3d38" fontSize="12" fontWeight="700">
            Variants AF ({varPoints.length} shown / {data?.total ?? 0} total)
          </text>
          <line
            x1={plotLeft}
            x2={plotRight}
            y1={varBaseY}
            y2={varBaseY}
            stroke="rgba(19,33,31,0.2)"
          />
          <text x={8} y={varBaseY - varMaxH + 4} fill="#5b6b67" fontSize="10">
            1
          </text>
          <text x={8} y={varBaseY + 3} fill="#5b6b67" fontSize="10">
            0
          </text>
          {varPoints.map((v: any) => (
            <circle
              key={v.id}
              cx={v.x}
              cy={v.y}
              r={2.4}
              fill="#d4a017"
              onMouseEnter={() =>
                setHover({
                  kind: 'variant',
                  title: v.id,
                  detail: `pos ${v.pos} · AF=${v.af}${v.ref && v.alt ? ` · ${v.ref}>${v.alt}` : ''}`,
                })
              }
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {hover ? (
          <div className="tree-tooltip">
            <strong>{hover.title}</strong>
            <div className="muted">{hover.detail}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
