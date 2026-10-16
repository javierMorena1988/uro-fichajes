import {
  getMedia,
  listPendingMedias,
  markMediaError,
  markMediaSynced,
} from '../db/indexeddb'
import type { MediaRemoteMeta } from '../types/media'

export interface MediaSyncResult {
  pushed: number
  errors: number
}

async function blobToBase64(blob: Blob): Promise<string> {
  // FileReader evita problemas de memoria con audios/vídeos más grandes.
  // OJO: no usar split(',') porque MIME con codecs (p.ej. video/webm;codecs=vp9,opus)
  // mete comas en el prefijo data:... y corrompe el base64.
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = String(reader.result || '')
      const marker = 'base64,'
      const idx = result.indexOf(marker)
      const base64 = idx >= 0 ? result.slice(idx + marker.length) : result
      if (!base64) {
        reject(new Error('No se pudo codificar el archivo'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error || new Error('Error leyendo el archivo'))
    reader.readAsDataURL(blob)
  })
}

export async function pushPendingMedias(): Promise<MediaSyncResult> {
  const pending = await listPendingMedias()
  let pushed = 0
  let errors = 0

  for (const meta of pending) {
    const full = await getMedia(meta.id)
    if (!full?.blob) {
      await markMediaError(meta.id, 'Falta el archivo local')
      errors += 1
      continue
    }

    try {
      const dataBase64 = await blobToBase64(full.blob)
      const res = await fetch('/api/medias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: full.id,
          tipo: full.tipo,
          numeroEmpleado: full.numeroEmpleado,
          dia: full.dia,
          trabajoId: full.trabajoId,
          capturadoEn: full.capturadoEn,
          creadoEn: full.creadoEn,
          dispositivoId: full.dispositivoId,
          mimeType: full.mimeType,
          fileName: full.fileName,
          dataBase64,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }

      const saved = (await res.json()) as MediaRemoteMeta
      await markMediaSynced(full.id, saved.url)
      pushed += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de sync media'
      await markMediaError(meta.id, message)
      errors += 1
    }
  }

  return { pushed, errors }
}

export async function fetchRemoteMedias(params?: {
  numeroEmpleado?: string
  dia?: string
}): Promise<MediaRemoteMeta[]> {
  const qs = new URLSearchParams()
  if (params?.numeroEmpleado) qs.set('numeroEmpleado', params.numeroEmpleado)
  if (params?.dia) qs.set('dia', params.dia)
  const suffix = qs.toString() ? `?${qs}` : ''
  const res = await fetch(`/api/medias${suffix}`)
  if (!res.ok) throw new Error(`No se pudieron listar medias (HTTP ${res.status})`)
  return (await res.json()) as MediaRemoteMeta[]
}
