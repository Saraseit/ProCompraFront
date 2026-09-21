// Valores del enum metodo_pago en Postgres. Cualquier valor fuera de esta lista
// es rechazado por la base, así que no agregar opciones aquí sin migrar antes.
export const METODOS_PAGO = [
  ['transferencia',   'Transferencia'],
  ['tarjeta_credito', 'Tarjeta de crédito'],
  ['efectivo',        'Efectivo'],
]

export const etiquetaMetodo = (valor) =>
  METODOS_PAGO.find(([k]) => k === valor)?.[1] || '—'

// Los colores de estado son variables CSS: en modo claro valen los tonos de marca
// (borrador #8A8577, autorización #B4791F, ...) y en oscuro sus variantes aclaradas.
const estado = (label, clave) => ({
  label, color: `var(--pc-e-${clave})`, bg: `var(--pc-e-${clave}-bg)`,
})

export const ESTADOS = {
  borrador:     estado('Borrador',        'borrador'),
  autorizacion: estado('En autorización', 'autorizacion'),
  autorizada:   estado('Autorizada',      'autorizada'),
  pagada:       estado('Pagada',          'pagada'),
  recoleccion:  estado('Por recolectar',  'recoleccion'),
  cerrada:      estado('Cerrada',         'cerrada'),
  rechazada:    estado('Rechazada',       'rechazada'),
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
