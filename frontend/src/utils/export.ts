export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadJson(filename: string, data: unknown) {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json')
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join(
    '\n',
  )
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  downloadText(filename, toCsv(rows), 'text/csv')
}

export async function exportChartPdf(
  chart: { getEchartsInstance: () => any },
  filename: string,
  title = filename,
) {
  const inst = chart.getEchartsInstance()
  const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
  try {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    pdf.setFontSize(14)
    pdf.text(title, 40, 36)
    pdf.addImage(url, 'PNG', 40, 50, pageW - 80, pageH - 80)
    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
  } catch {
    // fallback to PNG if jspdf unavailable
    exportChartPng(chart, filename.replace(/\.pdf$/i, '.png'))
  }
}

export function exportChartPng(
  chart: { getEchartsInstance: () => any },
  filename: string,
) {
  const inst = chart.getEchartsInstance()
  const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`
  a.click()
}
