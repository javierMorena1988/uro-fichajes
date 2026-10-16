export function newId(prefix = 'id'): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function minutosEntre(inicioIso: string, finIso: string): number {
  const a = new Date(inicioIso).getTime()
  const b = new Date(finIso).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return Math.round((b - a) / 60000)
}

export function normalizeTarjeta(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.padStart(8, '0').slice(-8)
}

export function formatHora(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatDuracionMinutos(minutos: number): string {
  const m = Math.max(0, Math.floor(minutos))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h <= 0) return `${rest} min`
  return `${h} h ${rest} min`
}
