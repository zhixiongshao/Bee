import { useEffect, useMemo, useRef, useState } from 'react'
import {
  layoutRadial,
  layoutRectangular,
  parseNewick,
  type LaidOut,
} from '../utils/newick'
import { downloadText } from '../utils/export'

type Meta = Record<string, { lineage?: string; color?: string; type?: string }>

export default function PhylogenyTree({
  newick,
  sampleMeta,
}: {
  newick: string
  sampleMeta: Meta
}) {
  const [mode, setMode] = useState<'radial' | 'rectangular'>('radial')
  const [hover, setHover] = useState<LaidOut | null>(null)
  const [scale, setScale] = useState(1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 900, h: 560 })

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 900
      const h = w < 640 ? 380 : 560
      setSize({ w, h })
    })
    ro.observe(el)
    const w = el.clientWidth || 900
    setSize({ w, h: w < 640 ? 380 : 560 })
    return () => ro.disconnect()
  }, [])

  const nodes = useMemo(() => {
    try {
      const root = parseNewick(newick)
      return mode === 'radial'
        ? layoutRadial(root, sampleMeta, size.w, size.h)
        : layoutRectangular(root, sampleMeta, size.w, size.h)
    } catch (e) {
      console.error(e)
      return [] as LaidOut[]
    }
  }, [newick, sampleMeta, mode, size])

  const leaves = nodes.filter((n) => n.isLeaf)
  const lineageLegend = useMemo(() => {
    const map = new Map<string, string>()
    for (const [id, m] of Object.entries(sampleMeta)) {
      if (m.lineage && m.color) map.set(m.lineage, m.color)
      void id
    }
    return [...map.entries()]
  }, [sampleMeta])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button
            className={`tab ${mode === 'radial' ? 'active' : ''}`}
            onClick={() => setMode('radial')}
            type="button"
          >
            Radial
          </button>
          <button
            className={`tab ${mode === 'rectangular' ? 'active' : ''}`}
            onClick={() => setMode('rectangular')}
            type="button"
          >
            Rectangular
          </button>
        </div>
        <div className="chart-actions">
          <button className="btn secondary" type="button" onClick={() => setScale((s) => Math.min(3, s + 0.2))}>
            Zoom +
          </button>
          <button className="btn secondary" type="button" onClick={() => setScale((s) => Math.max(0.4, s - 0.2))}>
            Zoom -
          </button>
          <button className="btn secondary" type="button" onClick={() => setScale(1)}>
            Reset
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => downloadText('cohort_2360_nj.tree', newick, 'text/plain')}
          >
            Export Newick
          </button>
        </div>
      </div>

      <div className="chips" style={{ marginTop: 10, marginBottom: 8 }}>
        {lineageLegend.map(([lin, color]) => (
          <span className="chip" key={lin} style={{ background: `${color}22`, color }}>
            {lin}
          </span>
        ))}
        <span className="muted">{leaves.length} tips</span>
      </div>

      <div ref={wrapRef} className="tree-wrap">
        <svg width={size.w} height={size.h} style={{ background: '#fffcf6' }}>
          <g transform={`translate(${size.w / 2} ${size.h / 2}) scale(${scale}) translate(${-size.w / 2} ${-size.h / 2})`}>
            {nodes.map((n, idx) =>
              n.parent ? (
                <path
                  key={`e-${idx}`}
                  d={
                    mode === 'rectangular'
                      ? `M${n.parent.x},${n.parent.y} H${n.x} V${n.y}`
                      : `M${n.parent.x},${n.parent.y} L${n.x},${n.y}`
                  }
                  fill="none"
                  stroke="rgba(19,33,31,0.25)"
                  strokeWidth={1}
                />
              ) : null,
            )}
            {nodes.map((n, idx) =>
              n.isLeaf ? (
                <circle
                  key={`n-${idx}`}
                  cx={n.x}
                  cy={n.y}
                  r={2.2}
                  fill={n.color}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>
                    {n.name} · {sampleMeta[n.name]?.lineage || ''}
                  </title>
                </circle>
              ) : null,
            )}
          </g>
        </svg>
        {hover ? (
          <div className="tree-tooltip">
            <strong>{hover.name}</strong>
            <div>{sampleMeta[hover.name]?.lineage || 'Unassigned'}</div>
            <div className="muted">{sampleMeta[hover.name]?.type || ''}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
