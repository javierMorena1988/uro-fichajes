import type { SyncStatus } from './fichaje'

/** Un ciclo completo entrada→salida (como Factorial). */
export interface Presencia {
  id: string
  codDelegacion: number
  codOperario: number
  fechaHoraEntrada: string
  fechaHoraSalida?: string
  totalMinutos?: number
  dispositivoId: string
  syncStatus: SyncStatus
  syncError?: string
}
