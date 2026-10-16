# Registro de cambios · UROVESA (para imputación)

Documento interno para anotar el trabajo entregado y poder imputar horas/conceptos al cliente.

> Horas = tiempo real de Javier (definición con cliente, prueba, ajustes, revisión con IA). No se imputa el volumen de código generado por la herramienta.

---

## Resumen

### Ya hecho (demo funcional local PC + Android) — horas reales

| Bloque | Qué incluye | Horas |
|--------|-------------|------:|
| Arranque + arquitectura | PWA React/Vite, API local, IndexedDB, sync, HTTPS por IP | **1** |
| Fichaje inicial | Login demo, Entrada/Salida, offline + sync | **1** |
| Fotos | Captura, operario+día, sync, ver en PC | **1,5** |
| Audios | Grabación, límite 1 min + cuenta atrás, sync | **1,5** |
| Vídeos | Grabación in-app, preview, límite 1 min + cuenta atrás, sync | **1,5** |
| UX / bugs / estabilidad | Listados, filtro fechas, “Sin servidor”, IP móvil, preview vídeo, sync | **3** |
| Maestros ERP (demo) | Tablas Operarios + Órdenes reparación (SQL/JSON/API), fix sync vídeo corrupto | **1** |
| **Flujo PDA estilo PTV** | Tarjeta 8 dígitos, presencia 1 registro, fabricación OR multi, adjuntos a trabajo, retomar OR, sync maestros | **4** |
| **Total trabajado** | | **14,5** |

Fechas: 08/10 (**2 h**) · 09/10 (**4,5 h**) · 13/10 (**4 h**) · 14/10 (**4 h**).

### Qué queda (según alcance) — estimación

| Escenario | Contenido | Horas |
|-----------|-----------|------:|
| A · Cerrar demo | Checklist cliente, pulido UI PDA, README breve | **2** |
| B · **Subida a productivo** | Despliegue (VM/IIS/Node), HTTPS real, variables entorno, backup media, prueba sync en su red | **8** |
| C · Producción usable | Auth real / maestros vivos desde ERP, destino storage/BD, logs, pruebas | **24** |
| D · Vídeo robusto *(opcional)* | OPFS, upload por trozos, cuotas, reintentos | **12** |
| E · Consulta histórica *(propuesta, no pedida)* | Ver trabajos/adjuntos del día en PDA o PC | **3** |

> B–E son estimaciones (dependen del entorno y de lo que definan auth/storage/ERP).

Llevamos **14,5 h** de demo (fichaje + media + flujo PTV presencia/fabricación).  
Cerrar demo: **+2 h**.  
Subida a productivo: **+8 h (estimado)**.  
Producción usable: **+24 h (estimado)**.

---

## Historial de entregas

| Fecha | Bloque | Descripción | Estado |
|-------|--------|-------------|--------|
| 2026-10-08 | MVP Fichaje PWA | React/Vite PWA, login, fichaje, IndexedDB offline, sync, prueba Android | Entregado / demo OK |
| 2026-10-09 | Fase 2 · Media | Fotos, audios y vídeos (1 min + cuenta atrás), sync PC/móvil | Entregado / demo OK |
| 2026-10-13 | Estabilidad + maestros | Filtro fechas, servidor/IP, preview vídeo; Operarios/OR; fix sync vídeo | Entregado / demo OK |
| 2026-10-14 | Flujo PDA PTV | Identificación por tarjeta, presencia entrada/salida en 1 registro, fabricación multi-OR, adjuntos al trabajo, modal retomar OR | Entregado / demo OK |

---

## Pendiente (roadmap cliente)

1. ~~Demo fichaje + media offline/sync en local~~
2. ~~Flujo PDA presencia + fabricación + adjuntos (como PTV)~~
3. Cerrar demo / documentación breve / checklist con cliente
4. **Subida a productivo**
5. Destino definitivo storage / BD + maestros vivos ERP
6. Auth real (AD / ERP)
7. *(Propuesta)* Consulta histórica trabajos/adjuntos
8. *(Opcional)* Upload vídeo por trozos / OPFS

---

## Texto corto para imputar / informar

> UROVESA PDA — demo local PC+Android: PWA offline con sync a API en red. Identificación por código de tarjeta, presencia (entrada/salida en un solo registro con minutos), fabricación contra una o varias órdenes de reparación (cabecera/detalle), adjuntos foto/audio/vídeo al trabajo en curso, y modal para retomar la última OR. Maestros Operarios/OR cargados por sync. **14,5 h** reales de trabajo (08–14/10). Pendiente cierre demo (~2 h) y, si aplica, subida a productivo (~8 h est.).
