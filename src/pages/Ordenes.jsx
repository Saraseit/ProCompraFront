import { useState, useEffect } from 'react'
import api from '../api'
import { ESTADOS, money, fechaCorta, mensajeError } from '../constants'
import { useToast } from '../ui/feedback-context'
import { C } from '../ui/tema'
import ModalOrden, { Badge } from './orden/ModalOrden'

export default function Ordenes({ usuario, filtroInicial = '', onCambio }) {
  const [ordenes, setOrdenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState(filtroInicial)
  const [busqueda, setBusqueda] = useState('')
  const [buscadorActivo, setBuscadorActivo] = useState(false)
  const [ordenAbierta, setOrdenAbierta] = useState(null)
  const toast = useToast()

  async function cargarOrdenes() {
    setCargando(true)
    setError('')
    try {
      const url = filtro ? `/ordenes?estado=${filtro}` : '/ordenes'
      const res = await api.get(url)
      setOrdenes(res.data)
    } catch (e) {
      setError('Error al cargar órdenes: ' + mensajeError(e))
    }
    setCargando(false)
  }

  // El cambio de filtro se aplica con un respiro para no encadenar peticiones.
  useEffect(() => {
    const timer = setTimeout(() => { cargarOrdenes() }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro])

  async function abrirOrden(orden) {
    try {
      const res = await api.get(`/ordenes/${orden.id}`)
      setOrdenAbierta(res.data)
    } catch (e) {
      toast('Error al abrir orden: ' + mensajeError(e), 'error')
    }
  }

  async function refrescarOrden(ordenId) {
    const res = await api.get(`/ordenes/${ordenId}`)
    setOrdenAbierta(res.data)
    cargarOrdenes()
    if (onCambio) onCambio()
  }

  async function descargarPdf(orden) {
    try {
      const res = await api.get(`/ordenes/${orden.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `orden-${orden.folio}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      // Con responseType blob el cuerpo del error también llega como Blob.
      let detalle = ''
      if (e.response?.data instanceof Blob) {
        try { detalle = JSON.parse(await e.response.data.text()).detail } catch { detalle = '' }
      }
      toast('No se pudo generar el PDF: ' + (detalle || mensajeError(e)), 'error')
    }
  }

  const termino = busqueda.trim().toLowerCase()
  const visibles = termino
    ? ordenes.filter((o) =>
        String(o.folio).includes(termino) ||
        (o.proveedor?.nombre || '').toLowerCase().includes(termino) ||
        (o.partidas || []).some((p) => (p.concepto || '').toLowerCase().includes(termino))
      )
    : ordenes

  if (error) return <div style={s.error}>{error}</div>

  return (
    <div>
      <div style={s.header}>
        <div>
          <h2 style={s.h2}>Órdenes de compra</h2>
          <p style={s.help}>
            El folio es el número consecutivo que identifica cada orden ante el proveedor.
          </p>
        </div>
        <select style={s.select} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todas las activas</option>
          {Object.entries(ESTADOS).map(([k, v]) => (
            <option key={k} value={k}>
              {k === 'rechazada' ? 'Canceladas' : v.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ ...s.buscador, ...(buscadorActivo ? s.buscadorActivo : {}) }}>
        <span style={s.lupa} aria-hidden>⌕</span>
        <input
          style={s.buscadorInput}
          placeholder="Buscar por folio, proveedor o concepto..."
          value={busqueda}
          onFocus={() => setBuscadorActivo(true)}
          onBlur={() => setBuscadorActivo(false)}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {termino && (
          <>
            <span style={s.conteo}>
              {visibles.length} de {ordenes.length}
            </span>
            <button style={s.btnLimpiar} onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda">
              ✕
            </button>
          </>
        )}
      </div>

      {cargando && <div style={s.msg}>Cargando órdenes...</div>}

      <div style={s.grid}>
        {visibles.map((o) => (
          <button key={o.id}
            style={{ ...s.card, borderLeft: `4px solid ${(ESTADOS[o.estado] || ESTADOS.borrador).color}` }}
            onClick={() => abrirOrden(o)}>
            <div style={s.cardTop}>
              <span style={s.folioTag}>Folio #{o.folio}</span>
              <Badge estado={o.estado} />
            </div>
            <div style={s.prov}>{o.proveedor?.nombre || 'Sin proveedor'}</div>
            <div style={s.meta}>{fechaCorta(o.fecha)}</div>
            <div style={s.total}>{money(o.total)}</div>
            <div style={s.meta}>
              Creó: {o.creador?.nombre || '—'}
              {o.adjuntos?.[0]?.count > 0 && <span title="Documentos adjuntos"> · 📎 {o.adjuntos[0].count}</span>}
            </div>
            {o.estado === 'borrador' && o.motivo_devolucion && (
              <span style={s.devuelta}>Devuelta por contabilidad</span>
            )}
          </button>
        ))}
        {!cargando && visibles.length === 0 && (
          <div style={s.empty}>
            {termino ? (
              <>
                <div style={s.emptyTitulo}>Ninguna orden coincide con “{busqueda.trim()}”.</div>
                <button style={s.btnGhost} onClick={() => setBusqueda('')}>Limpiar búsqueda</button>
              </>
            ) : filtro ? (
              <>
                <div style={s.emptyTitulo}>No hay órdenes en este estado.</div>
                <button style={s.btnGhost} onClick={() => setFiltro('')}>Ver todas las activas</button>
              </>
            ) : (
              <>
                <div style={s.emptyTitulo}>No hay órdenes activas.</div>
                <div>Genera una desde Requerimientos seleccionando los artículos a comprar.</div>
              </>
            )}
          </div>
        )}
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
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-end',
            marginBottom:14, gap:16, flexWrap:'wrap' },
  h2: { fontSize:22, fontWeight:600, margin:0, color:'var(--pc-tinta)' },
  help: { fontSize:13, color:'var(--pc-gris)', marginTop:4, maxWidth:420 },
  msg: { padding:'0 0 12px', color:'var(--pc-gris)', fontSize:13 },
  error: { padding:20, background:'var(--pc-rojo-bg)', color:'var(--pc-rojo)', borderRadius:8 },
  empty: { gridColumn:'1 / -1', padding:'40px 20px', textAlign:'center', color:'var(--pc-gris)', fontSize:14,
           background:'var(--pc-superficie)', border:'1px dashed var(--pc-borde)', borderRadius:12 },
  emptyTitulo: { fontSize:16, fontWeight:600, color:'var(--pc-tinta)', marginBottom:10 },
  select: { border:'1px solid var(--pc-borde)', borderRadius:8, padding:'9px 11px', fontSize:14, background:'var(--pc-superficie)' },
  buscador: { display:'flex', alignItems:'center', gap:10, background:'var(--pc-superficie)',
              borderWidth:1, borderStyle:'solid', borderColor:'var(--pc-borde)',
              borderRadius:10, padding:'0 12px', marginBottom:16, transition:'border-color 0.15s, box-shadow 0.15s' },
  buscadorActivo: { borderColor:C.aqua, boxShadow:`0 0 0 3px ${C.aquaBg}` },
  lupa: { fontSize:18, color:'var(--pc-gris-3)', lineHeight:1 },
  buscadorInput: { flex:1, border:'none', outline:'none', padding:'11px 0', fontSize:14,
                   background:'transparent', font:'inherit', color:'var(--pc-tinta)' },
  conteo: { fontSize:12, fontWeight:600, color:C.aqua, background:C.aquaBg, padding:'3px 9px',
            borderRadius:20, whiteSpace:'nowrap' },
  btnLimpiar: { border:'none', background:'var(--pc-superficie-3)', width:26, height:26, borderRadius:7,
                cursor:'pointer', fontSize:12, color:'var(--pc-gris-2)' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px,1fr))', gap:14 },
  card: { textAlign:'left', background:'var(--pc-superficie)', borderRadius:12,
          borderTop:'1px solid var(--pc-borde)', borderRight:'1px solid var(--pc-borde)', borderBottom:'1px solid var(--pc-borde)',
          padding:16, cursor:'pointer', font:'inherit', color:'inherit',
          display:'flex', flexDirection:'column', gap:6 },
  cardTop: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  folioTag: { fontSize:12, fontWeight:600, color:'var(--pc-gris-2)', letterSpacing:'0.02em' },
  prov: { fontWeight:600, fontSize:15, lineHeight:1.3 },
  meta: { fontSize:12, color:'var(--pc-gris)' },
  total: { fontSize:18, fontWeight:700, marginTop:4 },
  btnGhost: { background:'var(--pc-superficie)', border:'1px solid var(--pc-borde)', padding:'10px 16px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--pc-tinta)' },
  devuelta: { alignSelf:'flex-start', fontSize:11, fontWeight:600, color:'var(--pc-ambar-texto)',
              background:'var(--pc-ambar-bg)', padding:'2px 8px', borderRadius:20 },
}
