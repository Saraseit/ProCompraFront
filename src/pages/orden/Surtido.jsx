import { useState, useEffect } from 'react'
import { PackageOpen, ArrowRight } from 'lucide-react'
import api from '../../api'
import { METODOS_PAGO, money, mensajeError, totalConIva } from '../../constants'
import Modal, { ModalHead, Label } from '../../ui/Modal'
import ComboProveedor from '../../ui/ComboProveedor'
import { useToast } from '../../ui/feedback-context'
import { s, bloqueado } from './estilos'

const ATAJOS = [[1, 'Todo'], [0.5, 'Mitad'], [0, 'Nada']]

const redondear = (n) => Math.round(n * 1000) / 1000

// El proveedor no surtió todo: la orden se queda con lo surtido y el faltante
// se cancela o pasa a una orden complementaria con otro proveedor.
export default function Surtido({ orden, onClose, onHecho }) {
  const [filas, setFilas] = useState(() => (orden.partidas || []).map((p) => ({
    id: p.id, concepto: p.concepto, unidad: p.unidad, pedida: Number(p.cantidad),
    precioOriginal: Number(p.precio_unitario), surtida: String(p.cantidad),
    faltante: 'complemento', precio: String(p.precio_unitario),
  })))
  const [proveedores, setProveedores] = useState([])
  const [proveedorId, setProveedorId] = useState('')
  const [tipoPago, setTipoPago] = useState('transferencia')
  const [enviar, setEnviar] = useState(true)
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [intento, setIntento] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api.get('/proveedores').then(({ data }) => setProveedores(data)).catch(() => {})
  }, [])

  const set = (id, campo, valor) => setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)))

  const conFaltante = filas.filter((f) => Number(f.surtida) < f.pedida)
  const aComplemento = conFaltante.filter((f) => f.faltante === 'complemento')
  const invalida = filas.find((f) => f.surtida === '' || Number(f.surtida) < 0 || Number(f.surtida) > f.pedida)
  const nadaSurtido = filas.every((f) => Number(f.surtida) === 0)

  const queda = totalConIva(filas.map((f) => ({ cantidad: f.surtida, precio_unitario: f.precioOriginal })))
  const complemento = totalConIva(aComplemento.map((f) => ({ cantidad: f.pedida - Number(f.surtida), precio_unitario: f.precio })))
  const provComp = proveedores.find((p) => p.id === proveedorId)

  const errores = []
  if (invalida) errores.push(`${invalida.concepto}: lo surtido debe estar entre 0 y ${invalida.pedida}.`)
  else if (!conFaltante.length) errores.push('Indica cuánto sí surtió el proveedor en la partida que quedó incompleta.')
  else if (nadaSurtido) errores.push('Si el proveedor no surte nada, cancela la orden o cambia el proveedor desde Editar.')
  if (aComplemento.length && !proveedorId) errores.push('Elige el proveedor que surtirá el faltante.')
  if (!motivo.trim()) errores.push('Explica qué pasó con el proveedor.')
  const puede = !errores.length && !guardando

  async function guardar() {
    setIntento(true)
    if (!puede) return
    setGuardando(true)
    try {
      const { data } = await api.post(`/ordenes/${orden.id}/surtido`, {
        motivo: motivo.trim(),
        partidas: conFaltante.map((f) => ({ partida_id: f.id, cantidad_surtida: Number(f.surtida), faltante: f.faltante })),
        complemento: aComplemento.length ? {
          proveedor_id: proveedorId, tipo_pago: tipoPago, enviar_a_autorizacion: enviar,
          precios: Object.fromEntries(aComplemento.map((f) => [f.id, Number(f.precio)])),
        } : null,
      })
      toast(data.complemento
        ? `Surtido registrado · se creó la orden complementaria #${data.complemento.folio}`
        : 'Surtido registrado')
      onHecho(data.complemento)
    } catch (e) {
      toast('No se registró: ' + mensajeError(e), 'error')
      setGuardando(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={880} zIndex={70} arriba>
      <ModalHead titulo={`Surtido parcial · orden #${orden.folio}`}
        subtitulo={`¿Cuánto sí surtió ${orden.proveedor?.nombre || 'el proveedor'}? El faltante se cancela o se compra con otro proveedor.`}
        onClose={onClose} />
      <div style={{ ...s.modalBody, gap: 16 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ ...s.table, minWidth: 760 }}>
            <thead>
              <tr>
                <th style={s.th}>Partida</th>
                <th style={{ ...s.th, width: 200 }}>Surtió</th>
                <th style={{ ...s.th, width: 90, textAlign: 'right' }}>Faltante</th>
                <th style={{ ...s.th, width: 170 }}>El faltante</th>
                <th style={{ ...s.th, width: 120 }}>Precio nuevo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const surtida = Number(f.surtida) || 0
                const falta = redondear(f.pedida - surtida)
                const pct = f.pedida ? Math.round((100 * surtida) / f.pedida) : 0
                return (
                  <tr key={f.id}>
                    <td style={s.tdForm}>
                      <div style={{ fontWeight: 600 }}>{f.concepto}</div>
                      <div style={{ fontSize: 12, color: 'var(--pc-gris)' }}>Pedido: {f.pedida} {f.unidad}</div>
                    </td>
                    <td style={s.tdForm}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="number" min="0" max={f.pedida} step="any" style={{ ...s.inputTabla, width: 80 }}
                          value={f.surtida} onChange={(e) => set(f.id, 'surtida', e.target.value)} />
                        <span style={{ fontSize: 12, color: 'var(--pc-gris)', minWidth: 34 }}>{pct}%</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        {ATAJOS.map(([factor, texto]) => (
                          <button key={texto} style={s.atajo}
                            onClick={() => set(f.id, 'surtida', String(redondear(f.pedida * factor)))}>
                            {texto}
                          </button>
                        ))}
                      </div>
                      <div style={s.barraSurtido}>
                        <div style={{ ...s.barraSurtidoLlena, width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </td>
                    <td style={{ ...s.tdForm, textAlign: 'right', fontWeight: 600,
                                 color: falta > 0 ? 'var(--pc-acento)' : 'var(--pc-gris-3)' }}>
                      {falta > 0 ? `${falta} ${f.unidad}` : '—'}
                    </td>
                    <td style={s.tdForm}>
                      {falta > 0 ? (
                        <select style={s.inputTabla} value={f.faltante} onChange={(e) => set(f.id, 'faltante', e.target.value)}>
                          <option value="complemento">Comprar con otro proveedor</option>
                          <option value="cancelar">Ya no se necesita</option>
                        </select>
                      ) : <span style={{ fontSize: 12, color: 'var(--pc-gris-3)' }}>Completo</span>}
                    </td>
                    <td style={s.tdForm}>
                      {falta > 0 && f.faltante === 'complemento' ? (
                        <input type="number" min="0" step="any" style={s.inputTabla} value={f.precio}
                          onChange={(e) => set(f.id, 'precio', e.target.value)} />
                      ) : <span style={{ fontSize: 12, color: 'var(--pc-gris-3)' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {aComplemento.length > 0 && (
          <div style={s.panel}>
            <p style={s.panelTitulo}><PackageOpen size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Orden complementaria</p>
            <p style={s.panelAyuda}>
              Se crea una orden nueva con el faltante, ligada a la #{orden.folio}. Sus requerimientos y contratos se conservan.
            </p>
            <div style={s.grid2}>
              <div>
                <Label requerido>Proveedor del faltante</Label>
                <ComboProveedor proveedores={proveedores} valor={proveedorId} onChange={setProveedorId} />
              </div>
              <div>
                <Label>Forma de pago sugerida</Label>
                <select style={s.input} value={tipoPago} onChange={(e) => setTipoPago(e.target.value)}>
                  {METODOS_PAGO.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={enviar} onChange={(e) => setEnviar(e.target.checked)} />
              Enviarla a autorización de inmediato (es urgente)
            </label>
          </div>
        )}

        <label>
          <Label requerido>Qué pasó</Label>
          <textarea style={{ ...s.input, resize: 'vertical' }} rows={2} value={motivo}
            placeholder="Ej. Parisina solo tenía 20 m de tergal; el resto se compra de urgencia con el surtidor del tapicero"
            onChange={(e) => setMotivo(e.target.value)} />
        </label>

        {conFaltante.length > 0 && !invalida && !nadaSurtido && (
          <div style={s.resumenSurtido}>
            <div>
              <div style={s.resumenEtiqueta}>Orden #{orden.folio} · {orden.proveedor?.nombre}</div>
              <div style={s.resumenMonto}>{money(queda)}</div>
              <div style={{ fontSize: 12, color: 'var(--pc-gris)' }}>antes {money(orden.total)}</div>
            </div>
            {aComplemento.length > 0 && (<>
              <ArrowRight size={18} style={{ color: 'var(--pc-gris-3)', flex: 'none' }} />
              <div>
                <div style={s.resumenEtiqueta}>Orden nueva · {provComp?.nombre || 'proveedor por elegir'}</div>
                <div style={s.resumenMonto}>{money(complemento)}</div>
                <div style={{ fontSize: 12, color: 'var(--pc-gris)' }}>{enviar ? 'va a autorización' : 'queda en borrador'}</div>
              </div>
            </>)}
          </div>
        )}

        {intento && errores.length > 0 && <div style={s.avisoError}>{errores[0]}</div>}

        <div style={{ ...s.filaFin, marginTop: 0 }}>
          <span style={{ fontSize: 12.5, color: 'var(--pc-gris)', marginRight: 'auto' }}>
            Se avisa a administración y contabilidad.
          </span>
          <button style={s.btnGhost} onClick={onClose}>Cancelar</button>
          <button style={bloqueado(s.btnPrimary, guardando)} disabled={guardando} onClick={guardar}>
            {guardando ? 'Registrando...' : 'Registrar surtido'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
