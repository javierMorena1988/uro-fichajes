import type { SyncStatus } from './fichaje'

/** foto ahora; video/audio reutilizan el mismo modelo */
export type TipoMedia = 'foto' | 'video' | 'audio'

export interface MediaItem {
  id: string
  tipo: TipoMedia
  /** Código operario como string (compat sync) */
  numeroEmpleado: string
  /** Día de trabajo YYYY-MM-DD */
  dia: string
  /** Trabajo de fabricación al que se adjunta (obligatorio en flujo PDA) */
  trabajoId?: string
  capturadoEn: string
  creadoEn: string
  dispositivoId: string
  mimeType: string
  fileName: string
  /** Solo en dispositivo; no viaja entero en listados remotos */
  blob?: Blob
  syncStatus: SyncStatus
  syncError?: string
  remoteUrl?: string
}

export interface MediaRemoteMeta {
  id: string
  tipo: TipoMedia
  numeroEmpleado: string
  dia: string
  trabajoId?: string
  capturadoEn: string
  creadoEn: string
  dispositivoId: string
  mimeType: string
  fileName: string
  url: string
  recibidoEn: string
}
