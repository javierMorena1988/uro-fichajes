# UROVESA · Presencia PDA + fabricación + media

PWA (React + Vite) + API local (Express) para terminal compartido de presencia en Android/PDA.

- Identificación por **código de tarjeta** (8 dígitos / código de barras)
- **Entrada / Salida** en un solo registro (con minutos)
- **Fabricación** contra una o varias órdenes de reparación
- Adjuntos **foto / audio / vídeo** (1 min) al trabajo en curso
- Offline en **IndexedDB** + sync a API en la red

## Arranque (PC / máquina cliente)

```bash
npm install
npm run dev
```

- Frontend PWA (HTTPS): puerto `5173`
- API: puerto `8787`

En producción de pruebas en LAN, deja ambos procesos en marcha y abre en la PDA:

`https://IP_DEL_PC:5173`

(Acepta el certificado autofirmado. Misma WiFi. Firewall: permite Node en red privada.)

### Solo API (si el front ya está servido aparte)

```bash
npm run server
```

### Build estático del front

```bash
npm run build
npm run preview
```

## Datos demo

Maestros en `server/data/operarios.json` y `ordenes-reparacion.json`.  
Tarjeta de prueba: `00161220`.

Los movimientos (`presencias`, `trabajos`, `medias`, ficheros) se generan en runtime y no van al git.

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Web + API juntos |
| `npm run dev:web` | Solo Vite |
| `npm run dev:api` / `npm run server` | Solo API |
| `npm run build` | Build producción |
