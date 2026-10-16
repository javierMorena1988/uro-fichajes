import cors from 'cors'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const MEDIA_DIR = path.join(DATA_DIR, 'media-files')
const DATA_FILE = path.join(DATA_DIR, 'fichajes.json')
const MEDIAS_FILE = path.join(DATA_DIR, 'medias.json')
const PRESENCIAS_FILE = path.join(DATA_DIR, 'presencias.json')
const TRABAJOS_FILE = path.join(DATA_DIR, 'trabajos.json')
const OPERARIOS_FILE = path.join(DATA_DIR, 'operarios.json')
const ORDENES_FILE = path.join(DATA_DIR, 'ordenes-reparacion.json')
const PORT = Number(process.env.API_PORT || 8787)

/** Empleados demo (luego vendrá de AD / ERP / lo que diga el cliente) */
const EMPLEADOS = [
  { numeroEmpleado: '1042', pin: '1234', nombre: 'Ana López' },
  { numeroEmpleado: '2055', pin: '1234', nombre: 'Carlos Ruiz' },
  { numeroEmpleado: '3088', pin: '1234', nombre: 'María Gómez' },
]

async function ensureFile(file) {
  try {
    await fs.access(file)
  } catch {
    await fs.writeFile(file, '[]', 'utf8')
  }
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.mkdir(MEDIA_DIR, { recursive: true })
  await ensureFile(DATA_FILE)
  await ensureFile(MEDIAS_FILE)
  await ensureFile(PRESENCIAS_FILE)
  await ensureFile(TRABAJOS_FILE)
}

async function readJson(file) {
  await ensureStore()
  const raw = await fs.readFile(file, 'utf8')
  return JSON.parse(raw)
}

async function writeJson(file, items) {
  await ensureStore()
  await fs.writeFile(file, JSON.stringify(items, null, 2), 'utf8')
}

function extFromMime(mime, tipo, fallback = 'bin') {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (tipo === 'video' || mime?.startsWith('video/')) {
    if (mime?.includes('webm')) return 'webm'
    return 'mp4'
  }
  if (tipo === 'audio' || mime?.startsWith('audio/')) {
    if (mime?.includes('mp4')) return 'm4a'
    if (mime?.includes('ogg')) return 'ogg'
    return 'weba'
  }
  return fallback
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '60mb' }))
app.use(
  '/api/media-files',
  express.static(MEDIA_DIR, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.weba')) {
        res.setHeader('Content-Type', 'audio/webm')
      } else if (filePath.endsWith('.m4a')) {
        res.setHeader('Content-Type', 'audio/mp4')
      } else if (filePath.endsWith('.ogg')) {
        res.setHeader('Content-Type', 'audio/ogg')
      } else if (filePath.endsWith('.webm')) {
        res.setHeader('Content-Type', 'video/webm')
      } else if (filePath.endsWith('.mp4')) {
        res.setHeader('Content-Type', 'video/mp4')
      }
    },
  }),
)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'urovesa-fichaje-api' })
})

app.get('/api/operarios', async (_req, res) => {
  try {
    const items = await readJson(OPERARIOS_FILE)
    res.json(items)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudieron leer los operarios' })
  }
})

app.get('/api/ordenes-reparacion', async (_req, res) => {
  try {
    const items = await readJson(ORDENES_FILE)
    res.json(items)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudieron leer las órdenes de reparación' })
  }
})

app.post('/api/login', (req, res) => {
  const numeroEmpleado = String(req.body?.numeroEmpleado || '').trim()
  const pin = String(req.body?.pin || '').trim()

  if (!numeroEmpleado || !pin) {
    res.status(400).json({ error: 'Faltan nº de empleado o PIN' })
    return
  }

  const emp = EMPLEADOS.find(
    (e) => e.numeroEmpleado === numeroEmpleado && e.pin === pin,
  )

  if (!emp) {
    res.status(401).json({ error: 'Empleado o PIN incorrectos' })
    return
  }

  res.json({
    numeroEmpleado: emp.numeroEmpleado,
    nombre: emp.nombre,
  })
})

app.get('/api/fichajes', async (_req, res) => {
  try {
    const items = await readJson(DATA_FILE)
    items.sort((a, b) => String(b.registradoEn).localeCompare(String(a.registradoEn)))
    res.json(items)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudieron leer los fichajes' })
  }
})

app.post('/api/fichajes', async (req, res) => {
  try {
    const body = req.body || {}
    const required = ['id', 'tipo', 'numeroEmpleado', 'registradoEn', 'creadoEn', 'dispositivoId']
    for (const key of required) {
      if (!body[key]) {
        res.status(400).json({ error: `Falta el campo: ${key}` })
        return
      }
    }
    if (body.tipo !== 'entrada' && body.tipo !== 'salida') {
      res.status(400).json({ error: 'tipo debe ser entrada o salida' })
      return
    }

    const items = await readJson(DATA_FILE)
    const idx = items.findIndex((item) => item.id === body.id)
    const record = {
      id: String(body.id),
      tipo: body.tipo,
      numeroEmpleado: String(body.numeroEmpleado).trim(),
      registradoEn: String(body.registradoEn),
      creadoEn: String(body.creadoEn),
      dispositivoId: String(body.dispositivoId),
      recibidoEn: new Date().toISOString(),
    }

    if (idx >= 0) {
      items[idx] = { ...items[idx], ...record }
    } else {
      items.push(record)
    }

    await writeJson(DATA_FILE, items)
    res.status(201).json(record)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo guardar el fichaje' })
  }
})

app.get('/api/presencias', async (_req, res) => {
  try {
    const items = await readJson(PRESENCIAS_FILE)
    items.sort((a, b) =>
      String(b.fechaHoraEntrada).localeCompare(String(a.fechaHoraEntrada)),
    )
    res.json(items)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudieron leer las presencias' })
  }
})

app.post('/api/presencias', async (req, res) => {
  try {
    const body = req.body || {}
    const required = [
      'id',
      'codDelegacion',
      'codOperario',
      'fechaHoraEntrada',
      'dispositivoId',
    ]
    for (const key of required) {
      if (body[key] === undefined || body[key] === null || body[key] === '') {
        res.status(400).json({ error: `Falta el campo: ${key}` })
        return
      }
    }

    const items = await readJson(PRESENCIAS_FILE)
    const idx = items.findIndex((item) => item.id === body.id)
    const record = {
      id: String(body.id),
      codDelegacion: Number(body.codDelegacion),
      codOperario: Number(body.codOperario),
      fechaHoraEntrada: String(body.fechaHoraEntrada),
      fechaHoraSalida: body.fechaHoraSalida ? String(body.fechaHoraSalida) : undefined,
      totalMinutos:
        body.totalMinutos !== undefined && body.totalMinutos !== null
          ? Number(body.totalMinutos)
          : undefined,
      dispositivoId: String(body.dispositivoId),
      recibidoEn: new Date().toISOString(),
    }

    if (idx >= 0) {
      items[idx] = { ...items[idx], ...record }
    } else {
      items.push(record)
    }

    await writeJson(PRESENCIAS_FILE, items)
    res.status(201).json(record)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo guardar la presencia' })
  }
})

app.get('/api/trabajos', async (_req, res) => {
  try {
    const items = await readJson(TRABAJOS_FILE)
    items.sort((a, b) =>
      String(b.cabecera?.fechaHoraInicio || '').localeCompare(
        String(a.cabecera?.fechaHoraInicio || ''),
      ),
    )
    res.json(items)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudieron leer los trabajos' })
  }
})

app.post('/api/trabajos', async (req, res) => {
  try {
    const body = req.body || {}
    const cab = body.cabecera || {}
    const detalles = Array.isArray(body.detalles) ? body.detalles : []
    const required = [
      'id',
      'codDelegacion',
      'codOperario',
      'fechaHoraInicio',
      'dispositivoId',
    ]
    for (const key of required) {
      if (cab[key] === undefined || cab[key] === null || cab[key] === '') {
        res.status(400).json({ error: `Falta cabecera.${key}` })
        return
      }
    }

    const items = await readJson(TRABAJOS_FILE)
    const idx = items.findIndex((item) => item.cabecera?.id === cab.id)
    const record = {
      cabecera: {
        id: String(cab.id),
        codDelegacion: Number(cab.codDelegacion),
        codOperario: Number(cab.codOperario),
        fechaHoraInicio: String(cab.fechaHoraInicio),
        fechaHoraFin: cab.fechaHoraFin ? String(cab.fechaHoraFin) : undefined,
        totalMinutos:
          cab.totalMinutos !== undefined && cab.totalMinutos !== null
            ? Number(cab.totalMinutos)
            : undefined,
        dispositivoId: String(cab.dispositivoId),
      },
      detalles: detalles.map((d) => ({
        id: String(d.id),
        idCabecera: String(d.idCabecera || cab.id),
        codigoOrden: Number(d.codigoOrden),
      })),
      recibidoEn: new Date().toISOString(),
    }

    if (idx >= 0) {
      items[idx] = record
    } else {
      items.push(record)
    }

    await writeJson(TRABAJOS_FILE, items)
    res.status(201).json(record)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo guardar el trabajo' })
  }
})

app.get('/api/medias', async (req, res) => {
  try {
    const numeroEmpleado = String(req.query.numeroEmpleado || '').trim()
    const dia = String(req.query.dia || '').trim()
    let items = await readJson(MEDIAS_FILE)

    if (numeroEmpleado) {
      items = items.filter((m) => m.numeroEmpleado === numeroEmpleado)
    }
    if (dia) {
      items = items.filter((m) => m.dia === dia)
    }

    items.sort((a, b) => String(b.capturadoEn).localeCompare(String(a.capturadoEn)))
    res.json(items)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudieron leer las medias' })
  }
})

app.post('/api/medias', async (req, res) => {
  try {
    const body = req.body || {}
    const required = [
      'id',
      'tipo',
      'numeroEmpleado',
      'dia',
      'capturadoEn',
      'creadoEn',
      'dispositivoId',
      'mimeType',
      'fileName',
      'dataBase64',
    ]
    for (const key of required) {
      if (!body[key]) {
        res.status(400).json({ error: `Falta el campo: ${key}` })
        return
      }
    }

    const tipo = String(body.tipo)
    if (tipo !== 'foto' && tipo !== 'video' && tipo !== 'audio') {
      res.status(400).json({ error: 'tipo de media no válido' })
      return
    }

    await ensureStore()
    const mimeType = String(body.mimeType)
    const ext = extFromMime(mimeType, tipo)
    const safeId = String(body.id).replace(/[^a-zA-Z0-9_-]/g, '')
    const storedName = `${safeId}.${ext}`
    const filePath = path.join(MEDIA_DIR, storedName)
    const buffer = Buffer.from(String(body.dataBase64), 'base64')
    const minBytes = tipo === 'foto' ? 100 : tipo === 'audio' ? 100 : 500
    if (!buffer.length || buffer.length < minBytes) {
      res.status(400).json({
        error: `Archivo vacío o corrupto (${buffer.length} bytes). Vuelve a grabar/sincronizar.`,
      })
      return
    }
    await fs.writeFile(filePath, buffer)

    const url = `/api/media-files/${storedName}`
    const items = await readJson(MEDIAS_FILE)
    const idx = items.findIndex((item) => item.id === body.id)
    const record = {
      id: String(body.id),
      tipo,
      numeroEmpleado: String(body.numeroEmpleado).trim(),
      dia: String(body.dia),
      trabajoId: body.trabajoId ? String(body.trabajoId) : undefined,
      capturadoEn: String(body.capturadoEn),
      creadoEn: String(body.creadoEn),
      dispositivoId: String(body.dispositivoId),
      mimeType,
      fileName: String(body.fileName),
      url,
      recibidoEn: new Date().toISOString(),
    }

    if (idx >= 0) {
      items[idx] = { ...items[idx], ...record }
    } else {
      items.push(record)
    }

    await writeJson(MEDIAS_FILE, items)
    res.status(201).json(record)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo guardar la media' })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] UROVESA fichaje escuchando en http://0.0.0.0:${PORT}`)
})
