import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Fichaje } from '../types/fichaje'
import type { Operario, OrdenReparacion } from '../types/maestro'
import type { MediaItem } from '../types/media'
import type { Presencia } from '../types/presencia'
import type { TrabajoCabecera, TrabajoCompleto, TrabajoDetalle } from '../types/trabajo'
import { normalizeTarjeta } from '../utils/ids'

type MediaStored = MediaItem & { empleadoDia: string }

interface UrovesaDB extends DBSchema {
  fichajes: {
    key: string
    value: Fichaje
    indexes: {
      'by-sync': string
      'by-fecha': string
    }
  }
  medias: {
    key: string
    value: MediaStored
    indexes: {
      'by-sync': string
      'by-empleado-dia': string
      'by-fecha': string
    }
  }
  meta: {
    key: string
    value: string
  }
  operarios: {
    key: number
    value: Operario
    indexes: {
      'by-tarjeta': string
    }
  }
  ordenesReparacion: {
    key: number
    value: OrdenReparacion
  }
  presencia: {
    key: string
    value: Presencia
    indexes: {
      'by-sync': string
      'by-operario': number
    }
  }
  trabajosCabecera: {
    key: string
    value: TrabajoCabecera
    indexes: {
      'by-sync': string
      'by-operario': number
    }
  }
  trabajosDetalle: {
    key: string
    value: TrabajoDetalle
    indexes: {
      'by-cabecera': string
    }
  }
}

const DB_NAME = 'urovesa-fichaje'
const DB_VERSION = 3

let dbPromise: Promise<IDBPDatabase<UrovesaDB>> | null = null

function empleadoDiaKey(numeroEmpleado: string, dia: string) {
  return `${numeroEmpleado}::${dia}`
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<UrovesaDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('fichajes', { keyPath: 'id' })
          store.createIndex('by-sync', 'syncStatus')
          store.createIndex('by-fecha', 'registradoEn')
          db.createObjectStore('meta')
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains('medias')) {
          const medias = db.createObjectStore('medias', { keyPath: 'id' })
          medias.createIndex('by-sync', 'syncStatus')
          medias.createIndex('by-fecha', 'capturadoEn')
          medias.createIndex('by-empleado-dia', 'empleadoDia')
        }
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('operarios')) {
            const ops = db.createObjectStore('operarios', { keyPath: 'codOperario' })
            ops.createIndex('by-tarjeta', 'codTarjetaPresencia', { unique: true })
          }
          if (!db.objectStoreNames.contains('ordenesReparacion')) {
            db.createObjectStore('ordenesReparacion', { keyPath: 'codigoOrden' })
          }
          if (!db.objectStoreNames.contains('presencia')) {
            const p = db.createObjectStore('presencia', { keyPath: 'id' })
            p.createIndex('by-sync', 'syncStatus')
            p.createIndex('by-operario', 'codOperario')
          }
          if (!db.objectStoreNames.contains('trabajosCabecera')) {
            const t = db.createObjectStore('trabajosCabecera', { keyPath: 'id' })
            t.createIndex('by-sync', 'syncStatus')
            t.createIndex('by-operario', 'codOperario')
          }
          if (!db.objectStoreNames.contains('trabajosDetalle')) {
            const d = db.createObjectStore('trabajosDetalle', { keyPath: 'id' })
            d.createIndex('by-cabecera', 'idCabecera')
          }
        }
      },
    })
  }
  return dbPromise
}

function toStored(item: MediaItem): MediaStored {
  return {
    ...item,
    empleadoDia: empleadoDiaKey(item.numeroEmpleado, item.dia),
  }
}

function fromStored(item: MediaStored): MediaItem {
  const { empleadoDia: _empleadoDia, ...rest } = item
  return rest
}

export async function getDispositivoId(): Promise<string> {
  const db = await getDb()
  const existing = await db.get('meta', 'dispositivoId')
  if (existing) return existing

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  await db.put('meta', id, 'dispositivoId')
  return id
}

/* ---------- Maestros ---------- */

export async function replaceOperarios(items: Operario[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('operarios', 'readwrite')
  await tx.store.clear()
  for (const item of items) {
    await tx.store.put({
      ...item,
      codTarjetaPresencia: normalizeTarjeta(item.codTarjetaPresencia),
    })
  }
  await tx.done
}

export async function replaceOrdenesReparacion(items: OrdenReparacion[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('ordenesReparacion', 'readwrite')
  await tx.store.clear()
  for (const item of items) {
    await tx.store.put(item)
  }
  await tx.done
}

export async function countOperarios(): Promise<number> {
  const db = await getDb()
  return db.count('operarios')
}

export async function findOperarioByTarjeta(tarjeta: string): Promise<Operario | undefined> {
  const db = await getDb()
  const code = normalizeTarjeta(tarjeta)
  if (!code) return undefined
  return db.getFromIndex('operarios', 'by-tarjeta', code)
}

export async function listOrdenesReparacion(): Promise<OrdenReparacion[]> {
  const db = await getDb()
  const all = await db.getAll('ordenesReparacion')
  return all.sort((a, b) => a.codigoOrden - b.codigoOrden)
}

export async function getOrdenesByCodigos(codigos: number[]): Promise<OrdenReparacion[]> {
  const db = await getDb()
  const out: OrdenReparacion[] = []
  for (const c of codigos) {
    const row = await db.get('ordenesReparacion', c)
    if (row) out.push(row)
  }
  return out
}

/* ---------- Presencia ---------- */

export async function addPresencia(item: Presencia): Promise<void> {
  const db = await getDb()
  await db.put('presencia', item)
}

export async function updatePresencia(item: Presencia): Promise<void> {
  const db = await getDb()
  await db.put('presencia', item)
}

export async function getPresenciaAbierta(codOperario: number): Promise<Presencia | undefined> {
  const db = await getDb()
  const rows = await db.getAllFromIndex('presencia', 'by-operario', codOperario)
  return rows.find((p) => !p.fechaHoraSalida)
}

export async function listPendingPresencias(): Promise<Presencia[]> {
  const db = await getDb()
  const pending = await db.getAllFromIndex('presencia', 'by-sync', 'pending')
  const errors = await db.getAllFromIndex('presencia', 'by-sync', 'error')
  return [...pending, ...errors]
}

export async function markPresenciaSynced(id: string): Promise<void> {
  const db = await getDb()
  const item = await db.get('presencia', id)
  if (!item) return
  await db.put('presencia', { ...item, syncStatus: 'synced', syncError: undefined })
}

export async function markPresenciaError(id: string, message: string): Promise<void> {
  const db = await getDb()
  const item = await db.get('presencia', id)
  if (!item) return
  await db.put('presencia', { ...item, syncStatus: 'error', syncError: message })
}

export async function markPresenciaPending(id: string): Promise<void> {
  const db = await getDb()
  const item = await db.get('presencia', id)
  if (!item) return
  await db.put('presencia', { ...item, syncStatus: 'pending', syncError: undefined })
}

export async function countPendingPresencias(): Promise<number> {
  return (await listPendingPresencias()).length
}

/* ---------- Trabajos ---------- */

export async function saveTrabajoCompleto(trabajo: TrabajoCompleto): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['trabajosCabecera', 'trabajosDetalle'], 'readwrite')
  await tx.objectStore('trabajosCabecera').put(trabajo.cabecera)
  const existing = await tx.objectStore('trabajosDetalle').index('by-cabecera').getAll(trabajo.cabecera.id)
  for (const row of existing) {
    await tx.objectStore('trabajosDetalle').delete(row.id)
  }
  for (const d of trabajo.detalles) {
    await tx.objectStore('trabajosDetalle').put(d)
  }
  await tx.done
}

export async function updateTrabajoCabecera(cab: TrabajoCabecera): Promise<void> {
  const db = await getDb()
  await db.put('trabajosCabecera', cab)
}

export async function getTrabajoAbierto(codOperario: number): Promise<TrabajoCompleto | undefined> {
  const db = await getDb()
  const rows = await db.getAllFromIndex('trabajosCabecera', 'by-operario', codOperario)
  const abierta = rows.find((t) => !t.fechaHoraFin)
  if (!abierta) return undefined
  const detalles = await db.getAllFromIndex('trabajosDetalle', 'by-cabecera', abierta.id)
  return { cabecera: abierta, detalles }
}

export async function getUltimoTrabajoCerrado(
  codOperario: number,
): Promise<TrabajoCompleto | undefined> {
  const db = await getDb()
  const rows = await db.getAllFromIndex('trabajosCabecera', 'by-operario', codOperario)
  const cerrados = rows
    .filter((t) => !!t.fechaHoraFin)
    .sort((a, b) => String(b.fechaHoraFin).localeCompare(String(a.fechaHoraFin)))
  const last = cerrados[0]
  if (!last) return undefined
  const detalles = await db.getAllFromIndex('trabajosDetalle', 'by-cabecera', last.id)
  return { cabecera: last, detalles }
}

export async function getTrabajoById(id: string): Promise<TrabajoCompleto | undefined> {
  const db = await getDb()
  const cab = await db.get('trabajosCabecera', id)
  if (!cab) return undefined
  const detalles = await db.getAllFromIndex('trabajosDetalle', 'by-cabecera', id)
  return { cabecera: cab, detalles }
}

export async function listPendingTrabajos(): Promise<TrabajoCompleto[]> {
  const db = await getDb()
  const pending = await db.getAllFromIndex('trabajosCabecera', 'by-sync', 'pending')
  const errors = await db.getAllFromIndex('trabajosCabecera', 'by-sync', 'error')
  const cabs = [...pending, ...errors]
  const out: TrabajoCompleto[] = []
  for (const cab of cabs) {
    const detalles = await db.getAllFromIndex('trabajosDetalle', 'by-cabecera', cab.id)
    out.push({ cabecera: cab, detalles })
  }
  return out
}

export async function markTrabajoSynced(id: string): Promise<void> {
  const db = await getDb()
  const item = await db.get('trabajosCabecera', id)
  if (!item) return
  await db.put('trabajosCabecera', { ...item, syncStatus: 'synced', syncError: undefined })
}

export async function markTrabajoError(id: string, message: string): Promise<void> {
  const db = await getDb()
  const item = await db.get('trabajosCabecera', id)
  if (!item) return
  await db.put('trabajosCabecera', { ...item, syncStatus: 'error', syncError: message })
}

export async function countPendingTrabajos(): Promise<number> {
  return (await listPendingTrabajos()).length
}

/* ---------- Fichajes legacy (sync antiguo) ---------- */

export async function addFichaje(fichaje: Fichaje): Promise<void> {
  const db = await getDb()
  await db.put('fichajes', fichaje)
}

export async function listFichajes(): Promise<Fichaje[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('fichajes', 'by-fecha')
  return all.reverse()
}

export async function listPendingFichajes(): Promise<Fichaje[]> {
  const db = await getDb()
  return db.getAllFromIndex('fichajes', 'by-sync', 'pending')
}

export async function markFichajeSynced(id: string): Promise<void> {
  const db = await getDb()
  const item = await db.get('fichajes', id)
  if (!item) return
  await db.put('fichajes', {
    ...item,
    syncStatus: 'synced',
    syncError: undefined,
  })
}

export async function markFichajeError(id: string, message: string): Promise<void> {
  const db = await getDb()
  const item = await db.get('fichajes', id)
  if (!item) return
  await db.put('fichajes', {
    ...item,
    syncStatus: 'error',
    syncError: message,
  })
}

export async function upsertFichajesFromServer(items: Fichaje[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('fichajes', 'readwrite')
  for (const item of items) {
    const existing = await tx.store.get(item.id)
    if (existing?.syncStatus === 'pending' || existing?.syncStatus === 'error') {
      continue
    }
    await tx.store.put({ ...item, syncStatus: 'synced' })
  }
  await tx.done
}

/* ---------- Medias ---------- */

export async function addMedia(item: MediaItem): Promise<void> {
  const db = await getDb()
  await db.put('medias', toStored(item))
}

export async function listMediasByTrabajo(trabajoId: string): Promise<MediaItem[]> {
  const db = await getDb()
  const rows = await db.getAll('medias')
  return rows
    .map((r) => fromStored(r))
    .filter((m) => m.trabajoId === trabajoId)
    .sort((a, b) => b.capturadoEn.localeCompare(a.capturadoEn))
}

export async function listMediasByEmpleadoDia(
  numeroEmpleado: string,
  dia: string,
): Promise<MediaItem[]> {
  const db = await getDb()
  const rows = await db.getAllFromIndex(
    'medias',
    'by-empleado-dia',
    empleadoDiaKey(numeroEmpleado, dia),
  )
  return rows
    .map((r) => fromStored(r))
    .sort((a, b) => b.capturadoEn.localeCompare(a.capturadoEn))
}

export async function listMediasByEmpleado(numeroEmpleado: string): Promise<MediaItem[]> {
  const db = await getDb()
  const rows = await db.getAll('medias')
  return rows
    .map((r) => fromStored(r))
    .filter((m) => m.numeroEmpleado === numeroEmpleado)
    .sort((a, b) => b.capturadoEn.localeCompare(a.capturadoEn))
}

export async function listPendingMedias(): Promise<MediaItem[]> {
  const db = await getDb()
  const pending = await db.getAllFromIndex('medias', 'by-sync', 'pending')
  const errors = await db.getAllFromIndex('medias', 'by-sync', 'error')
  return [...pending, ...errors].map((r) => fromStored(r))
}

export async function countPendingMedias(): Promise<number> {
  const items = await listPendingMedias()
  return items.length
}

export async function markMediaSynced(id: string, remoteUrl: string): Promise<void> {
  const db = await getDb()
  const item = await db.get('medias', id)
  if (!item) return
  await db.put(
    'medias',
    toStored({
      ...fromStored(item),
      syncStatus: 'synced',
      syncError: undefined,
      remoteUrl,
    }),
  )
}

export async function markMediaError(id: string, message: string): Promise<void> {
  const db = await getDb()
  const item = await db.get('medias', id)
  if (!item) return
  await db.put(
    'medias',
    toStored({
      ...fromStored(item),
      syncStatus: 'error',
      syncError: message,
    }),
  )
}

export async function markMediaPending(id: string): Promise<void> {
  const db = await getDb()
  const item = await db.get('medias', id)
  if (!item) return
  const media = fromStored(item)
  if (!media.blob) return
  await db.put(
    'medias',
    toStored({
      ...media,
      syncStatus: 'pending',
      syncError: undefined,
      remoteUrl: undefined,
    }),
  )
}

export async function getMedia(id: string): Promise<MediaItem | undefined> {
  const db = await getDb()
  const item = await db.get('medias', id)
  return item ? fromStored(item) : undefined
}

export async function countAllPendientes(): Promise<number> {
  const [p, t, m] = await Promise.all([
    countPendingPresencias(),
    countPendingTrabajos(),
    countPendingMedias(),
  ])
  return p + t + m
}
