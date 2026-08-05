import { useState, useEffect } from 'react'
import api from '../api'

const money = (n) => (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" })

export default function Control() {
  const [ordenes, setOrdenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => { cargarDatos() }, 300)
    return () => clearTimeout(timer)
  }, [])

  async function cargarDatos() {
    setCargando(true)
    setError('')
    try {
      // Traer solo órdenes pagadas, en recolección o cerradas
      const [pagadas, recoleccion, cerradas] = await Promise.all([
        api.get('/ordenes?estado=pagada'),
        api.get('/ordenes?estado=recoleccion'),
        api.get('/ordenes?estado=cerrada'),
      ])
      setOrdenes([...pagadas.data, ...recoleccion.data, ...cerradas.data])
    } catch (e) {
      setError('Error al cargar datos: ' + (e.response?.data?.detail || e.message))
    }
    setCargando(false)
  }

  const total = ordenes.reduce((s, o) => s + (o.total || 0), 0)
  const promedio = ordenes.length ? total / ordenes.length : 0

  // Agrupar por proveedor
  const porProveedor = {}
  ordenes.forEach((o) => {
    const nombre = o.proveedor?.nombre || 'Sin proveedor'
    porProveedor[nombre] = (porProveedor[nombre] || 0) + (o.total || 0)
  })
  const maxGasto = Math.max(1, ...Object.values(porProveedor))
  const proveedoresOrdenados = Object.entries(porProveedor).sort((a, b) => b[1] - a[1])

  if (error) return <div style={s.error}>{error}</div>

  return (
    <div>
      <h2 style={s.h2}>Control de gastos</h2>

      {cargando && <div style={s.msg}>Cargando...</div>}

      {/* KPIs */}
      <div style={s.kpis}>
        <div style={s.kpi}>
          <div style={s.kpiV}>{ordenes.length}</div>
          <div style={s.kpiL}>Órdenes pagadas</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiV}>{money(total)}</div>
          <div style={s.kpiL}>Gasto total (c/IVA)</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiV}>{money(promedio)}</div>
          <div style={s.kpiL}>Ticket promedio</div>
        </div>
      </div>

      {/* Gasto por proveedor */}
      <div style={{...s.box, marginTop:20}}>
        <div style={s.boxTitle}>Gasto por proveedor</div>
        {proveedoresOrdenados.length === 0 && !cargando && (
          <div style={s.empty}>Aún no hay pagos registrados.</div>
        )}
        {proveedoresOrdenados.map(([nombre, monto]) => (
          <div key={nombre} style={s.barRow}>
            <div style={s.barLabel} title={nombre}>{nombre}</div>
            <div style={s.barTrack}>
              <div style={{ ...s.barFill, width: `${(monto / maxGasto) * 100}%` }} />
            </div>
            <div style={s.barVal}>{money(monto)}</div>
          </div>
        ))}
      </div>

      {/* Tabla detalle */}
      <div style={{...s.box, marginTop:18}}>
        <div style={s.boxTitle}>Detalle de gasto ejercido</div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Folio</th>
              <th style={s.th}>Proveedor</th>
              <th style={s.th}>Tipo pago</th>
              <th style={s.th}>Estado</th>
              <th style={{...s.th, textAlign:'right'}}>Total</th>
              <th style={s.th}>Recolección</th>
            </tr>
          </thead>
          <tbody>
            {ordenes.length === 0 && !cargando && (
              <tr><td colSpan={6} style={s.empty}>Sin registros.</td></tr>
            )}
            {ordenes.map((o) => (
              <tr key={o.id}>
                <td style={{...s.td, fontFamily:'monospace'}}>#{o.folio}</td>
                <td style={s.td}>{o.proveedor?.nombre || '—'}</td>
                <td style={s.td}>{o.tipo_pago?.replace(/_/g, ' ') || '—'}</td>
                <td style={s.td}>{o.estado}</td>
                <td style={{...s.td, textAlign:'right', fontWeight:600}}>{money(o.total)}</td>
                <td style={s.td}>
                  {o.estado === 'cerrada' ? '✓ Recibido' : 'Pendiente'}
                </td>
              </tr>
            ))}
          </tbody>
          {ordenes.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} style={{...s.td, textAlign:'right', fontWeight:700}}>Total</td>
                <td style={{...s.td, textAlign:'right', fontWeight:700}}>{money(total)}</td>
                <td style={s.td}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

const s = {
  h2: { fontSize:22, fontWeight:600, margin:'0 0 16px', color:'#26241D' },
  msg: { padding:20, color:'#8A8577' },
  error: { padding:20, background:'#F7DEDE', color:'#B03A3A', borderRadius:8 },
  empty: { textAlign:'center', color:'#A8A395', padding:26 },
  kpis: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 },
  kpi: { background:'#fff', border:'1px solid #E3DFD5', borderRadius:12, padding:20 },
  kpiV: { fontSize:26, fontWeight:700, color:'#26241D' },
  kpiL: { fontSize:12, color:'#8A8577', marginTop:4 },
  box: { border:'1px solid #E3DFD5', borderRadius:12, padding:16, background:'#fff' },
  boxTitle: { fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em',
              color:'#8A8577', fontWeight:600, marginBottom:14 },
  barRow: { display:'flex', alignItems:'center', gap:12, padding:'6px 0' },
  barLabel: { width:200, fontSize:13, fontWeight:500, overflow:'hidden',
              textOverflow:'ellipsis', whiteSpace:'nowrap' },
  barTrack: { flex:1, height:10, background:'#EEEBE3', borderRadius:6, overflow:'hidden' },
  barFill: { height:'100%', background:'#C4462B', borderRadius:6, transition:'width 0.3s' },
  barVal: { width:120, textAlign:'right', fontSize:13, fontWeight:600, fontFamily:'monospace' },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { textAlign:'left', padding:'10px 8px', background:'#F4F1EA', color:'#6B6659',
        fontWeight:600, fontSize:11, textTransform:'uppercase' },
  td: { padding:'10px 8px', borderBottom:'1px solid #EFEBE2' },
}
