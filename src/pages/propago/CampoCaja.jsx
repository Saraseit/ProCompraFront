import { Label } from '../../ui/Modal'
import { etiquetaTipoCaja } from './comun'
import { s } from '../pagos/estilos'

// Selector de la caja de la que sale un pago. Sin ProPago o sin cajas no se muestra.
export default function CampoCaja({ estado, valor, onCambio, requerido = true }) {
  const cajas = (estado?.cajas || []).filter((c) => c.puede_registrar)
  if (!estado?.disponible || !(estado.cajas || []).length) return null
  return (
    <label>
      <Label requerido={requerido}>Caja</Label>
      <select style={s.input} value={valor || ''} onChange={(e) => onCambio(cajas.find((c) => c.id === e.target.value) || null)}>
        <option value="">{cajas.length ? 'Elige de dónde sale el pago' : 'No tienes cajas asignadas'}</option>
        {cajas.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {etiquetaTipoCaja(c.tipo)} · {c.plaza}</option>)}
      </select>
    </label>
  )
}
