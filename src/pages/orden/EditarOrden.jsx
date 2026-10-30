import { useState, useEffect } from 'react'
import { Plus, Trash2, BellRing } from 'lucide-react'
import api from '../../api'
import { UNIDADES, money, mensajeError, totalConIva } from '../../constants'
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

  const total = totalConIva(filas)
  const diferencia = Math.round((total - Number(orden.total || 0)) * 100) / 100

  const errores = []
  if (!filas.length) errores.push('La orden necesita al menos una partida.')
  filas.forEach((f, i) => {
    if (!f.concepto.trim()) errores.push(`Partida ${i + 1}: falta el concepto.`)
    if (!(Number(f.cantidad) > 0)) errores.push(`Partida ${i + 1}: la cantidad debe ser mayor que cero.`)
    if (!(Number(f.precio_unitario) >= 0)) errores.push(`Partida ${i + 1}: el precio no puede ser negativo.`)
  })
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
        subtitulo="Cambia cantidades, precios o conceptos; agrega o quita partidas." onClose={onClose} />
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
