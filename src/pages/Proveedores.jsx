import { useState, useEffect } from 'react'
import api from '../api'

export default function Proveedores({ usuario }) {
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(null)  // null = cerrado, {} = nuevo, {id,...} = editar

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
      setError('Error al cargar proveedores: ' + (e.response?.data?.detail || e.message))
    }
    setCargando(false)
  }

  async function guardarProveedor(datos) {
    try {
      if (datos.id) {
        await api.put(`/proveedores/${datos.id}`, datos)
      } else {
        await api.post('/proveedores', datos)
      }
      setForm(null)
      cargarProveedores()
    } catch (e) {
      alert('Error al guardar: ' + (e.response?.data?.detail || e.message))
    }
  }

  async function desactivarProveedor(id, nombre) {
    if (!confirm(`¿Desactivar a "${nombre}"? No aparecerá en listas pero sus órdenes históricas se conservan.`)) return
    try {
      await api.delete(`/proveedores/${id}`)
      cargarProveedores()
    } catch (e) {
      alert('Error: ' + (e.response?.data?.detail || e.message))
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
            <button style={s.btnPrimary} onClick={() => setForm({
              nombre: '', rfc: '', correo: '', telefono: '', direccion: '', cuenta_bancaria: ''
            })}>
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
                {busqueda ? 'Sin resultados para esa búsqueda.' : 'No hay proveedores activos.'}
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
          onSave={guardarProveedor}
        />
      )}
    </div>
  )
}

function ModalProveedor({ data, onClose, onSave }) {
  const [form, setForm] = useState(data)
  const set = (k, v) => setForm({ ...form, [k]: v })
  const esNuevo = !form.id

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}>
          <h3 style={s.h3}>{esNuevo ? 'Nuevo proveedor' : 'Editar proveedor'}</h3>
          <button style={s.btnX} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 24px 24px' }}>
          <Field label="Nombre *">
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
            style={{ ...s.btnPrimary, width: '100%', marginTop: 16 }}
            disabled={!form.nombre}
            onClick={() => onSave(form)}>
            {esNuevo ? 'Agregar proveedor' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={s.label}>{label}</span>
      {children}
    </label>
  )
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, gap: 16, flexWrap: 'wrap' },
  h2: { fontSize: 22, fontWeight: 600, margin: 0, color: '#26241D' },
  h3: { fontSize: 18, fontWeight: 600, margin: 0, color: '#26241D' },
  help: { fontSize: 13, color: '#8A8577', marginTop: 4 },
  error: { padding: 20, background: '#F7DEDE', color: '#B03A3A', borderRadius: 8 },
  empty: { textAlign: 'center', color: '#A8A395', padding: 26 },
  card: { background: '#fff', border: '1px solid #E3DFD5', borderRadius: 12, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { textAlign: 'left', padding: '11px 14px', background: '#F4F1EA', color: '#6B6659', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #E3DFD5' },
  td: { padding: '11px 14px', borderBottom: '1px solid #EFEBE2' },
  input: { width: '100%', border: '1px solid #E3DFD5', borderRadius: 8, padding: '9px 11px', fontSize: 14, boxSizing: 'border-box' },
  label: { display: 'block', fontSize: 12, color: '#8A8577', marginBottom: 5, fontWeight: 500 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,28,22,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 },
  modal: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 30px 80px rgba(0,0,0,0.25)' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E3DFD5' },
  btnPrimary: { background: '#26241D', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { background: 'transparent', border: '1px solid #E3DFD5', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  btnDanger: { background: '#fff', color: '#B03A3A', border: '1px solid #E9C9C9', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  btnX: { border: 'none', background: '#F4F1EA', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#6B6659' },
}