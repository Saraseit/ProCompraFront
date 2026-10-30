// Valores del enum metodo_pago en Postgres. Cualquier valor fuera de esta lista
// es rechazado por la base, así que no agregar opciones aquí sin migrar antes.
export const METODOS_PAGO = [
  ['transferencia',   'Transferencia'],
  ['efectivo',        'Efectivo'],
  ['tarjeta_debito',  'Tarjeta de débito'],
  ['tarjeta_credito', 'Tarjeta de crédito'],
  ['credito',         'Crédito del proveedor'],
]

export const etiquetaMetodo = (valor) =>
  METODOS_PAGO.find(([k]) => k === valor)?.[1] || '—'

// Formas en que contabilidad entrega dinero o tarjeta a quien hará la compra.
export const METODOS_CON_ENTREGA = ['efectivo', 'tarjeta_debito', 'tarjeta_credito']

// Quién opera las compras (almacén y compras conviven) y quién maneja el dinero.
// Contabilidad (pagos) tiene los permisos de admin salvo gestionar usuarios.
// El backend aplica las mismas reglas; aquí solo deciden qué botones se muestran.
export const esAdmin = (rol) => ['admin', 'pagos'].includes(rol)
export const esOperacion = (rol) => ['admin', 'pagos', 'compras', 'almacen'].includes(rol)
export const esContabilidad = (rol) => ['admin', 'pagos'].includes(rol)
export const ROLES = {
  admin: 'Administrador',
  pagos: 'Contabilidad',
  compras: 'Compras',
  almacen: 'Almacén',
}
export const etiquetaRol = (rol) => ROLES[rol] || rol

export const veFacturas = (rol) => ['admin', 'compras', 'pagos'].includes(rol)

export const TIPOS_ADJUNTO = [
  ['cotizacion',       'Cotización'],
  ['comprobante_pago', 'Comprobante de pago'],
  ['ticket',           'Ticket'],
  ['factura',          'Factura (PDF o XML)'],
  ['otro',             'Otro documento'],
]

export const etiquetaAdjunto = (valor) =>
  (TIPOS_ADJUNTO.find(([k]) => k === valor)?.[1] || 'Documento').replace(' (PDF o XML)', '')

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
  comprobacion: estado('Por comprobar',   'comprobacion'),
  cerrada:      estado('Cerrada',         'cerrada'),
  rechazada:    estado('Cancelada',       'rechazada'),
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
    ? new Date(String(valor).length > 10 ? valor : `${valor}T00:00:00`).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—'

export const PROVEEDOR_VACIO = {
  nombre: '', rfc: '', correo: '', telefono: '', direccion: '', cuenta_bancaria: '', dias_credito: '',
}

export const hoy = () => isoLocal(new Date())

export const tamanoArchivo = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Fecha local en ISO (YYYY-MM-DD). toISOString() usa UTC y después de las
// 6 p. m. en México ya devuelve el día siguiente.
export const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const UNIDADES = ['PZA', 'CAJA', 'LITRO', 'KILO', 'CUBETA', 'BOTE', 'CORTE', 'GALON', 'MTR', 'ROLLO', 'SERVICIO', 'PAQUETE']

// Mismo cálculo que el backend (app/utils/ajustes.py): IVA 16% sobre el subtotal.
export const totalConIva = (partidas) => {
  const subtotal = partidas.reduce((s, p) => s + (Number(p.cantidad) || 0) * (Number(p.precio_unitario) || 0), 0)
  return Math.round(subtotal * 1.16 * 100) / 100
}
