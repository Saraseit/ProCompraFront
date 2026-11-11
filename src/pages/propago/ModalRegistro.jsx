import { useState } from 'react'
import api from '../../api'
import { mensajeError } from '../../constants'
import Modal, { ModalHead, Label } from '../../ui/Modal'
import { useToast } from '../../ui/feedback-context'
import { s } from '../pagos/estilos'

// Corrige un renglón a mano. Uno ya exportado no cambia en el ERP: queda un
// ajuste pendiente para hacerlo allá, porque el ERP no acepta cargos negativos.
export default function ModalRegistro({ registro: r, cuentas, onClose, onGuardado }) {
  const toast = useToast()
  const exportado = r.estado === 'exportado'
  const [datos, setDatos] = useState({
    cuenta_id: r.cuenta_id || '', cargo: String(r.cargo), contrato: r.contrato || '', ref: r.ref, motivo: '',
  })
  const [guardando, setGuardando] = useState(false)
  const set = (k, v) => setDatos((d) => ({ ...d, [k]: v }))

  async function guardar() {
    const cambios = {}
    if (datos.cuenta_id && datos.cuenta_id !== r.cuenta_id) cambios.cuenta_id = datos.cuenta_id
    if (Number(datos.cargo) !== Number(r.cargo)) cambios.cargo = Number(datos.cargo)
    if ((datos.contrato || '') !== (r.contrato || '')) cambios.contrato = datos.contrato
    if (datos.ref.trim() !== r.ref) cambios.ref = datos.ref.trim()
    if (!Object.keys(cambios).length) return onClose()
    setGuardando(true)
    try {
      await api.patch(`/propago/registros/${r.id}`, { ...cambios, ...(exportado ? { motivo: datos.motivo } : {}) })
      toast(exportado ? 'Corrección guardada: aplícala en el ERP (Ajustes ERP)' : 'Renglón actualizado')
      onGuardado()
    } catch (e) {
      toast('No se pudo guardar: ' + mensajeError(e), 'error')
      setGuardando(false)
    }
  }

  const invalido = !(Number(datos.cargo) > 0) || !datos.ref.trim() || (exportado && !datos.motivo.trim())

  return (
    <Modal onClose={onClose} maxWidth={640}>
      <ModalHead titulo="Editar renglón" subtitulo={exportado ? 'Ya exportado: se guardará como ajuste para el ERP' : 'Los cambios a mano no se pierden al regenerar'}
        onClose={onClose} />
      <div style={{ padding: '14px 24px 22px', display: 'grid', gap: 12 }}>
        {exportado && (
          <div style={s.aviso}>
            Este renglón ya se subió al ERP. ProCompra guarda la corrección y la deja en «Ajustes ERP» para que la hagas allá a mano.
          </div>
        )}
        <div style={s.grid2}>
          <label>
            <Label requerido>Cargo</Label>
            <input type="number" min="0" step="0.01" style={s.input} value={datos.cargo} onChange={(e) => set('cargo', e.target.value)} />
          </label>
          <label>
            <Label>Contrato</Label>
            <input style={s.input} value={datos.contrato} placeholder="0 si no lleva" onChange={(e) => set('contrato', e.target.value)} />
          </label>
        </div>
        <label>
          <Label requerido>Cuenta</Label>
          <select style={s.input} value={datos.cuenta_id} onChange={(e) => set('cuenta_id', e.target.value)}>
            <option value="" disabled>Elige la cuenta</option>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre_erp}</option>)}
          </select>
        </label>
        <label>
          <Label requerido>Ref (texto del registro)</Label>
          <textarea style={{ ...s.input, fontFamily: 'var(--pc-mono)', fontSize: 12.5, minHeight: 80 }} value={datos.ref}
            onChange={(e) => set('ref', e.target.value)} />
        </label>
        {exportado && (
          <label>
            <Label requerido>Motivo</Label>
            <input style={s.input} value={datos.motivo} placeholder="Qué se corrige y por qué" onChange={(e) => set('motivo', e.target.value)} />
          </label>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button style={s.btnGhost} onClick={onClose}>Cancelar</button>
          <button style={{ ...s.btnPrimary, opacity: invalido || guardando ? 0.45 : 1 }} disabled={invalido || guardando} onClick={guardar}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
