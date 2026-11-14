export const NUCLEAR_CHROMS = Array.from(
  { length: 16 },
  (_, i) => `NC_0376${38 + i}.1`,
)

export const CHROM_LABELS: Record<string, string> = Object.fromEntries(
  NUCLEAR_CHROMS.map((c, i) => [c, `Chr${i + 1}`]),
)

export function chromLabel(chrom: string) {
  return CHROM_LABELS[chrom] || chrom
}

export const LINEAGE_COLORS: Record<string, string> = {
  A: '#E4572E',
  C: '#2E86AB',
  M: '#F2C14E',
  O: '#76B041',
  Y: '#8E44AD',
  Unassigned: '#9AA0A6',
}
