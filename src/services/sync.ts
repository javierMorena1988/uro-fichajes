import {
  listPendingPresencias,
  listPendingTrabajos,
  markPresenciaError,
  markPresenciaSynced,
  markTrabajoError,
  markTrabajoSynced,
  replaceOperarios,
  replaceOrdenesReparacion,
} from '../db/indexeddb'
import type { Operario, OrdenReparacion } from '../types/maestro'
import type { Presencia } from '../types/presencia'
import type { TrabajoCompleto } from '../types/trabajo'
import { pushPendingMedias } from './media-sync'

export interface SyncResult {
  mastersPulled: number
  presenciaPushed: number
  trabajosPushed: number
  mediaPushed: number
  errors: number
}

async function pullMasters(): Promise<number> {
  const [opsRes, orRes] = await Promise.all([
    fetch('/api/operarios'),
    fetch('/api/ordenes-reparacion'),
  ])
  if (!opsRes.ok) throw new Error(`Operarios HTTP ${opsRes.status}`)
  if (!orRes.ok) throw new Error(`Órdenes HTTP ${orRes.status}`)

  const operarios = (await opsRes.json()) as Operario[]
  const ordenes = (await orRes.json()) as OrdenReparacion[]
  await replaceOperarios(operarios)
  await replaceOrdenesReparacion(ordenes)
  return operarios.length + ordenes.length
}

async function pushPresencias(): Promise<{ pushed: number; errors: number }> {
  const pending = await listPendingPresencias()
  let pushed = 0
  let errors = 0

  for (const item of pending) {
    try {
      const payload: Omit<Presencia, 'syncStatus' | 'syncError'> & {
        syncStatus?: never
      } = {
        id: item.id,
        codDelegacion: item.codDelegacion,
        codOperario: item.codOperario,
        fechaHoraEntrada: item.fechaHoraEntrada,
        fechaHoraSalida: item.fechaHoraSalida,
        totalMinutos: item.totalMinutos,
        dispositivoId: item.dispositivoId,
      }
      const res = await fetch('/api/presencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      await markPresenciaSynced(item.id)
      pushed += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error sync presencia'
      await markPresenciaError(item.id, message)
      errors += 1
    }
  }

  return { pushed, errors }
}

async function pushTrabajos(): Promise<{ pushed: number; errors: number }> {
  const pending = await listPendingTrabajos()
  let pushed = 0
  let errors = 0

  for (const item of pending) {
    try {
      const payload: TrabajoCompleto = {
        cabecera: {
          ...item.cabecera,
          syncStatus: item.cabecera.syncStatus,
        },
        detalles: item.detalles,
      }
      const res = await fetch('/api/trabajos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cabecera: {
            id: payload.cabecera.id,
            codDelegacion: payload.cabecera.codDelegacion,
            codOperario: payload.cabecera.codOperario,
            fechaHoraInicio: payload.cabecera.fechaHoraInicio,
            fechaHoraFin: payload.cabecera.fechaHoraFin,
            totalMinutos: payload.cabecera.totalMinutos,
            dispositivoId: payload.cabecera.dispositivoId,
          },
          detalles: payload.detalles,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      await markTrabajoSynced(item.cabecera.id)
      pushed += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error sync trabajo'
      await markTrabajoError(item.cabecera.id, message)
      errors += 1
    }
  }

  return { pushed, errors }
}

export async function syncAll(): Promise<SyncResult> {
  let mastersPulled = 0
  let errors = 0

  try {
    mastersPulled = await pullMasters()
  } catch {
    errors += 1
  }

  const presencia = await pushPresencias()
  const trabajos = await pushTrabajos()
  const media = await pushPendingMedias()

  return {
    mastersPulled,
    presenciaPushed: presencia.pushed,
    trabajosPushed: trabajos.pushed,
    mediaPushed: media.pushed,
    errors: errors + presencia.errors + trabajos.errors + media.errors,
  }
}

/** Solo maestros (arranque / botón sync ligero). */
export async function syncMasters(): Promise<number> {
  return pullMasters()
}
