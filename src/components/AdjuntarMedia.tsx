import { useEffect, useRef, useState } from 'react'
import { addMedia, getDispositivoId, listMediasByTrabajo } from '../db/indexeddb'
import type { MediaItem, TipoMedia } from '../types/media'
import { diaLocal } from '../utils/dates'
import { newId } from '../utils/ids'

interface Props {
  trabajoId: string
  codOperario: number
  online: boolean
  onSaved?: () => void
  onRequestSync?: () => void
  onClose?: () => void
}

const MEDIA_MAX_SECONDS = 60

type RecordingKind = 'audio' | 'video' | null

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

function formatCountdown(seconds: number) {
  const s = Math.max(0, seconds)
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function AdjuntarMedia({
  trabajoId,
  codOperario,
  online,
  onSaved,
  onRequestSync,
  onClose,
}: Props) {
  const photoInputRef = useRef<HTMLInputElement>(null)
  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const autoStopRef = useRef<number | null>(null)

  const [mode, setMode] = useState<'menu' | TipoMedia>('menu')
  const [recordingKind, setRecordingKind] = useState<RecordingKind>(null)
  const [timeLeft, setTimeLeft] = useState(MEDIA_MAX_SECONDS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [adjuntos, setAdjuntos] = useState<MediaItem[]>([])

  const numeroEmpleado = String(codOperario)
  const diaCaptura = diaLocal()

  async function refreshAdjuntos() {
    setAdjuntos(await listMediasByTrabajo(trabajoId))
  }

  useEffect(() => {
    void refreshAdjuntos()
  }, [trabajoId])

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

  useEffect(() => {
    if (recordingKind !== 'video') return
    const el = liveVideoRef.current
    const stream = streamRef.current
    if (!el || !stream) return
    el.srcObject = stream
    el.muted = true
    void el.play().catch(() => undefined)
    return () => {
      el.srcObject = null
    }
  }, [recordingKind])

  useEffect(() => {
    return () => {
      clearAutoStop()
      stopTracks()
    }
  }, [])

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
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function saveMedia(partial: Omit<MediaItem, 'dispositivoId' | 'syncStatus'>) {
    const item: MediaItem = {
      ...partial,
      trabajoId,
      dispositivoId: await getDispositivoId(),
      syncStatus: 'pending',
    }
    await addMedia(item)
    await refreshAdjuntos()
    setMessage(`${partial.tipo} guardado.`)
    onSaved?.()
    if (online) onRequestSync?.()
    setMode('menu')
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setError(null)
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickAudioMime()
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
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
      stopTracks()
    }
  }

  async function startVideoRecording() {
    setError(null)
    setMessage(null)
    if (recordingKind) return
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
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      recorder.onstop = () => {
        clearAutoStop()
        void finalizeVideo(mimeType)
      }
      recorderRef.current = recorder
      recorder.start(250)
      setRecordingKind('video')
      armAutoStop()
    } catch {
      setError('No se pudo acceder a la cámara/micrófono.')
      stopTracks()
    }
  }

  function stopCurrentRecording() {
    clearAutoStop()
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      setRecordingKind(null)
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
      if (blob.size < 100) throw new Error('La grabación de audio quedó vacía.')
      const ahora = new Date().toISOString()
      const id = newId('a')
      await saveMedia({
        id,
        tipo: 'audio',
        numeroEmpleado,
        dia: diaCaptura,
        capturadoEn: ahora,
        creadoEn: ahora,
        mimeType: blob.type || mimeType,
        fileName: `${numeroEmpleado}_${diaCaptura}_${id.slice(0, 8)}.${audioExt(mimeType)}`,
        blob,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el audio')
      setMode('menu')
    } finally {
      setBusy(false)
      recorderRef.current = null
    }
  }

  async function finalizeVideo(mimeType: string) {
    setBusy(true)
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      chunksRef.current = []
      stopTracks()
      if (blob.size < 500) throw new Error('La grabación de vídeo quedó vacía.')
      const ahora = new Date().toISOString()
      const id = newId('v')
      await saveMedia({
        id,
        tipo: 'video',
        numeroEmpleado,
        dia: diaCaptura,
        capturadoEn: ahora,
        creadoEn: ahora,
        mimeType: blob.type || mimeType,
        fileName: `${numeroEmpleado}_${diaCaptura}_${id.slice(0, 8)}.${videoExt(mimeType)}`,
        blob,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el vídeo')
      setMode('menu')
    } finally {
      setBusy(false)
      recorderRef.current = null
    }
  }

  return (
    <div className="adjuntar-panel">
      <div className="list-head">
        <h3>Adjuntar al trabajo</h3>
        <p>Puedes añadir varios sin salir</p>
      </div>

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

      {mode === 'menu' && !recordingKind ? (
        <div className="ptv-btn-col">
          <button
            type="button"
            className="btn foto-btn"
            disabled={busy}
            onClick={() => photoInputRef.current?.click()}
          >
            Foto
          </button>
          <button
            type="button"
            className="btn audio-btn"
            disabled={busy}
            onClick={() => {
              setMode('audio')
              void startAudioRecording()
            }}
          >
            Audio (1 min)
          </button>
          <button
            type="button"
            className="btn video-btn"
            disabled={busy}
            onClick={() => {
              setMode('video')
              void startVideoRecording()
            }}
          >
            Vídeo (1 min)
          </button>
          {onClose ? (
            <button type="button" className="btn ghost" onClick={onClose}>
              Volver al trabajo
            </button>
          ) : null}
        </div>
      ) : null}

      {recordingKind === 'audio' ? (
        <div className="audio-live">
          <div className={`video-countdown ${timeLeft <= 10 ? 'urgent' : ''}`}>
            Quedan <strong>{formatCountdown(timeLeft)}</strong>
          </div>
          <button type="button" className="btn audio-btn recording" onClick={stopCurrentRecording}>
            Detener audio
          </button>
        </div>
      ) : null}

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
          <button type="button" className="btn video-btn recording" onClick={stopCurrentRecording}>
            Detener vídeo
          </button>
        </div>
      ) : null}

      {adjuntos.length > 0 ? (
        <ul className="adjuntos-list">
          {adjuntos.map((a) => (
            <li key={a.id}>
              <span className={`pill ${a.tipo}`}>{a.tipo}</span>
              <span>{new Date(a.capturadoEn).toLocaleTimeString('es-ES')}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted media-hint">Sin adjuntos en este trabajo.</p>
      )}
    </div>
  )
}
