import { useEffect, useState } from 'react'

/**
 * Online real = el dispositivo tiene red Y responde nuestro API.
 * navigator.onLine solo no basta (PWA instalada / IP cambiada / API caída).
 */
export function useOnline() {
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [apiOk, setApiOk] = useState(false)

  useEffect(() => {
    const on = () => setBrowserOnline(true)
    const off = () => {
      setBrowserOnline(false)
      setApiOk(false)
    }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function ping() {
      if (!navigator.onLine) {
        if (!cancelled) setApiOk(false)
        return
      }
      try {
        const res = await fetch(`/api/health?t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (!cancelled) setApiOk(res.ok)
      } catch {
        if (!cancelled) setApiOk(false)
      }
    }

    void ping()
    const timer = window.setInterval(() => void ping(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [browserOnline])

  return browserOnline && apiOk
}
