import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import api from '../../api'
import { money, hoy, mensajeError } from '../../constants'
import Modal, { ModalHead, Label } from '../../ui/Modal'
import { useToast } from '../../ui/feedback-context'
import CampoCaja from './CampoCaja'
import { refrescarProPago } from './comun'
import { s } from '../pagos/estilos'

const LINEA = { concepto: '', cantidad: '', contrato: '', importe: '', con_iva: false }

// Gasto pagado por urgencia sin orden previa: casetas, DiDi, hidratación.
// Cada línea es un renglón; la cuenta la sugieren las reglas del catálogo.
export default function ModalSinOrden({ estado, onClose, onHecho }) {
  const toast = useToast()
  const [caja, setCaja] = useState(() => (estado?.cajas || []).filter((c) => c.puede_registrar).length === 1
    ? estado.cajas.find((c) => c.puede_registrar) : null)
  const [datos, setDatos] = useState({ fecha_pago: hoy(), justificacion: '', proveedor_texto: '', referencia: '',
                                       comision: '', diferencia: '' })
  const [lineas, setLineas] = useState([{ ...LINEA }])
  const [guardando, setGuardando] = useState(false)
  const set = (k, v) => setDatos((d) => ({ ...d, [k]: v }))
  const setLinea = (i, k, v) => setLineas((ls) => ls.map((l, n) => (n === i ? { ...l, [k]: v } : l)))

  const total = lineas.reduce((t, l) => t + (Number(l.importe) || 0), 0) + (Number(datos.comision) || 0) + (Number(datos.diferencia) || 0)
  const faltante =
    !caja ? 'Elige de qué caja sale el pago'
    : !datos.fecha_pago ? 'Captura la fecha'
    : datos.justificacion.trim().length < 3 ? 'Explica por qué se pagó sin orden'
    : lineas.some((l) => !l.concepto.trim() || !(Number(l.importe) > 0)) ? 'Cada línea necesita concepto e importe'
    : null

  async function registrar() {
    if (faltante || guardando) return
    setGuardando(true)
    try {
      const { data } = await api.post('/propago/sin-orden', {
        ...datos, caja_id: caja.id,
        comision: Number(datos.comision) || 0, diferencia: Number(datos.diferencia) || 0,
        lineas: lineas.map((l) => ({ ...l, cantidad: l.cantidad === '' ? null : Number(l.cantidad), importe: Number(l.importe) })),
      })
      refrescarProPago()
      toast(`Pago sin orden de ${money(data.monto)} registrado · ${data.generados || 0} renglón(es) para el ERP`)
      onHecho()
    } catch (e) {
      toast('No se pudo registrar: ' + mensajeError(e), 'error')
      setGuardando(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={760}>
      <ModalHead titulo="Pago sin orden" subtitulo="Gastos de urgencia que no pasaron por una orden de compra" onClose={onClose} />
      <div style={{ padding: '14px 24px 22px' }}>
        <div style={s.grid2}>
          <CampoCaja estado={estado} valor={caja?.id} onCambio={setCaja} />
          <label>
            <Label requerido>Fecha</Label>
            <input type="date" style={s.input} value={datos.fecha_pago} onChange={(e) => set('fecha_pago', e.target.value)} />
          </label>
          <label>
            <Label>Proveedor, tienda o persona</Label>
            <input style={s.input} value={datos.proveedor_texto} placeholder="Minisuper GM, Samuel…"
              onChange={(e) => set('proveedor_texto', e.target.value)} />
          </label>
          <label>
            <Label>Referencia (opcional)</Label>
            <input style={s.input} value={datos.referencia} onChange={(e) => set('referencia', e.target.value)} />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            <Label requerido>Justificación</Label>
            <input style={s.input} value={datos.justificacion} placeholder="Por qué se pagó sin orden: urgencia en evento, diligencia…"
              onChange={(e) => set('justificacion', e.target.value)} />
          </label>
        </div>

        <div style={{ ...s.tablaWrap, border: '1px solid var(--pc-borde)', borderRadius: 10, margin: '14px 0' }}>
          <table style={{ ...s.table, minWidth: 640 }}>
            <thead>
              <tr>
                <th style={s.th}>Concepto</th>
                <th style={{ ...s.th, width: 80 }}>Cant.</th>
                <th style={{ ...s.th, width: 130 }}>Contrato</th>
                <th style={{ ...s.th, width: 120, textAlign: 'right' }}>Importe</th>
                <th style={{ ...s.th, width: 80 }} title="Tiene factura: se separa el IVA">Factura</th>
                <th style={{ ...s.th, width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i}>
                  <td style={s.td}>
                    <input style={{ ...s.input, padding: '6px 8px' }} value={l.concepto} aria-label={`Concepto de la línea ${i + 1}`}
                      placeholder="DiDi para depósitos en el banco" onChange={(e) => setLinea(i, 'concepto', e.target.value)} />
                  </td>
                  <td style={s.td}>
                    <input type="number" min="0" style={{ ...s.input, padding: '6px 8px' }} value={l.cantidad} aria-label={`Cantidad de la línea ${i + 1}`}
                      onChange={(e) => setLinea(i, 'cantidad', e.target.value)} />
                  </td>
                  <td style={s.td}>
                    <input style={{ ...s.input, padding: '6px 8px' }} value={l.contrato} placeholder="17101" aria-label={`Contrato de la línea ${i + 1}`}
                      onChange={(e) => setLinea(i, 'contrato', e.target.value)} />
                  </td>
                  <td style={s.td}>
                    <input type="number" min="0" step="0.01" style={{ ...s.input, padding: '6px 8px', textAlign: 'right' }} value={l.importe}
                      aria-label={`Importe de la línea ${i + 1}`} onChange={(e) => setLinea(i, 'importe', e.target.value)} />
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <input type="checkbox" checked={l.con_iva} aria-label={`La línea ${i + 1} tiene factura`}
                      onChange={(e) => setLinea(i, 'con_iva', e.target.checked)} />
                  </td>
                  <td style={s.td}>
                    {lineas.length > 1 && (
                      <button style={s.btnBorrar} aria-label={`Quitar la línea ${i + 1}`}
                        onClick={() => setLineas((ls) => ls.filter((_, n) => n !== i))}><Trash2 size={13} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button style={s.btnGhost} onClick={() => setLineas((ls) => [...ls, { ...LINEA }])}><Plus size={13} /> Agregar línea</button>
        <p style={{ ...s.nota, marginTop: 10 }}>
          Varios contratos en una línea (17095/17100) reparten el importe en partes iguales. Con «Factura» se separa el IVA (16 %);
          sin factura el renglón va completo con ND.
        </p>

        <div style={s.grid2}>
          <label>
            <Label>Comisión (opcional)</Label>
            <input type="number" min="0" step="0.01" style={s.input} value={datos.comision} placeholder="OXXO, SPEI…"
              onChange={(e) => set('comision', e.target.value)} />
          </label>
          <label>
            <Label>Diferencia (opcional)</Label>
            <input type="number" min="0" step="0.01" style={s.input} value={datos.diferencia} placeholder="Propina, redondeo"
              onChange={(e) => set('diferencia', e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <span style={{ flex: 1, fontSize: 12.5, color: faltante ? 'var(--pc-gris)' : 'var(--pc-verde)' }}>
            {faltante || `Sale de ${caja.nombre}: ${money(total)}`}
          </span>
          <button style={s.btnGhost} onClick={onClose}>Cancelar</button>
          <button style={{ ...s.btnPrimary, opacity: faltante || guardando ? 0.45 : 1, cursor: faltante || guardando ? 'not-allowed' : 'pointer' }}
            disabled={!!faltante || guardando} onClick={registrar}>
            {guardando ? 'Registrando...' : 'Registrar pago →'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
