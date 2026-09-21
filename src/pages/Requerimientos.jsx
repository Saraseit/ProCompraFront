import { useState, useEffect, useMemo } from 'react'
import api from '../api'
import { money, mensajeError, PROVEEDOR_VACIO } from '../constants'
import Modal, { ModalHead, Label } from '../ui/Modal'
import { useToast } from '../ui/feedback-context'
import { C } from '../ui/tema'
import { ModalProveedor } from './Proveedores'

const UNIDADES = ["PZA","CAJA","LITRO","KILO","CUBETA","BOTE","CORTE","GALON","MTR","ROLLO","SERVICIO","PAQUETE"]

const REQ_VACIO = {
  descripcion: '', cantidad: 1, unidad: 'PZA',
  precio_estimado: 0, contrato: '', proveedor_sug: '',
}

export default function Requerimientos({ usuario, onOrdenCreada, onCambio }) {
  const [requerimientos, setRequerimientos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [nuevo, setNuevo] = useState(null)
  const [editando, setEditando] = useState(null)
  const [sel, setSel] = useState({})
  const [generando, setGenerando] = useState(false)
  const toast = useToast()

  useEffect(() => {
    const timer = setTimeout(async () => {
      setCargando(true)
      setError('')
      try {
        const reqRes = await api.get('/requerimientos?estado=pendiente')
        setRequerimientos(reqRes.data)
        const provRes = await api.get('/proveedores')
        setProveedores(provRes.data)
      } catch (e) {
        setError('Error al cargar datos: ' + mensajeError(e))
      }
      setCargando(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  async function recargarReqs() {
    const reqRes = await api.get('/requerimientos?estado=pendiente')
    setRequerimientos(reqRes.data)
    if (onCambio) onCambio()
  }

  // Devuelven true si se guardó, para que el modal sepa si debe liberar el botón.
  async function crearRequerimiento(datos) {
    try {
      await api.post('/requerimientos', { ...datos, solicitante_id: usuario.id })
      toast('Requerimiento creado')
      setNuevo(null)
      await recargarReqs()
      return true
    } catch (e) {
      toast('Error al crear: ' + mensajeError(e), 'error')
      return false
    }
  }

  async function editarRequerimiento(id, datos) {
    try {
      await api.put(`/requerimientos/${id}`, datos)
      toast('Requerimiento actualizado')
      setEditando(null)
      await recargarReqs()
      return true
    } catch (e) {
      toast('Error al editar: ' + mensajeError(e), 'error')
      return false
    }
  }

  // Un proveedor dado de alta desde el formulario se agrega a la lista local.
  const agregarProveedor = (p) =>
    setProveedores((lista) =>
      [...lista, p].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))

  const seleccionados = requerimientos.filter((r) => sel[r.id])

  const grupos = useMemo(() => {
    const g = {}
    seleccionados.forEach((r) => {
      const provId = r.proveedor_sug || '__sin_proveedor__'
      const provNombre = r.proveedor?.nombre || 'Sin proveedor'
      if (!g[provId]) g[provId] = { provId, provNombre, items: [] }
      g[provId].items.push(r)
    })
    return Object.values(g)
  }, [seleccionados])

  async function generarOrdenes() {
    if (seleccionados.length === 0) return
    setGenerando(true)
    let creadas = 0
    try {
      for (const grupo of grupos) {
        await api.post('/ordenes', {
          proveedor_id: grupo.provId,
          tipo_pago: 'transferencia',
          partidas: grupo.items.map((r) => ({
            req_id: r.id,
            concepto: r.descripcion,
            cantidad: r.cantidad,
            unidad: r.unidad,
            precio_unitario: r.precio_estimado,
            contrato: r.contrato || null,
          })),
        })
        creadas++
      }
      toast(creadas === 1 ? 'Se generó 1 orden de compra' : `Se generaron ${creadas} órdenes de compra`)
      if (onOrdenCreada) onOrdenCreada()
    } catch (e) {
      // Las órdenes ya creadas no se revierten: se avisa cuántas quedaron.
      toast(
        `Se generaron ${creadas} de ${grupos.length} orden(es). ` +
        `La orden de ${grupos[creadas]?.provNombre || '—'} falló: ${mensajeError(e)}`,
        'error'
      )
    } finally {
      setSel({})
      await recargarReqs()
      setGenerando(false)
    }
  }

  const toggle = (id) => setSel((s) => ({ ...s, [id]: !s[id] }))
  const nSel = seleccionados.length
  const puedeEditar = ['admin', 'compras'].includes(usuario.rol)
  const abrirNuevo = () => setNuevo({ ...REQ_VACIO })

  const todosSeleccionados = requerimientos.length > 0 && nSel === requerimientos.length
  const alternarTodos = () =>
    setSel(todosSeleccionados
      ? {}
      : Object.fromEntries(requerimientos.map((r) => [r.id, true])))

  const grupoSinProveedor = grupos.find((g) => g.provId === '__sin_proveedor__')
  const puedeGenerar = nSel > 0 && !grupoSinProveedor && !generando

  if (cargando) return <div style={s.msg}>Cargando requerimientos...</div>
  if (error) return <div style={s.error}>{error}</div>

  return (
    <div>
      <div style={s.header}>
        <div>
          <h2 style={s.h2}>Requerimientos</h2>
          <p style={s.help}>
            Marca los requerimientos que quieras convertir en órdenes de compra.
            Se agrupan automáticamente en una orden por proveedor.
          </p>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button style={s.btnGhostLg} onClick={abrirNuevo}>
            + Nuevo requerimiento
          </button>
          <button
            style={{ ...s.btnPrimary,
                     opacity: puedeGenerar ? 1 : 0.45,
                     cursor: puedeGenerar ? 'pointer' : 'not-allowed' }}
            disabled={!puedeGenerar}
            title={nSel === 0
              ? 'Marca al menos un requerimiento en la tabla'
              : grupoSinProveedor
                ? 'Hay requerimientos seleccionados sin proveedor sugerido'
                : 'Generar las órdenes de compra'}
            onClick={generarOrdenes}>
            {generando
              ? 'Generando...'
              : `Generar órdenes de compra${nSel > 0 ? ` (${nSel})` : ''}`}
          </button>
        </div>
      </div>

      {nSel > 0 && (
        <div style={grupoSinProveedor ? s.resumenAviso : s.resumen}>
          {grupoSinProveedor ? (
            <>
              <strong>Falta el proveedor.</strong> No se puede generar una orden para{' '}
              {grupoSinProveedor.items.map((i) => i.descripcion).join(', ')}.
              Edita esos requerimientos y asígnales un proveedor sugerido, o quítalos de la selección.
            </>
          ) : (
            <>
              <strong>{nSel}</strong> requerimiento(s) seleccionado(s) → se crearán{' '}
              <strong>{grupos.length}</strong> orden(es):{' '}
              {grupos.map((g) => `${g.provNombre} (${g.items.length})`).join(' · ')}
            </>
          )}
        </div>
      )}

      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{...s.th, width:78}}>
                <label style={s.thCheck} title="Seleccionar todos">
                  <input type="checkbox" checked={todosSeleccionados}
                    onChange={alternarTodos} />
                  Generar
                </label>
              </th>
              <th style={s.th}>Descripción</th>
              <th style={{...s.th, textAlign:'right'}}>Cant.</th>
              <th style={s.th}>Unidad</th>
              <th style={s.th}>Contrato</th>
              <th style={s.th}>Proveedor sugerido</th>
              <th style={{...s.th, textAlign:'right'}}>Precio est.</th>
              {puedeEditar && <th style={s.th}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {requerimientos.length === 0 && (
              <tr><td colSpan={puedeEditar ? 8 : 7} style={s.empty}>
                <div style={s.emptyTitulo}>Todo listo.</div>
                <div>Agrega un requerimiento para empezar.</div>
                <button style={{ ...s.btnPrimary, marginTop:14 }} onClick={abrirNuevo}>
                  + Nuevo requerimiento
                </button>
              </td></tr>
            )}
            {requerimientos.map((r) => (
              <tr key={r.id} style={sel[r.id] ? { background:'#FBF3EF' } : {}}>
                <td style={s.td}>
                  <input type="checkbox" checked={!!sel[r.id]} onChange={() => toggle(r.id)} />
                </td>
                <td style={{...s.td, fontWeight:500}}>{r.descripcion}</td>
                <td style={{...s.td, textAlign:'right'}}>{r.cantidad}</td>
                <td style={s.td}>{r.unidad}</td>
                <td style={{...s.td, fontFamily:'monospace', fontSize:12}}>{r.contrato || '—'}</td>
                <td style={s.td}>{r.proveedor?.nombre || '—'}</td>
                <td style={{...s.td, textAlign:'right'}}>{money(r.precio_estimado)}</td>
                {puedeEditar && (
                  <td style={s.td}>
                    <button style={s.btnGhost}
                      onClick={() => setEditando({ ...r, proveedor_sug: r.proveedor_sug || '' })}>
                      Editar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nuevo && (
        <ModalReq
          data={nuevo}
          setData={setNuevo}
          proveedores={proveedores}
          puedeCrearProveedor={puedeEditar}
          onProveedorCreado={agregarProveedor}
          onClose={() => setNuevo(null)}
          onSave={crearRequerimiento}
        />
      )}

      {editando && (
        <ModalReq
          data={editando}
          setData={setEditando}
          proveedores={proveedores}
          puedeCrearProveedor={puedeEditar}
          onProveedorCreado={agregarProveedor}
          onClose={() => setEditando(null)}
          onSave={(datos) => editarRequerimiento(editando.id, datos)}
        />
      )}
    </div>
  )
}

function ModalReq({ data, setData, proveedores, puedeCrearProveedor, onProveedorCreado, onClose, onSave }) {
  const [guardando, setGuardando] = useState(false)
  const [altaProveedor, setAltaProveedor] = useState(null)
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  const esNuevo = !data.id

  const descripcion = (data.descripcion || '').trim()
  const cantidad = Number(data.cantidad)
  const precio = Number(data.precio_estimado)
  const errores = []
  if (!descripcion) errores.push('La descripción es obligatoria.')
  if (!(cantidad > 0)) errores.push('La cantidad debe ser mayor que cero.')
  if (!(precio >= 0)) errores.push('El precio estimado no puede ser negativo.')
  const puedeGuardar = errores.length === 0 && !guardando

  async function guardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    const ok = await onSave({
      ...data,
      descripcion,
      cantidad,
      precio_estimado: precio,
      contrato: (data.contrato || '').trim() || null,
      proveedor_sug: data.proveedor_sug || null,
    })
    if (!ok) setGuardando(false)
  }

  return (
    <Modal onClose={onClose} maxWidth={480}>
      <ModalHead titulo={esNuevo ? 'Nuevo requerimiento' : 'Editar requerimiento'} onClose={onClose} />
      <div style={{ padding:'4px 24px 24px' }}>
        <Label requerido style={s.labelGap}>Descripción</Label>
        <input style={s.input} value={data.descripcion}
          placeholder="Qué se necesita comprar"
          onChange={(e) => set('descripcion', e.target.value)} autoFocus />

        <div style={s.row}>
          <div style={{flex:1}}>
            <Label requerido style={s.labelGap}>Cantidad</Label>
            <input type="number" style={s.input} value={data.cantidad}
              onChange={(e) => set('cantidad', +e.target.value)} />
          </div>
          <div style={{flex:1}}>
            <Label requerido style={s.labelGap}>Unidad</Label>
            <select style={s.input} value={data.unidad}
              onChange={(e) => set('unidad', e.target.value)}>
              {UNIDADES.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <Label style={s.labelGap}>Precio est.</Label>
            <input type="number" style={s.input} value={data.precio_estimado}
              onChange={(e) => set('precio_estimado', +e.target.value)} />
          </div>
        </div>

        <Label style={s.labelGap}>Proveedor sugerido</Label>
        <ComboProveedor
          proveedores={proveedores}
          valor={data.proveedor_sug}
          onChange={(id) => set('proveedor_sug', id)}
          onAgregar={puedeCrearProveedor
            ? (texto) => setAltaProveedor({ ...PROVEEDOR_VACIO, nombre: texto })
            : null}
        />

        <Label style={s.labelGap}>Contrato (opcional)</Label>
        <input style={s.input} value={data.contrato || ''}
          onChange={(e) => set('contrato', e.target.value)} />

        {errores.length > 0 && (
          <div style={s.avisoError}>{errores[0]}</div>
        )}

        <button style={{ ...s.btnPrimary, width:'100%', marginTop:16,
                         opacity: puedeGuardar ? 1 : 0.45,
                         cursor: puedeGuardar ? 'pointer' : 'not-allowed' }}
          disabled={!puedeGuardar}
          onClick={guardar}>
          {guardando ? 'Guardando...' : esNuevo ? 'Guardar requerimiento' : 'Guardar cambios'}
        </button>
      </div>

      {altaProveedor && (
        <ModalProveedor
          data={altaProveedor}
          zIndex={70}
          onClose={() => setAltaProveedor(null)}
          onGuardado={(p) => {
            onProveedorCreado(p)
            set('proveedor_sug', p.id)
            setAltaProveedor(null)
          }}
        />
      )}
    </Modal>
  )
}

function ComboProveedor({ proveedores, valor, onChange, onAgregar }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')

  const seleccionado = proveedores.find((p) => p.id === valor) || null
  const filtro = texto.trim().toLowerCase()
  const coincidencias = filtro
    ? proveedores.filter((p) =>
        p.nombre.toLowerCase().includes(filtro) ||
        (p.rfc || '').toLowerCase().includes(filtro))
    : proveedores
  const opciones = coincidencias.slice(0, 40)

  const elegir = (p) => {
    onChange(p ? p.id : '')
    setTexto('')
    setAbierto(false)
  }

  return (
    <div style={{ position:'relative' }}>
      <input
        style={s.input}
        placeholder={`Escribe para buscar entre ${proveedores.length} proveedores...`}
        value={abierto ? texto : (seleccionado?.nombre || '')}
        onFocus={() => { setTexto(''); setAbierto(true) }}
        // El cierre se retrasa para que alcance a registrarse el clic en una opción.
        onBlur={() => setTimeout(() => setAbierto(false), 120)}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true) }}
      />
      {abierto && (
        <div style={s.combo}>
          <div style={{ ...s.comboItem, color:'#8A8577' }}
            onMouseDown={() => elegir(null)}>
            — Ninguno —
          </div>
          {opciones.map((p) => (
            <div key={p.id} style={s.comboItem} onMouseDown={() => elegir(p)}>
              <span>{p.nombre}</span>
              {p.rfc && <span style={s.comboRfc}>{p.rfc}</span>}
            </div>
          ))}
          {coincidencias.length === 0 && (
            <div style={{ ...s.comboItem, color:'#A8A395' }}>Sin coincidencias.</div>
          )}
          {coincidencias.length > opciones.length && (
            <div style={s.comboMas}>
              +{coincidencias.length - opciones.length} más — sigue escribiendo para acotar.
            </div>
          )}
          {onAgregar && (
            <div style={s.comboNuevo}
              onMouseDown={(e) => {
                e.preventDefault()
                setAbierto(false)
                onAgregar(texto.trim())
              }}>
              + Agregar nuevo proveedor{texto.trim() ? ` "${texto.trim()}"` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-end',
            marginBottom:16, gap:16, flexWrap:'wrap' },
  h2: { fontSize:22, fontWeight:600, margin:0, color:'#26241D' },
  help: { fontSize:13, color:'#8A8577', marginTop:4 },
  card: { background:'#fff', border:'1px solid #E3DFD5', borderRadius:12, overflow:'hidden' },
  table: { width:'100%', borderCollapse:'collapse', fontSize:14 },
  th: { textAlign:'left', padding:'11px 14px', background:'#F4F1EA', color:'#6B6659',
        fontWeight:600, fontSize:11, textTransform:'uppercase', borderBottom:'1px solid #E3DFD5' },
  td: { padding:'11px 14px', borderBottom:'1px solid #EFEBE2' },
  empty: { textAlign:'center', color:'#8A8577', padding:'34px 26px', fontSize:14 },
  emptyTitulo: { fontSize:16, fontWeight:600, color:'#26241D', marginBottom:4 },
  msg: { padding:40, color:'#8A8577' },
  error: { padding:20, background:'#F7DEDE', color:'#B03A3A', borderRadius:8 },
  resumen: { marginBottom:12, background:'#FBF3EF', border:'1px solid #EBD9D1',
             borderRadius:10, padding:'11px 14px', fontSize:13, color:'#6B6659' },
  resumenAviso: { marginBottom:12, background:'#FBF0DA', border:'1px solid #E8D5A8',
                  borderRadius:10, padding:'11px 14px', fontSize:13, color:'#7A5B14' },
  thCheck: { display:'flex', alignItems:'center', gap:6, cursor:'pointer',
             fontSize:11, textTransform:'uppercase', fontWeight:600, color:'#6B6659' },
  btnPrimary: { background:'#26241D', color:'#fff', border:'none', padding:'10px 16px',
                borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer' },
  btnGhostLg: { background:'#fff', color:'#26241D', border:'1px solid #E3DFD5',
                padding:'10px 16px', borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer' },
  btnGhost: { background:'transparent', border:'1px solid #E3DFD5', padding:'5px 10px',
              borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer' },
  labelGap: { marginTop:12 },
  input: { width:'100%', border:'1px solid #E3DFD5', borderRadius:8, padding:'9px 11px',
           fontSize:14, boxSizing:'border-box' },
  row: { display:'flex', gap:12 },
  avisoError: { marginTop:12, background:'#F7DEDE', color:'#B03A3A', borderRadius:8,
                padding:'8px 11px', fontSize:12.5 },
  combo: { position:'absolute', top:'100%', left:0, right:0, zIndex:60, marginTop:4,
           background:'#fff', border:'1px solid #E3DFD5', borderRadius:8,
           maxHeight:240, overflowY:'auto', boxShadow:'0 12px 28px rgba(0,0,0,0.14)' },
  comboItem: { display:'flex', justifyContent:'space-between', alignItems:'center', gap:10,
               padding:'8px 11px', fontSize:13.5, cursor:'pointer',
               borderBottom:'1px solid #F2EFE8' },
  comboRfc: { fontFamily:'monospace', fontSize:11, color:'#A8A395', whiteSpace:'nowrap' },
  comboMas: { padding:'8px 11px', fontSize:12, color:'#A8A395', background:'#FCFBF8' },
  comboNuevo: { position:'sticky', bottom:0, padding:'9px 11px', fontSize:13.5, fontWeight:600,
                cursor:'pointer', color:C.aqua, background:C.aquaBg,
                borderTop:`1px solid ${C.aqua}` },
}