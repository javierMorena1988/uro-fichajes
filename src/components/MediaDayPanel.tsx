import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addMedia,
  getDispositivoId,
  listMediasByEmpleado,
  markMediaPending,
} from '../db/indexeddb'
import { fetchRemoteMedias } from '../services/media-sync'
import type { MediaItem, TipoMedia } from '../types/media'
import { diaLocal, formatDiaEs } from '../utils/dates'

interface Props {
  numeroEmpleado: string
  online: boolean
  refreshKey?: number
  onSaved?: () => void
  onRequestSync?: () => void
}

const MEDIA_MAX_SECONDS = 60

type RecordingKind = 'audio' | 'video' | null

function newId(prefix: string) {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function pickAudioMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return 'audio/webm'
}

function pickVideoMime(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return 'video/webm'
}

function audioExt(mime: string): string {
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'weba'
}

function videoExt(mime: string): string {
  if (mime.includes('mp4') || mime.includes('quicktime')) return 'mp4'
  if (mime.includes('webm')) return 'webm'
  return 'mp4'
}

function labelTipo(tipo: TipoMedia): string {
  if (tipo === 'foto') return 'Foto'
  if (tipo === 'audio') return 'Audio'
  return 'Vídeo'
}

function syncLabel(status: MediaItem['syncStatus']) {
  if (status === 'pending') return 'Pendiente'
  if (status === 'synced') return 'Sincronizado'
  return 'Error'
}

function previewUrl(item: MediaItem, previews: Record<string, string>) {
  return previews[item.id] || item.remoteUrl || ''
}

function formatCountdown(seconds: number) {
  const s = Math.max(0, seconds)
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function MediaDayPanel({
  numeroEmpleado,
  online,
  refreshKey = 0,
  onSaved,
  onRequestSync,
}: Props) {
  const photoInputRef = useRef<HTMLInputElement>(null)
  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const recordingKindRef = useRef<RecordingKind>(null)
  const autoStopRef = useRef<number | null>(null)

  /** Día que se asigna al grabar (metadato). La lista muestra todos los del operario. */
  const diaCaptura = diaLocal()
  const [filtroDia, setFiltroDia] = useState<string>('todos')
  const [items, setItems] = useState<MediaItem[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [recordingKind, setRecordingKind] = useState<RecordingKind>(null)
  const [timeLeft, setTimeLeft] = useState(MEDIA_MAX_SECONDS)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [serverNote, setServerNote] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const visibles = useMemo(
    () => (filtroDia === 'todos' ? items : items.filter((m) => m.dia === filtroDia)),
    [items, filtroDia],
  )
  const fotos = useMemo(() => visibles.filter((m) => m.tipo === 'foto'), [visibles])
  const audios = useMemo(() => visibles.filter((m) => m.tipo === 'audio'), [visibles])
  const videos = useMemo(() => visibles.filter((m) => m.tipo === 'video'), [visibles])
  const diasDisponibles = useMemo(() => {
    const set = new Set(items.map((m) => m.dia))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [items])

  async function refresh() {
    const local = await listMediasByEmpleado(numeroEmpleado)
    const byId = new Map<string, MediaItem>()

    for (const item of local) {
      byId.set(item.id, item)
    }

    // Siempre intentamos el servidor (PC y móvil). Si falla, nos quedamos con lo local.
    try {
      const remote = await fetchRemoteMedias({ numeroEmpleado })
      const remoteIds = new Set(remote.map((r) => r.id))
      for (const r of remote) {
        const existing = byId.get(r.id)
        if (existing) {
          byId.set(r.id, {
            ...existing,
            remoteUrl: r.url,
            syncStatus: existing.syncStatus === 'pending' ? existing.syncStatus : 'synced',
          })
        } else {
          byId.set(r.id, {
            id: r.id,
            tipo: r.tipo,
            numeroEmpleado: r.numeroEmpleado,
            dia: r.dia,
            capturadoEn: r.capturadoEn,
            creadoEn: r.creadoEn,
            dispositivoId: r.dispositivoId,
            mimeType: r.mimeType,
            fileName: r.fileName,
            remoteUrl: r.url,
            syncStatus: 'synced',
          })
        }
      }
      // Si el móvil aún tiene el blob y el servidor ya no (p.ej. archivo corrupto borrado), reencolar.
      for (const item of local) {
        if (item.blob && item.syncStatus === 'synced' && !remoteIds.has(item.id)) {
          await markMediaPending(item.id)
          byId.set(item.id, { ...item, syncStatus: 'pending', remoteUrl: undefined })
        }
      }
      setServerNote(
        remote.length > 0
          ? `Servidor: ${remote.length} archivo(s) de este operario.`
          : 'Servidor: aún no hay archivos de este operario.',
      )
    } catch {
      setServerNote(
        'No se pudo leer el servidor. Revisa que el PC tenga la app en marcha y la misma WiFi/IP.',
      )
    }

    const merged = [...byId.values()].sort((a, b) =>
      b.capturadoEn.localeCompare(a.capturadoEn),
    )
    setItems(merged)

    const urls: Record<string, string> = {}
    for (const item of merged) {
      if (item.blob) urls[item.id] = URL.createObjectURL(item.blob)
    }
    setPreviews((prev) => {
      for (const url of Object.values(prev)) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      }
      return urls
    })
  }

  useEffect(() => {
    void refresh()
  }, [numeroEmpleado, refreshKey, online])

  useEffect(() => {
    return () => {
      clearAutoStop()
      stopTracks()
      setPreviews((prev) => {
        for (const url of Object.values(prev)) {
          if (url.startsWith('blob:')) URL.revokeObjectURL(url)
        }
        return {}
      })
    }
  }, [])

  useEffect(() => {
    if (!recordingKind) {
      setTimeLeft(MEDIA_MAX_SECONDS)
      return
    }
    const started = Date.now()
    const timer = window.setInterval(() => {
      const secs = Math.floor((Date.now() - started) / 1000)
      setTimeLeft(Math.max(0, MEDIA_MAX_SECONDS - secs))
    }, 200)
    return () => window.clearInterval(timer)
  }, [recordingKind])

  // El <video> de preview solo existe cuando recordingKind === 'video'.
  // Hay que enganchar el stream DESPUÉS de montarlo (si no, no se ve nada).
  useEffect(() => {
    if (recordingKind !== 'video') return
    const el = liveVideoRef.current
    const stream = streamRef.current
    if (!el || !stream) return

    el.srcObject = stream
    el.muted = true
    el.setAttribute('playsinline', 'true')
    el.setAttribute('webkit-playsinline', 'true')
    void el.play().catch(() => undefined)

    return () => {
      el.srcObject = null
    }
  }, [recordingKind])

  function clearAutoStop() {
    if (autoStopRef.current != null) {
      window.clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
  }

  function armAutoStop() {
    clearAutoStop()
    setTimeLeft(MEDIA_MAX_SECONDS)
    autoStopRef.current = window.setTimeout(() => {
      stopCurrentRecording()
    }, MEDIA_MAX_SECONDS * 1000)
  }

  function stopTracks() {
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function saveMedia(partial: Omit<MediaItem, 'dispositivoId' | 'syncStatus'>) {
    const item: MediaItem = {
      ...partial,
      dispositivoId: await getDispositivoId(),
      syncStatus: 'pending',
    }
    await addMedia(item)
    await refresh()
    const name = labelTipo(partial.tipo)
    setMessage(
      online ? `${name} guardado. Sincronizando…` : `${name} guardado offline.`,
    )
    onSaved?.()
    if (online) onRequestSync?.()
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      if (!file.type.startsWith('image/')) throw new Error('Solo se admiten fotos.')
      const ahora = new Date().toISOString()
      const id = newId('f')
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      await saveMedia({
        id,
        tipo: 'foto',
        numeroEmpleado,
        dia: diaCaptura,
        capturadoEn: ahora,
        creadoEn: ahora,
        mimeType: file.type || 'image/jpeg',
        fileName: `${numeroEmpleado}_${diaCaptura}_${id.slice(0, 8)}.${ext}`,
        blob: file,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la foto')
    } finally {
      setBusy(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  async function startAudioRecording() {
    setError(null)
    setMessage(null)
    if (recordingKind) return
    if (typeof MediaRecorder === 'undefined') {
      setError('Este navegador no permite grabar audio.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickAudioMime()
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recordingKindRef.current = 'audio'

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      recorder.onerror = () => {
        clearAutoStop()
        setError('Error durante la grabación de audio')
        setRecordingKind(null)
        recordingKindRef.current = null
        stopTracks()
      }
      recorder.onstop = () => {
        clearAutoStop()
        void finalizeAudio(mimeType)
      }

      recorderRef.current = recorder
      recorder.start(250)
      setRecordingKind('audio')
      armAutoStop()
    } catch {
      setError('No se pudo acceder al micrófono.')
      recordingKindRef.current = null
      stopTracks()
    }
  }

  async function startVideoRecording() {
    setError(null)
    setMessage(null)
    if (recordingKind) return
    if (typeof MediaRecorder === 'undefined') {
      setError('Este navegador no permite grabar vídeo.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream

      const mimeType = pickVideoMime()
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recordingKindRef.current = 'video'

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      recorder.onerror = () => {
        clearAutoStop()
        setError('Error durante la grabación de vídeo')
        setRecordingKind(null)
        recordingKindRef.current = null
        stopTracks()
      }
      recorder.onstop = () => {
        clearAutoStop()
        void finalizeVideo(mimeType)
      }

      recorderRef.current = recorder
      recorder.start(250)
      // Primero montamos el <video>; el useEffect engancha el stream al preview
      setRecordingKind('video')
      armAutoStop()
    } catch {
      setError('No se pudo acceder a la cámara/micrófono.')
      recordingKindRef.current = null
      stopTracks()
    }
  }

  function stopCurrentRecording() {
    clearAutoStop()
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      setRecordingKind(null)
      recordingKindRef.current = null
      stopTracks()
      return
    }
    recorder.stop()
    setRecordingKind(null)
  }

  async function finalizeAudio(mimeType: string) {
    setBusy(true)
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      chunksRef.current = []
      stopTracks()
      setTimeLeft(MEDIA_MAX_SECONDS)
      if (blob.size < 100) throw new Error('La grabación de audio quedó vacía.')

      const ahora = new Date().toISOString()
      const id = newId('a')
      const ext = audioExt(mimeType)
      await saveMedia({
        id,
        tipo: 'audio',
        numeroEmpleado,
        dia: diaCaptura,
        capturadoEn: ahora,
        creadoEn: ahora,
        mimeType: blob.type || mimeType,
        fileName: `${numeroEmpleado}_${diaCaptura}_${id.slice(0, 8)}.${ext}`,
        blob,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el audio')
    } finally {
      setBusy(false)
      recorderRef.current = null
      recordingKindRef.current = null
    }
  }

  async function finalizeVideo(mimeType: string) {
    setBusy(true)
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      chunksRef.current = []
      stopTracks()
      setTimeLeft(MEDIA_MAX_SECONDS)
      if (blob.size < 500) throw new Error('La grabación de vídeo quedó vacía.')

      const ahora = new Date().toISOString()
      const id = newId('v')
      const ext = videoExt(mimeType)
      await saveMedia({
        id,
        tipo: 'video',
        numeroEmpleado,
        dia: diaCaptura,
        capturadoEn: ahora,
        creadoEn: ahora,
        mimeType: blob.type || mimeType,
        fileName: `${numeroEmpleado}_${diaCaptura}_${id.slice(0, 8)}.${ext}`,
        blob,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el vídeo')
    } finally {
      setBusy(false)
      recorderRef.current = null
      recordingKindRef.current = null
    }
  }

  const locked = busy || recordingKind !== null

  function renderSync(item: MediaItem) {
    return <span className={`sync ${item.syncStatus}`}>{syncLabel(item.syncStatus)}</span>
  }

  return (
    <section className="card media-card">
      <div className="list-head">
        <h2>Archivos del operario</h2>
        <p>
          Operario <strong>#{numeroEmpleado}</strong> · cada archivo guarda su día
        </p>
      </div>

      <label className="field" style={{ marginBottom: '0.65rem' }}>
        <span>Ver por día</span>
        <select value={filtroDia} onChange={(e) => setFiltroDia(e.target.value)}>
          <option value="todos">Todos</option>
          {diasDisponibles.map((d) => (
            <option key={d} value={d}>
              {formatDiaEs(d)}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="btn ghost"
        style={{ width: '100%', marginBottom: '0.65rem' }}
        disabled={refreshing}
        onClick={() => {
          setRefreshing(true)
          void refresh().finally(() => setRefreshing(false))
        }}
      >
        {refreshing ? 'Actualizando…' : 'Actualizar desde servidor'}
      </button>
      {serverNote ? <p className="muted media-hint">{serverNote}</p> : null}

      {message ? <p className="msg ok">{message}</p> : null}
      {error ? <p className="msg err">{error}</p> : null}

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => void onPhoto(e.target.files?.[0])}
      />

      <div className="media-block">
        <h3>Fotos</h3>
        <button
          type="button"
          className="btn foto-btn"
          disabled={locked}
          onClick={() => photoInputRef.current?.click()}
        >
          Sacar foto
        </button>
        {fotos.length === 0 ? (
          <p className="empty">Sin fotos.</p>
        ) : (
          <ul className="photo-grid">
            {fotos.map((item) => {
              const src = previewUrl(item, previews)
              return (
                <li key={item.id} className="photo-item">
                  {src ? (
                    <img src={src} alt={item.fileName} />
                  ) : (
                    <div className="photo-placeholder">Sin vista</div>
                  )}
                  <div className="photo-meta">
                    <span>
                      {item.dia} · {new Date(item.capturadoEn).toLocaleTimeString('es-ES')}
                    </span>
                    {renderSync(item)}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="media-block">
        <h3>Audios</h3>
        <p className="muted media-hint">Máximo 1 minuto · cuenta atrás al grabar</p>
        {recordingKind === 'audio' ? (
          <div className="audio-live">
            <div className={`video-countdown ${timeLeft <= 10 ? 'urgent' : ''}`}>
              Quedan <strong>{formatCountdown(timeLeft)}</strong>
            </div>
            <button
              type="button"
              className="btn audio-btn recording"
              disabled={busy}
              onClick={stopCurrentRecording}
            >
              Detener audio
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn audio-btn"
            disabled={locked}
            onClick={() => void startAudioRecording()}
          >
            Grabar audio (1 min)
          </button>
        )}
        {audios.length === 0 ? (
          <p className="empty">Sin audios.</p>
        ) : (
          <ul className="audio-list">
            {audios.map((item) => {
              const src = previewUrl(item, previews)
              return (
                <li key={item.id} className="audio-item">
                  {src ? (
                    <audio controls preload="metadata" src={src} />
                  ) : (
                    <p className="muted">Sin reproducción</p>
                  )}
                  <div className="photo-meta">
                    <span>
                      {item.dia} · {new Date(item.capturadoEn).toLocaleTimeString('es-ES')}
                    </span>
                    {renderSync(item)}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="media-block">
        <h3>Vídeos</h3>
        <p className="muted media-hint">Máximo 1 minuto · cuenta atrás al grabar</p>

        {recordingKind === 'video' ? (
          <div className="video-live">
            <video
              ref={liveVideoRef}
              className="video-live-preview"
              muted
              playsInline
              autoPlay
              controls={false}
            />
            <div className={`video-countdown ${timeLeft <= 10 ? 'urgent' : ''}`}>
              Quedan <strong>{formatCountdown(timeLeft)}</strong>
            </div>
            <button
              type="button"
              className="btn video-btn recording"
              disabled={busy}
              onClick={stopCurrentRecording}
            >
              Detener vídeo
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn video-btn"
            disabled={locked}
            onClick={() => void startVideoRecording()}
          >
            Grabar vídeo (1 min)
          </button>
        )}

        {videos.length === 0 ? (
          <p className="empty">Sin vídeos.</p>
        ) : (
          <ul className="video-list">
            {videos.map((item) => {
              const src = previewUrl(item, previews)
              return (
                <li key={item.id} className="video-item">
                  {src ? (
                    <video controls preload="metadata" src={src} playsInline />
                  ) : (
                    <div className="photo-placeholder">Sin vista</div>
                  )}
                  <div className="photo-meta">
                    <span>
                      {item.dia} · {new Date(item.capturadoEn).toLocaleTimeString('es-ES')}
                    </span>
                    {renderSync(item)}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
