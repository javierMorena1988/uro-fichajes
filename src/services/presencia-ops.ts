import {
  addPresencia,
  getDispositivoId,
  getPresenciaAbierta,
  getTrabajoAbierto,
  getUltimoTrabajoCerrado,
  markPresenciaPending,
  markTrabajoError,
  saveTrabajoCompleto,
  updatePresencia,
  updateTrabajoCabecera,
} from '../db/indexeddb'
import type { Operario } from '../types/maestro'
import type { Presencia } from '../types/presencia'
import type { TrabajoCabecera, TrabajoCompleto, TrabajoDetalle } from '../types/trabajo'
import { minutosEntre, newId } from '../utils/ids'

export async function registrarEntrada(operario: Operario): Promise<Presencia> {
  const abierta = await getPresenciaAbierta(operario.codOperario)
  if (abierta) throw new Error('Ya hay una entrada abierta.')

  const ahora = new Date().toISOString()
  const item: Presencia = {
    id: newId('p'),
    codDelegacion: operario.codDelegacion,
    codOperario: operario.codOperario,
    fechaHoraEntrada: ahora,
    dispositivoId: await getDispositivoId(),
    syncStatus: 'pending',
  }
  await addPresencia(item)
  return item
}

export async function registrarSalida(operario: Operario): Promise<{
  presencia: Presencia
  trabajoCerrado?: TrabajoCompleto
}> {
  const abierta = await getPresenciaAbierta(operario.codOperario)
  if (!abierta) throw new Error('No hay entrada pendiente de salida.')

  const ahora = new Date().toISOString()
  const cerrada: Presencia = {
    ...abierta,
    fechaHoraSalida: ahora,
    totalMinutos: minutosEntre(abierta.fechaHoraEntrada, ahora),
    syncStatus: 'pending',
    syncError: undefined,
  }
  await updatePresencia(cerrada)

  const trabajo = await getTrabajoAbierto(operario.codOperario)
  let trabajoCerrado: TrabajoCompleto | undefined
  if (trabajo) {
    trabajoCerrado = await finalizarTrabajo(trabajo)
  }

  return { presencia: cerrada, trabajoCerrado }
}

export async function iniciarTrabajo(
  operario: Operario,
  codigosOrden: number[],
): Promise<TrabajoCompleto> {
  if (codigosOrden.length === 0) throw new Error('Selecciona al menos una orden.')

  const abierto = await getTrabajoAbierto(operario.codOperario)
  if (abierto) {
    await finalizarTrabajo(abierto)
  }

  const ahora = new Date().toISOString()
  const id = newId('t')
  const cabecera: TrabajoCabecera = {
    id,
    codDelegacion: operario.codDelegacion,
    codOperario: operario.codOperario,
    fechaHoraInicio: ahora,
    dispositivoId: await getDispositivoId(),
    syncStatus: 'pending',
  }
  const detalles: TrabajoDetalle[] = codigosOrden.map((codigoOrden) => ({
    id: newId('td'),
    idCabecera: id,
    codigoOrden,
  }))
  const completo = { cabecera, detalles }
  await saveTrabajoCompleto(completo)
  return completo
}

export async function finalizarTrabajo(trabajo: TrabajoCompleto): Promise<TrabajoCompleto> {
  if (trabajo.cabecera.fechaHoraFin) return trabajo
  const ahora = new Date().toISOString()
  const cabecera: TrabajoCabecera = {
    ...trabajo.cabecera,
    fechaHoraFin: ahora,
    totalMinutos: minutosEntre(trabajo.cabecera.fechaHoraInicio, ahora),
    syncStatus: 'pending',
    syncError: undefined,
  }
  await updateTrabajoCabecera(cabecera)
  return { cabecera, detalles: trabajo.detalles }
}

export async function retomarUltimoTrabajo(operario: Operario): Promise<TrabajoCompleto | null> {
  const ultimo = await getUltimoTrabajoCerrado(operario.codOperario)
  if (!ultimo || ultimo.detalles.length === 0) return null
  return iniciarTrabajo(
    operario,
    ultimo.detalles.map((d) => d.codigoOrden),
  )
}

/** Tras editar presencia abierta (solo entrada) hay que reencolar si estaba synced. */
export async function touchPresenciaPending(id: string): Promise<void> {
  await markPresenciaPending(id)
}

export async function markTrabajoFail(id: string, msg: string): Promise<void> {
  await markTrabajoError(id, msg)
}
