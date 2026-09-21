import { useState, useEffect } from 'react'
import api from '../api'
import { mensajeError } from '../constants'
import Modal, { ModalHead, Label } from '../ui/Modal'
import { useToast, useConfirm } from '../ui/feedback-context'

const ROLES = ['admin', 'compras', 'almacen', 'pagos']

export default function Usuarios({ usuario }) {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)
  const toast = useToast()
  const confirmar = useConfirm()

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
      setError('Error al cargar usuarios: ' + mensajeError(e))
    }
    setCargando(false)
  }

  // Devuelve true si se guardó, para que el modal sepa si debe liberar el botón.
  async function crearUsuario(datos) {
    try {
      await api.post('/usuarios', datos)
      toast(`Usuario "${datos.nombre}" creado`)
      setForm(null)
      cargarUsuarios()
      return true
    } catch (e) {
      toast('Error al crear: ' + mensajeError(e), 'error')
      return false
    }
  }

  async function actualizarUsuario(id, datos) {
    try {
      await api.put(`/usuarios/${id}`, datos)
      toast('Usuario actualizado')
      setForm(null)
      cargarUsuarios()
      return true
    } catch (e) {
      toast('Error al actualizar: ' + mensajeError(e), 'error')
      return false
    }
  }

  async function desactivarUsuario(id, nombre) {
    const ok = await confirmar({
      titulo: 'Desactivar usuario',
      mensaje: `¿Desactivar a "${nombre}"? Ya no podrá entrar al sistema.`,
      textoBoton: 'Desactivar',
      peligro: true,
    })
    if (!ok) return
    try {
      await api.delete(`/usuarios/${id}`)
      toast(`Usuario "${nombre}" desactivado`)
      cargarUsuarios()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
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
                    background: u.rol === 'admin' ? 'var(--pc-rojo-bg)' : 'var(--pc-neutro-bg)',
                    color: u.rol === 'admin' ? 'var(--pc-rojo)' : 'var(--pc-gris-2)',
                  }}>
                    {u.rol}
                  </span>
                </td>
                <td style={s.td}>
                  <span style={{
                    ...s.badge,
                    background: u.activo ? 'var(--pc-verde-bg)' : 'var(--pc-neutro-bg)',
                    color: u.activo ? 'var(--pc-verde)' : 'var(--pc-gris)',
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
  const [guardando, setGuardando] = useState(false)
  const set = (k, v) => setForm({ ...form, [k]: v })
  const esNuevo = form.esNuevo
  const completo = form.nombre && (!esNuevo || (form.correo && form.password))
  const puedeGuardar = completo && !guardando

  async function guardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    const { esNuevo: _, ...datos } = form
    const ok = await onSave(datos)
    if (!ok) setGuardando(false)
  }

  return (
    <Modal onClose={onClose} maxWidth={460}>
      <ModalHead titulo={esNuevo ? 'Nuevo usuario' : 'Editar usuario'} onClose={onClose} />
      <div style={{ padding: '16px 24px 24px' }}>
        <Field label="Nombre completo" requerido>
          <input style={s.input} value={form.nombre || ''}
            onChange={(e) => set('nombre', e.target.value)} autoFocus />
        </Field>

        {esNuevo && (
          <>
            <Field label="Correo" requerido>
              <input type="email" style={s.input} value={form.correo || ''}
                onChange={(e) => set('correo', e.target.value)} />
            </Field>
            <Field label="Contraseña inicial" requerido>
              <input type="password" style={s.input} value={form.password || ''}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Mínimo 6 caracteres" />
            </Field>
          </>
        )}

        <Field label="Rol" requerido>
          <select style={s.input} value={form.rol || 'compras'}
            onChange={(e) => set('rol', e.target.value)}
            disabled={form.id === usuarioActual.id}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {form.id === usuarioActual.id && (
            <span style={{ fontSize: 11, color: 'var(--pc-gris)', marginTop: 4, display: 'block' }}>
              No puedes cambiar tu propio rol
            </span>
          )}
        </Field>

        <button
          style={{ ...s.btnPrimary, width: '100%', marginTop: 16,
                   opacity: puedeGuardar ? 1 : 0.45,
                   cursor: puedeGuardar ? 'pointer' : 'not-allowed' }}
          disabled={!puedeGuardar}
          onClick={guardar}>
          {guardando ? 'Guardando...' : esNuevo ? 'Crear usuario' : 'Guardar cambios'}
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, gap: 16 },
  h2: { fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--pc-tinta)' },
  help: { fontSize: 13, color: 'var(--pc-gris)', marginTop: 4 },
  error: { padding: 20, background: 'var(--pc-rojo-bg)', color: 'var(--pc-rojo)', borderRadius: 8 },
  empty: { textAlign: 'center', color: 'var(--pc-gris-3)', padding: 26 },
  card: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 12, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { textAlign: 'left', padding: '11px 14px', background: 'var(--pc-superficie-3)', color: 'var(--pc-gris-2)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid var(--pc-borde)' },
  td: { padding: '11px 14px', borderBottom: '1px solid var(--pc-linea)' },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 },
  input: { width: '100%', border: '1px solid var(--pc-borde)', borderRadius: 8, padding: '9px 11px', fontSize: 14, boxSizing: 'border-box' },
  btnPrimary: { background: 'var(--pc-btn)', color: 'var(--pc-btn-texto)', border: 'none', padding: '10px 16px', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { background: 'transparent', border: '1px solid var(--pc-borde)', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  btnDanger: { background: 'var(--pc-superficie)', color: 'var(--pc-rojo)', border: '1px solid var(--pc-rojo-borde)', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
}