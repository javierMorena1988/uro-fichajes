import { useCallback, useEffect, useRef, useState } from 'react'
import { AccionesOperario } from './components/AccionesOperario'
import { FabricacionPanel } from './components/FabricacionPanel'
import {
  countAllPendientes,
  countOperarios,
  findOperarioByTarjeta,
  getTrabajoAbierto,
} from './db/indexeddb'
import { useOnline } from './hooks/useOnline'
import { syncAll, syncMasters } from './services/sync'
import type { Operario } from './types/maestro'
import type { TrabajoCompleto } from './types/trabajo'
import { normalizeTarjeta } from './utils/ids'
import './App.css'

type Screen = 'espera' | 'acciones' | 'fabricacion'

export default function App() {
  const online = useOnline()
  const inputRef = useRef<HTMLInputElement>(null)

  const [screen, setScreen] = useState<Screen>('espera')
  const [tarjeta, setTarjeta] = useState('')
  const [operario, setOperario] = useState<Operario | null>(null)
  const [trabajo, setTrabajo] = useState<TrabajoCompleto | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncBlocking, setSyncBlocking] = useState(false)
  const [pendientes, setPendientes] = useState(0)
  const [mastersCount, setMastersCount] = useState(0)
  const [bootMsg, setBootMsg] = useState<string | null>(null)

  const refreshPendientes = useCallback(async () => {
    setPendientes(await countAllPendientes())
    setMastersCount(await countOperarios())
  }, [])

  const focusTarjeta = useCallback(() => {
    const apply = () => {
      const el = inputRef.current
      if (!el) return
      el.focus({ preventScroll: false })
      // Ayuda a abrir teclado en algunos Android / PDA
      try {
        el.click()
      } catch {
        /* ignore */
      }
      const len = el.value.length
      try {
        el.setSelectionRange(len, len)
      } catch {
        /* ignore */
      }
    }
    apply()
    window.setTimeout(apply, 50)
    window.setTimeout(apply, 200)
  }, [])

  const volverEspera = useCallback(() => {
    setScreen('espera')
    setOperario(null)
    setTrabajo(null)
    setTarjeta('')
    setError(null)
    focusTarjeta()
  }, [focusTarjeta])

  const volverAcciones = useCallback(() => {
    setError(null)
    setScreen('acciones')
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  const handleSync = useCallback(
    async (silent = false) => {
      if (!navigator.onLine) {
        if (!silent) {
          setError('Sin conexión. Inténtalo cuando haya red.')
          focusTarjeta()
        }
        return
      }
      const started = Date.now()
      const minMs = 1400
      if (!silent) {
        setSyncBlocking(true)
        setError(null)
      }
      try {
        const result = await syncAll()
        await refreshPendientes()
        if (!silent) {
          showToast(
            result.errors > 0
              ? 'No se pudieron actualizar todos los datos.'
              : 'Datos actualizados correctamente.',
          )
        }
      } catch {
        if (!silent) {
          setError('No se pudieron actualizar los datos. Inténtalo de nuevo.')
        }
      } finally {
        if (!silent) {
          const wait = Math.max(0, minMs - (Date.now() - started))
          if (wait > 0) await new Promise((r) => window.setTimeout(r, wait))
          setSyncBlocking(false)
          // Foco al input solo cuando ya no hay overlay (evita que el teclado “mate” el popup)
          if (screen === 'espera') {
            window.setTimeout(() => focusTarjeta(), 80)
          }
        }
      }
    },
    [refreshPendientes, showToast, focusTarjeta, screen],
  )

  useEffect(() => {
    void (async () => {
      await refreshPendientes()
      const n = await countOperarios()
      if (n === 0 && navigator.onLine) {
        setBootMsg('Preparando datos…')
        const started = Date.now()
        setSyncBlocking(true)
        try {
          await syncMasters()
          await refreshPendientes()
          setBootMsg(null)
        } catch {
          setBootMsg('Pulsa Sincronizar cuando haya red.')
        } finally {
          const wait = Math.max(0, 1400 - (Date.now() - started))
          if (wait > 0) await new Promise((r) => window.setTimeout(r, wait))
          setSyncBlocking(false)
        }
      }
      focusTarjeta()
    })()
  }, [refreshPendientes, focusTarjeta])

  useEffect(() => {
    if (!online) return
    const timer = window.setTimeout(() => {
      void handleSync(true)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [online, handleSync])

  useEffect(() => {
    if (screen === 'espera') focusTarjeta()
  }, [screen, focusTarjeta])

  async function validarTarjeta(raw: string) {
    setError(null)
    const code = normalizeTarjeta(raw)
    if (!raw.trim() || code.length < 8) {
      setError('Introduce el código de tarjeta (8 dígitos).')
      focusTarjeta()
      return
    }

    const found = await findOperarioByTarjeta(code)
    if (!found) {
      setError('Tarjeta no autorizada.')
      setTarjeta('')
      focusTarjeta()
      return
    }

    setOperario(found)
    const t = await getTrabajoAbierto(found.codOperario)
    setTrabajo(t ?? null)
    setScreen('acciones')
  }

  async function openFabricacion() {
    if (!operario) return
    const t = await getTrabajoAbierto(operario.codOperario)
    setTrabajo(t ?? null)
    setScreen('fabricacion')
  }

  return (
    <div className="app ptv-app">
      {syncBlocking ? (
        <div className="sync-overlay" role="alertdialog" aria-busy="true" aria-label="Actualizando">
          <div className="sync-overlay-card">
            <div className="sync-spinner" aria-hidden />
            <p>Un momento, por favor…</p>
            <p className="sync-overlay-sub">Actualizando datos</p>
          </div>
        </div>
      ) : null}

      <header className="top">
        <div className="brand">
          <img className="brand-logo" src="/urovesa.png" alt="UROVESA" />
          <div>
            <p className="eyebrow">UROVESA</p>
            <h1>Presencia</h1>
          </div>
        </div>
        <div className={`badge ${online ? 'online' : 'offline'}`}>
          <span className="dot" />
          {online ? 'Online' : 'Sin servidor'}
        </div>
      </header>

      {toast ? <div className="ptv-toast">{toast}</div> : null}

      {screen === 'espera' ? (
        <section className="card ptv-card">
          <label className="field tarjeta-field">
            <span>Código de tarjeta</span>
            <input
              ref={inputRef}
              type="text"
              name="tarjeta"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="done"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
              maxLength={12}
              placeholder="________"
              value={tarjeta}
              onChange={(e) => setTarjeta(e.target.value.replace(/\D/g, '').slice(0, 12))}
              onBlur={() => {
                if (screen === 'espera' && !syncBlocking) focusTarjeta()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void validarTarjeta(tarjeta)
                }
              }}
            />
          </label>

          <button
            type="button"
            className="btn entrada ptv-big"
            style={{ width: '100%', marginTop: '0.75rem' }}
            onClick={() => void validarTarjeta(tarjeta)}
          >
            Validar
          </button>

          {error ? <p className="msg err">{error}</p> : null}
          {bootMsg ? <p className="msg ok">{bootMsg}</p> : null}

          <div className="sync-row" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn ghost"
              disabled={syncBlocking || !online}
              onClick={() => void handleSync(false)}
            >
              Sincronizar
            </button>
            <p className="hint">
              Maestros: <strong>{mastersCount}</strong> · Pendientes:{' '}
              <strong>{pendientes}</strong>
            </p>
          </div>
        </section>
      ) : null}

      {screen === 'acciones' && operario ? (
        <AccionesOperario
          operario={operario}
          online={online}
          onToast={showToast}
          onError={setError}
          onVolverEspera={volverEspera}
          onFabricacion={() => void openFabricacion()}
          onRequestSync={() => void handleSync(true)}
        />
      ) : null}

      {screen === 'acciones' && error ? <p className="msg err">{error}</p> : null}

      {screen === 'fabricacion' && operario ? (
        <FabricacionPanel
          operario={operario}
          trabajoAbierto={trabajo}
          online={online}
          onTrabajoChange={setTrabajo}
          onRequestSync={() => void handleSync(true)}
          onVolverEspera={volverEspera}
          onVolverAcciones={volverAcciones}
        />
      ) : null}

      <footer className="foot">
        <p className="muted">
          Terminal compartido · tras Entrada/Salida o Finalizar vuelve a pedir tarjeta.
        </p>
      </footer>
    </div>
  )
}
