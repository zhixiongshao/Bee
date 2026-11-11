import { useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import { downloadJson, exportChartPdf, exportChartPng } from '../utils/export'

type Props = {
  option: any
  height?: number
  title: string
  filename: string
  exportData?: unknown
  notMerge?: boolean
}

export default function ChartActions({
  option,
  height = 360,
  title,
  filename,
  exportData,
  notMerge,
}: Props) {
  const ref = useRef<ReactECharts>(null)

  return (
    <div>
      <div className="chart-actions">
        <button
          className="btn secondary"
          type="button"
          onClick={() => ref.current && void exportChartPdf(ref.current, `${filename}.pdf`, title)}
        >
          Export PDF
        </button>
        <button
          className="btn secondary"
          type="button"
          onClick={() => ref.current && exportChartPng(ref.current, `${filename}.png`)}
        >
          Export PNG
        </button>
        {exportData != null ? (
          <button
            className="btn secondary"
            type="button"
            onClick={() => downloadJson(`${filename}.json`, exportData)}
          >
            Export Data
          </button>
        ) : null}
      </div>
      <ReactECharts ref={ref} option={option} style={{ height }} notMerge={notMerge} />
    </div>
  )
}
