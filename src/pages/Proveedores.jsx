import { useState, useEffect } from 'react'
import api from '../api'
import { mensajeError, PROVEEDOR_VACIO } from '../constants'
import Modal, { ModalHead, Label } from '../ui/Modal'
import { useToast, useConfirm } from '../ui/feedback-context'

export default function Proveedores({ usuario }) {
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(null)  // null = cerrado, {} = nuevo, {id,...} = editar
  const toast = useToast()
  const confirmar = useConfirm()

  const puedeEditar = ['admin', 'compras'].includes(usuario.rol)
  const puedeEliminar = usuario.rol === 'admin'

  useEffect(() => {
    const timer = setTimeout(() => cargarProveedores(), 300)
    return () => clearTimeout(timer)
  }, [])

  async function cargarProveedores() {
    setCargando(true)
    setError('')
    try {
      const res = await api.get('/proveedores')
      setProveedores(res.data)
    } catch (e) {
      setError('Error al cargar proveedores: ' + mensajeError(e))
    }
    setCargando(false)
  }

  async function desactivarProveedor(id, nombre) {
    const ok = await confirmar({
      titulo: 'Desactivar proveedor',
      mensaje: `¿Desactivar a "${nombre}"? No aparecerá en listas pero sus órdenes históricas se conservan.`,
      textoBoton: 'Desactivar',
      peligro: true,
    })
    if (!ok) return
    try {
      await api.delete(`/proveedores/${id}`)
      toast(`Proveedor "${nombre}" desactivado`)
      cargarProveedores()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  const filtrados = proveedores.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.rfc || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  if (error) return <div style={s.error}>{error}</div>

  return (
    <div>
      <div style={s.header}>
        <div>
          <h2 style={s.h2}>Proveedores</h2>
          <p style={s.help}>{proveedores.length} proveedores activos</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            style={{ ...s.input, width: 240 }}
            placeholder="Buscar por nombre o RFC..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {puedeEditar && (
            <button style={s.btnPrimary} onClick={() => setForm({ ...PROVEEDOR_VACIO })}>
              + Nuevo proveedor
            </button>
          )}
        </div>
      </div>

      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Nombre</th>
              <th style={s.th}>RFC</th>
              <th style={s.th}>Correo</th>
              <th style={s.th}>Teléfono</th>
              <th style={s.th}>Cuenta bancaria</th>
              {puedeEditar && <th style={s.th}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={6} style={s.empty}>Cargando...</td></tr>
            )}
            {!cargando && filtrados.length === 0 && (
              <tr><td colSpan={6} style={s.empty}>
                {busqueda ? 'Sin resultados para esa búsqueda.' : (
                  <>
                    Aún no hay proveedores activos.
                    {puedeEditar && (
                      <div style={{ marginTop: 12 }}>
                        <button style={s.btnPrimary} onClick={() => setForm({ ...PROVEEDOR_VACIO })}>
                          + Agregar el primero
                        </button>
                      </div>
                    )}
                  </>
                )}
              </td></tr>
            )}
            {filtrados.map((p) => (
              <tr key={p.id}>
                <td style={{ ...s.td, fontWeight: 500 }}>{p.nombre}</td>
                <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12 }}>{p.rfc || '—'}</td>
                <td style={s.td}>{p.correo || '—'}</td>
                <td style={s.td}>{p.telefono || '—'}</td>
                <td style={s.td}>{p.cuenta_bancaria || '—'}</td>
                {puedeEditar && (
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={s.btnGhost} onClick={() => setForm({ ...p })}>
                        Editar
                      </button>
                      {puedeEliminar && (
                        <button style={s.btnDanger} onClick={() => desactivarProveedor(p.id, p.nombre)}>
                          Desactivar
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <ModalProveedor
          data={form}
          onClose={() => setForm(null)}
          onGuardado={() => { setForm(null); cargarProveedores() }}
        />
      )}
    </div>
  )
}

// Alta/edición de proveedor. Hace la petición por sí mismo para poder abrirse
// desde otras pantallas (p. ej. el formulario de requerimiento).
export function ModalProveedor({ data, onClose, onGuardado, zIndex }) {
  const [form, setForm] = useState(data)
  const [guardando, setGuardando] = useState(false)
  const toast = useToast()
  const set = (k, v) => setForm({ ...form, [k]: v })
  const esNuevo = !form.id
  const nombre = (form.nombre || '').trim()
  const puedeGuardar = !!nombre && !guardando

  async function guardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    try {
      const datos = { ...form, nombre }
      const res = datos.id
        ? await api.put(`/proveedores/${datos.id}`, datos)
        : await api.post('/proveedores', datos)
      toast(esNuevo ? `Proveedor "${nombre}" creado` : 'Proveedor actualizado')
      onGuardado(res.data)
    } catch (e) {
      toast('Error al guardar: ' + mensajeError(e), 'error')
      setGuardando(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={520} zIndex={zIndex}>
      <ModalHead titulo={esNuevo ? 'Nuevo proveedor' : 'Editar proveedor'} onClose={onClose} />
      <div style={{ padding: '16px 24px 24px' }}>
        <Field label="Nombre" requerido>
          <input style={s.input} value={form.nombre || ''}
            onChange={(e) => set('nombre', e.target.value)} autoFocus />
        </Field>
        <div style={s.twoCol}>
          <Field label="RFC">
            <input style={s.input} value={form.rfc || ''}
              onChange={(e) => set('rfc', e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <input style={s.input} value={form.telefono || ''}
              onChange={(e) => set('telefono', e.target.value)} />
          </Field>
        </div>
        <Field label="Correo">
          <input type="email" style={s.input} value={form.correo || ''}
            onChange={(e) => set('correo', e.target.value)} />
        </Field>
        <Field label="Dirección">
          <input style={s.input} value={form.direccion || ''}
            onChange={(e) => set('direccion', e.target.value)} />
        </Field>
        <Field label="Cuenta bancaria">
          <input style={s.input} value={form.cuenta_bancaria || ''}
            onChange={(e) => set('cuenta_bancaria', e.target.value)} />
        </Field>
        <button
          style={{ ...s.btnPrimary, width: '100%', marginTop: 16,
                   opacity: puedeGuardar ? 1 : 0.45,
                   cursor: puedeGuardar ? 'pointer' : 'not-allowed' }}
          disabled={!puedeGuardar}
          onClick={guardar}>
          {guardando ? 'Guardando...' : esNuevo ? 'Agregar proveedor' : 'Guardar cambios'}
        </button>
      </div>
    </Modal>
  )
}

function Field({ label, requerido, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <Label requerido={requerido}>{label}</Label>
      {children}
    </label>
  )
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, gap: 16, flexWrap: 'wrap' },
  h2: { fontSize: 22, fontWeight: 600, margin: 0, color: '#26241D' },
  help: { fontSize: 13, color: '#8A8577', marginTop: 4 },
  error: { padding: 20, background: '#F7DEDE', color: '#B03A3A', borderRadius: 8 },
  empty: { textAlign: 'center', color: '#A8A395', padding: 26 },
  card: { background: '#fff', border: '1px solid #E3DFD5', borderRadius: 12, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { textAlign: 'left', padding: '11px 14px', background: '#F4F1EA', color: '#6B6659', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #E3DFD5' },
  td: { padding: '11px 14px', borderBottom: '1px solid #EFEBE2' },
  input: { width: '100%', border: '1px solid #E3DFD5', borderRadius: 8, padding: '9px 11px', fontSize: 14, boxSizing: 'border-box' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  btnPrimary: { background: '#26241D', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { background: 'transparent', border: '1px solid #E3DFD5', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  btnDanger: { background: '#fff', color: '#B03A3A', border: '1px solid #E9C9C9', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
}
