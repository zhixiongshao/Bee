import { api } from '../api'
import PageHeader from '../components/PageHeader'
import { useAsync } from '../hooks/useAsync'

const snippet = `# list samples
curl -s 'http://127.0.0.1:8000/api/samples?page=1&page_size=5' | python -m json.tool

# query variants in a region
curl -s 'http://127.0.0.1:8000/api/variants/region?chrom=NC_037638.1&start=3000&end=10000' \\
  | python -m json.tool

# Python
import requests
r = requests.get('http://127.0.0.1:8000/api/popgen/summary')
print(r.json()['pairwise_fst_flat'])
`

export default function Download() {
  const { data, error, loading } = useAsync(() => api.manifest(), [])

  return (
    <div className="stack">
      <PageHeader
        title="Download"
        subtitle="核心数据资产清单、MD5 校验与 API 快速接入示例。"
      />

      <div className="panel panel-pad">
        <h3 className="section-title">Dataset Manifest</h3>
        {loading ? <div className="loading">加载清单…</div> : null}
        {error ? <div className="error">{error}</div> : null}
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>File</th>
                <th>Size</th>
                <th>MD5</th>
                <th>Available</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((row: any) => (
                <tr key={row.file_name}>
                  <td>{row.file_name}</td>
                  <td>{row.size_human || row.size_bytes}</td>
                  <td style={{ fontFamily: 'ui-monospace, monospace' }}>{row.md5}</td>
                  <td>
                    <span className={`badge ${row.available ? 'ok' : 'warn'}`}>
                      {row.available ? 'yes' : 'missing'}
                    </span>
                  </td>
                  <td>
                    {row.available ? (
                      <a className="btn secondary" href={row.download_url}>
                        Download
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel panel-pad">
        <h3 className="section-title">API quickstart</h3>
        <pre className="code">{snippet}</pre>
      </div>
    </div>
  )
}
