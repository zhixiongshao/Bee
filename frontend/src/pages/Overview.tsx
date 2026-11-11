import * as echarts from 'echarts'
import { useEffect, useState } from 'react'
import { api } from '../api'
import PageHeader from '../components/PageHeader'
import ChartActions from '../components/ChartActions'
import { useAsync } from '../hooks/useAsync'

function fmt(n: number) {
  return n.toLocaleString()
}

export default function Overview() {
  const { data, error, loading } = useAsync(() => api.overview(), [])
  const mapReady = useWorldMapReady()

  if (loading) return <div className="loading">加载概览数据…</div>
  if (error) return <div className="error">{error}</div>
  if (!data) return null

  const mapOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const d = p.data || {}
        return `${d.country || ''}<br/>${d.lineage || ''}: ${d.count || 0} samples`
      },
    },
    geo: {
      map: 'world',
      roam: true,
      itemStyle: {
        areaColor: '#dfe8e3',
        borderColor: '#9bb5ab',
      },
      emphasis: { itemStyle: { areaColor: '#c5ddd3' } },
    },
    series: [
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        symbolSize: (val: number[]) => Math.max(8, Math.min(28, Math.sqrt(val[2] || 1) * 3)),
        data: (data.map_points || []).map((p: any) => ({
          name: `${p.country}-${p.lineage}`,
          value: [p.lon, p.lat, p.count],
          country: p.country,
          lineage: p.lineage,
          count: p.count,
          itemStyle: { color: p.color },
        })),
      },
    ],
  }

  const pie = (items: any[], nameKey: string) => ({
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        label: { formatter: '{b}\n{d}%' },
        data: items.map((d) => ({
          name: d[nameKey],
          value: d.count,
          itemStyle: { color: d.color },
        })),
      },
    ],
  })

  return (
    <div className="stack">
      <PageHeader
        title="Overview"
        subtitle="全球蜜蜂全基因组队列概览：样本规模、谱系组成与采样分布。"
        right={<span className="badge ok">{data.pipeline_version}</span>}
      />

      <div className="grid-4">
        {[
          ['Samples', data.n_samples],
          ['SNPs', data.n_snps],
          ['Genes', data.n_genes],
          ['Sweep windows', data.n_sweep_windows],
        ].map(([label, value]) => (
          <div className="panel stat-card" key={label as string}>
            <div className="stat-label">{label as string}</div>
            <div className="stat-value">{fmt(value as number)}</div>
          </div>
        ))}
      </div>

      <div className="panel panel-pad">
        <h3 className="section-title">Global Sample Distribution</h3>
        {!mapReady.ready ? (
          <div className={mapReady.error ? 'error' : 'loading'}>
            {mapReady.error || '加载世界地图…'}
          </div>
        ) : (
          <ChartActions
            option={mapOption}
            height={420}
            title="Global Sample Distribution"
            filename="overview_sample_map"
            exportData={data.map_points}
          />
        )}
      </div>

      <div className="grid-2">
        <div className="panel panel-pad">
          <h3 className="section-title">Lineage Diversity</h3>
          <ChartActions
            option={pie(data.lineage, 'lineage')}
            height={320}
            title="Lineage Diversity"
            filename="overview_lineage"
            exportData={data.lineage}
          />
        </div>
        <div className="panel panel-pad">
          <h3 className="section-title">Caste Distribution</h3>
          <ChartActions
            option={pie(data.caste, 'caste')}
            height={320}
            title="Caste Distribution"
            filename="overview_caste"
            exportData={data.caste}
          />
        </div>
      </div>
    </div>
  )
}

function useWorldMapReady() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/maps/world.json')
        if (!res.ok) throw new Error(`world.json ${res.status}`)
        const geo = await res.json()
        echarts.registerMap('world', geo as any)
        if (alive) setReady(true)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return { ready, error }
}
