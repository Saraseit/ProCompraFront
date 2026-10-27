import { useState, useEffect } from 'react'
import { Plus, Pencil, Search, Building2 } from 'lucide-react'
import api from '../api'
import { mensajeError, PROVEEDOR_VACIO, esAdmin, esOperacion } from '../constants'
import Modal, { ModalHead, Label } from '../ui/Modal'
import { useToast, useConfirm } from '../ui/feedback-context'
import { FilasCarga } from '../ui/Carga'
import Vacio from '../ui/Vacio'

export default function Proveedores({ usuario }) {
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(null)  // null = cerrado, {} = nuevo, {id,...} = editar
  const toast = useToast()
  const confirmar = useConfirm()

  const puedeEditar = esOperacion(usuario.rol)
  const puedeEliminar = esAdmin(usuario.rol)

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
              <Plus size={16} /> Nuevo proveedor
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
              <th style={s.th}>Crédito</th>
              {puedeEditar && <th style={s.th}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <FilasCarga columnas={7} />
            )}
            {!cargando && filtrados.length === 0 && (
              <tr><td colSpan={7} style={s.empty}>
                {busqueda ? (
                  <Vacio icono={Search} titulo="Sin resultados" compacto>Ningún proveedor coincide con “{busqueda}”.</Vacio>
                ) : (
                  <Vacio icono={Building2} titulo="Aún no hay proveedores activos" compacto
                    accion={puedeEditar && (
                      <button style={s.btnPrimary} onClick={() => setForm({ ...PROVEEDOR_VACIO })}>
                        <Plus size={16} /> Agregar el primero
                      </button>
                    )} />
                )}
              </td></tr>
            )}
            {filtrados.map((p) => (
              <tr key={p.id}>
                <td style={{ ...s.td, fontWeight: 500 }}>{p.nombre}</td>
                <td style={{ ...s.td, fontFamily: 'var(--pc-mono)', fontSize: 12 }}>{p.rfc || '—'}</td>
                <td style={s.td}>{p.correo || '—'}</td>
                <td style={s.td}>{p.telefono || '—'}</td>
                <td style={s.td}>{p.cuenta_bancaria || '—'}</td>
                <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                  {p.dias_credito == null ? '—' : p.dias_credito === 0 ? 'Contado' : `${p.dias_credito} días`}
                </td>
                {puedeEditar && (
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={s.btnGhost} onClick={() => setForm({ ...p })}>
                        <Pencil size={12} /> Editar
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
  const diasTexto = String(form.dias_credito ?? '').trim()
  const dias = diasTexto === '' ? null : Number(diasTexto)
  const diasValidos = dias === null || (Number.isInteger(dias) && dias >= 0 && dias <= 365)
  const puedeGuardar = !!nombre && diasValidos && !guardando

  async function guardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    try {
      const datos = { ...form, nombre, dias_credito: dias }
      // Solo se manda si hay plazo o si se quiere quitar uno que ya existía.
      if (dias === null && data.dias_credito == null) delete datos.dias_credito
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
        <div style={s.twoCol}>
          <Field label="Cuenta bancaria">
            <input style={s.input} value={form.cuenta_bancaria || ''}
              onChange={(e) => set('cuenta_bancaria', e.target.value)} />
          </Field>
          <Field label="Días de crédito">
            <input type="number" min="0" max="365" step="1" style={s.input}
              placeholder="Sin crédito" value={form.dias_credito ?? ''}
              onChange={(e) => set('dias_credito', e.target.value)} />
          </Field>
        </div>
        {!diasValidos && (
          <div style={s.avisoError}>Los días de crédito deben ser un número entero entre 0 y 365.</div>
        )}
        <p style={s.nota}>
          Los días de crédito calculan los vencimientos del estado de cuenta: corren desde la
          fecha de la factura (o de la recepción, si aún no hay factura).
        </p>
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
  h2: { fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--pc-tinta)', letterSpacing: '-0.022em' },
  help: { fontSize: 13, color: 'var(--pc-gris)', marginTop: 4 },
  error: { padding: 20, background: 'var(--pc-rojo-bg)', color: 'var(--pc-rojo)', borderRadius: 8 },
  empty: { textAlign: 'center', color: 'var(--pc-gris-3)', padding: 26 },
  card: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 12, overflowX: 'auto', boxShadow: 'var(--pc-sombra-1)' },
  table: { minWidth:820, width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { textAlign: 'left', padding: '11px 14px', background: 'var(--pc-superficie-3)', color: 'var(--pc-gris-2)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid var(--pc-borde)' },
  td: { padding: '11px 14px', borderBottom: '1px solid var(--pc-linea)' },
  input: { width: '100%', border: '1px solid var(--pc-borde)', borderRadius: 8, padding: '9px 11px', fontSize: 14, boxSizing: 'border-box' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  avisoError: { marginBottom: 8, background: 'var(--pc-rojo-bg)', color: 'var(--pc-rojo)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5 },
  nota: { fontSize: 12, color: 'var(--pc-gris)', margin: '0 0 4px', lineHeight: 1.45 },
  btnPrimary: { background: 'var(--pc-btn)', color: 'var(--pc-btn-texto)', border: 'none', padding: '10px 16px', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { background: 'transparent', border: '1px solid var(--pc-borde)', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  btnDanger: { background: 'var(--pc-superficie)', color: 'var(--pc-rojo)', border: '1px solid var(--pc-rojo-borde)', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
}
