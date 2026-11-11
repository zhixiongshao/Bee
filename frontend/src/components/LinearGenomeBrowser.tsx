import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { useAsync } from '../hooks/useAsync'

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
  const height = 280
  const pad = 28
  const plotLeft = pad
  const plotRight = width - pad
  const plotW = plotRight - plotLeft
  const span = Math.max(1, query.end - query.start)

  // Track layout (no overlap):
  // ruler y=36; genes 58-88; variants baseline 240, points 160-240
  const geneY = 68
  const geneH = 16
  const varBaseY = 240
  const varMaxH = 70

  const genes = data?.genes || []
  const variants = data?.items || []

  const geneRects = useMemo(
    () =>
      genes.map((g: any) => {
        const x1 = plotLeft + ((Math.max(g.start, query.start) - query.start) / span) * plotW
        const x2 = plotLeft + ((Math.min(g.end, query.end) - query.start) / span) * plotW
        return { ...g, x: x1, w: Math.max(2, x2 - x1) }
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
            {(chroms.data?.items || [{ chrom: defaultChrom }]).map((c: any) => (
              <option key={c.chrom} value={c.chrom}>
                {c.chrom}
              </option>
            ))}
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
            {query.chrom}:{query.start.toLocaleString()}-{query.end.toLocaleString()}
          </text>
          <line
            x1={plotLeft}
            x2={plotRight}
            y1={36}
            y2={36}
            stroke="#0f3d38"
            strokeWidth="2"
          />

          <text x={pad} y={56} fill="#0f3d38" fontSize="12" fontWeight="700">
            Gene models ({geneRects.length})
          </text>
          <rect
            x={plotLeft}
            y={geneY - 6}
            width={plotW}
            height={geneH + 12}
            fill="rgba(31,107,95,0.04)"
            rx={6}
          />
          {geneRects.map((g: any) => (
            <rect
              key={g.gene_id}
              x={g.x}
              y={geneY}
              width={g.w}
              height={geneH}
              rx={3}
              fill="#1f6b5f"
              opacity={0.9}
            >
              <title>
                {g.symbol} {g.start}-{g.end} ({g.strand})
              </title>
            </rect>
          ))}

          <text x={pad} y={130} fill="#0f3d38" fontSize="12" fontWeight="700">
            Variants AF ({varPoints.length} shown / {data?.total ?? 0} total)
          </text>
          <line
            x1={plotLeft}
            x2={plotRight}
            y1={varBaseY}
            y2={varBaseY}
            stroke="rgba(19,33,31,0.2)"
          />
          <line
            x1={plotLeft}
            x2={plotLeft}
            y1={varBaseY - varMaxH}
            y2={varBaseY}
            stroke="rgba(19,33,31,0.15)"
          />
          <text x={8} y={varBaseY - varMaxH + 4} fill="#5b6b67" fontSize="10">
            1
          </text>
          <text x={8} y={varBaseY + 3} fill="#5b6b67" fontSize="10">
            0
          </text>
          {varPoints.map((v: any) => (
            <circle key={v.id} cx={v.x} cy={v.y} r={2.2} fill="#d4a017">
              <title>
                {v.id} AF={v.af}
              </title>
            </circle>
          ))}
        </svg>
      </div>
    </div>
  )
}
