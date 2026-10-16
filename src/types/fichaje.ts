export type TipoFichaje = 'entrada' | 'salida'

export type SyncStatus = 'pending' | 'synced' | 'error'

export interface Fichaje {
  id: string
  tipo: TipoFichaje
  numeroEmpleado: string
  registradoEn: string
  creadoEn: string
  dispositivoId: string
  syncStatus: SyncStatus
  syncError?: string
}

export interface FichajePayload {
  id: string
  tipo: TipoFichaje
  numeroEmpleado: string
  registradoEn: string
  creadoEn: string
  dispositivoId: string
}
