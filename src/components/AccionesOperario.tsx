import { useEffect, useMemo, useState } from 'react'
import {
  getPresenciaAbierta,
  getTrabajoAbierto,
  getUltimoTrabajoCerrado,
} from '../db/indexeddb'
import { registrarEntrada, registrarSalida, retomarUltimoTrabajo } from '../services/presencia-ops'
import type { Operario } from '../types/maestro'
import type { Presencia } from '../types/presencia'
import type { TrabajoCompleto } from '../types/trabajo'
import { formatDuracionMinutos, formatHora, minutosEntre } from '../utils/ids'

interface Props {
  operario: Operario
  online: boolean
  onToast: (msg: string) => void
  onError: (msg: string) => void
  onVolverEspera: () => void
  onFabricacion: () => void
  onRequestSync: () => void
}

export function AccionesOperario({
  operario,
  online,
  onToast,
  onError,
  onVolverEspera,
  onFabricacion,
  onRequestSync,
}: Props) {
  const [presencia, setPresencia] = useState<Presencia | null>(null)
  const [trabajo, setTrabajo] = useState<TrabajoCompleto | null>(null)
  const [busy, setBusy] = useState(false)
  const [showRetomar, setShowRetomar] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())

  async function refresh() {
    const [p, t] = await Promise.all([
      getPresenciaAbierta(operario.codOperario),
      getTrabajoAbierto(operario.codOperario),
    ])
    setPresencia(p ?? null)
    setTrabajo(t ?? null)
  }

  useEffect(() => {
    void refresh()
  }, [operario.codOperario])

  useEffect(() => {
    if (!presencia || presencia.fechaHoraSalida) return
    const t = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [presencia])

  const dentro = !!presencia && !presencia.fechaHoraSalida

  const minutosPresencia = useMemo(() => {
    if (!presencia || presencia.fechaHoraSalida) return 0
    return minutosEntre(presencia.fechaHoraEntrada, new Date(nowTick).toISOString())
  }, [presencia, nowTick])

  async function onEntrada() {
    setBusy(true)
    try {
      await registrarEntrada(operario)
      onToast(`Entrada grabada · ${operario.nombreApellidos}`)
      if (online) onRequestSync()

      const ultimo = await getUltimoTrabajoCerrado(operario.codOperario)
      if (ultimo && ultimo.detalles.length > 0) {
        setShowRetomar(true)
        await refresh()
        return
      }
      onVolverEspera()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al registrar entrada')
    } finally {
      setBusy(false)
    }
  }

  async function onSalida() {
    setBusy(true)
    try {
      const { presencia: cerrada, trabajoCerrado } = await registrarSalida(operario)
      const mins = cerrada.totalMinutos ?? 0
      const extra = trabajoCerrado ? ' · Trabajo finalizado' : ''
      onToast(`Salida grabada · ${formatDuracionMinutos(mins)}${extra}`)
      if (online) onRequestSync()
      onVolverEspera()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al registrar salida')
    } finally {
      setBusy(false)
    }
  }

  async function onRetomarSi() {
    setBusy(true)
    try {
      await retomarUltimoTrabajo(operario)
      onToast('Orden de reparación retomada')
      if (online) onRequestSync()
      setShowRetomar(false)
      onVolverEspera()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo retomar')
    } finally {
      setBusy(false)
    }
  }

  function onRetomarNo() {
    setShowRetomar(false)
    onVolverEspera()
  }

  return (
    <section className="card ptv-card">
      <div className="auth-ok">
        <span className="check-ok" aria-hidden>
          ✓
        </span>
        <div>
          <p className="session-name">{operario.nombreApellidos}</p>
          <p className="session-nro">
            Operario <strong>{operario.codOperario}</strong> · Delegación{' '}
            <strong>{operario.codDelegacion}</strong>
          </p>
        </div>
      </div>

      <div className="info-presencia">
        {dentro && presencia ? (
          <>
            <p>
              Entrada a <strong>{formatHora(presencia.fechaHoraEntrada)}</strong>
            </p>
            <p>
              Tiempo: <strong>{formatDuracionMinutos(minutosPresencia)}</strong>
            </p>
          </>
        ) : (
          <p className="muted">Sin presencia abierta · habilitada Entrada</p>
        )}
        {trabajo ? (
          <p className="fab-badge">Fabricación en curso</p>
        ) : (
          <p className="muted">Sin fabricación abierta</p>
        )}
      </div>

      <div className="ptv-btn-row">
        <button
          type="button"
          className="btn entrada ptv-big"
          disabled={busy || dentro}
          onClick={() => void onEntrada()}
        >
          Entrada
        </button>
        <button
          type="button"
          className="btn salida ptv-big"
          disabled={busy || !dentro}
          onClick={() => void onSalida()}
        >
          Salida
        </button>
      </div>

      <button
        type="button"
        className="btn video-btn ptv-big"
        style={{ width: '100%', marginTop: '0.65rem' }}
        disabled={busy}
        onClick={onFabricacion}
      >
        Fabricación
      </button>

      <button
        type="button"
        className="btn ghost"
        style={{ width: '100%', marginTop: '0.65rem' }}
        disabled={busy}
        onClick={onVolverEspera}
      >
        Cancelar
      </button>

      {showRetomar ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>¿Retomar última orden?</h3>
            <p>Se abrirá de nuevo el último trabajo de fabricación cerrado.</p>
            <div className="ptv-btn-row">
              <button
                type="button"
                className="btn entrada"
                disabled={busy}
                onClick={() => void onRetomarSi()}
              >
                Sí
              </button>
              <button type="button" className="btn ghost" disabled={busy} onClick={onRetomarNo}>
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
