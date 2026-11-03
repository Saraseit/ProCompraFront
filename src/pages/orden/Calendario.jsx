import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import api from '../../api'
import { money, hoy, isoLocal, mensajeError } from '../../constants'
import Modal, { ModalHead, Label } from '../../ui/Modal'
import { useToast } from '../../ui/feedback-context'
import { s as so } from './estilos'

const redondo = (n) => Math.round(n * 100) / 100

function sumarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number)
  return isoLocal(new Date(a, m - 1, d + dias))
}

// Fechas en que se paga una compra a crédito. El plazo cambia en cada compra
// (una semana, un mes, tres meses) y a veces se divide en varios pagos con
// recargo: por eso se captura aquí y no en el proveedor.
export default function Calendario({ ordenId, folio, base, pagado = 0, cuotas = [], onClose, onGuardado }) {
  const toast = useToast()
  const [filas, setFilas] = useState(() =>
    cuotas.length
      ? cuotas.map((c) => ({ fecha: c.fecha, monto: String(c.monto), notas: c.notas || '' }))
      : [{ fecha: sumarDias(hoy(), 30), monto: String(redondo(base)), notas: '' }])
  const [division, setDivision] = useState({ pagos: 2, cada: 30, desde: sumarDias(hoy(), 30), total: String(redondo(base)) })
  const [guardando, setGuardando] = useState(false)

  const set = (i, k, v) => setFilas((f) => f.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const total = redondo(filas.reduce((t, f) => t + (Number(f.monto) || 0), 0))
  const diferencia = redondo(total - base)

  const faltante =
    filas.some((f) => !f.fecha) ? 'Cada pago necesita su fecha'
    : filas.some((f) => !(Number(f.monto) > 0)) ? 'Cada pago necesita un monto mayor a cero'
    : null

  function dividir() {
    const n = Math.max(1, Math.min(12, Number(division.pagos) || 1))
    const cada = Math.max(1, Number(division.cada) || 30)
    const totalDividir = Number(division.total) || base
    const parte = Math.floor((totalDividir / n) * 100) / 100
    setFilas(Array.from({ length: n }, (_, i) => ({
      fecha: sumarDias(division.desde || hoy(), cada * i),
      // El último pago absorbe los centavos del redondeo.
      monto: String(i === n - 1 ? redondo(totalDividir - parte * (n - 1)) : parte),
      notas: n > 1 ? `${i + 1} de ${n}` : '',
    })))
  }

  async function guardar() {
    if (faltante || guardando) return
    setGuardando(true)
    try {
      const { data } = await api.put(`/ordenes/${ordenId}/programados`, {
        programados: filas.map((f) => ({ fecha: f.fecha, monto: redondo(Number(f.monto)), notas: f.notas.trim() || null })),
      })
      toast(filas.length ? `Fechas de pago guardadas en la orden #${folio}` : `Se quitaron las fechas de pago de la orden #${folio}`)
      onGuardado?.(data)
    } catch (e) {
      toast('No se pudieron guardar las fechas: ' + mensajeError(e), 'error')
      setGuardando(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={620} zIndex={70}>
      <ModalHead titulo={`Fechas de pago · orden #${folio}`}
        subtitulo={`Importe de la compra ${money(base)}${pagado > 0 ? ` · ya abonado ${money(pagado)}` : ''}`}
        onClose={onClose} />
      <div style={{ padding: '14px 24px 22px' }}>
        <p style={s.ayuda}>
          Captura cuándo se le paga al proveedor. Si la compra se divide en varios pagos, agrega una fecha
          por pago; si diferir tiene recargo, pon el monto real de cada pago. Lo abonado se aplica a las
          primeras fechas.
        </p>

        <div style={s.division}>
          <span style={{ fontWeight: 600 }}>Dividir</span>
          <input type="number" min="1" max="12" style={{ ...so.input, width: 64 }} aria-label="Número de pagos"
            value={division.pagos} onChange={(e) => setDivision((d) => ({ ...d, pagos: e.target.value }))} />
          <span>pagos por un total de</span>
          <input type="number" min="0" step="0.01" style={{ ...so.input, width: 120 }} aria-label="Total a pagar"
            value={division.total} onChange={(e) => setDivision((d) => ({ ...d, total: e.target.value }))} />
          <span>cada</span>
          <input type="number" min="1" style={{ ...so.input, width: 64 }} aria-label="Días entre pagos"
            value={division.cada} onChange={(e) => setDivision((d) => ({ ...d, cada: e.target.value }))} />
          <span>días desde</span>
          <input type="date" style={{ ...so.input, width: 150 }} aria-label="Fecha del primer pago"
            value={division.desde} onChange={(e) => setDivision((d) => ({ ...d, desde: e.target.value }))} />
          <button style={so.btnChico} onClick={dividir}>Generar</button>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={s.filaHead}>
            <Label style={{ margin: 0 }}>Fecha</Label><Label style={{ margin: 0 }}>Monto</Label>
            <Label style={{ margin: 0 }}>Nota (opcional)</Label><span />
          </div>
          {filas.map((f, i) => (
            <div key={i} style={s.fila}>
              <input type="date" style={so.input} value={f.fecha} aria-label={`Fecha del pago ${i + 1}`}
                onChange={(e) => set(i, 'fecha', e.target.value)} />
              <input type="number" min="0" step="0.01" style={{ ...so.input, textAlign: 'right' }} value={f.monto}
                aria-label={`Monto del pago ${i + 1}`} onChange={(e) => set(i, 'monto', e.target.value)} />
              <input style={so.input} value={f.notas} placeholder="Ej. 1 de 2" aria-label={`Nota del pago ${i + 1}`}
                onChange={(e) => set(i, 'notas', e.target.value)} />
              <button style={s.quitar} onClick={() => setFilas((x) => x.filter((_, j) => j !== i))}
                aria-label={`Quitar el pago ${i + 1}`} title="Quitar esta fecha"><X size={14} /></button>
            </div>
          ))}
          <button style={{ ...so.btnChico, justifySelf: 'start' }}
            onClick={() => setFilas((x) => [...x, {
              fecha: x.length ? sumarDias(x[x.length - 1].fecha || hoy(), 30) : sumarDias(hoy(), 30),
              monto: String(Math.max(redondo(base - total), 0) || ''), notas: '' }])}>
            <Plus size={13} /> Agregar fecha
          </button>
        </div>

        <div style={s.resumen}>
          <span>Total programado <b>{money(total)}</b></span>
          {diferencia > 0.005 && <span style={{ color: 'var(--pc-ambar-texto)' }}>Recargo {money(diferencia)} sobre la compra</span>}
          {diferencia < -0.005 && filas.length > 0 && <span style={{ color: 'var(--pc-gris)' }}>Faltan {money(-diferencia)} sin fecha</span>}
          {!filas.length && <span style={{ color: 'var(--pc-gris)' }}>Sin fechas: la orden queda como "sin fecha de pago"</span>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {faltante && <span style={{ fontSize: 12.5, color: 'var(--pc-gris)', marginRight: 'auto' }}>{faltante}</span>}
          <button style={so.btnGhost} onClick={onClose}>Cancelar</button>
          <button style={{ ...so.btnPrimary, opacity: faltante || guardando ? 0.45 : 1 }}
            disabled={!!faltante || guardando} onClick={guardar}>
            {guardando ? 'Guardando...' : 'Guardar fechas'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

const s = {
  ayuda: { fontSize: 13, color: 'var(--pc-gris)', margin: '0 0 14px', lineHeight: 1.5 },
  division: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--pc-tinta)',
              background: 'var(--pc-superficie-2)', border: '1px solid var(--pc-borde)', borderRadius: 10,
              padding: '10px 12px', marginBottom: 16 },
  filaHead: { display: 'grid', gridTemplateColumns: 'minmax(128px, 150px) minmax(96px, 130px) minmax(0, 1fr) 32px', gap: 8 },
  fila: { display: 'grid', gridTemplateColumns: 'minmax(128px, 150px) minmax(96px, 130px) minmax(0, 1fr) 32px', gap: 8, alignItems: 'center' },
  quitar: { border: '1px solid var(--pc-borde)', background: 'var(--pc-superficie)', borderRadius: 7, height: 32,
            cursor: 'pointer', color: 'var(--pc-gris-2)', display: 'grid', placeItems: 'center' },
  resumen: { display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, marginTop: 14, paddingTop: 12,
             borderTop: '1px dashed var(--pc-borde)', color: 'var(--pc-tinta)' },
}
