/** Día local YYYY-MM-DD */
export function diaLocal(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDiaEs(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number)
  if (!y || !m || !d) return dia
  try {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'full' }).format(
      new Date(y, m - 1, d),
    )
  } catch {
    return dia
  }
}
