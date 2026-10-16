export interface Operario {
  codDelegacion: number
  codOperario: number
  nombreApellidos: string
  /** CHAR(8) con ceros a la izquierda — código de barras de la tarjeta */
  codTarjetaPresencia: string
}

export interface OrdenReparacion {
  tipoOrden: string
  codigoOrden: number
  nombre: string
  articuloAsociado: string
}
