import type { EmpleadoSesion, LoginResponse } from '../types/auth'

const SESSION_KEY = 'urovesa.session'
const CRED_CACHE_KEY = 'urovesa.loginCache'

interface CachedCred {
  numeroEmpleado: string
  pin: string
  nombre: string
}

export function getSession(): EmpleadoSesion | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as EmpleadoSesion
    if (!parsed?.numeroEmpleado) return null
    return parsed
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

function saveSession(data: LoginResponse): EmpleadoSesion {
  const session: EmpleadoSesion = {
    numeroEmpleado: data.numeroEmpleado,
    nombre: data.nombre,
    loggedAt: new Date().toISOString(),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

function cacheCredentials(numeroEmpleado: string, pin: string, nombre: string) {
  const list = readCredCache().filter((c) => c.numeroEmpleado !== numeroEmpleado)
  list.push({ numeroEmpleado, pin, nombre })
  localStorage.setItem(CRED_CACHE_KEY, JSON.stringify(list))
}

function readCredCache(): CachedCred[] {
  try {
    const raw = localStorage.getItem(CRED_CACHE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as CachedCred[]
  } catch {
    return []
  }
}

function loginFromCache(numeroEmpleado: string, pin: string): EmpleadoSesion | null {
  const hit = readCredCache().find(
    (c) => c.numeroEmpleado === numeroEmpleado && c.pin === pin,
  )
  if (!hit) return null
  return saveSession({ numeroEmpleado: hit.numeroEmpleado, nombre: hit.nombre })
}

export async function login(numeroEmpleado: string, pin: string): Promise<EmpleadoSesion> {
  const nro = numeroEmpleado.trim()
  const clave = pin.trim()
  if (!nro || !clave) {
    throw new Error('Indica nº de empleado y PIN.')
  }

  if (!navigator.onLine) {
    const cached = loginFromCache(nro, clave)
    if (cached) return cached
    throw new Error('Sin conexión y no hay sesión previa cacheada para este empleado.')
  }

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numeroEmpleado: nro, pin: clave }),
  })

  if (!res.ok) {
    let msg = 'Credenciales incorrectas'
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) msg = body.error
    } catch {
      // ignore
    }
    throw new Error(msg)
  }

  const data = (await res.json()) as LoginResponse
  cacheCredentials(data.numeroEmpleado, clave, data.nombre)
  return saveSession(data)
}
