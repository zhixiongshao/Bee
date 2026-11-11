import PageHeader from '../components/PageHeader'
import LinearGenomeBrowser from '../components/LinearGenomeBrowser'

export default function Browser() {
  return (
    <div className="stack">
      <PageHeader
        title="Genome Browser"
        subtitle="交互式线性基因组浏览：基因模型与变异频率轨道。"
      />

      <div className="panel panel-pad">
        <h3 className="section-title">Linear Genome View</h3>
        <LinearGenomeBrowser />
      </div>
    </div>
  )
}
