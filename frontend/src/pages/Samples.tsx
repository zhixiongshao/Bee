import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import PageHeader from '../components/PageHeader'
import ChartActions from '../components/ChartActions'
import Modal from '../components/Modal'
import { useAsync } from '../hooks/useAsync'
import { downloadCsv, downloadJson } from '../utils/export'

export default function Samples() {
  const filters = useAsync(() => api.sampleFilters(), [])
  const [lineage, setLineage] = useState<string[]>([])
  const [caste, setCaste] = useState<string[]>([])
  const [country, setCountry] = useState<string[]>([])
  const [instrument, setInstrument] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<any>(null)
  const [pageSize, setPageSize] = useState(10)
  const [chartHeight, setChartHeight] = useState(220)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const apply = () => {
      setPageSize(mq.matches ? 6 : 10)
      setChartHeight(mq.matches ? 180 : 220)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [pageSize])

  const queryKey = useMemo(
    () => ({ lineage, caste, country, instrument, q, page, pageSize }),
    [lineage, caste, country, instrument, q, page, pageSize],
  )

  const { data, error, loading } = useAsync(
    () =>
      api.samples({
        lineage,
        caste,
        country,
        instrument,
        q: q || undefined,
        page,
        page_size: pageSize,
      }),
    [JSON.stringify(queryKey)],
  )

  const histOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 52, right: 28, top: 28, bottom: 52, containLabel: false },
    xAxis: {
      type: 'category',
      data: (data?.qc?.depth_hist || []).map((b: any) => `${b.bin_start.toFixed(0)}`),
      name: 'mean depth',
      nameLocation: 'middle',
      nameGap: 28,
      axisLabel: { interval: 4, hideOverlap: true, margin: 10 },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: 'value',
      name: 'samples',
      nameLocation: 'middle',
      nameGap: 36,
      splitNumber: 4,
    },
    series: [
      {
        type: 'bar',
        barCategoryGap: '28%',
        data: (data?.qc?.depth_hist || []).map((b: any) => b.count),
        itemStyle: { color: '#1f6b5f' },
      },
    ],
  }

  return (
    <div className="stack">
      <PageHeader
        title="Samples"
        subtitle="多维筛选 2,360 样本元数据与质控指标，支持按谱系、阶级、国家与测序平台过滤。"
      />

      <div className="panel panel-pad">
        <div className="filters">
          <Multi
            label="Lineage"
            options={filters.data?.lineages || []}
            value={lineage}
            onChange={(v) => {
              setPage(1)
              setLineage(v)
            }}
          />
          <Multi
            label="Caste"
            options={filters.data?.castes || []}
            value={caste}
            onChange={(v) => {
              setPage(1)
              setCaste(v)
            }}
          />
          <Multi
            label="Country"
            options={filters.data?.countries || []}
            value={country}
            onChange={(v) => {
              setPage(1)
              setCountry(v)
            }}
          />
          <Multi
            label="Instrument"
            options={filters.data?.instruments || []}
            value={instrument}
            onChange={(v) => {
              setPage(1)
              setInstrument(v)
            }}
          />
          <div className="field" style={{ minWidth: 180 }}>
            <label>Search</label>
            <input
              value={q}
              placeholder="sample / alias / strain"
              onChange={(e) => {
                setPage(1)
                setQ(e.target.value)
              }}
            />
          </div>
        </div>
      </div>

      <div className="samples-layout">
        <div className="panel panel-pad samples-table-panel">
          <div className="panel-title-row">
            <h3 className="section-title">Sample Table</h3>
            <span className="muted">{data ? `${data.total} samples` : ''}</span>
          </div>
          {loading ? <div className="loading">加载中…</div> : null}
          {error ? <div className="error">{error}</div> : null}
          <div className="table-wrap samples-table-wrap">
            <table className="data samples-table">
              <colgroup>
                <col style={{ width: '14%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '23%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Sample ID</th>
                  <th>Lineage</th>
                  <th>Caste</th>
                  <th>Country</th>
                  <th className="num">Depth</th>
                  <th className="num">Mapping %</th>
                  <th className="num">Q30 %</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items || []).map((s: any) => (
                  <tr key={s.sample_id}>
                    <td>{s.sample_id}</td>
                    <td>{s.lineage}</td>
                    <td>{s.type}</td>
                    <td>{s.country}</td>
                    <td className="num">{s.mean_depth}</td>
                    <td className="num">{s.mapping_rate}</td>
                    <td className="num">{s.q30_rate}</td>
                    <td className="actions">
                      <div className="row-actions">
                        <button className="btn secondary" type="button" onClick={() => setDetail(s)}>
                          Detail
                        </button>
                        <button
                          className="btn secondary"
                          type="button"
                          onClick={() => downloadCsv(`${s.sample_id}.csv`, [s])}
                        >
                          Export
                        </button>
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
            <span className="muted">
              Page {page}
              {data ? ` / ${Math.max(1, Math.ceil(data.total / data.page_size))}` : ''}
            </span>
            <button
              className="btn secondary"
              disabled={!data || page * data.page_size >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>

        <div className="samples-side">
          <div className="panel panel-pad">
            <h3 className="section-title">QC Snapshot</h3>
            <div className="qc-metrics">
              <Metric label="Mean depth" value={data?.qc?.mean_depth ?? '-'} />
              <Metric label="Mapping ≥80%" value={`${data?.qc?.mapping_pass_rate ?? '-'}%`} />
              <Metric label="Q30 ≥85%" value={`${data?.qc?.q30_pass_rate ?? '-'}%`} />
            </div>
          </div>
          <div className="panel panel-pad samples-chart-panel">
            <h3 className="section-title">Depth Distribution</h3>
            <ChartActions
              option={histOption}
              height={chartHeight}
              title="Depth Distribution"
              filename="samples_depth_hist"
              exportData={data?.qc?.depth_hist || []}
            />
          </div>
        </div>
      </div>

      <Modal
        open={!!detail}
        title={detail ? `Sample ${detail.sample_id}` : ''}
        onClose={() => setDetail(null)}
        wide
      >
        {detail ? (
          <div className="stack">
            <div className="chart-actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => downloadJson(`${detail.sample_id}.json`, detail)}
              >
                Export JSON
              </button>
              <button
                className="btn secondary"
                type="button"
                onClick={() => downloadCsv(`${detail.sample_id}.csv`, [detail])}
              >
                Export CSV
              </button>
            </div>
            <div className="table-wrap">
              <table className="data">
                <tbody>
                  {Object.entries(detail).map(([k, v]) => (
                    <tr key={k}>
                      <th style={{ width: 180 }}>{k}</th>
                      <td>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="qc-metric">
      <div className="qc-metric-label">{label}</div>
      <div className="qc-metric-value">{value}</div>
    </div>
  )
}

function Multi({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select
        multiple
        value={value}
        onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value))}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}
