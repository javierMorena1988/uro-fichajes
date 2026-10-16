import { useState, type FormEvent } from 'react'
import { login } from '../services/auth'
import type { EmpleadoSesion } from '../types/auth'
import { useOnline } from '../hooks/useOnline'

interface Props {
  onLoggedIn: (session: EmpleadoSesion) => void
}

export function LoginPage({ onLoggedIn }: Props) {
  const online = useOnline()
  const [numeroEmpleado, setNumeroEmpleado] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const session = await login(numeroEmpleado, pin)
      onLoggedIn(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="eyebrow">UROVESA</p>
          <h1>Acceso empleado</h1>
        </div>
        <div className={`badge ${online ? 'online' : 'offline'}`}>
          <span className="dot" />
          {online ? 'Online' : 'Sin servidor'}
        </div>
      </header>

      <form className="card form-card" onSubmit={(e) => void onSubmit(e)}>
        <p className="login-lead">
          El nº de empleado queda ligado a la sesión. Luego solo ficharás entrada o salida.
        </p>

        <label className="field">
          <span>Nº de empleado</span>
          <input
            inputMode="numeric"
            autoComplete="username"
            placeholder="Ej. 1042"
            value={numeroEmpleado}
            onChange={(e) => setNumeroEmpleado(e.target.value)}
            disabled={busy}
          />
        </label>

        <label className="field" style={{ marginTop: '0.85rem' }}>
          <span>PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            placeholder="····"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={busy}
          />
        </label>

        <button type="submit" className="btn entrada login-btn" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>

        {error ? <p className="msg err">{error}</p> : null}

        <p className="login-hint muted">
          Demo: <code>1042</code> / <code>1234</code> · <code>2055</code> / <code>1234</code> ·{' '}
          <code>3088</code> / <code>1234</code>
        </p>
      </form>
    </div>
  )
}
