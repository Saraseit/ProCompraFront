import { useState } from 'react'
import api from '../../api'
import {
  ESTADOS, METODOS_PAGO, etiquetaMetodo, money, fechaCorta, mensajeError,
  esOperacion, esContabilidad,
} from '../../constants'
import {
  Download, Paperclip, Plus, ArrowRight, Check, CheckCircle2, XCircle, Info, Pencil, PackageOpen, Link2, History,
} from 'lucide-react'
import Modal, { BotonCerrar } from '../../ui/Modal'
import { useToast, useConfirm } from '../../ui/feedback-context'
import { s, bloqueado } from './estilos'
import { C } from '../../ui/tema'
import Documentos from './Documentos'
import BotonArchivo from './BotonArchivo'
import { ACEPTA_DOCUMENTOS, abrirEnPestana, subirAdjunto } from './archivos'
import { PanelPago, PanelLogistica, PanelComprobacion, ResumenDinero } from './Paneles'
import EditarOrden from './EditarOrden'
import Surtido from './Surtido'

const ESTADOS_SURTIDO = ['borrador', 'autorizacion', 'autorizada', 'pagada', 'recoleccion', 'comprobacion']
const EVENTOS_CAMBIO = ['Orden modificada', 'Surtido parcial']

export function Badge({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.borrador
  return (
    <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                   color:e.color, background:e.bg, whiteSpace:'nowrap' }}>
      {e.label}
    </span>
  )
}

// Cómo se repartió una partida entre esta orden y sus complementos.
function RepartoSurtido({ surtido, onAbrirOrden }) {
  const colores = [C.aqua, 'var(--pc-e-pagada)', 'var(--pc-e-recoleccion)', 'var(--pc-e-autorizacion)']
  return (
    <>
      <div style={s.reparto} title="Reparto del surtido">
        {surtido.partes.map((p, i) => (
          <div key={i} style={{ width: `${p.porcentaje}%`, background: colores[i % colores.length] }} />
        ))}
      </div>
      <div style={s.repartoTexto}>
        {surtido.partes.map((p, i) => (
          <span key={i}>
            {i > 0 && ' · '}
            <b style={{ color: colores[i % colores.length] }}>{p.porcentaje}%</b>{' '}
            {p.actual ? 'en esta orden' : (
              <>en <button style={{ ...s.vinculo, fontWeight: 500 }} onClick={() => onAbrirOrden?.(p.orden_id)}>#{p.folio}</button></>
            )}
            {p.proveedor ? ` (${p.proveedor})` : ''}
          </span>
        ))}
        {surtido.sin_surtir > 0 && <span> · <b style={{ color: 'var(--pc-rojo)' }}>{surtido.porcentaje_sin_surtir}%</b> cancelado</span>}
        <span> de {surtido.pedida}</span>
      </div>
    </>
  )
}

export default function ModalOrden({ orden, usuario, onClose, onCambio, onDescargarPdf, onAbrirOrden }) {
  const [pestana, setPestana] = useState('detalle')
  const [procesando, setProcesando] = useState(null)
  const [editando, setEditando] = useState(false)
  const [surtiendo, setSurtiendo] = useState(false)
  const [obs, setObs] = useState(orden.observaciones || '')
  const toast = useToast()
  const confirmar = useConfirm()

  const e = orden.estado
  const op = esOperacion(usuario.rol)
  const conta = esContabilidad(usuario.rol)
  const aCredito = orden.tipo_pago === 'credito'
  const ocupado = !!procesando
  const cotizaciones = (orden.adjuntos || []).filter((a) => a.tipo === 'cotizacion')
  const nDocumentos = (orden.adjuntos?.length || 0) + (orden.facturas?.length || 0)
  const ultimaCancelacion = (orden.historial || []).find((h) => h.evento === 'Cancelada')
  const ultimoCambio = e !== 'borrador' && (orden.historial || []).find((h) => EVENTOS_CAMBIO.includes(h.evento))
  const puedeEditar = op && e !== 'rechazada'
  const puedeSurtir = op && ESTADOS_SURTIDO.includes(e)

  // Una acción a la vez; al terminar se recarga la orden y la lista.
  const ejecutar = async (clave, accion) => {
    if (procesando) return
    setProcesando(clave)
    try {
      await accion()
      await onCambio()
    } catch (err) {
      toast('Error: ' + mensajeError(err), 'error')
    } finally {
      setProcesando(null)
    }
  }
  const etiqueta = (clave, texto) => (procesando === clave ? 'Procesando...' : texto)

  const cambiarEstado = (clave, estado, detalle, mensaje) => ejecutar(clave, async () => {
    await api.patch(`/ordenes/${orden.id}/estado`, { estado, detalle })
    toast(mensaje)
  })

  async function pedirMotivo(titulo, mensaje, textoBoton) {
    return confirmar({ titulo, mensaje, pedirTexto: 'Motivo', textoBoton, peligro: true,
                       placeholder: 'Se guarda en el historial y se avisa a quien creó la orden' })
  }

  const devolver = async () => {
    const motivo = await pedirMotivo(`Devolver orden #${orden.folio}`,
      'La orden regresa a borrador para que almacén o compras la corrijan y la vuelvan a enviar.',
      'Devolver para corrección')
    if (motivo) cambiarEstado('devolver', 'borrador', motivo, `Orden #${orden.folio} devuelta para corrección`)
  }

  const cancelar = async () => {
    const motivo = await pedirMotivo(`Cancelar orden #${orden.folio}`,
      'La orden se cancela y sus requerimientos regresan a la lista de pendientes.',
      'Cancelar orden')
    if (motivo) cambiarEstado('cancelar', 'rechazada', motivo, `Orden #${orden.folio} cancelada`)
  }

  const guardarCampo = (patch) => ejecutar('editar', () => api.put(`/ordenes/${orden.id}`, patch))

  const adjuntarCotizacion = ([archivo]) => ejecutar('cotizacion', async () => {
    await subirAdjunto(orden.id, 'cotizacion', archivo)
    toast('Cotización adjuntada')
  })

  const abrir = async (ruta) => {
    try { await abrirEnPestana(ruta) } catch (err) { toast('No se pudo abrir: ' + mensajeError(err), 'error') }
  }

  const pestanas = [
    ['detalle', 'Detalle'],
    ['documentos', 'Documentos', nDocumentos],
    ['historial', 'Historial', orden.historial?.length || 0],
  ]

  const panelesComunes = { orden, ejecutar, procesando, toast }

  return (
    <Modal onClose={onClose} maxWidth={760} arriba>
      <div style={s.modalHead}>
        <div style={s.modalHeadFila}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <div style={s.folioBig}>Orden #{orden.folio}</div>
              <Badge estado={orden.estado} />
            </div>
            <div style={{ fontSize:13, color:'var(--pc-gris)', marginTop:3 }}>
              {orden.proveedor?.nombre} · {fechaCorta(orden.fecha)} · {orden.creador?.nombre} · {etiquetaMetodo(orden.tipo_pago)}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {puedeEditar && (
              <button style={s.btnPdf} onClick={() => setEditando(true)}
                title={e === 'borrador' ? 'Editar partidas' : 'Editar la orden (se avisa a administración y contabilidad)'}>
                <Pencil size={14} /> Editar
              </button>
            )}
            <button style={s.btnPdf} onClick={() => onDescargarPdf(orden)}><Download size={14} /> PDF</button>
            <BotonCerrar onClick={onClose} />
          </div>
        </div>

        <div style={s.pestanas} role="tablist">
          {pestanas.map(([k, label, n]) => (
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
          {e === 'borrador' && orden.motivo_devolucion && (
            <div style={s.aviso}>
              <b>Contabilidad la devolvió para corrección:</b> {orden.motivo_devolucion}
            </div>
          )}

          {(orden.origen || orden.complementos?.length > 0) && (
            <div style={s.vinculos}>
              {orden.origen && (
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <Link2 size={15} style={{ color: C.aqua }} />
                  Complementa la orden
                  <button style={s.vinculo} onClick={() => onAbrirOrden?.(orden.origen.id)}>#{orden.origen.folio}</button>
                  <span style={{ color:'var(--pc-gris)' }}>({orden.origen.proveedor?.nombre})</span>
                  <Badge estado={orden.origen.estado} />
                </div>
              )}
              {orden.complementos?.map((c) => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <PackageOpen size={15} style={{ color: C.aqua }} />
                  El faltante se surte en la orden
                  <button style={s.vinculo} onClick={() => onAbrirOrden?.(c.id)}>#{c.folio}</button>
                  <span style={{ color:'var(--pc-gris)' }}>({c.proveedor?.nombre} · {money(c.total)})</span>
                  <Badge estado={c.estado} />
                </div>
              ))}
            </div>
          )}

          {ultimoCambio && (
            <button style={{ ...s.modificada, cursor:'pointer', font:'inherit', textAlign:'left', justifyContent:'flex-start', width:'100%' }}
              onClick={() => setPestana('historial')}>
              <History size={15} style={{ flex:'none' }} />
              <span>
                {ultimoCambio.evento} por {ultimoCambio.usuario?.nombre || '—'} el{' '}
                {new Date(ultimoCambio.created_at).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                {' · '}<u>ver detalle en el historial</u>
              </span>
            </button>
          )}

          <div style={s.box}>
            <div style={s.boxTitle}>Proveedor</div>
            <b>{orden.proveedor?.nombre}</b>
            <div style={s.lineItem}><span style={s.lineL}>RFC</span><span>{orden.proveedor?.rfc || '—'}</span></div>
            <div style={s.lineItem}><span style={s.lineL}>Dirección</span><span>{orden.proveedor?.direccion || '—'}</span></div>
            <div style={s.lineItem}><span style={s.lineL}>Teléfono</span><span>{orden.proveedor?.telefono || '—'}</span></div>
            <div style={s.lineItem}><span style={s.lineL}>Cuenta</span><span>{orden.proveedor?.cuenta_bancaria || '—'}</span></div>
          </div>

          <div style={s.accionesPartidas}>
            <div style={{ ...s.boxTitle, margin:0 }}>Partidas</div>
            {puedeSurtir && (
              <button style={s.btnChico} onClick={() => setSurtiendo(true)}
                title="El proveedor no tiene todo: ajusta lo surtido y manda el faltante a otra orden">
                <PackageOpen size={14} /> Surtido parcial
              </button>
            )}
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Cant.</th><th style={s.th}>Unidad</th>
                  <th style={s.th}>Concepto</th><th style={s.th}>Contrato</th>
                  <th style={{...s.th, textAlign:'right'}}>P. Unit.</th>
                  <th style={{...s.th, textAlign:'right'}}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {orden.partidas?.map((p) => (
                  <tr key={p.id}>
                    <td style={s.td}>{p.cantidad}</td>
                    <td style={s.td}>{p.unidad}</td>
                    <td style={s.td}>
                      {p.concepto}
                      {p.surtido && <RepartoSurtido surtido={p.surtido} onAbrirOrden={onAbrirOrden} />}
                    </td>
                    <td style={{...s.td, fontFamily:'var(--pc-mono)', fontSize:12}}>{p.contrato || '—'}</td>
                    <td style={{...s.td, textAlign:'right'}}>{money(p.precio_unitario)}</td>
                    <td style={{...s.td, textAlign:'right'}}>{money(p.importe)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={5} style={{...s.td, textAlign:'right', color:'var(--pc-gris)'}}>Subtotal</td><td style={{...s.td, textAlign:'right'}}>{money(orden.subtotal)}</td></tr>
                <tr><td colSpan={5} style={{...s.td, textAlign:'right', color:'var(--pc-gris)'}}>IVA 16%</td><td style={{...s.td, textAlign:'right'}}>{money(orden.iva)}</td></tr>
                <tr><td colSpan={5} style={{...s.td, textAlign:'right', fontWeight:700}}>Total autorizado</td><td style={{...s.td, textAlign:'right', fontWeight:700}}>{money(orden.total)}</td></tr>
              </tfoot>
            </table>
          </div>

          {/* Cotización: visible siempre; se adjunta mientras la orden no esté cancelada */}
          <div style={{ ...s.box, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <div style={{ ...s.boxTitle, margin:0, flex:'0 0 auto' }}>Cotización</div>
            {cotizaciones.length === 0 && (
              <span style={{ fontSize:12.5, color:'var(--pc-gris-3)', flex:1 }}>
                {e === 'borrador' ? 'Adjúntala si el proveedor la dio: agiliza la autorización.' : 'Sin cotización.'}
              </span>
            )}
            {cotizaciones.length > 0 && (
              <span style={{ flex:1, display:'flex', gap:8, flexWrap:'wrap' }}>
                {cotizaciones.map((c) => (
                  <button key={c.id} style={s.btnChico} onClick={() => abrir(`/adjuntos/${c.id}/url`)}>
                    <Paperclip size={12} /> {c.nombre_archivo}
                  </button>
                ))}
              </span>
            )}
            {e !== 'rechazada' && e !== 'cerrada' && (
              <BotonArchivo accept={ACEPTA_DOCUMENTOS} disabled={ocupado}
                style={bloqueado(s.btnAqua, ocupado)} onArchivos={adjuntarCotizacion}>
                {procesando === 'cotizacion' ? 'Subiendo...' : <><Plus size={14} />{cotizaciones.length ? 'Otra' : 'Adjuntar cotización'}</>}
              </BotonArchivo>
            )}
          </div>

          {e === 'borrador' && op && (
            <div style={s.box}>
              <div style={s.boxTitle}>Detalles de la orden</div>
              <div style={s.grid2}>
                <div>
                  <label style={s.label}>Forma de pago sugerida</label>
                  <select style={s.input} value={orden.tipo_pago} disabled={ocupado}
                    onChange={(ev) => guardarCampo({ tipo_pago: ev.target.value })}>
                    {METODOS_PAGO.map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Observaciones</label>
                  <input style={s.input} value={obs}
                    onChange={(ev) => setObs(ev.target.value)}
                    onBlur={() => { if (obs !== (orden.observaciones || '')) guardarCampo({ observaciones: obs }) }}
                    placeholder="Notas para el proveedor o contabilidad" />
                </div>
              </div>
            </div>
          )}

          <ResumenDinero orden={orden} />

          {/* ── Acciones según estado y rol ── */}
          {e === 'borrador' && (
            <div style={{ ...s.filaFin, marginTop:0 }}>
              {conta && (
                <button style={{ ...bloqueado(s.btnDanger, ocupado), marginRight:'auto' }} disabled={ocupado} onClick={cancelar}>
                  {etiqueta('cancelar', 'Cancelar orden')}
                </button>
              )}
              {op && (
                <button style={bloqueado(s.btnPrimary, ocupado)} disabled={ocupado}
                  onClick={() => cambiarEstado('enviar', 'autorizacion', null, `Orden #${orden.folio} enviada a autorización`)}>
                  {procesando === 'enviar' ? 'Procesando...' : <>Enviar a autorización <ArrowRight size={15} /></>}
                </button>
              )}
            </div>
          )}

          {e === 'autorizacion' && (conta ? (
            <div style={{ ...s.filaFin, marginTop:0 }}>
              <button style={{ ...bloqueado(s.btnDanger, ocupado), marginRight:'auto' }} disabled={ocupado} onClick={cancelar}>
                {etiqueta('cancelar', 'Cancelar')}
              </button>
              <button style={bloqueado(s.btnGhost, ocupado)} disabled={ocupado} onClick={devolver}>
                {etiqueta('devolver', 'Devolver para corrección')}
              </button>
              <button style={bloqueado(s.btnOk, ocupado)} disabled={ocupado}
                onClick={() => cambiarEstado('autorizar', 'autorizada', null, `Orden #${orden.folio} autorizada`)}>
                {procesando === 'autorizar' ? 'Procesando...' : <><Check size={15} /> Autorizar</>}
              </button>
            </div>
          ) : (
            <div style={s.info}><Info size={16} /> Esperando autorización de contabilidad.</div>
          ))}

          {e === 'autorizada' && !aCredito && (conta ? (<>
            <PanelPago {...panelesComunes} />
            <div style={{ ...s.filaFin, marginTop:0 }}>
              <button style={bloqueado(s.btnDanger, ocupado)} disabled={ocupado} onClick={cancelar}>
                {etiqueta('cancelar', 'Cancelar orden')}
              </button>
            </div>
          </>) : (
            <div style={s.info}><Info size={16} /> Autorizada. Contabilidad está procesando el pago.</div>
          ))}

          {aCredito && ['autorizada', 'recoleccion', 'comprobacion', 'cerrada'].includes(e) && conta && (
            <PanelPago {...panelesComunes} />
          )}

          {(['pagada', 'recoleccion'].includes(e) || (e === 'autorizada' && aCredito)) && (
            <PanelLogistica {...panelesComunes} />
          )}

          {e === 'comprobacion' && (<>
            <PanelComprobacion {...panelesComunes} />
            {orden.monto_comprobado != null && (conta ? (
              <div style={{ ...s.filaFin, marginTop:0 }}>
                <span style={{ fontSize:12.5, color:'var(--pc-gris)', marginRight:'auto' }}>
                  Revisa los documentos en la pestaña Documentos antes de cerrar.
                </span>
                <button style={bloqueado(s.btnOk, ocupado)} disabled={ocupado}
                  onClick={() => ejecutar('cerrar', async () => {
                    await api.post(`/ordenes/${orden.id}/cerrar`)
                    toast(`Orden #${orden.folio} cerrada`)
                  })}>
                  {procesando === 'cerrar' ? 'Procesando...' : <><Check size={15} /> Cerrar orden</>}
                </button>
              </div>
            ) : (
              <div style={s.info}><Info size={16} /> Comprobación enviada. Contabilidad la revisará para cerrar la orden.</div>
            ))}
          </>)}

          {e === 'cerrada' && <div style={s.infoOk}><CheckCircle2 size={16} /> Orden cerrada con comprobación revisada.</div>}
          {e === 'rechazada' && (
            <div style={s.avisoError}>
              <XCircle size={16} /> Orden cancelada{ultimaCancelacion?.detalle ? `: ${ultimaCancelacion.detalle}` : '.'}
            </div>
          )}
        </>)}

        {pestana === 'documentos' && (
          <Documentos orden={orden} usuario={usuario} onCambio={onCambio} />
        )}

        {pestana === 'historial' && (
          <div style={s.box}>
            {(orden.historial?.length || 0) === 0 && (
              <div style={{ fontSize:12.5, color:'var(--pc-gris-3)' }}>Sin eventos registrados.</div>
            )}
            {orden.historial?.map((h) => (
              <div key={h.id} style={s.histLine}>
                <span style={s.histTime}>
                  {new Date(h.created_at).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                </span>
                <span>
                  <b style={{ fontWeight: 600 }}>{h.evento}</b>
                  {h.detalle && <span style={{ display:'block', whiteSpace:'pre-line', color:'var(--pc-texto-suave)', marginTop:2 }}>{h.detalle}</span>}
                  <span style={s.histUser}> · {h.usuario?.nombre || 'Sistema'}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {editando && (
        <EditarOrden orden={orden} onClose={() => setEditando(false)}
          onGuardado={async () => { setEditando(false); await onCambio() }} />
      )}
      {surtiendo && (
        <Surtido orden={orden} onClose={() => setSurtiendo(false)}
          onHecho={async (complemento) => {
            setSurtiendo(false)
            await onCambio()
            if (complemento && onAbrirOrden) onAbrirOrden(complemento.id)
          }} />
      )}
    </Modal>
  )
}
