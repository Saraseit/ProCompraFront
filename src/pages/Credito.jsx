import { useState, useEffect, useCallback } from 'react'
import api from '../api'
import { money, fechaCorta, mensajeError } from '../constants'
import { useToast } from '../ui/feedback-context'
import { C } from '../ui/tema'
import ModalOrden from './orden/ModalOrden'
import { descargarPdfOrden } from './orden/archivos'

const SITUACION = {
  vencida:    { label: 'Vencida',    color: 'var(--pc-rojo)',        bg: 'var(--pc-rojo-bg)' },
  por_vencer: { label: 'Por vencer', color: 'var(--pc-ambar-texto)', bg: 'var(--pc-ambar-bg)' },
  vigente:    { label: 'Al corriente', color: 'var(--pc-verde)',     bg: 'var(--pc-verde-bg)' },
  sin_plazo:  { label: 'Sin plazo',  color: 'var(--pc-gris-2)',      bg: 'var(--pc-superficie-3)' },
  liquidada:  { label: 'Liquidada',  color: C.aqua,                  bg: C.aquaBg },
}

const ORIGEN = { factura: 'factura', recepcion: 'recepción', orden: 'orden' }

function cuandoVence(m) {
  if (m.situacion === 'liquidada' || m.dias == null) return null
  if (m.dias === 0) return 'vence hoy'
  if (m.dias < 0) return `hace ${-m.dias} día${m.dias === -1 ? '' : 's'}`
  return `en ${m.dias} día${m.dias === 1 ? '' : 's'}`
}

function Chip({ situacion }) {
  const e = SITUACION[situacion] || SITUACION.sin_plazo
  return <span style={{ ...s.chip, color: e.color, background: e.bg }}>{e.label}</span>
}

export default function Credito({ usuario, onCambio }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [abiertos, setAbiertos] = useState({})
  const [verLiquidadas, setVerLiquidadas] = useState(false)
  const [ordenAbierta, setOrdenAbierta] = useState(null)
  const toast = useToast()

  const cargar = useCallback(async () => {
    try {
      const res = await api.get('/reportes/credito')
      setDatos(res.data)
      setError('')
      // De entrada se despliegan los proveedores con algo vencido (o todos, si son pocos).
      const pocos = res.data.proveedores.length <= 3
      setAbiertos((a) => Object.keys(a).length ? a
        : Object.fromEntries(res.data.proveedores.filter((p) => pocos || p.vencido > 0).map((p) => [p.id, true])))
    } catch (e) {
      setError('No se pudo cargar el estado de cuenta: ' + mensajeError(e))
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(cargar, 300)
    return () => clearTimeout(timer)
  }, [cargar])

  async function abrirOrden(id) {
    try {
      const res = await api.get(`/ordenes/${id}`)
      setOrdenAbierta(res.data)
    } catch (e) {
      toast('Error al abrir orden: ' + mensajeError(e), 'error')
    }
  }

  async function refrescarOrden(id) {
    const res = await api.get(`/ordenes/${id}`)
    setOrdenAbierta(res.data)
    cargar()
    if (onCambio) onCambio()
  }

  async function descargarPdf(orden) {
    try {
      await descargarPdfOrden(orden)
    } catch (e) {
      toast('No se pudo generar el PDF: ' + mensajeError(e), 'error')
    }
  }

  if (error) return <div style={s.error}>{error}</div>
  if (!datos) return <div style={s.msg}>Cargando estado de cuenta...</div>

  const { totales } = datos
  const proveedores = verLiquidadas ? datos.proveedores : datos.proveedores.filter((p) => p.saldo > 0)
  const sinPlazo = datos.proveedores.filter((p) => p.saldo > 0 && p.dias_credito == null)
  const alternar = (id) => setAbiertos((a) => ({ ...a, [id]: !a[id] }))

  const kpis = [
    { titulo: 'Saldo por pagar', valor: money(totales.saldo), pie: `${totales.ordenes_abiertas} orden(es) abiertas` },
    { titulo: 'Vencido', valor: money(totales.vencido), pie: `${totales.ordenes_vencidas} orden(es) vencidas`,
      color: totales.vencido > 0 ? 'var(--pc-rojo)' : null },
    { titulo: `Vence en ${datos.dias_por_vencer} días`, valor: money(totales.por_vencer), pie: 'Programa estos pagos',
      color: totales.por_vencer > 0 ? 'var(--pc-ambar-texto)' : null },
  ]

  return (
    <div>
      <div style={s.header}>
        <div>
          <h2 style={s.h2}>Crédito con proveedores</h2>
          <p style={s.help}>
            Saldo y vencimientos de las compras a crédito. Abre una orden para registrar un abono.
          </p>
        </div>
        <label style={s.toggle}>
          <input type="checkbox" checked={verLiquidadas} onChange={(e) => setVerLiquidadas(e.target.checked)} />
          Mostrar liquidadas
        </label>
      </div>

      <div style={s.kpis}>
        {kpis.map((k) => (
          <div key={k.titulo} style={s.kpi}>
            <div style={{ ...s.kpiV, ...(k.color ? { color: k.color } : {}) }}>{k.valor}</div>
            <div style={s.kpiT}>{k.titulo}</div>
            <div style={s.kpiL}>{k.pie}</div>
          </div>
        ))}
      </div>

      {sinPlazo.length > 0 && (
        <div style={s.aviso}>
          <strong>Sin días de crédito:</strong> {sinPlazo.map((p) => p.nombre).join(', ')}.{' '}
          Sin plazo no se puede calcular cuándo vence. Captúralo en Proveedores → Editar → Días de crédito.
        </div>
      )}

      {proveedores.length === 0 && (
        <div style={s.empty}>
          <div style={s.emptyTitulo}>No hay saldos pendientes.</div>
          <div>
            {datos.proveedores.length
              ? 'Todas las compras a crédito están liquidadas.'
              : 'Aquí aparecerán las órdenes que contabilidad autorice como crédito del proveedor.'}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {proveedores.map((p) => {
          const abierto = !!abiertos[p.id]
          const ordenes = verLiquidadas ? p.ordenes : p.ordenes.filter((m) => m.situacion !== 'liquidada')
          return (
            <div key={p.id} style={{ ...s.card, ...(p.vencido > 0 ? { borderLeftColor: 'var(--pc-rojo)' } : {}) }}>
              <button style={s.cardHead} onClick={() => alternar(p.id)} aria-expanded={abierto}>
                <div style={{ minWidth: 0 }}>
                  <div style={s.prov}>{p.nombre}</div>
                  <div style={s.meta}>
                    {p.rfc && <span style={{ fontFamily: 'monospace' }}>{p.rfc} · </span>}
                    {p.dias_credito == null
                      ? <span style={{ color: 'var(--pc-ambar-texto)' }}>sin días de crédito</span>
                      : `${p.dias_credito} días de crédito`}
                    {p.proximo_vencimiento && ` · próximo vencimiento ${fechaCorta(p.proximo_vencimiento)}`}
                  </div>
                </div>
                <div style={s.cifras}>
                  {p.vencido > 0 && (
                    <div style={s.cifra}>
                      <div style={{ ...s.cifraV, color: 'var(--pc-rojo)' }}>{money(p.vencido)}</div>
                      <div style={s.cifraT}>vencido</div>
                    </div>
                  )}
                  <div style={s.cifra}>
                    <div style={s.cifraV}>{money(p.saldo)}</div>
                    <div style={s.cifraT}>saldo</div>
                  </div>
                  <span style={{ ...s.flecha, transform: abierto ? 'rotate(90deg)' : 'none' }}>›</span>
                </div>
              </button>

              {abierto && (
                <div style={s.tablaWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Orden</th>
                        <th style={s.th}>Factura</th>
                        <th style={s.th}>Plazo desde</th>
                        <th style={s.th}>Vence</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Importe</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Abonos</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Saldo</th>
                        <th style={s.th}>Situación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordenes.map((m) => (
                        <tr key={m.id}>
                          <td style={s.td}>
                            <button style={s.folio} onClick={() => abrirOrden(m.id)}>#{m.folio}</button>
                          </td>
                          <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12 }}>{m.factura || '—'}</td>
                          <td style={s.td}>
                            {fechaCorta(m.fecha_base)}
                            <div style={s.sub}>{ORIGEN[m.origen_base]}</div>
                          </td>
                          <td style={s.td}>
                            {m.vencimiento ? fechaCorta(m.vencimiento) : '—'}
                            {cuandoVence(m) && <div style={s.sub}>{cuandoVence(m)}</div>}
                          </td>
                          <td style={{ ...s.td, textAlign: 'right' }}>{money(m.importe)}</td>
                          <td style={{ ...s.td, textAlign: 'right' }}
                            title={m.pagos.map((pg) => `${fechaCorta(pg.fecha_pago)} · ${money(pg.monto)}${pg.referencia ? ` · ${pg.referencia}` : ''}`).join('\n')}>
                            {m.pagado > 0 ? money(m.pagado) : '—'}
                            {m.pagos.length > 0 && <div style={s.sub}>{m.pagos.length} abono{m.pagos.length === 1 ? '' : 's'}</div>}
                          </td>
                          <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>{money(m.saldo)}</td>
                          <td style={s.td}><Chip situacion={m.situacion} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={s.tf} colSpan={4}>Total</td>
                        <td style={{ ...s.tf, textAlign: 'right' }}>{money(p.cargos)}</td>
                        <td style={{ ...s.tf, textAlign: 'right' }}>{money(p.abonos)}</td>
                        <td style={{ ...s.tf, textAlign: 'right' }}>{money(p.saldo)}</td>
                        <td style={s.tf} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {ordenAbierta && (
        <ModalOrden
          key={ordenAbierta.id}
          orden={ordenAbierta}
          usuario={usuario}
          onClose={() => setOrdenAbierta(null)}
          onCambio={() => refrescarOrden(ordenAbierta.id)}
          onDescargarPdf={descargarPdf}
        />
      )}
    </div>
  )
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, gap: 16, flexWrap: 'wrap' },
  h2: { fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--pc-tinta)' },
  help: { fontSize: 13, color: 'var(--pc-gris)', marginTop: 4 },
  msg: { padding: 40, color: 'var(--pc-gris)' },
  error: { padding: 20, background: 'var(--pc-rojo-bg)', color: 'var(--pc-rojo)', borderRadius: 8 },
  toggle: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--pc-gris-2)', cursor: 'pointer' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 },
  kpi: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 12, padding: 18 },
  kpiV: { fontSize: 24, fontWeight: 700, color: 'var(--pc-tinta)', lineHeight: 1.1 },
  kpiT: { fontSize: 13.5, fontWeight: 600, color: 'var(--pc-tinta)', marginTop: 8 },
  kpiL: { fontSize: 12, color: 'var(--pc-gris)', marginTop: 3 },
  aviso: { background: 'var(--pc-ambar-bg)', border: '1px solid var(--pc-ambar-borde)', color: 'var(--pc-ambar-texto)',
           padding: '11px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.45, marginBottom: 14 },
  empty: { padding: '40px 20px', textAlign: 'center', color: 'var(--pc-gris)', fontSize: 14,
           background: 'var(--pc-superficie)', border: '1px dashed var(--pc-borde)', borderRadius: 12 },
  emptyTitulo: { fontSize: 16, fontWeight: 600, color: 'var(--pc-tinta)', marginBottom: 6 },
  card: { background: 'var(--pc-superficie)', borderRadius: 12, overflow: 'hidden',
          borderTop: '1px solid var(--pc-borde)', borderRight: '1px solid var(--pc-borde)',
          borderBottom: '1px solid var(--pc-borde)', borderLeft: `4px solid ${C.aqua}` },
  cardHead: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14,
              flexWrap: 'wrap', padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer',
              font: 'inherit', color: 'inherit', textAlign: 'left' },
  prov: { fontWeight: 600, fontSize: 15, color: 'var(--pc-tinta)' },
  meta: { fontSize: 12, color: 'var(--pc-gris)', marginTop: 3 },
  cifras: { display: 'flex', alignItems: 'center', gap: 18, marginLeft: 'auto' },
  cifra: { textAlign: 'right' },
  cifraV: { fontSize: 17, fontWeight: 700, color: 'var(--pc-tinta)' },
  cifraT: { fontSize: 11, color: 'var(--pc-gris)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  flecha: { fontSize: 22, color: 'var(--pc-gris-3)', transition: 'transform 0.15s', lineHeight: 1 },
  tablaWrap: { overflowX: 'auto', borderTop: '1px solid var(--pc-borde)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 },
  th: { textAlign: 'left', padding: '9px 12px', background: 'var(--pc-superficie-3)', color: 'var(--pc-gris-2)',
        fontWeight: 600, fontSize: 11, textTransform: 'uppercase' },
  td: { padding: '9px 12px', borderBottom: '1px solid var(--pc-linea)', verticalAlign: 'top' },
  tf: { padding: '9px 12px', fontWeight: 700, background: 'var(--pc-superficie-2)' },
  sub: { fontSize: 11, color: 'var(--pc-gris-3)', marginTop: 2 },
  folio: { border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: C.aqua,
           cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 },
  chip: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' },
}
