import { useState, useEffect } from 'react'
import {
  Clock, CheckCircle2, TrendingUp, Truck, FileSearch, Receipt, AlertTriangle, ChevronRight,
} from 'lucide-react'
import api from '../api'
import { money, mensajeError } from '../constants'
import { Esqueleto } from '../ui/Carga'

const nombreMes = (iso) => {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

const saludo = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

// Tono de cada tarjeta: color del ícono y de su fondo.
const TONOS = {
  ambar: ['var(--pc-e-autorizacion)', 'var(--pc-e-autorizacion-bg)'],
  aqua:  ['var(--pc-aqua)', 'var(--pc-aqua-bg)'],
  azul:  ['var(--pc-e-pagada)', 'var(--pc-e-pagada-bg)'],
  morado: ['var(--pc-e-recoleccion)', 'var(--pc-e-recoleccion-bg)'],
  verde: ['var(--pc-verde)', 'var(--pc-verde-bg)'],
  rojo:  ['var(--pc-rojo)', 'var(--pc-rojo-bg)'],
  acento: ['var(--pc-acento)', 'var(--pc-acento-bg)'],
}

export default function Inicio({ usuario, onIr }) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/reportes/dashboard')
        setDatos(res.data)
      } catch (e) {
        setError('No se pudo cargar el resumen: ' + mensajeError(e))
      }
      setCargando(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  if (error) return <div style={s.error}>{error}</div>

  const mes = datos ? nombreMes(datos.mes) : ''
  const montos = !!datos?.incluye_montos

  const atencion = [
    {
      valor: datos?.en_autorizacion, icono: Clock, tono: 'ambar',
      titulo: 'En autorización', pie: 'Esperan visto bueno de contabilidad',
      ir: () => onIr('ordenes', 'autorizacion'),
    },
    {
      valor: datos?.por_comprobar, icono: FileSearch, tono: 'aqua',
      titulo: 'Por comprobar', pie: 'Recibidas, falta ticket o factura',
      ir: () => onIr('ordenes', 'comprobacion'),
    },
    ...(montos ? [{
      valor: datos?.facturas_pendientes, icono: Receipt, tono: 'acento',
      titulo: 'Facturas sin vincular', pie: 'XML que esperan su orden',
      ir: () => onIr('facturas'),
    }, {
      valor: money(datos?.credito_vencido), activo: (datos?.credito_ordenes_vencidas || 0) > 0,
      icono: AlertTriangle, tono: 'rojo',
      titulo: 'Crédito vencido',
      pie: datos?.credito_ordenes_vencidas
        ? `${datos.credito_ordenes_vencidas} orden(es) sin pagar a tiempo`
        : 'Ninguna compra a crédito vencida',
      ir: () => onIr('credito'),
    }] : []),
  ]

  const mesActual = [
    ...(montos ? [{
      valor: money(datos?.gasto_mes), icono: TrendingUp, tono: 'verde', destacada: true,
      titulo: 'Gasto del mes', pie: `Pagos realizados en ${mes}`,
      ir: () => onIr('control'),
    }] : []),
    {
      valor: datos?.pagadas_mes, icono: CheckCircle2, tono: 'azul',
      titulo: 'Órdenes pagadas', pie: `Con pago registrado en ${mes}`,
      ir: () => onIr('ordenes', 'pagada'),
    },
    {
      valor: datos?.por_recolectar, icono: Truck, tono: 'morado',
      titulo: 'Por recolectar', pie: 'Pagadas y pendientes de recibir',
      ir: () => onIr('ordenes', 'recoleccion'),
    },
  ]

  const nombre = (usuario.nombre || '').split(' ')[0]
  const fecha = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <div style={s.cabecera}>
        <div style={s.fecha}>{fecha}</div>
        <h2 style={s.h2}>{saludo()}, {nombre}</h2>
        <p style={s.help}>Esto es lo que está pasando con las compras.</p>
      </div>

      <Grupo titulo="Requiere atención" tarjetas={atencion} cargando={cargando} resaltar />
      <Grupo titulo={`Este mes${mes ? ` · ${mes}` : ''}`} tarjetas={mesActual} cargando={cargando} />
    </div>
  )
}

function Grupo({ titulo, tarjetas, cargando, resaltar }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h3 style={s.grupo}>{titulo}</h3>
      <div style={s.kpis} className="pc-kpis">
        {tarjetas.map((t) => {
          const [color, fondo] = TONOS[t.tono]
          const Icono = t.icono
          const pendiente = resaltar && (t.activo ?? (typeof t.valor === 'number' && t.valor > 0))
          return (
            <button key={t.titulo} className="pc-elevable pc-kpi" onClick={t.ir}
              style={{ ...s.kpi, ...(pendiente ? { borderColor: `color-mix(in srgb, ${color} 35%, var(--pc-borde))` } : {}) }}>
              <div style={s.kpiArriba}>
                <span style={{ ...s.kpiIcono, color, background: fondo }}><Icono size={17} strokeWidth={2} /></span>
                <ChevronRight size={16} className="pc-kpi-flecha" />
              </div>
              {cargando
                ? <Esqueleto ancho="45%" alto={26} style={{ margin: '4px 0 6px' }} />
                : <div className="pc-kpi-valor" style={{ ...s.kpiV, ...(t.destacada ? { fontSize: 28 } : {}) }}>{t.valor ?? 0}</div>}
              <div style={s.kpiT}>{t.titulo}</div>
              <div style={s.kpiL}>{t.pie}</div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

const s = {
  cabecera: { marginBottom: 26 },
  fecha: { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--pc-aqua)' },
  h2: { fontSize: 26, fontWeight: 700, margin: '4px 0 0', color: 'var(--pc-tinta)', letterSpacing: '-0.025em' },
  help: { fontSize: 14, color: 'var(--pc-gris)', marginTop: 4 },
  error: { padding: 20, background: 'var(--pc-rojo-bg)', color: 'var(--pc-rojo)', borderRadius: 10 },
  grupo: { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em',
           color: 'var(--pc-gris)', margin: '0 0 12px' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 },
  kpi: { textAlign: 'left', background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 14,
         padding: '16px 18px 18px', cursor: 'pointer', font: 'inherit', color: 'inherit',
         boxShadow: 'var(--pc-sombra-1)', display: 'flex', flexDirection: 'column' },
  kpiArriba: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  kpiIcono: { width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center' },
  kpiV: { fontSize: 26, fontWeight: 700, color: 'var(--pc-tinta)', lineHeight: 1.1, letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums' },
  kpiT: { fontSize: 13.5, fontWeight: 600, color: 'var(--pc-tinta)', marginTop: 8 },
  kpiL: { fontSize: 12.5, color: 'var(--pc-gris)', marginTop: 2 },
}
