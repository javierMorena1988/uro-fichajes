import type { SyncStatus } from './fichaje'

export interface TrabajoCabecera {
  id: string
  codDelegacion: number
  codOperario: number
  fechaHoraInicio: string
  fechaHoraFin?: string
  totalMinutos?: number
  dispositivoId: string
  syncStatus: SyncStatus
  syncError?: string
}

export interface TrabajoDetalle {
  id: string
  idCabecera: string
  codigoOrden: number
}

export interface TrabajoCompleto {
  cabecera: TrabajoCabecera
  detalles: TrabajoDetalle[]
}
