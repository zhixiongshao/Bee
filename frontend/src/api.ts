async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  return res.json() as Promise<T>
}

function qs(params: Record<string, string | number | string[] | undefined | null>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) v.forEach((item) => sp.append(k, item))
    else sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const api = {
  overview: () => get<any>('/api/overview/stats'),
  sampleFilters: () => get<any>('/api/samples/filters'),
  samples: (params: Record<string, any>) =>
    get<any>(`/api/samples${qs(params)}`),
  pca: () => get<any>('/api/samples/pca_scatter'),
  admixture: (k: number) => get<any>(`/api/popgen/admixture${qs({ k })}`),
  popgenSummary: () => get<any>('/api/popgen/summary'),
  ldDecay: () => get<any>('/api/popgen/ld_decay'),
  tree: () => get<any>('/api/popgen/tree'),
  sweeps: (params: Record<string, any>) =>
    get<any>(`/api/sweeps${qs(params)}`),
  chromosomes: () => get<any>('/api/chromosomes'),
  variants: (params: Record<string, any>) =>
    get<any>(`/api/variants/region${qs(params)}`),
  gene: (id: string) => get<any>(`/api/genes/${encodeURIComponent(id)}`),
  geneSearch: (q: string) => get<any>(`/api/genes/search${qs({ q })}`),
  manifest: () => get<any>('/api/download/manifest'),
  jbrowse: () => get<any>('/api/jbrowse/config'),
}
