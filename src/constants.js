// Valores del enum metodo_pago en Postgres. Cualquier valor fuera de esta lista
// es rechazado por la base, así que no agregar opciones aquí sin migrar antes.
export const METODOS_PAGO = [
  ['transferencia',   'Transferencia'],
  ['tarjeta_credito', 'Tarjeta de crédito'],
  ['efectivo',        'Efectivo'],
]

export const etiquetaMetodo = (valor) =>
  METODOS_PAGO.find(([k]) => k === valor)?.[1] || '—'

export const ESTADOS = {
  borrador:     { label: 'Borrador',        color: '#8A8577', bg: '#EEEBE3' },
  autorizacion: { label: 'En autorización', color: '#B4791F', bg: '#FBF0DA' },
  autorizada:   { label: 'Autorizada',      color: '#2E6B4F', bg: '#DCEEE4' },
  pagada:       { label: 'Pagada',          color: '#1F5AA6', bg: '#DBE7F7' },
  recoleccion:  { label: 'Por recolectar',  color: '#8A3FA6', bg: '#EEE1F5' },
  cerrada:      { label: 'Cerrada',         color: '#5A5648', bg: '#E4E1D8' },
  rechazada:    { label: 'Rechazada',       color: '#B03A3A', bg: '#F7DEDE' },
}

export const etiquetaEstado = (valor) => ESTADOS[valor]?.label || valor || '—'

// FastAPI devuelve `detail` como texto en los HTTPException y como arreglo de
// objetos en los errores de validación de Pydantic: hay que aplanar los dos.
export const mensajeError = (e) => {
  const detalle = e?.response?.data?.detail
  if (typeof detalle === 'string') return detalle
  if (Array.isArray(detalle)) {
    const partes = detalle
      .map((d) => {
        const campo = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null
        return campo ? `${campo}: ${d.msg}` : d.msg
      })
      .filter(Boolean)
    if (partes.length) return partes.join(' · ')
  }
  return e?.message || 'Error desconocido'
}

export const money = (n) =>
  (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export const fechaCorta = (valor) =>
  valor
    ? new Date(`${valor}T00:00:00`).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—'

export const PROVEEDOR_VACIO = {
  nombre: '', rfc: '', correo: '', telefono: '', direccion: '', cuenta_bancaria: '',
}
