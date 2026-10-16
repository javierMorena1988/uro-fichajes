import { useEffect, useMemo, useState } from 'react'
import { getOrdenesByCodigos, listOrdenesReparacion } from '../db/indexeddb'
import { finalizarTrabajo, iniciarTrabajo } from '../services/presencia-ops'
import type { Operario, OrdenReparacion } from '../types/maestro'
import type { TrabajoCompleto } from '../types/trabajo'
import { formatDuracionMinutos, formatHora, minutosEntre } from '../utils/ids'
import { AdjuntarMedia } from './AdjuntarMedia'
import { OrdenSelector } from './OrdenSelector'

interface Props {
  operario: Operario
  trabajoAbierto: TrabajoCompleto | null
  online: boolean
  onTrabajoChange: (t: TrabajoCompleto | null) => void
  onRequestSync: () => void
  /** Tras finalizar trabajo → espera de tarjeta */
  onVolverEspera: () => void
  /** Volver a Entrada/Salida/Fabricación sin perder el trabajo abierto */
  onVolverAcciones: () => void
}

type View = 'select' | 'curso' | 'adjuntar'

export function FabricacionPanel({
  operario,
  trabajoAbierto,
  online,
  onTrabajoChange,
  onRequestSync,
  onVolverEspera,
  onVolverAcciones,
}: Props) {
  const [view, setView] = useState<View>(trabajoAbierto ? 'curso' : 'select')
  const [ordenes, setOrdenes] = useState<OrdenReparacion[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [ordenesCurso, setOrdenesCurso] = useState<OrdenReparacion[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    void listOrdenesReparacion().then(setOrdenes)
  }, [])

  useEffect(() => {
    setView(trabajoAbierto ? 'curso' : 'select')
  }, [trabajoAbierto?.cabecera.id])

  useEffect(() => {
    if (!trabajoAbierto) {
      setOrdenesCurso([])
      return
    }
    void getOrdenesByCodigos(trabajoAbierto.detalles.map((d) => d.codigoOrden)).then(
      setOrdenesCurso,
    )
  }, [trabajoAbierto])

  useEffect(() => {
    if (view !== 'curso' || !trabajoAbierto) return
    const t = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [view, trabajoAbierto])

  const minutosCurso = useMemo(() => {
    if (!trabajoAbierto) return 0
    return minutosEntre(trabajoAbierto.cabecera.fechaHoraInicio, new Date(nowTick).toISOString())
  }, [trabajoAbierto, nowTick])

  async function onIniciar() {
    setError(null)
    setBusy(true)
    try {
      const t = await iniciarTrabajo(operario, selected)
      onTrabajoChange(t)
      setSelected([])
      setView('curso')
      if (online) onRequestSync()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar')
    } finally {
      setBusy(false)
    }
  }

  async function onFinalizar() {
    if (!trabajoAbierto) return
    setError(null)
    setBusy(true)
    try {
      await finalizarTrabajo(trabajoAbierto)
      onTrabajoChange(null)
      if (online) onRequestSync()
      onVolverEspera()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo finalizar')
    } finally {
      setBusy(false)
    }
  }

  async function onNuevaOrden() {
    setError(null)
    setView('select')
  }

  if (view === 'adjuntar' && trabajoAbierto) {
    return (
      <section className="card ptv-card">
        <AdjuntarMedia
          trabajoId={trabajoAbierto.cabecera.id}
          codOperario={operario.codOperario}
          online={online}
          onRequestSync={onRequestSync}
          onClose={() => setView('curso')}
        />
      </section>
    )
  }

  if (view === 'curso' && trabajoAbierto) {
    return (
      <section className="card ptv-card">
        <div className="list-head">
          <h2>Trabajo en curso</h2>
          <p>
            Inicio {formatHora(trabajoAbierto.cabecera.fechaHoraInicio)} ·{' '}
            <strong>{formatDuracionMinutos(minutosCurso)}</strong>
          </p>
        </div>

        <ul className="orden-curso-list">
          {ordenesCurso.map((o) => (
            <li key={o.codigoOrden}>
              <strong>
                {o.tipoOrden}-{o.codigoOrden}
              </strong>
              <span>{o.nombre}</span>
            </li>
          ))}
        </ul>

        {error ? <p className="msg err">{error}</p> : null}

        <div className="ptv-btn-col">
          <button
            type="button"
            className="btn foto-btn"
            disabled={busy}
            onClick={() => setView('adjuntar')}
          >
            Adjuntar foto / audio / vídeo
          </button>
          <button
            type="button"
            className="btn entrada"
            disabled={busy}
            onClick={() => void onFinalizar()}
          >
            Finalizar trabajo
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => void onNuevaOrden()}
          >
            Iniciar otra orden
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={onVolverAcciones}>
            Volver
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="card ptv-card">
      <div className="list-head">
        <h2>Órdenes de reparación</h2>
        <p>Selecciona una o varias e inicia el trabajo</p>
      </div>

      <OrdenSelector ordenes={ordenes} selected={selected} onChange={setSelected} />

      {error ? <p className="msg err">{error}</p> : null}

      <div className="ptv-btn-col" style={{ marginTop: '0.75rem' }}>
        <button
          type="button"
          className="btn entrada"
          disabled={busy || selected.length === 0}
          onClick={() => void onIniciar()}
        >
          {busy ? 'Iniciando…' : 'Iniciar trabajo'}
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={onVolverAcciones}>
          Volver
        </button>
      </div>
    </section>
  )
}
