import { useMemo, useState } from 'react'
import type { OrdenReparacion } from '../types/maestro'

interface Props {
  ordenes: OrdenReparacion[]
  selected: number[]
  onChange: (codigos: number[]) => void
}

export function OrdenSelector({ ordenes, selected, onChange }: Props) {
  const [q, setQ] = useState('')

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return ordenes
    return ordenes.filter((o) => {
      const blob = `${o.codigoOrden} ${o.nombre} ${o.articuloAsociado} ${o.tipoOrden}`.toLowerCase()
      return blob.includes(term)
    })
  }, [ordenes, q])

  function toggle(codigo: number) {
    if (selected.includes(codigo)) {
      onChange(selected.filter((c) => c !== codigo))
    } else {
      onChange([...selected, codigo])
    }
  }

  return (
    <div className="orden-selector">
      <label className="field">
        <span>Buscar orden (código, nombre, artículo)</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Escribe para filtrar…"
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>

      <p className="muted media-hint">
        Seleccionadas: <strong>{selected.length}</strong>
      </p>

      <ul className="orden-list">
        {filtradas.length === 0 ? (
          <li className="empty">Sin resultados.</li>
        ) : (
          filtradas.map((o) => {
            const on = selected.includes(o.codigoOrden)
            return (
              <li key={o.codigoOrden}>
                <button
                  type="button"
                  className={`orden-item ${on ? 'selected' : ''}`}
                  onClick={() => toggle(o.codigoOrden)}
                >
                  <span className="orden-check">{on ? '✓' : ''}</span>
                  <span className="orden-main">
                    <strong>
                      {o.tipoOrden}-{o.codigoOrden}
                    </strong>
                    <span>{o.nombre}</span>
                    <span className="muted">{o.articuloAsociado}</span>
                  </span>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
