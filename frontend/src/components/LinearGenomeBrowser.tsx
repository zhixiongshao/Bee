import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { useAsync } from '../hooks/useAsync'
import { chromLabel } from '../utils/chroms'

function niceStep(spanBp: number) {
  const raw = spanBp / 5
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))))
  const n = raw / pow
  const mult = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10
  return mult * pow
}

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
        page_size: 200000,
      }),
    [JSON.stringify(query)],
  )

  const [width, setWidth] = useState(960)
  const padL = 44
  const padR = 56
  const plotLeft = padL
  const plotRight = width - padR
  const plotW = Math.max(1, plotRight - plotLeft)
  const span = Math.max(1, query.end - query.start)

  const genes = data?.genes || []
  const variants = data?.items || []

  const geneLanes = Math.max(2, Math.min(8, Math.ceil(genes.length / 8) || 2))
  const geneY = 78
  const geneLaneH = 34
  const geneH = 16
  const geneTrackBottom = geneY + geneLanes * geneLaneH
  const varLabelY = geneTrackBottom + 24
  const varBaseY = varLabelY + 120
  const varMaxH = 100
  const axisY = varBaseY + 18
  const height = axisY + 36

  const xOf = (pos: number) =>
    plotLeft + ((pos - query.start) / span) * plotW

  const geneRects = useMemo(
    () =>
      genes.map((g: any, i: number) => {
        const x1 = xOf(Math.max(g.start, query.start))
        const x2 = xOf(Math.min(g.end, query.end))
        const lane = i % geneLanes
        return {
          ...g,
          x: x1,
          w: Math.max(3, x2 - x1),
          y: geneY + lane * geneLaneH,
          label: g.symbol || g.gene_id,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [genes, query, span, plotLeft, plotW, geneLanes],
  )

  const varPoints = useMemo(
    () =>
      variants.map((v: any) => ({
        ...v,
        x: xOf(v.pos),
        y: varBaseY - Math.min(varMaxH, (Number(v.af) || 0) * varMaxH),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variants, query, span, plotLeft, plotW, varBaseY],
  )

  const ticks = useMemo(() => {
    const step = niceStep(span)
    const first = Math.ceil(query.start / step) * step
    const out: { pos: number; x: number; label: string }[] = []
    for (let p = first; p <= query.end; p += step) {
      const kb = p / 1000
      const label =
        kb >= 1000 ? `${(kb / 1000).toFixed(kb % 1000 === 0 ? 0 : 1)} Mb` : `${Math.round(kb)} kb`
      out.push({ pos: p, x: xOf(p), label })
    }
    if (!out.length || out[0].pos !== query.start) {
      out.unshift({
        pos: query.start,
        x: xOf(query.start),
        label: `${Math.round(query.start / 1000)} kb`,
      })
    }
    const last = out[out.length - 1]
    if (!last || last.pos !== query.end) {
      out.push({
        pos: query.end,
        x: xOf(query.end),
        label: `${Math.round(query.end / 1000)} kb`,
      })
    }
    return out
  }, [query.start, query.end, span, plotLeft, plotW])

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setWidth(Math.max(640, el.clientWidth))
    })
    ro.observe(el)
    setWidth(Math.max(640, el.clientWidth))
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#d4a017'
    for (const v of varPoints) {
      // keep points fully inside plot (right edge inclusive)
      if (v.x < plotLeft - 1 || v.x > plotRight + 1) continue
      ctx.beginPath()
      ctx.arc(Math.min(plotRight, Math.max(plotLeft, v.x)), v.y, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [varPoints, width, height, plotLeft, plotRight])

  function onPlotMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const geneHit = geneRects.find(
      (g: any) =>
        x >= g.x &&
        x <= g.x + Math.max(g.w, 40) &&
        y >= g.y &&
        y <= g.y + geneLaneH,
    )
    if (geneHit) {
      setHover({
        kind: 'gene',
        title: geneHit.label,
        detail: `${geneHit.chrom}:${geneHit.start}-${geneHit.end} (${geneHit.strand}) · exons ${geneHit.exon_count}`,
      })
      return
    }

    let best: any = null
    let bestD = 8
    for (const v of varPoints) {
      const d = Math.hypot(v.x - x, v.y - y)
      if (d < bestD) {
        bestD = d
        best = v
      }
    }
    if (best) {
      setHover({
        kind: 'variant',
        title: best.id,
        detail: `pos ${best.pos} · AF=${best.af}${
          best.ref && best.alt ? ` · ${best.ref}>${best.alt}` : ''
        }`,
      })
    } else {
      setHover(null)
    }
  }

  function zoom(factor: number) {
    const mid = (query.start + query.end) / 2
    const half = Math.max(500, ((query.end - query.start) / 2) * factor)
    const chromLen =
      chroms.data?.items?.find((c: any) => c.chrom === query.chrom)?.length || 1e9
    const ns = Math.max(1, Math.floor(mid - half))
    const ne = Math.min(chromLen, Math.floor(mid + half))
    setStart(ns)
    setEnd(ne)
    setQuery({ chrom: query.chrom, start: ns, end: ne })
  }

  return (
    <div className="stack">
      <div className="filters">
        <div className="field">
          <label>Chromosome</label>
          <select
            value={chrom}
            onChange={(e) => {
              setChrom(e.target.value)
              const len =
                chroms.data?.items?.find((c: any) => c.chrom === e.target.value)
                  ?.length || end
              setStart(1)
              setEnd(Math.min(1500000, len))
            }}
          >
            {(chroms.data?.items || []).map((c: any) => (
              <option key={c.chrom} value={c.chrom}>
                {c.label || chromLabel(c.chrom)} ({c.chrom})
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
          <input
            type="number"
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
          />
        </div>
        <button
          className="btn"
          onClick={() => setQuery({ chrom, start, end })}
          disabled={loading}
        >
          Go
        </button>
        <button className="btn secondary" onClick={() => zoom(0.5)}>
          Zoom in
        </button>
        <button className="btn secondary" onClick={() => zoom(2)}>
          Zoom out
        </button>
      </div>

      {error ? <div className="error">{String(error)}</div> : null}
      {loading ? <div className="muted">Loading track…</div> : null}

      <div className="tree-wrap" style={{ padding: 8 }} ref={wrapRef}>
        <div
          style={{ position: 'relative', width, height }}
          onMouseMove={onPlotMove}
          onMouseLeave={() => setHover(null)}
        >
          <svg
            width={width}
            height={height}
            style={{ display: 'block', position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <text x={padL} y={22} fill="#0f3d38" fontSize="13" fontWeight="700">
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

            <text x={padL} y={58} fill="#0f3d38" fontSize="12" fontWeight="700">
              Gene models ({geneRects.length})
            </text>
            {geneRects.map((g: any) => (
              <g key={g.gene_id}>
                <rect
                  x={g.x}
                  y={g.y + 12}
                  width={g.w}
                  height={geneH}
                  rx={3}
                  fill="#1f6b5f"
                  opacity={0.92}
                />
                <text
                  x={g.x}
                  y={g.y + 10}
                  fill="#0f3d38"
                  fontSize="10"
                  fontWeight="600"
                >
                  {g.label}
                </text>
              </g>
            ))}

            <text x={padL} y={varLabelY} fill="#0f3d38" fontSize="12" fontWeight="700">
              Variants AF ({varPoints.length}
              {data?.total && data.total !== varPoints.length
                ? ` / ${data.total} total`
                : ''}
              )
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

            {/* Physical coordinate ruler */}
            <line
              x1={plotLeft}
              x2={plotRight}
              y1={axisY}
              y2={axisY}
              stroke="#0f3d38"
              strokeWidth="1.5"
            />
            {ticks.map((t) => (
              <g key={`tick-${t.pos}`}>
                <line
                  x1={t.x}
                  x2={t.x}
                  y1={axisY}
                  y2={axisY + 6}
                  stroke="#0f3d38"
                  strokeWidth="1.5"
                />
                <text
                  x={t.x}
                  y={axisY + 20}
                  fill="#5b6b67"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {t.label}
                </text>
              </g>
            ))}
          </svg>
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          />
        </div>
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
