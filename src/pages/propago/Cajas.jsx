import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Wallet } from 'lucide-react'
import api from '../../api'
import { METODOS_PAGO, etiquetaMetodo, etiquetaRol, mensajeError } from '../../constants'
import Modal, { ModalHead, Label } from '../../ui/Modal'
import { useToast } from '../../ui/feedback-context'
import { CargaTarjetas } from '../../ui/Carga'
import Vacio from '../../ui/Vacio'
import { TIPOS_CAJA, etiquetaTipoCaja, refrescarProPago } from './comun'
import { s } from '../pagos/estilos'

const FORMAS = METODOS_PAGO.filter(([k]) => k !== 'credito')
const VACIA = { nombre: '', tipo: 'banco', metodo: 'transferencia', plaza: 'MID', prefijo_poliza: '', numero_cuenta: '', activa: true, notas: '' }

function ModalCaja({ caja, usuarios, onClose, onListo }) {
  const toast = useToast()
  const [d, setD] = useState({ ...VACIA, ...caja })
  const [permisos, setPermisos] = useState(() => Object.fromEntries((caja?.usuarios || []).map((p) => [p.usuario_id, p])))
  const [guardando, setGuardando] = useState(false)
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }))
  const alternar = (id) => setPermisos((p) => {
    const x = { ...p }
    if (x[id]) delete x[id]
    else x[id] = { usuario_id: id, puede_registrar: true, puede_exportar: true }
    return x
  })
  const permiso = (id, k, v) => setPermisos((p) => ({ ...p, [id]: { ...p[id], [k]: v } }))

  async function guardar() {
    setGuardando(true)
    try {
      const datos = { nombre: d.nombre, tipo: d.tipo, metodo: d.metodo, plaza: d.plaza, prefijo_poliza: d.prefijo_poliza || null,
                      numero_cuenta: d.numero_cuenta || null, activa: d.activa, notas: d.notas || null }
      const { data } = caja?.id ? await api.patch(`/propago/cajas/${caja.id}`, datos) : await api.post('/propago/cajas', datos)
      await api.put(`/propago/cajas/${data.id}/usuarios`, Object.values(permisos))
      toast('Caja guardada')
      refrescarProPago()
      onListo()
    } catch (e) {
      toast('No se pudo guardar: ' + mensajeError(e), 'error')
      setGuardando(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={680}>
      <ModalHead titulo={caja?.id ? caja.nombre : 'Nueva caja'} subtitulo="El nombre de la caja es el PROPIETARIO en el archivo del ERP" onClose={onClose} />
      <div style={{ padding: '14px 24px 22px', display: 'grid', gap: 12 }}>
        <div style={s.grid2}>
          <label><Label requerido>Nombre (propietario en el ERP)</Label>
            <input style={s.input} value={d.nombre} placeholder="COMPRAS, AMERICAN, DAVID" onChange={(e) => set('nombre', e.target.value)} /></label>
          <label><Label>Tipo</Label>
            <select style={s.input} value={d.tipo} onChange={(e) => set('tipo', e.target.value)}>
              {TIPOS_CAJA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
          <label><Label>Forma de pago</Label>
            <select style={s.input} value={d.metodo} onChange={(e) => set('metodo', e.target.value)}>
              {FORMAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
          <label><Label>Plaza</Label>
            <select style={s.input} value={d.plaza} onChange={(e) => set('plaza', e.target.value)}>
              <option value="MID">Mérida (MID)</option><option value="CUN">Cancún (CUN)</option>
            </select></label>
          <label><Label>Prefijo de póliza</Label>
            <input style={s.input} value={d.prefijo_poliza || ''} placeholder="TCB (solo tarjeta de compras)" onChange={(e) => set('prefijo_poliza', e.target.value)} /></label>
          <label><Label>Últimos dígitos de la cuenta</Label>
            <input style={s.input} value={d.numero_cuenta || ''} placeholder="1234" onChange={(e) => set('numero_cuenta', e.target.value)} /></label>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
          <input type="checkbox" checked={!!d.activa} onChange={(e) => set('activa', e.target.checked)} /> Activa
        </label>

        <div style={{ fontWeight: 650, fontSize: 13.5, marginTop: 4 }}>Quién la usa</div>
        <p style={{ ...s.nota, margin: 0 }}>Un admin usa todas las cajas. Los demás solo ven las que tengan asignadas.</p>
        <div style={{ display: 'grid', gap: 6 }}>
          {usuarios.filter((u) => u.activo && u.rol !== 'admin').map((u) => (
            <div key={u.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13.5 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 200 }}>
                <input type="checkbox" checked={!!permisos[u.id]} onChange={() => alternar(u.id)} />
                {u.nombre} <span style={s.sub}>{etiquetaRol(u.rol)}</span>
              </label>
              {permisos[u.id] && (<>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={permisos[u.id].puede_registrar} onChange={(e) => permiso(u.id, 'puede_registrar', e.target.checked)} /> Registra pagos
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={permisos[u.id].puede_exportar} onChange={(e) => permiso(u.id, 'puede_exportar', e.target.checked)} /> Descarga al ERP
                </label>
              </>)}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button style={s.btnGhost} onClick={onClose}>Cancelar</button>
          <button style={{ ...s.btnPrimary, opacity: !d.nombre.trim() || guardando ? 0.45 : 1 }} disabled={!d.nombre.trim() || guardando} onClick={guardar}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function Cajas() {
  const [cajas, setCajas] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [editando, setEditando] = useState(null)
  const toast = useToast()

  const cargar = useCallback(async () => {
    try {
      setCajas((await api.get('/propago/cajas', { params: { todas: true } })).data)
    } catch (e) {
      toast('No se pudieron cargar las cajas: ' + mensajeError(e), 'error')
      setCajas([])
    }
  }, [toast])

  useEffect(() => {
    const t = setTimeout(cargar, 0)
    api.get('/usuarios').then(({ data }) => setUsuarios(data)).catch(() => setUsuarios([]))
    return () => clearTimeout(t)
  }, [cargar])

  const nombre = Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]))
  if (cajas === null) return <CargaTarjetas n={2} alto={70} minimo={200} />

  return (
    <div>
      <button style={{ ...s.btnGhost, marginBottom: 12 }} onClick={() => setEditando({})}><Plus size={13} /> Nueva caja</button>
      {!cajas.length ? (
        <Vacio icono={Wallet} titulo="Sin cajas todavía">
          Da de alta las cuentas, tarjetas y cajas chicas de las que salen los pagos. Su nombre es el PROPIETARIO del archivo del ERP.
        </Vacio>
      ) : (
        <div style={s.seccion}>
          <div style={s.tablaWrap}>
            <table style={{ ...s.table, minWidth: 720 }}>
              <thead><tr>
                <th style={s.th}>Caja</th><th style={s.th}>Tipo</th><th style={s.th}>Forma de pago</th><th style={s.th}>Plaza</th>
                <th style={s.th}>Póliza</th><th style={s.th}>Usuarios</th><th style={s.th} />
              </tr></thead>
              <tbody>
                {cajas.map((c) => (
                  <tr key={c.id} style={c.activa ? undefined : { opacity: 0.5 }}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{c.nombre}{c.numero_cuenta && <div style={s.sub}>···{c.numero_cuenta}</div>}</td>
                    <td style={s.td}>{etiquetaTipoCaja(c.tipo)}</td>
                    <td style={s.td}>{etiquetaMetodo(c.metodo)}</td>
                    <td style={s.td}>{c.plaza}</td>
                    <td style={s.td}>{c.prefijo_poliza || '—'}</td>
                    <td style={{ ...s.td, fontSize: 12.5 }}>
                      {(c.usuarios || []).map((p) => nombre[p.usuario_id]).filter(Boolean).join(', ') || 'Solo admin'}
                    </td>
                    <td style={s.td}><button style={{ ...s.btnGhost, padding: '5px 8px' }} aria-label={`Editar ${c.nombre}`} onClick={() => setEditando(c)}><Pencil size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {editando && <ModalCaja caja={editando.id ? editando : null} usuarios={usuarios} onClose={() => setEditando(null)}
        onListo={() => { setEditando(null); cargar() }} />}
    </div>
  )
}
