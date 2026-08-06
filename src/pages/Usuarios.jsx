import { useState, useEffect } from 'react'
import api from '../api'

const ROLES = ['admin', 'compras', 'almacen', 'pagos']

export default function Usuarios({ usuario }) {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => cargarUsuarios(), 300)
    return () => clearTimeout(timer)
  }, [])

  async function cargarUsuarios() {
    setCargando(true)
    setError('')
    try {
      const res = await api.get('/usuarios')
      setUsuarios(res.data)
    } catch (e) {
      setError('Error al cargar usuarios: ' + (e.response?.data?.detail || e.message))
    }
    setCargando(false)
  }

  async function crearUsuario(datos) {
    try {
      await api.post('/usuarios', datos)
      setForm(null)
      cargarUsuarios()
    } catch (e) {
      alert('Error al crear: ' + (e.response?.data?.detail || e.message))
    }
  }

  async function actualizarUsuario(id, datos) {
    try {
      await api.put(`/usuarios/${id}`, datos)
      setForm(null)
      cargarUsuarios()
    } catch (e) {
      alert('Error al actualizar: ' + (e.response?.data?.detail || e.message))
    }
  }

  async function desactivarUsuario(id, nombre) {
    if (!confirm(`¿Desactivar a "${nombre}"? Ya no podrá entrar al sistema.`)) return
    try {
      await api.delete(`/usuarios/${id}`)
      cargarUsuarios()
    } catch (e) {
      alert('Error: ' + (e.response?.data?.detail || e.message))
    }
  }

  if (error) return <div style={s.error}>{error}</div>

  return (
    <div>
      <div style={s.header}>
        <div>
          <h2 style={s.h2}>Usuarios</h2>
          <p style={s.help}>Gestión de acceso al sistema</p>
        </div>
        <button style={s.btnPrimary} onClick={() => setForm({
          nombre: '', correo: '', password: '', rol: 'compras', esNuevo: true
        })}>
          + Nuevo usuario
        </button>
      </div>

      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Nombre</th>
              <th style={s.th}>Correo</th>
              <th style={s.th}>Rol</th>
              <th style={s.th}>Estado</th>
              <th style={s.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={5} style={s.empty}>Cargando...</td></tr>
            )}
            {!cargando && usuarios.length === 0 && (
              <tr><td colSpan={5} style={s.empty}>No hay usuarios registrados.</td></tr>
            )}
            {usuarios.map((u) => (
              <tr key={u.id} style={!u.activo ? { opacity: 0.5 } : {}}>
                <td style={{ ...s.td, fontWeight: 500 }}>{u.nombre}</td>
                <td style={s.td}>{u.correo}</td>
                <td style={s.td}>
                  <span style={{
                    ...s.badge,
                    background: u.rol === 'admin' ? '#F7DEDE' : '#EEEBE3',
                    color: u.rol === 'admin' ? '#B03A3A' : '#5A5648',
                  }}>
                    {u.rol}
                  </span>
                </td>
                <td style={s.td}>
                  <span style={{
                    ...s.badge,
                    background: u.activo ? '#DCEEE4' : '#EEEBE3',
                    color: u.activo ? '#2E6B4F' : '#8A8577',
                  }}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={s.btnGhost}
                      onClick={() => setForm({ ...u, esNuevo: false })}>
                      Editar
                    </button>
                    {u.activo && u.id !== usuario.id && (
                      <button style={s.btnDanger}
                        onClick={() => desactivarUsuario(u.id, u.nombre)}>
                        Desactivar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <ModalUsuario
          data={form}
          usuarioActual={usuario}
          onClose={() => setForm(null)}
          onSave={(datos) => form.esNuevo ? crearUsuario(datos) : actualizarUsuario(form.id, datos)}
        />
      )}
    </div>
  )
}

function ModalUsuario({ data, usuarioActual, onClose, onSave }) {
  const [form, setForm] = useState(data)
  const set = (k, v) => setForm({ ...form, [k]: v })
  const esNuevo = form.esNuevo

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}>
          <h3 style={s.h3}>{esNuevo ? 'Nuevo usuario' : 'Editar usuario'}</h3>
          <button style={s.btnX} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 24px 24px' }}>
          <Field label="Nombre completo">
            <input style={s.input} value={form.nombre || ''}
              onChange={(e) => set('nombre', e.target.value)} autoFocus />
          </Field>

          {esNuevo && (
            <>
              <Field label="Correo">
                <input type="email" style={s.input} value={form.correo || ''}
                  onChange={(e) => set('correo', e.target.value)} />
              </Field>
              <Field label="Contraseña inicial">
                <input type="password" style={s.input} value={form.password || ''}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Mínimo 6 caracteres" />
              </Field>
            </>
          )}

          <Field label="Rol">
            <select style={s.input} value={form.rol || 'compras'}
              onChange={(e) => set('rol', e.target.value)}
              disabled={form.id === usuarioActual.id}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {form.id === usuarioActual.id && (
              <span style={{ fontSize: 11, color: '#8A8577', marginTop: 4, display: 'block' }}>
                No puedes cambiar tu propio rol
              </span>
            )}
          </Field>

          <button
            style={{ ...s.btnPrimary, width: '100%', marginTop: 16 }}
            disabled={!form.nombre || (esNuevo && (!form.correo || !form.password))}
            onClick={() => {
              const { esNuevo: _, ...datos } = form
              onSave(datos)
            }}>
            {esNuevo ? 'Crear usuario' : 'Guardar cambios'}
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, gap: 16 },
  h2: { fontSize: 22, fontWeight: 600, margin: 0, color: '#26241D' },
  h3: { fontSize: 18, fontWeight: 600, margin: 0, color: '#26241D' },
  help: { fontSize: 13, color: '#8A8577', marginTop: 4 },
  error: { padding: 20, background: '#F7DEDE', color: '#B03A3A', borderRadius: 8 },
  empty: { textAlign: 'center', color: '#A8A395', padding: 26 },
  card: { background: '#fff', border: '1px solid #E3DFD5', borderRadius: 12, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { textAlign: 'left', padding: '11px 14px', background: '#F4F1EA', color: '#6B6659', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #E3DFD5' },
  td: { padding: '11px 14px', borderBottom: '1px solid #EFEBE2' },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 },
  label: { display: 'block', fontSize: 12, color: '#8A8577', marginBottom: 5, fontWeight: 500 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,28,22,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 },
  modal: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 30px 80px rgba(0,0,0,0.25)' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E3DFD5' },
  input: { width: '100%', border: '1px solid #E3DFD5', borderRadius: 8, padding: '9px 11px', fontSize: 14, boxSizing: 'border-box' },
  btnPrimary: { background: '#26241D', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { background: 'transparent', border: '1px solid #E3DFD5', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  btnDanger: { background: '#fff', color: '#B03A3A', border: '1px solid #E9C9C9', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  btnX: { border: 'none', background: '#F4F1EA', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#6B6659' },
}