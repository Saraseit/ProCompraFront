import { useState, useEffect } from 'react'
import api from '../api'
import { ESTADOS, METODOS_PAGO, etiquetaMetodo, money, fechaCorta, mensajeError } from '../constants'

const hoy = () => new Date().toISOString().slice(0, 10)

function Badge({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.borrador
  return (
    <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                   color:e.color, background:e.bg, whiteSpace:'nowrap' }}>
      {e.label}
    </span>
  )
}

export default function Ordenes({ usuario, filtroInicial = '' }) {
  const [ordenes, setOrdenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState(filtroInicial)
  const [busqueda, setBusqueda] = useState('')
  const [ordenAbierta, setOrdenAbierta] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => { cargarOrdenes() }, 300)
    return () => clearTimeout(timer)
  }, [filtro])

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

  async function abrirOrden(orden) {
    try {
      const res = await api.get(`/ordenes/${orden.id}`)
      setOrdenAbierta(res.data)
    } catch (e) {
      alert('Error al abrir orden: ' + mensajeError(e))
    }
  }

  async function refrescarOrden(ordenId) {
    const res = await api.get(`/ordenes/${ordenId}`)
    setOrdenAbierta(res.data)
    cargarOrdenes()
  }

  async function cambiarEstado(ordenId, estado, detalle = '') {
    try {
      await api.patch(`/ordenes/${ordenId}/estado`, { estado, detalle })
      await refrescarOrden(ordenId)
    } catch (e) {
      alert('Error: ' + mensajeError(e))
    }
  }

  async function registrarPago(ordenId, pago) {
    try {
      await api.post(`/ordenes/${ordenId}/pago`, { ...pago, registrado_por: usuario.id })
      await refrescarOrden(ordenId)
    } catch (e) {
      alert('Error: ' + mensajeError(e))
    }
  }

  async function registrarRecoleccion(ordenId, rec) {
    try {
      await api.post(`/ordenes/${ordenId}/recoleccion`, rec)
      await refrescarOrden(ordenId)
    } catch (e) {
      alert('Error: ' + mensajeError(e))
    }
  }

  async function eliminarOrden(ordenId, folio) {
    if (!confirm(`¿Eliminar la orden #${folio}? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/ordenes/${ordenId}`)
      setOrdenAbierta(null)
      cargarOrdenes()
    } catch (e) {
      alert('Error: ' + mensajeError(e))
    }
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
      alert('No se pudo generar el PDF: ' + (detalle || mensajeError(e)))
    }
  }

  async function actualizarOrden(ordenId, patch) {
    try {
      await api.put(`/ordenes/${ordenId}`, patch)
      await refrescarOrden(ordenId)
    } catch (e) {
      alert('Error: ' + mensajeError(e))
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
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <input
            style={{ ...s.select, width:250 }}
            placeholder="Buscar por folio, proveedor o concepto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <select style={s.select} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todas las activas</option>
            {Object.entries(ESTADOS).map(([k, v]) => (
              <option key={k} value={k}>
                {k === 'rechazada' ? 'Rechazadas y eliminadas' : v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {cargando && <div style={s.msg}>Cargando órdenes...</div>}

      <div style={s.grid}>
        {visibles.map((o) => (
          <button key={o.id} style={s.card} onClick={() => abrirOrden(o)}>
            <div style={s.cardTop}>
              <span style={s.folioTag}>Folio #{o.folio}</span>
              <Badge estado={o.estado} />
            </div>
            <div style={s.prov}>{o.proveedor?.nombre || 'Sin proveedor'}</div>
            <div style={s.meta}>{fechaCorta(o.fecha)}</div>
            <div style={s.total}>{money(o.total)}</div>
            <div style={s.meta}>Creó: {o.creador?.nombre || '—'}</div>
          </button>
        ))}
        {!cargando && visibles.length === 0 && (
          <div style={s.empty}>
            {termino
              ? `Ninguna orden coincide con "${busqueda.trim()}".`
              : 'No hay órdenes en este estado.'}
          </div>
        )}
      </div>

      {ordenAbierta && (
        <ModalOrden
          orden={ordenAbierta}
          usuario={usuario}
          onClose={() => setOrdenAbierta(null)}
          onCambiarEstado={cambiarEstado}
          onPago={registrarPago}
          onRecoleccion={registrarRecoleccion}
          onEliminar={eliminarOrden}
          onActualizar={actualizarOrden}
          onDescargarPdf={descargarPdf}
        />
      )}
    </div>
  )
}

function ModalOrden({ orden, usuario, onClose, onCambiarEstado, onPago, onRecoleccion, onEliminar, onActualizar, onDescargarPdf }) {
  const [pago, setPago] = useState({ fecha_pago: hoy(), referencia: '', metodo: 'transferencia', monto: orden.total })
  const [rec, setRec] = useState({ tipo: 'recoleccion', fecha_programada: hoy(), responsable: '', notas: '', completado: false })
  const [obs, setObs] = useState(orden.observaciones || '')
  const [tipoPago, setTipoPago] = useState(orden.tipo_pago || 'transferencia')
  const e = orden.estado

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(ev) => ev.stopPropagation()}>

        <div style={s.modalHead}>
          <div>
            <div style={s.folioBig}>Orden · Folio #{orden.folio}</div>
            <div style={{ fontSize:13, color:'#8A8577' }}>
              {fechaCorta(orden.fecha)} · {orden.creador?.nombre} · {etiquetaMetodo(orden.tipo_pago)}
            </div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <button style={s.btnPdf} onClick={() => onDescargarPdf(orden)}>
              Descargar PDF
            </button>
            <Badge estado={orden.estado} />
            <button style={s.btnX} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={s.modalBody}>
          {/* Proveedor */}
          <div style={s.box}>
            <div style={s.boxTitle}>Proveedor</div>
            <b>{orden.proveedor?.nombre}</b>
            <div style={s.lineItem}><span style={s.lineL}>RFC</span><span>{orden.proveedor?.rfc || '—'}</span></div>
            <div style={s.lineItem}><span style={s.lineL}>Dirección</span><span>{orden.proveedor?.direccion || '—'}</span></div>
            <div style={s.lineItem}><span style={s.lineL}>Teléfono</span><span>{orden.proveedor?.telefono || '—'}</span></div>
            <div style={s.lineItem}><span style={s.lineL}>Cuenta</span><span>{orden.proveedor?.cuenta_bancaria || '—'}</span></div>
          </div>

          {/* Partidas */}
          <table style={{ ...s.table, marginTop:14 }}>
            <thead>
              <tr>
                <th style={s.th}>Cant.</th><th style={s.th}>Unidad</th>
                <th style={s.th}>Concepto</th>
                <th style={{...s.th, textAlign:'right'}}>P. Unit.</th>
                <th style={{...s.th, textAlign:'right'}}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {orden.partidas?.map((p) => (
                <tr key={p.id}>
                  <td style={s.td}>{p.cantidad}</td>
                  <td style={s.td}>{p.unidad}</td>
                  <td style={s.td}>{p.concepto}</td>
                  <td style={{...s.td, textAlign:'right'}}>{money(p.precio_unitario)}</td>
                  <td style={{...s.td, textAlign:'right'}}>{money(p.importe)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={4} style={{...s.td, textAlign:'right', color:'#8A8577'}}>Subtotal</td><td style={{...s.td, textAlign:'right'}}>{money(orden.subtotal)}</td></tr>
              <tr><td colSpan={4} style={{...s.td, textAlign:'right', color:'#8A8577'}}>IVA 16%</td><td style={{...s.td, textAlign:'right'}}>{money(orden.iva)}</td></tr>
              <tr><td colSpan={4} style={{...s.td, textAlign:'right', fontWeight:700}}>Total</td><td style={{...s.td, textAlign:'right', fontWeight:700}}>{money(orden.total)}</td></tr>
            </tfoot>
          </table>

          {/* Editar borrador */}
          {e === 'borrador' && (
            <div style={{...s.box, marginTop:14}}>
              <div style={s.boxTitle}>Detalles de la orden</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={s.label}>Tipo de pago</label>
                  <select style={s.input} value={tipoPago}
                    onChange={(ev) => setTipoPago(ev.target.value)}
                    onBlur={() => onActualizar(orden.id, { tipo_pago: tipoPago })}>
                    {METODOS_PAGO.map(([valor, label]) =>
                      <option key={valor} value={valor}>{label}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Observaciones</label>
                  <input style={s.input} value={obs}
                    onChange={(ev) => setObs(ev.target.value)}
                    onBlur={() => onActualizar(orden.id, { observaciones: obs })}
                    placeholder="Notas para el proveedor o autorizador" />
                </div>
              </div>
            </div>
          )}

          {/* Acciones por estado */}
          <div style={s.acciones}>
            {/* Eliminar — solo admin, solo borrador o rechazada */}
            {usuario.rol === 'admin' && ['borrador', 'rechazada'].includes(e) && (
              <button style={{...s.btnDanger, marginRight:'auto'}}
                onClick={() => onEliminar(orden.id, orden.folio)}>
                Eliminar orden
              </button>
            )}

            {e === 'borrador' && (
              <button style={s.btnPrimary}
                onClick={() => onCambiarEstado(orden.id, 'autorizacion')}>
                Enviar a autorización →
              </button>
            )}
            {e === 'autorizacion' && (<>
              <button style={s.btnDanger}
                onClick={() => { const m = prompt('Motivo del rechazo:'); if (m) onCambiarEstado(orden.id, 'rechazada', m) }}>
                Rechazar
              </button>
              <button style={s.btnOk} onClick={() => onCambiarEstado(orden.id, 'autorizada')}>
                Autorizar ✓
              </button>
            </>)}
            {e === 'autorizada' && (
              <div style={s.pagoBox}>
                <strong>Registrar pago</strong>
                <div style={s.pagoGrid}>
                  <div>
                    <label style={s.label}>Fecha</label>
                    <input type="date" style={s.input} value={pago.fecha_pago}
                      onChange={(ev) => setPago({...pago, fecha_pago: ev.target.value})} />
                  </div>
                  <div>
                    <label style={s.label}>Referencia</label>
                    <input style={s.input} value={pago.referencia}
                      onChange={(ev) => setPago({...pago, referencia: ev.target.value})} />
                  </div>
                  <div>
                    <label style={s.label}>Método</label>
                    <select style={s.input} value={pago.metodo}
                      onChange={(ev) => setPago({...pago, metodo: ev.target.value})}>
                      {METODOS_PAGO.map(([valor, label]) =>
                        <option key={valor} value={valor}>{label}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Monto</label>
                    <input type="number" style={s.input} value={pago.monto}
                      onChange={(ev) => setPago({...pago, monto: +ev.target.value})} />
                  </div>
                </div>
                <button style={{...s.btnPrimary, marginTop:10}} disabled={!pago.referencia}
                  onClick={() => onPago(orden.id, pago)}>
                  Registrar pago →
                </button>
              </div>
            )}
            {(e === 'pagada' || e === 'recoleccion') && (
              <div style={s.pagoBox}>
                <div style={s.pagoInfo}>✓ Pagada · ref {orden.pagos?.[0]?.referencia}</div>
                <strong style={{ display:'block', margin:'12px 0 8px' }}>Recolección / entrega</strong>
                <div style={s.pagoGrid}>
                  <div>
                    <label style={s.label}>Tipo</label>
                    <select style={s.input} value={rec.tipo}
                      onChange={(ev) => setRec({...rec, tipo: ev.target.value})}>
                      <option value="recoleccion">Recolectar en proveedor</option>
                      <option value="entrega">Programar entrega</option>
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Fecha</label>
                    <input type="date" style={s.input} value={rec.fecha_programada}
                      onChange={(ev) => setRec({...rec, fecha_programada: ev.target.value})} />
                  </div>
                  <div>
                    <label style={s.label}>Responsable</label>
                    <input style={s.input} value={rec.responsable}
                      onChange={(ev) => setRec({...rec, responsable: ev.target.value})} />
                  </div>
                  <div>
                    <label style={s.label}>Notas</label>
                    <input style={s.input} value={rec.notas}
                      onChange={(ev) => setRec({...rec, notas: ev.target.value})} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:10, marginTop:10 }}>
                  <button style={s.btnGhost} onClick={() => onRecoleccion(orden.id, {...rec, completado: false})}>
                    Programar
                  </button>
                  <button style={s.btnOk} onClick={() => onRecoleccion(orden.id, {...rec, completado: true})}>
                    Marcar recolectado ✓
                  </button>
                </div>
              </div>
            )}
            {e === 'cerrada' && <div style={s.pagoInfo}>✓ Orden cerrada.</div>}
            {e === 'rechazada' && <div style={{...s.pagoInfo, background:'#F7DEDE', color:'#B03A3A'}}>✕ Rechazada.</div>}
          </div>

          {/* Historial */}
          <div style={{...s.box, marginTop:14}}>
            <div style={s.boxTitle}>Historial</div>
            {orden.historial?.length === 0 && (
              <div style={{ fontSize:12.5, color:'#A8A395' }}>Sin eventos registrados.</div>
            )}
            {orden.historial?.map((h) => (
              <div key={h.id} style={s.histLine}>
                <span style={s.histTime}>
                  {new Date(h.created_at).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                </span>
                <span>
                  {h.evento}{h.detalle ? ` — ${h.detalle}` : ''}
                  <span style={s.histUser}> · {h.usuario?.nombre || 'Sistema'}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-end',
            marginBottom:16, gap:16, flexWrap:'wrap' },
  h2: { fontSize:22, fontWeight:600, margin:0, color:'#26241D' },
  help: { fontSize:13, color:'#8A8577', marginTop:4, maxWidth:420 },
  msg: { padding:20, color:'#8A8577' },
  error: { padding:20, background:'#F7DEDE', color:'#B03A3A', borderRadius:8 },
  empty: { padding:40, textAlign:'center', color:'#A8A395' },
  select: { border:'1px solid #E3DFD5', borderRadius:8, padding:'9px 11px', fontSize:14 },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px,1fr))', gap:14 },
  card: { textAlign:'left', background:'#fff', border:'1px solid #E3DFD5', borderRadius:12,
          padding:16, cursor:'pointer', font:'inherit', color:'inherit',
          display:'flex', flexDirection:'column', gap:6 },
  cardTop: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  folioTag: { fontSize:12, fontWeight:600, color:'#6B6659', letterSpacing:'0.02em' },
  folioBig: { fontSize:20, fontWeight:700, color:'#26241D' },
  prov: { fontWeight:600, fontSize:15, lineHeight:1.3 },
  meta: { fontSize:12, color:'#8A8577' },
  total: { fontSize:18, fontWeight:700, marginTop:4 },
  overlay: { position:'fixed', inset:0, background:'rgba(30,28,22,0.5)', display:'flex',
             alignItems:'flex-start', justifyContent:'center', padding:'40px 16px', zIndex:50, overflowY:'auto' },
  modal: { background:'#fff', borderRadius:16, width:'100%', maxWidth:720,
           boxShadow:'0 30px 80px rgba(0,0,0,0.25)' },
  modalHead: { display:'flex', justifyContent:'space-between', alignItems:'flex-start',
               padding:'20px 24px', borderBottom:'1px solid #E3DFD5',
               position:'sticky', top:0, background:'#fff', borderRadius:'16px 16px 0 0', zIndex:2 },
  modalBody: { padding:24 },
  box: { border:'1px solid #E3DFD5', borderRadius:10, padding:14, background:'#FCFBF8' },
  boxTitle: { fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', color:'#8A8577', fontWeight:600, marginBottom:10 },
  lineItem: { display:'flex', justifyContent:'space-between', fontSize:13, padding:'2px 0' },
  lineL: { color:'#8A8577' },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { textAlign:'left', padding:'10px 8px', background:'#F4F1EA', color:'#6B6659',
        fontWeight:600, fontSize:11, textTransform:'uppercase' },
  td: { padding:'10px 8px', borderBottom:'1px solid #EFEBE2' },
  acciones: { display:'flex', gap:10, justifyContent:'flex-end', marginTop:18, flexWrap:'wrap', alignItems:'center' },
  pagoBox: { width:'100%', background:'#FCFBF8', border:'1px solid #E3DFD5', borderRadius:10, padding:16 },
  pagoGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:10 },
  pagoInfo: { background:'#DBE7F7', color:'#1F5AA6', padding:'10px 14px', borderRadius:8, fontSize:13, fontWeight:500 },
  histLine: { display:'flex', gap:12, fontSize:12.5, padding:'5px 0', borderBottom:'1px dashed #E3DFD5' },
  histTime: { color:'#A8A395', minWidth:110 },
  histUser: { color:'#A8A395' },
  label: { display:'block', fontSize:12, color:'#8A8577', marginBottom:5, fontWeight:500 },
  input: { width:'100%', border:'1px solid #E3DFD5', borderRadius:8, padding:'9px 11px', fontSize:13, boxSizing:'border-box' },
  btnPrimary: { background:'#26241D', color:'#fff', border:'none', padding:'10px 16px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnOk: { background:'#2E6B4F', color:'#fff', border:'none', padding:'10px 16px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnDanger: { background:'#fff', color:'#B03A3A', border:'1px solid #E9C9C9', padding:'10px 16px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnGhost: { background:'transparent', border:'1px solid #E3DFD5', padding:'10px 16px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnX: { border:'none', background:'#F4F1EA', width:30, height:30, borderRadius:8, cursor:'pointer', fontSize:14, color:'#6B6659' },
  btnPdf: { background:'#fff', color:'#26241D', border:'1px solid #E3DFD5', padding:'7px 13px',
            borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' },
}