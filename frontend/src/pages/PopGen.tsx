import { useMemo, useState } from 'react'
import 'echarts-gl'
import { api } from '../api'
import PageHeader from '../components/PageHeader'
import ChartActions from '../components/ChartActions'
import PhylogenyTree from '../components/PhylogenyTree'
import { useAsync } from '../hooks/useAsync'

export default function PopGen() {
  const [k, setK] = useState(5)
  const [pcaMode, setPcaMode] = useState<'2d' | '3d'>('2d')

  const overview = useAsync(() => api.overview(), [])
  const summary = useAsync(() => api.popgenSummary(), [])
  const pca = useAsync(() => api.pca(), [])
  const admix = useAsync(() => api.admixture(k), [k])
  const ld = useAsync(() => api.ldDecay(), [])
  const tree = useAsync(() => api.tree(), [])

  const admixOption = useMemo(() => {
    const items = admix.data?.items || []
    const step = Math.max(1, Math.floor(items.length / 800))
    const shown = items.filter((_: any, i: number) => i % step === 0)
    const kVal = admix.data?.k || k
    const series = Array.from({ length: kVal }, (_, i) => ({
      name: `Comp ${i + 1}`,
      type: 'bar',
      stack: 'admix',
      barWidth: '100%',
      data: shown.map((r: any) => r.proportions[i]),
      emphasis: { focus: 'series' },
    }))
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          const idx = params[0]?.dataIndex
          const row = shown[idx]
          if (!row) return ''
          return (
            `${row.sample_id}<br/>${row.lineage} · ${row.country}<br/>` +
            params
              .map((p) => `${p.marker}${p.seriesName}: ${Number(p.value).toFixed(3)}`)
              .join('<br/>')
          )
        },
      },
      legend: { top: 0 },
      grid: { left: 20, right: 20, top: 40, bottom: 40 },
      xAxis: {
        type: 'category',
        data: shown.map((r: any) => r.sample_id),
        axisLabel: { show: false },
        axisTick: { show: false },
      },
      yAxis: { type: 'value', max: 1, min: 0 },
      series,
      color: [
        '#0f3d38',
        '#d4a017',
        '#2e86ab',
        '#e4572e',
        '#76b041',
        '#8e44ad',
        '#5b6b67',
        '#f0c45c',
        '#a8d5c8',
        '#b56576',
        '#1f6b5f',
        '#9aa0a6',
      ],
    }
  }, [admix.data, k])

  const pca2d = useMemo(() => {
    const items = pca.data?.items || []
    const byLin: Record<string, any[]> = {}
    for (const s of items) {
      ;(byLin[s.lineage] ||= []).push([s.pc1, s.pc2, s.sample_id, s.mean_depth, s.country])
    }
    return {
      tooltip: {
        formatter: (p: any) =>
          `${p.data[2]}<br/>${p.seriesName}<br/>PC1=${p.data[0]} PC2=${p.data[1]}<br/>depth=${p.data[3]}<br/>${p.data[4]}`,
      },
      legend: { top: 0 },
      grid: { left: 50, right: 20, top: 40, bottom: 40 },
      xAxis: { name: 'PC1', scale: true },
      yAxis: { name: 'PC2', scale: true },
      series: Object.entries(byLin).map(([lin, pts]) => ({
        name: lin,
        type: 'scatter',
        symbolSize: 7,
        data: pts,
        itemStyle: { color: items.find((x: any) => x.lineage === lin)?.color },
      })),
    }
  }, [pca.data])

  const pca3d = useMemo(() => {
    const items = pca.data?.items || []
    const byLin: Record<string, any[]> = {}
    for (const s of items) {
      ;(byLin[s.lineage] ||= []).push([s.pc1, s.pc2, s.pc3, s.sample_id])
    }
    return {
      tooltip: {},
      legend: { top: 0 },
      xAxis3D: { name: 'PC1' },
      yAxis3D: { name: 'PC2' },
      zAxis3D: { name: 'PC3' },
      grid3D: {
        boxWidth: 100,
        boxDepth: 80,
        viewControl: { projection: 'perspective' },
      },
      series: Object.entries(byLin).map(([lin, pts]) => ({
        name: lin,
        type: 'scatter3D',
        symbolSize: 5,
        data: pts,
        itemStyle: { color: items.find((x: any) => x.lineage === lin)?.color },
      })),
    }
  }, [pca.data])

  const fstOption = useMemo(() => {
    const grid = summary.data?.pairwise_fst_grid || {}
    const labels = Object.keys(grid)
    const data: any[] = []
    labels.forEach((a, i) => {
      labels.forEach((b, j) => {
        data.push([j, i, grid[a]?.[b] ?? 0])
      })
    })
    return {
      tooltip: { position: 'top' },
      grid: { left: 50, right: 40, top: 20, bottom: 40 },
      xAxis: { type: 'category', data: labels },
      yAxis: { type: 'category', data: labels },
      visualMap: {
        min: 0,
        max: Math.max(0.1, ...data.map((d) => d[2] || 0)),
        calculable: true,
        orient: 'vertical',
        right: 0,
        inRange: { color: ['#f7f3ea', '#d4a017', '#0f3d38'] },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: { show: true, formatter: (p: any) => Number(p.data[2]).toFixed(2) },
        },
      ],
    }
  }, [summary.data])

  const piOption = useMemo(() => {
    const pi = summary.data?.nucleotide_diversity_pi || {}
    const labels = Object.keys(pi)
    return {
      tooltip: { trigger: 'item' },
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      xAxis: { type: 'category', data: labels, name: 'Lineage' },
      yAxis: { type: 'value', name: 'π' },
      series: [
        {
          type: 'boxplot',
          data: labels.map((l) => {
            const d = pi[l]
            const median = d.median ?? d.median_pi
            const low = d.min ?? d.q25
            const high = d.max ?? d.q75
            return [low, d.q25, median, d.q75, high]
          }),
          itemStyle: { color: '#a8d5c8', borderColor: '#0f3d38' },
        },
      ],
    }
  }, [summary.data])

  const ldOption = useMemo(() => {
    const payload = ld.data || {}
    return {
      tooltip: { trigger: 'axis' },
      legend: { top: 0 },
      grid: { left: 50, right: 20, top: 40, bottom: 40 },
      xAxis: { type: 'value', name: 'Distance (kb)' },
      yAxis: { type: 'value', name: 'r²', min: 0, max: 1 },
      series: Object.entries(payload).map(([name, obj]: any) => ({
        name: name.replace('Lineage_', ''),
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: (obj.points || []).map((p: any) => [p.dist_kb, p.r2]),
        itemStyle: { color: obj.color },
        lineStyle: { color: obj.color, width: 2 },
      })),
    }
  }, [ld.data])

  return (
    <div className="stack">
      <PageHeader
        title="Population Genetics"
        subtitle="Admixture、PCA、Fst、核苷酸多样性、LD 衰减与 NJ 系统发育树。"
      />

      <div className="panel panel-pad meta-bar">
        <div>
          <div className="muted">Samples</div>
          <strong>{(overview.data?.n_samples || 2360).toLocaleString()}</strong>
        </div>
        <div>
          <div className="muted">Species</div>
          <strong>{overview.data?.species || 'Apis mellifera'}</strong>
        </div>
        <div>
          <div className="muted">Assembly</div>
          <strong>{overview.data?.assembly || 'Amel_HAv3.1'}</strong>
        </div>
        <div>
          <div className="muted">Pipeline</div>
          <strong>{overview.data?.pipeline_version || 'Slurm Batch v4.2'}</strong>
        </div>
      </div>

      <div className="panel panel-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h3 className="section-title" style={{ marginBottom: 0 }}>
            Admixture (K={k})
          </h3>
          <div className="field" style={{ minWidth: 220 }}>
            <label>K = {k}</label>
            <input
              type="range"
              min={2}
              max={12}
              value={k}
              onChange={(e) => setK(Number(e.target.value))}
            />
          </div>
        </div>
        {admix.loading ? <div className="loading">加载 Admixture…</div> : null}
        {admix.error ? <div className="error">{admix.error}</div> : null}
        <ChartActions
          option={admixOption}
          height={320}
          title={`Admixture K=${k}`}
          filename={`admixture_K${k}`}
          exportData={admix.data}
          notMerge
        />
      </div>

      <div className="panel panel-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="section-title" style={{ marginBottom: 0 }}>
            PCA Projection
          </h3>
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab ${pcaMode === '2d' ? 'active' : ''}`} onClick={() => setPcaMode('2d')}>
              2D
            </button>
            <button className={`tab ${pcaMode === '3d' ? 'active' : ''}`} onClick={() => setPcaMode('3d')}>
              3D
            </button>
          </div>
        </div>
        {pca.loading ? <div className="loading">加载 PCA…</div> : null}
        <ChartActions
          option={pcaMode === '2d' ? pca2d : pca3d}
          height={420}
          title={`PCA ${pcaMode.toUpperCase()}`}
          filename={`pca_${pcaMode}`}
          exportData={pca.data?.items || []}
          notMerge
        />
      </div>

      <div className="grid-2">
        <div className="panel panel-pad">
          <h3 className="section-title">Fst Divergence Heatmap</h3>
          <ChartActions
            option={fstOption}
            height={360}
            title="Fst Divergence"
            filename="fst_heatmap"
            exportData={summary.data?.pairwise_fst_flat || {}}
          />
        </div>
        <div className="panel panel-pad">
          <h3 className="section-title">Nucleotide Diversity (π)</h3>
          <ChartActions
            option={piOption}
            height={360}
            title="Nucleotide Diversity"
            filename="pi_boxplot"
            exportData={summary.data?.nucleotide_diversity_pi || {}}
          />
        </div>
      </div>

      <div className="panel panel-pad">
        <h3 className="section-title">LD Decay (r²)</h3>
        <ChartActions
          option={ldOption}
          height={360}
          title="LD Decay"
          filename="ld_decay"
          exportData={ld.data || {}}
        />
      </div>

      <div className="panel panel-pad">
        <h3 className="section-title">Phylogenetic Tree (NJ)</h3>
        {tree.loading ? <div className="loading">加载树…</div> : null}
        {tree.error ? <div className="error">{tree.error}</div> : null}
        {tree.data?.newick ? (
          <PhylogenyTree newick={tree.data.newick} sampleMeta={tree.data.sample_meta || {}} />
        ) : null}
      </div>
    </div>
  )
}
