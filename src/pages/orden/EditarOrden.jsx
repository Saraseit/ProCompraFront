import { useState, useEffect } from 'react'
import { Plus, Trash2, BellRing } from 'lucide-react'
import api from '../../api'
import { UNIDADES, money, mensajeError, totalesOrden } from '../../constants'
import Modal, { ModalHead, Label } from '../../ui/Modal'
import ComboProveedor from '../../ui/ComboProveedor'
import { useToast } from '../../ui/feedback-context'
import { s, bloqueado } from './estilos'

// Estados en que aún se puede cambiar de proveedor (sin pagos registrados).
const CAMBIO_PROVEEDOR = ['borrador', 'autorizacion', 'autorizada']

const filaDe = (p) => ({
  clave: p.id, id: p.id, req_id: p.req_id || null, concepto: p.concepto,
  cantidad: String(p.cantidad), unidad: p.unidad, precio_unitario: String(p.precio_unitario),
  contrato: p.contrato || '',
})

let siguiente = 0
const filaNueva = () => ({
  clave: `nueva-${++siguiente}`, id: null, req_id: null, concepto: '',
  cantidad: '1', unidad: 'PZA', precio_unitario: '0', contrato: '',
})

// Edición de partidas en cualquier estado. Fuera de borrador pide motivo y el
// backend avisa a administración y contabilidad.
export default function EditarOrden({ orden, onClose, onGuardado }) {
  const [filas, setFilas] = useState(() => (orden.partidas || []).map(filaDe))
  const [proveedorId, setProveedorId] = useState(orden.proveedor_id)
  const [proveedores, setProveedores] = useState([])
  const [motivo, setMotivo] = useState('')
  // Descuento e IVA (fase 9). Sin la migración la orden no trae con_iva y no se ofrecen.
  const conDescuentos = 'con_iva' in orden
  const [descTipo, setDescTipo] = useState(orden.descuento_tipo || 'ninguno')
  const [descValor, setDescValor] = useState(orden.descuento_tipo ? String(Number(orden.descuento_valor)) : '')
  const [conIva, setConIva] = useState(orden.con_iva !== false)
  const [guardando, setGuardando] = useState(false)
  const [intento, setIntento] = useState(false)
  const toast = useToast()

  const borrador = orden.estado === 'borrador'
  const cambiaProveedor = CAMBIO_PROVEEDOR.includes(orden.estado) && !(orden.pagos?.length)

  useEffect(() => {
    if (!cambiaProveedor) return
    api.get('/proveedores').then(({ data }) => setProveedores(data)).catch(() => {})
  }, [cambiaProveedor])

  const set = (clave, campo, valor) =>
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)))
  const quitar = (clave) => setFilas((fs) => fs.filter((f) => f.clave !== clave))

  const config = { descuento_tipo: descTipo === 'ninguno' ? null : descTipo, descuento_valor: descValor, con_iva: conIva }
  const t = totalesOrden(filas, config)
  const total = t.total
  const diferencia = Math.round((total - Number(orden.total || 0)) * 100) / 100

  const errores = []
  if (!filas.length) errores.push('La orden necesita al menos una partida.')
  filas.forEach((f, i) => {
    if (!f.concepto.trim()) errores.push(`Partida ${i + 1}: falta el concepto.`)
    if (!(Number(f.cantidad) > 0)) errores.push(`Partida ${i + 1}: la cantidad debe ser mayor que cero.`)
    if (!(Number(f.precio_unitario) >= 0)) errores.push(`Partida ${i + 1}: el precio no puede ser negativo.`)
  })
  if (descTipo !== 'ninguno') {
    const v = Number(descValor)
    if (descValor === '' || !(v > 0)) errores.push('Captura el descuento o elige «Sin descuento».')
    else if (descTipo === 'porcentaje' && v > 100) errores.push('El descuento no puede pasar de 100 %.')
    else if (descTipo === 'importe' && v > t.subtotal) errores.push(`El descuento no puede ser mayor que el subtotal (${money(t.subtotal)}).`)
  }
  if (!borrador && !motivo.trim()) errores.push('Explica el motivo del cambio.')
  const puede = !errores.length && !guardando

  async function guardar() {
    setIntento(true)
    if (!puede) return
    setGuardando(true)
    try {
      await api.put(`/ordenes/${orden.id}/partidas`, {
        partidas: filas.map((f) => ({
          id: f.id, req_id: f.req_id, concepto: f.concepto.trim(), cantidad: Number(f.cantidad),
          unidad: f.unidad, precio_unitario: Number(f.precio_unitario), contrato: f.contrato.trim() || null,
        })),
        motivo: motivo.trim() || null,
        proveedor_id: proveedorId,
        ...(conDescuentos ? {
          descuento_tipo: descTipo,
          descuento_valor: descTipo === 'ninguno' ? 0 : Number(descValor),
          con_iva: conIva,
        } : {}),
      })
      toast(borrador ? 'Orden actualizada' : `Orden #${orden.folio} modificada · se avisó a administración y contabilidad`)
      onGuardado()
    } catch (e) {
      toast('No se guardó: ' + mensajeError(e), 'error')
      setGuardando(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={860} zIndex={70} arriba>
      <ModalHead titulo={`Editar orden #${orden.folio}`}
        subtitulo="Cambia cantidades, precios, descuento o IVA; agrega o quita partidas." onClose={onClose} />
      <div style={{ ...s.modalBody, gap: 16 }}>
        {!borrador && (
          <div style={s.aviso}>
            <BellRing size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
            La orden ya está en curso: al guardar se avisa a <b>administración y contabilidad</b> y el cambio queda en el historial.
            Si el proveedor no tiene todo el material, usa mejor <b>Surtido parcial</b> para mandar el faltante a otra orden.
          </div>
        )}

        {cambiaProveedor && (
          <div>
            <Label>Proveedor</Label>
            <ComboProveedor proveedores={proveedores} valor={proveedorId}
              onChange={(id) => setProveedorId(id || orden.proveedor_id)} />
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ ...s.table, minWidth: 720 }}>
            <thead>
              <tr>
                <th style={s.th}>Concepto</th>
                <th style={{ ...s.th, width: 90 }}>Cant.</th>
                <th style={{ ...s.th, width: 110 }}>Unidad</th>
                <th style={{ ...s.th, width: 110 }}>P. unit.</th>
                <th style={{ ...s.th, width: 120 }}>Contrato</th>
                <th style={{ ...s.th, width: 110, textAlign: 'right' }}>Importe</th>
                <th style={{ ...s.th, width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.clave}>
                  <td style={s.tdForm}>
                    <input style={s.inputTabla} value={f.concepto} placeholder="Concepto"
                      onChange={(e) => set(f.clave, 'concepto', e.target.value)} />
                  </td>
                  <td style={s.tdForm}>
                    <input type="number" min="0" step="any" style={s.inputTabla} value={f.cantidad}
                      onChange={(e) => set(f.clave, 'cantidad', e.target.value)} />
                  </td>
                  <td style={s.tdForm}>
                    <select style={s.inputTabla} value={f.unidad} onChange={(e) => set(f.clave, 'unidad', e.target.value)}>
                      {[...new Set([f.unidad, ...UNIDADES])].map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td style={s.tdForm}>
                    <input type="number" min="0" step="any" style={s.inputTabla} value={f.precio_unitario}
                      onChange={(e) => set(f.clave, 'precio_unitario', e.target.value)} />
                  </td>
                  <td style={s.tdForm}>
                    <input style={s.inputTabla} value={f.contrato} placeholder="—"
                      onChange={(e) => set(f.clave, 'contrato', e.target.value)} />
                  </td>
                  <td style={{ ...s.tdForm, textAlign: 'right', fontWeight: 600 }}>
                    {money((Number(f.cantidad) || 0) * (Number(f.precio_unitario) || 0))}
                  </td>
                  <td style={s.tdForm}>
                    <button style={s.btnIcono} onClick={() => quitar(f.clave)} title="Quitar partida" aria-label="Quitar partida">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <button style={s.btnChico} onClick={() => setFilas((fs) => [...fs, filaNueva()])}>
            <Plus size={14} /> Agregar partida
          </button>
        </div>

        {conDescuentos && (
          <div style={e.ajustes}>
            <div>
              <Label>Descuento</Label>
              <div style={e.filaDescuento}>
                <div style={e.segmento} role="radiogroup" aria-label="Tipo de descuento">
                  {[['ninguno', 'Sin descuento'], ['importe', 'Importe $'], ['porcentaje', 'Porcentaje %']].map(([k, label]) => (
                    <button key={k} type="button" role="radio" aria-checked={descTipo === k}
                      style={{ ...e.segBtn, ...(descTipo === k ? e.segActivo : {}) }}
                      onClick={() => setDescTipo(k)}>{label}</button>
                  ))}
                </div>
                {descTipo !== 'ninguno' && (
                  <div style={e.campoValor}>
                    {descTipo === 'importe' && <span style={e.unidadValor}>$</span>}
                    <input type="number" min="0" step="any" max={descTipo === 'porcentaje' ? 100 : undefined}
                      style={{ ...s.inputTabla, width: 120 }} value={descValor} autoFocus
                      aria-label={descTipo === 'importe' ? 'Descuento en pesos' : 'Descuento en porcentaje'}
                      placeholder={descTipo === 'importe' ? '0.00' : '0'} onChange={(ev) => setDescValor(ev.target.value)} />
                    {descTipo === 'porcentaje' && <span style={e.unidadValor}>%</span>}
                  </div>
                )}
              </div>
            </div>
            <label style={e.checkIva}>
              <input type="checkbox" checked={conIva} onChange={(ev) => setConIva(ev.target.checked)} />
              <span>Lleva IVA 16 %<span style={e.nota}>Desmárcalo si se compra o paga sin IVA</span></span>
            </label>
          </div>
        )}

        <div style={e.desglose}>
          <span>Subtotal</span><span>{money(t.subtotal)}</span>
          {t.descuento > 0 && <>
            <span>Descuento{descTipo === 'porcentaje' ? ` (${Number(descValor)} %)` : ''}</span>
            <span style={{ color: 'var(--pc-verde)' }}>−{money(t.descuento)}</span>
          </>}
          <span>{conIva ? 'IVA 16 %' : 'Sin IVA'}</span><span>{money(t.iva)}</span>
        </div>

        <div style={s.totalesEdicion}>
          <span style={{ color: 'var(--pc-gris)' }}>Total actual {money(orden.total)}</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>
            Nuevo total {money(total)}
            {diferencia !== 0 && (
              <span style={{ marginLeft: 8, fontSize: 13, color: diferencia > 0 ? 'var(--pc-rojo)' : 'var(--pc-verde)' }}>
                ({diferencia > 0 ? '+' : '−'}{money(Math.abs(diferencia))})
              </span>
            )}
          </span>
        </div>

        <label>
          <Label requerido={!borrador}>Motivo del cambio</Label>
          <textarea style={{ ...s.input, resize: 'vertical' }} rows={2} value={motivo}
            placeholder="Ej. El proveedor subió el precio de la tela / se necesitan 10 metros más"
            onChange={(e) => setMotivo(e.target.value)} />
        </label>

        {intento && errores.length > 0 && <div style={s.avisoError}>{errores[0]}</div>}

        <div style={{ ...s.filaFin, marginTop: 0 }}>
          <button style={s.btnGhost} onClick={onClose}>Cancelar</button>
          <button style={bloqueado(s.btnPrimary, guardando)} disabled={guardando} onClick={guardar}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Estilos propios del bloque de descuento e IVA.
const e = {
  ajustes: { display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' },
  filaDescuento: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  segmento: { display: 'inline-flex', background: 'var(--pc-superficie-3)', borderRadius: 9, padding: 3, gap: 2, flexWrap: 'wrap' },
  segBtn: { border: 'none', background: 'none', color: 'var(--pc-gris-2)', padding: '6px 12px', borderRadius: 7,
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' },
  segActivo: { background: 'var(--pc-superficie)', color: 'var(--pc-tinta)', boxShadow: 'var(--pc-sombra-1)' },
  campoValor: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  unidadValor: { fontSize: 13, color: 'var(--pc-gris)', fontWeight: 600 },
  checkIva: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer', paddingBottom: 4 },
  nota: { display: 'block', fontSize: 11.5, color: 'var(--pc-gris-3)', marginTop: 2 },
  desglose: { display: 'grid', gridTemplateColumns: 'auto auto', justifyContent: 'end', columnGap: 24, rowGap: 4,
              fontSize: 13, color: 'var(--pc-gris)', textAlign: 'right', paddingRight: 14 },
}
