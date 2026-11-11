import { useState } from 'react'
import api from '../../api'
import { METODOS_PAGO, METODOS_CON_ENTREGA, etiquetaMetodo, money, hoy, mensajeError } from '../../constants'
import Modal, { ModalHead, Label } from '../../ui/Modal'
import { useToast } from '../../ui/feedback-context'
import BotonArchivo from '../orden/BotonArchivo'
import { ACEPTA_DOCUMENTOS, subirAdjunto } from '../orden/archivos'
import CampoCaja from '../propago/CampoCaja'
import { NATURALEZAS, exigeCaja, refrescarProPago, useProPago } from '../propago/comun'
import { s } from './estilos'

const FORMAS = METODOS_PAGO.filter(([k]) => k !== 'credito')

// Forma sugerida: la que pidió operación si todas las órdenes son de contado y coinciden.
function formaSugerida(ordenes) {
  const formas = new Set(ordenes.map((o) => (o.tipo === 'contado' ? o.tipo_pago : 'transferencia')))
  const [unica] = formas
  return formas.size === 1 && FORMAS.some(([k]) => k === unica) ? unica : 'transferencia'
}

export default function ModalPago({ ordenes, onClose, onHecho }) {
  const toast = useToast()
  const [metodo, setMetodo] = useState(() => formaSugerida(ordenes))
  const [datos, setDatos] = useState({ fecha_pago: hoy(), referencia: '', entregado_a: '', notas: '' })
  // De entrada se paga lo que toca ahora (lo de esta semana o el siguiente pago), no todo el saldo.
  const [montos, setMontos] = useState(() => Object.fromEntries(ordenes.map((o) => [o.id, String(o.a_pagar ?? o.saldo)])))
  const [comprobante, setComprobante] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const propago = useProPago()
  const [caja, setCaja] = useState(null)
  const [extras, setExtras] = useState({ comision: '', diferencia: '' })
  const [naturalezas, setNaturalezas] = useState({})
  const set = (k, v) => setDatos((d) => ({ ...d, [k]: v }))
  const elegirCaja = (c) => { setCaja(c); if (c?.metodo) setMetodo(c.metodo) }

  const conEntrega = METODOS_CON_ENTREGA.includes(metodo)
  const monto = (o) => Number(montos[o.id])
  const total = ordenes.reduce((t, o) => t + (monto(o) || 0), 0)
  const extra = (Number(extras.comision) || 0) + (Number(extras.diferencia) || 0)
  const proveedores = new Set(ordenes.map((o) => o.proveedor?.id)).size
  const excedida = ordenes.find((o) => o.tipo === 'credito' && monto(o) > o.saldo + 0.005)
  // Anticipo, abono o saldo solo importan si el pago no es el total de una sola vez.
  const parcial = (o) => monto(o) < o.saldo - 0.005 || o.pagado > 0.005

  const faltante =
    exigeCaja(propago) && !caja ? 'Elige de qué caja sale el pago'
    : ordenes.some((o) => !(monto(o) > 0)) ? 'Cada orden necesita un monto mayor a cero'
    : excedida ? `A la orden #${excedida.folio} solo le quedan ${money(excedida.saldo)}`
    : !datos.fecha_pago ? 'Captura la fecha'
    : metodo === 'transferencia' && !datos.referencia.trim() ? 'Captura la referencia de la transferencia'
    : conEntrega && !datos.entregado_a.trim() ? 'Indica a quién se le entrega'
    : null

  async function registrar() {
    if (faltante || guardando) return
    setGuardando(true)
    try {
      await api.post('/pagos', {
        ...datos, metodo,
        ...(caja ? { caja_id: caja.id, comision: Number(extras.comision) || 0, diferencia: Number(extras.diferencia) || 0 } : {}),
        aplicaciones: ordenes.map((o) => ({
          orden_id: o.id, monto: Math.round(monto(o) * 100) / 100,
          naturaleza: parcial(o) ? naturalezas[o.id] || 'abono' : 'total',
        })),
      })
      if (caja) refrescarProPago()
    } catch (e) {
      toast('No se pudo registrar el pago: ' + mensajeError(e), 'error')
      setGuardando(false)
      return
    }
    // El comprobante queda en los documentos de cada orden que cubre.
    let sinComprobante = 0
    if (comprobante) {
      for (const o of ordenes) {
        try { await subirAdjunto(o.id, 'comprobante_pago', comprobante) } catch { sinComprobante++ }
      }
    }
    toast(ordenes.length === 1
      ? `Pago de ${money(total)} registrado en la orden #${ordenes[0].folio}`
      : `Pago de ${money(total)} registrado en ${ordenes.length} órdenes`)
    if (sinComprobante) toast(`El comprobante no se pudo adjuntar a ${sinComprobante} orden(es); súbelo desde la orden.`, 'error')
    onHecho()
  }

  return (
    <Modal onClose={onClose} maxWidth={640}>
      <ModalHead
        titulo={ordenes.length === 1 ? `Pagar la orden #${ordenes[0].folio}` : `Pagar ${ordenes.length} órdenes`}
        subtitulo={`Total ${money(total)}${proveedores > 1 ? ` · ${proveedores} proveedores` : ` · ${ordenes[0].proveedor?.nombre || ''}`}`}
        onClose={onClose} />
      <div style={{ padding: '14px 24px 22px' }}>
        <div style={{ ...s.tablaWrap, border: '1px solid var(--pc-borde)', borderRadius: 10, marginBottom: 14 }}>
          <table style={{ ...s.table, minWidth: 480 }}>
            <thead>
              <tr>
                <th style={s.th}>Orden</th>
                <th style={s.th}>Proveedor</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Toca / saldo</th>
                <th style={{ ...s.th, textAlign: 'right', width: 140 }}>Se paga</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => (
                <tr key={o.id}>
                  <td style={s.td}>
                    <b>#{o.folio}</b>
                    <div style={s.sub}>{o.tipo === 'credito' ? 'Crédito' : 'Contado'}</div>
                  </td>
                  <td style={s.td}>{o.proveedor?.nombre || '—'}</td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    {money(o.a_pagar ?? o.saldo)}
                    {o.a_pagar != null && o.a_pagar < o.saldo - 0.005 && <div style={s.sub}>de {money(o.saldo)}</div>}
                  </td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    <input type="number" min="0" step="0.01" aria-label={`Monto para la orden ${o.folio}`}
                      style={{ ...s.input, textAlign: 'right', padding: '6px 8px',
                               ...(o === excedida ? { borderColor: 'var(--pc-rojo)' } : {}) }}
                      value={montos[o.id]} onChange={(e) => setMontos((m) => ({ ...m, [o.id]: e.target.value }))} />
                    {caja && parcial(o) && (
                      <select aria-label={`Tipo de pago de la orden ${o.folio}`} style={{ ...s.input, padding: '4px 6px', fontSize: 12, marginTop: 4 }}
                        value={naturalezas[o.id] || 'abono'} onChange={(e) => setNaturalezas((n) => ({ ...n, [o.id]: e.target.value }))}>
                        {NATURALEZAS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {proveedores > 1 && metodo === 'transferencia' && (
          <div style={s.aviso}>
            El pago incluye órdenes de {proveedores} proveedores. Una transferencia suele ir a uno solo:
            revisa que la referencia sea la misma para todas.
          </div>
        )}

        <div style={s.grid2}>
          <CampoCaja estado={propago} valor={caja?.id} onCambio={elegirCaja} />
          <label>
            <Label requerido>Forma de pago</Label>
            <select style={s.input} value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              {FORMAS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label>
            <Label requerido>Fecha</Label>
            <input type="date" style={s.input} value={datos.fecha_pago} onChange={(e) => set('fecha_pago', e.target.value)} />
          </label>
          {conEntrega && (
            <label>
              <Label requerido>Entregado a</Label>
              <input style={s.input} value={datos.entregado_a} placeholder="Quién hará la compra"
                onChange={(e) => set('entregado_a', e.target.value)} />
            </label>
          )}
          <label>
            <Label requerido={metodo === 'transferencia'}>
              {metodo === 'transferencia' ? 'Referencia' : conEntrega && metodo !== 'efectivo' ? 'Tarjeta (últimos 4 dígitos)' : 'Referencia (opcional)'}
            </Label>
            <input style={s.input} value={datos.referencia} onChange={(e) => set('referencia', e.target.value)} />
          </label>
          {caja && (<>
            <label>
              <Label>Comisión (opcional)</Label>
              <input type="number" min="0" step="0.01" style={s.input} value={extras.comision} placeholder="OXXO, SPEI…"
                onChange={(e) => setExtras((x) => ({ ...x, comision: e.target.value }))} />
            </label>
            <label>
              <Label>Diferencia (opcional)</Label>
              <input type="number" min="0" step="0.01" style={s.input} value={extras.diferencia} placeholder="Propina, redondeo"
                onChange={(e) => setExtras((x) => ({ ...x, diferencia: e.target.value }))} />
            </label>
          </>)}
          <label style={{ gridColumn: '1 / -1' }}>
            <Label>Notas (opcional)</Label>
            <input style={s.input} value={datos.notas} placeholder="Por ejemplo: abono a facturas de octubre"
              onChange={(e) => set('notas', e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <BotonArchivo accept={ACEPTA_DOCUMENTOS} style={s.btnGhost} onArchivos={([a]) => setComprobante(a)}>
            {comprobante ? `Comprobante: ${comprobante.name}` : '+ Comprobante (opcional)'}
          </BotonArchivo>
          <span style={{ flex: 1, fontSize: 12.5, color: faltante ? 'var(--pc-gris)' : 'var(--pc-verde)' }}>
            {faltante || `${etiquetaMetodo(metodo)} por ${money(total + extra)}${extra > 0 ? ` (incluye ${money(extra)} de comisión o diferencia)` : ''}`}
          </span>
          <button style={s.btnGhost} onClick={onClose}>Cancelar</button>
          <button style={{ ...s.btnPrimary, opacity: faltante || guardando ? 0.45 : 1,
                           cursor: faltante || guardando ? 'not-allowed' : 'pointer' }}
            disabled={!!faltante || guardando} onClick={registrar}>
            {guardando ? 'Registrando...' : 'Registrar pago →'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
