import { useState, useEffect } from 'react'
import api from '../api'
import { ESTADOS, METODOS_PAGO, etiquetaMetodo, money, fechaCorta, mensajeError } from '../constants'
import Modal from '../ui/Modal'
import { useToast, useConfirm } from '../ui/feedback-context'
import { C } from '../ui/tema'

const hoy = () => new Date().toISOString().slice(0, 10)

const MENSAJE_ESTADO = {
  autorizacion: (folio) => `Orden #${folio} enviada a autorización`,
  autorizada:   (folio) => `Orden #${folio} autorizada`,
  rechazada:    (folio) => `Orden #${folio} rechazada`,
}

function Badge({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.borrador
  return (
    <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                   color:e.color, background:e.bg, whiteSpace:'nowrap' }}>
      {e.label}
    </span>
  )
}

export default function Ordenes({ usuario, filtroInicial = '', onCambio }) {
  const [ordenes, setOrdenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState(filtroInicial)
  const [busqueda, setBusqueda] = useState('')
  const [buscadorActivo, setBuscadorActivo] = useState(false)
  const [ordenAbierta, setOrdenAbierta] = useState(null)
  const toast = useToast()
  const confirmar = useConfirm()

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

  async function cambiarEstado(orden, estado, detalle = '') {
    try {
      await api.patch(`/ordenes/${orden.id}/estado`, { estado, detalle })
      toast(MENSAJE_ESTADO[estado]?.(orden.folio) || 'Estado actualizado')
      await refrescarOrden(orden.id)
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  async function rechazarOrden(orden) {
    const motivo = await confirmar({
      titulo: `Rechazar orden #${orden.folio}`,
      mensaje: 'El motivo queda en el historial de la orden.',
      pedirTexto: 'Motivo del rechazo',
      placeholder: 'Ej. precio fuera de presupuesto',
      textoBoton: 'Rechazar orden',
      peligro: true,
    })
    if (motivo) await cambiarEstado(orden, 'rechazada', motivo)
  }

  async function registrarPago(orden, pago) {
    try {
      await api.post(`/ordenes/${orden.id}/pago`, { ...pago, registrado_por: usuario.id })
      toast(`Pago registrado para la orden #${orden.folio}`)
      await refrescarOrden(orden.id)
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  async function registrarRecoleccion(orden, rec) {
    try {
      await api.post(`/ordenes/${orden.id}/recoleccion`, rec)
      toast(rec.completado
        ? `Orden #${orden.folio} marcada como recolectada`
        : 'Recolección programada')
      await refrescarOrden(orden.id)
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  async function eliminarOrden(orden) {
    const ok = await confirmar({
      titulo: `Eliminar orden #${orden.folio}`,
      mensaje: 'Esta acción no se puede deshacer.',
      textoBoton: 'Eliminar',
      peligro: true,
    })
    if (!ok) return
    try {
      await api.delete(`/ordenes/${orden.id}`)
      toast(`Orden #${orden.folio} eliminada`)
      setOrdenAbierta(null)
      cargarOrdenes()
      if (onCambio) onCambio()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
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
      toast('No se pudo generar el PDF: ' + (detalle || mensajeError(e)), 'error')
    }
  }

  async function actualizarOrden(ordenId, patch) {
    try {
      await api.put(`/ordenes/${ordenId}`, patch)
      await refrescarOrden(ordenId)
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
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
              {k === 'rechazada' ? 'Rechazadas y eliminadas' : v.label}
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
            <div style={s.meta}>Creó: {o.creador?.nombre || '—'}</div>
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
          onCambiarEstado={cambiarEstado}
          onRechazar={rechazarOrden}
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

function ModalOrden({ orden, usuario, onClose, onCambiarEstado, onRechazar, onPago, onRecoleccion, onEliminar, onActualizar, onDescargarPdf }) {
  const [pestana, setPestana] = useState('detalle')
  const [procesando, setProcesando] = useState(null)
  const [pago, setPago] = useState({ fecha_pago: hoy(), referencia: '', metodo: 'transferencia', monto: orden.total })
  const [rec, setRec] = useState({ tipo: 'recoleccion', fecha_programada: hoy(), responsable: '', notas: '', completado: false })
  const [obs, setObs] = useState(orden.observaciones || '')
  const [tipoPago, setTipoPago] = useState(orden.tipo_pago || 'transferencia')
  const e = orden.estado
  const nHistorial = orden.historial?.length || 0

  // Solo una acción a la vez: mientras hay una petición en curso todos los botones quedan bloqueados.
  const ejecutar = async (clave, accion) => {
    if (procesando) return
    setProcesando(clave)
    try { await accion() } finally { setProcesando(null) }
  }
  const ocupado = !!procesando
  const etiqueta = (clave, texto) => (procesando === clave ? 'Procesando...' : texto)
  const conBloqueo = (estilo, extraDeshabilitado = false) => ({
    ...estilo,
    opacity: ocupado || extraDeshabilitado ? 0.5 : 1,
    cursor: ocupado || extraDeshabilitado ? 'not-allowed' : 'pointer',
  })

  return (
    <Modal onClose={onClose} maxWidth={720} arriba>
      <div style={s.modalHead}>
        <div style={s.modalHeadFila}>
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
            <button style={s.btnX} onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
        </div>

        <div style={s.pestanas} role="tablist">
          {[['detalle', 'Detalle'], ['historial', 'Historial', nHistorial]].map(([k, label, n]) => (
            <button key={k} role="tab" aria-selected={pestana === k}
              style={{ ...s.pestana, ...(pestana === k ? s.pestanaActiva : {}) }}
              onClick={() => setPestana(k)}>
              {label}
              {n > 0 && <span style={pestana === k ? s.pestanaCuentaActiva : s.pestanaCuenta}>{n}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={s.modalBody}>
        {pestana === 'detalle' && (<>
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
                    onBlur={() => { if (tipoPago !== orden.tipo_pago) onActualizar(orden.id, { tipo_pago: tipoPago }) }}>
                    {METODOS_PAGO.map(([valor, label]) =>
                      <option key={valor} value={valor}>{label}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Observaciones</label>
                  <input style={s.input} value={obs}
                    onChange={(ev) => setObs(ev.target.value)}
                    onBlur={() => { if (obs !== (orden.observaciones || '')) onActualizar(orden.id, { observaciones: obs }) }}
                    placeholder="Notas para el proveedor o autorizador" />
                </div>
              </div>
            </div>
          )}

          {/* Acciones por estado */}
          <div style={s.acciones}>
            {/* Eliminar — solo admin, solo borrador o rechazada */}
            {usuario.rol === 'admin' && ['borrador', 'rechazada'].includes(e) && (
              <button style={{...conBloqueo(s.btnDanger), marginRight:'auto'}} disabled={ocupado}
                onClick={() => ejecutar('eliminar', () => onEliminar(orden))}>
                {etiqueta('eliminar', 'Eliminar orden')}
              </button>
            )}

            {e === 'borrador' && (
              <button style={conBloqueo(s.btnPrimary)} disabled={ocupado}
                onClick={() => ejecutar('enviar', () => onCambiarEstado(orden, 'autorizacion'))}>
                {etiqueta('enviar', 'Enviar a autorización →')}
              </button>
            )}
            {e === 'autorizacion' && (<>
              <button style={conBloqueo(s.btnDanger)} disabled={ocupado}
                onClick={() => ejecutar('rechazar', () => onRechazar(orden))}>
                {etiqueta('rechazar', 'Rechazar')}
              </button>
              <button style={conBloqueo(s.btnOk)} disabled={ocupado}
                onClick={() => ejecutar('autorizar', () => onCambiarEstado(orden, 'autorizada'))}>
                {etiqueta('autorizar', 'Autorizar ✓')}
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
                <button style={{...conBloqueo(s.btnPrimary, !pago.referencia), marginTop:10}}
                  disabled={ocupado || !pago.referencia}
                  title={!pago.referencia ? 'Captura la referencia del pago' : undefined}
                  onClick={() => ejecutar('pago', () => onPago(orden, pago))}>
                  {etiqueta('pago', 'Registrar pago →')}
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
                  <button style={conBloqueo(s.btnGhost)} disabled={ocupado}
                    onClick={() => ejecutar('programar', () => onRecoleccion(orden, {...rec, completado: false}))}>
                    {etiqueta('programar', 'Programar')}
                  </button>
                  <button style={conBloqueo(s.btnOk)} disabled={ocupado}
                    onClick={() => ejecutar('recolectar', () => onRecoleccion(orden, {...rec, completado: true}))}>
                    {etiqueta('recolectar', 'Marcar recolectado ✓')}
                  </button>
                </div>
              </div>
            )}
            {e === 'cerrada' && <div style={s.pagoInfo}>✓ Orden cerrada.</div>}
            {e === 'rechazada' && <div style={{...s.pagoInfo, background:'#F7DEDE', color:'#B03A3A'}}>✕ Rechazada.</div>}
          </div>
        </>)}

        {pestana === 'historial' && (
          <div style={s.box}>
            {nHistorial === 0 && (
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
        )}
      </div>
    </Modal>
  )
}

const s = {
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-end',
            marginBottom:14, gap:16, flexWrap:'wrap' },
  h2: { fontSize:22, fontWeight:600, margin:0, color:'#26241D' },
  help: { fontSize:13, color:'#8A8577', marginTop:4, maxWidth:420 },
  msg: { padding:'0 0 12px', color:'#8A8577', fontSize:13 },
  error: { padding:20, background:'#F7DEDE', color:'#B03A3A', borderRadius:8 },
  empty: { gridColumn:'1 / -1', padding:'40px 20px', textAlign:'center', color:'#8A8577', fontSize:14,
           background:'#fff', border:'1px dashed #E3DFD5', borderRadius:12 },
  emptyTitulo: { fontSize:16, fontWeight:600, color:'#26241D', marginBottom:10 },
  select: { border:'1px solid #E3DFD5', borderRadius:8, padding:'9px 11px', fontSize:14, background:'#fff' },
  buscador: { display:'flex', alignItems:'center', gap:10, background:'#fff',
              borderWidth:1, borderStyle:'solid', borderColor:'#E3DFD5',
              borderRadius:10, padding:'0 12px', marginBottom:16, transition:'border-color 0.15s, box-shadow 0.15s' },
  buscadorActivo: { borderColor:C.aqua, boxShadow:`0 0 0 3px ${C.aquaBg}` },
  lupa: { fontSize:18, color:'#A8A395', lineHeight:1 },
  buscadorInput: { flex:1, border:'none', outline:'none', padding:'11px 0', fontSize:14,
                   background:'transparent', font:'inherit', color:'#26241D' },
  conteo: { fontSize:12, fontWeight:600, color:C.aqua, background:C.aquaBg, padding:'3px 9px',
            borderRadius:20, whiteSpace:'nowrap' },
  btnLimpiar: { border:'none', background:'#F4F1EA', width:26, height:26, borderRadius:7,
                cursor:'pointer', fontSize:12, color:'#6B6659' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px,1fr))', gap:14 },
  card: { textAlign:'left', background:'#fff', borderRadius:12,
          borderTop:'1px solid #E3DFD5', borderRight:'1px solid #E3DFD5', borderBottom:'1px solid #E3DFD5',
          padding:16, cursor:'pointer', font:'inherit', color:'inherit',
          display:'flex', flexDirection:'column', gap:6 },
  cardTop: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  folioTag: { fontSize:12, fontWeight:600, color:'#6B6659', letterSpacing:'0.02em' },
  folioBig: { fontSize:20, fontWeight:700, color:'#26241D' },
  prov: { fontWeight:600, fontSize:15, lineHeight:1.3 },
  meta: { fontSize:12, color:'#8A8577' },
  total: { fontSize:18, fontWeight:700, marginTop:4 },
  modalHead: { padding:'20px 24px 0', borderBottom:'1px solid #E3DFD5',
               position:'sticky', top:0, background:'#fff', borderRadius:'16px 16px 0 0', zIndex:2 },
  modalHeadFila: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 },
  pestanas: { display:'flex', gap:4, marginTop:14 },
  pestana: { border:'none', background:'none', padding:'10px 14px', fontSize:13.5, fontWeight:500,
             cursor:'pointer', color:'#8A8577', borderBottom:'2px solid transparent', marginBottom:-1,
             display:'flex', alignItems:'center', gap:6, font:'inherit' },
  pestanaActiva: { color:'#26241D', fontWeight:600, borderBottom:`2px solid ${C.aqua}` },
  pestanaCuenta: { fontSize:11, fontWeight:600, background:'#F4F1EA', color:'#6B6659',
                   padding:'1px 7px', borderRadius:10 },
  pestanaCuentaActiva: { fontSize:11, fontWeight:600, background:C.aquaBg, color:C.aqua,
                         padding:'1px 7px', borderRadius:10 },
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
  histLine: { display:'flex', gap:12, fontSize:12.5, padding:'7px 0', borderBottom:'1px dashed #E3DFD5' },
  histTime: { color:'#A8A395', minWidth:110 },
  histUser: { color:'#A8A395' },
  label: { display:'block', fontSize:12, color:'#8A8577', marginBottom:5, fontWeight:500 },
  input: { width:'100%', border:'1px solid #E3DFD5', borderRadius:8, padding:'9px 11px', fontSize:13, boxSizing:'border-box' },
  btnPrimary: { background:'#26241D', color:'#fff', border:'none', padding:'10px 16px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnOk: { background:'#2E6B4F', color:'#fff', border:'none', padding:'10px 16px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnDanger: { background:'#fff', color:'#B03A3A', border:'1px solid #E9C9C9', padding:'10px 16px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnGhost: { background:'#fff', border:'1px solid #E3DFD5', padding:'10px 16px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', color:'#26241D' },
  btnX: { border:'none', background:'#F4F1EA', width:30, height:30, borderRadius:8, cursor:'pointer', fontSize:14, color:'#6B6659' },
  btnPdf: { background:'#fff', color:'#26241D', border:'1px solid #E3DFD5', padding:'7px 13px',
            borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' },
}
