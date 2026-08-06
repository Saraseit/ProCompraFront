import { useState, useEffect, useMemo } from 'react'
import api from '../api'

const UNIDADES = ["PZA","CAJA","LITRO","KILO","CUBETA","BOTE","CORTE","GALON","MTR","ROLLO","SERVICIO","PAQUETE"]
const money = (n) => (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" })

export default function Requerimientos({ usuario, onOrdenCreada }) {
  const [requerimientos, setRequerimientos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [nuevo, setNuevo] = useState(null)
  const [editando, setEditando] = useState(null)
  const [sel, setSel] = useState({})
  const [generando, setGenerando] = useState(false)

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
        setError('Error al cargar datos: ' + (e.response?.data?.detail || e.message))
      }
      setCargando(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  async function recargarReqs() {
    const reqRes = await api.get('/requerimientos?estado=pendiente')
    setRequerimientos(reqRes.data)
  }

  async function crearRequerimiento(datos) {
    try {
      await api.post('/requerimientos', { ...datos, solicitante_id: usuario.id })
      setNuevo(null)
      await recargarReqs()
    } catch (e) {
      alert('Error al crear: ' + (e.response?.data?.detail || e.message))
    }
  }

  async function editarRequerimiento(id, datos) {
    try {
      await api.put(`/requerimientos/${id}`, datos)
      setEditando(null)
      await recargarReqs()
    } catch (e) {
      alert('Error al editar: ' + (e.response?.data?.detail || e.message))
    }
  }

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
    try {
      for (const grupo of grupos) {
        if (grupo.provId === '__sin_proveedor__') {
          alert(`Sin proveedor — no se puede convertir: ${grupo.items.map(i => i.descripcion).join(', ')}`)
          continue
        }
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
      }
      setSel({})
      await recargarReqs()
      if (onOrdenCreada) onOrdenCreada()
    } catch (e) {
      alert('Error al generar orden: ' + (e.response?.data?.detail || e.message))
    }
    setGenerando(false)
  }

  const toggle = (id) => setSel((s) => ({ ...s, [id]: !s[id] }))
  const nSel = seleccionados.length
  const puedeEditar = ['admin', 'compras'].includes(usuario.rol)

  if (cargando) return <div style={s.msg}>Cargando requerimientos...</div>
  if (error) return <div style={s.error}>{error}</div>

  return (
    <div>
      <div style={s.header}>
        <div>
          <h2 style={s.h2}>Requerimientos</h2>
          <p style={s.help}>Selecciona los que quieres convertir en órdenes — se agrupan por proveedor automáticamente.</p>
        </div>
        <button style={s.btnPrimary} onClick={() => setNuevo({
          descripcion: '', cantidad: 1, unidad: 'PZA',
          precio_estimado: 0, contrato: '', proveedor_sug: '',
        })}>
          + Nuevo requerimiento
        </button>
      </div>

      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{...s.th, width:34}}></th>
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
              <tr><td colSpan={puedeEditar ? 8 : 7} style={s.empty}>No hay requerimientos pendientes.</td></tr>
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

      {nSel > 0 && (
        <div style={s.genBar}>
          <div style={{ fontSize:14 }}>
            <strong>{nSel}</strong> requerimiento(s) → generará{' '}
            <strong>{grupos.length}</strong> orden(es):{' '}
            <span style={{ color:'#A8A395' }}>
              {grupos.map((g) => `${g.provNombre} (${g.items.length})`).join(' · ')}
            </span>
          </div>
          <button style={s.btnLight} disabled={generando} onClick={generarOrdenes}>
            {generando ? 'Generando...' : 'Generar órdenes de compra →'}
          </button>
        </div>
      )}

      {nuevo && (
        <ModalReq
          data={nuevo}
          setData={setNuevo}
          proveedores={proveedores}
          onClose={() => setNuevo(null)}
          onSave={crearRequerimiento}
        />
      )}

      {editando && (
        <ModalReq
          data={editando}
          setData={setEditando}
          proveedores={proveedores}
          onClose={() => setEditando(null)}
          onSave={(datos) => editarRequerimiento(editando.id, datos)}
        />
      )}
    </div>
  )
}

function ModalReq({ data, setData, proveedores, onClose, onSave }) {
  const set = (k, v) => setData({ ...data, [k]: v })
  const esNuevo = !data.id

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={s.h3}>{esNuevo ? 'Nuevo requerimiento' : 'Editar requerimiento'}</h3>

        <label style={s.label}>Descripción</label>
        <input style={s.input} value={data.descripcion}
          onChange={(e) => set('descripcion', e.target.value)} autoFocus />

        <div style={s.row}>
          <div style={{flex:1}}>
            <label style={s.label}>Cantidad</label>
            <input type="number" style={s.input} value={data.cantidad}
              onChange={(e) => set('cantidad', +e.target.value)} />
          </div>
          <div style={{flex:1}}>
            <label style={s.label}>Unidad</label>
            <select style={s.input} value={data.unidad}
              onChange={(e) => set('unidad', e.target.value)}>
              {UNIDADES.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <label style={s.label}>Precio est.</label>
            <input type="number" style={s.input} value={data.precio_estimado}
              onChange={(e) => set('precio_estimado', +e.target.value)} />
          </div>
        </div>

        <label style={s.label}>Proveedor sugerido</label>
        <select style={s.input} value={data.proveedor_sug}
          onChange={(e) => set('proveedor_sug', e.target.value)}>
          <option value="">— Ninguno —</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>

        <label style={s.label}>Contrato (opcional)</label>
        <input style={s.input} value={data.contrato || ''}
          onChange={(e) => set('contrato', e.target.value)} />

        <button style={{...s.btnPrimary, width:'100%', marginTop:12}}
          disabled={!data.descripcion}
          onClick={() => onSave({ ...data, proveedor_sug: data.proveedor_sug || null })}>
          {esNuevo ? 'Guardar requerimiento' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

const s = {
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:16, gap:16 },
  h2: { fontSize:22, fontWeight:600, margin:0, color:'#26241D' },
  h3: { fontSize:18, fontWeight:600, marginTop:0, color:'#26241D' },
  help: { fontSize:13, color:'#8A8577', marginTop:4 },
  card: { background:'#fff', border:'1px solid #E3DFD5', borderRadius:12, overflow:'hidden' },
  table: { width:'100%', borderCollapse:'collapse', fontSize:14 },
  th: { textAlign:'left', padding:'11px 14px', background:'#F4F1EA', color:'#6B6659',
        fontWeight:600, fontSize:11, textTransform:'uppercase', borderBottom:'1px solid #E3DFD5' },
  td: { padding:'11px 14px', borderBottom:'1px solid #EFEBE2' },
  empty: { textAlign:'center', color:'#A8A395', padding:26 },
  msg: { padding:40, color:'#8A8577' },
  error: { padding:20, background:'#F7DEDE', color:'#B03A3A', borderRadius:8 },
  genBar: { position:'sticky', bottom:16, marginTop:18, background:'#26241D', color:'#fff',
            padding:'16px 20px', borderRadius:12, display:'flex', justifyContent:'space-between',
            alignItems:'center', gap:16, boxShadow:'0 10px 30px rgba(0,0,0,0.18)', flexWrap:'wrap' },
  btnPrimary: { background:'#26241D', color:'#fff', border:'none', padding:'10px 16px',
                borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer' },
  btnLight: { background:'#fff', color:'#26241D', border:'none', padding:'10px 18px',
              borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer' },
  btnGhost: { background:'transparent', border:'1px solid #E3DFD5', padding:'5px 10px',
              borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer' },
  overlay: { position:'fixed', inset:0, background:'rgba(30,28,22,0.5)', display:'flex',
             alignItems:'center', justifyContent:'center', padding:16, zIndex:50 },
  modal: { background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:480 },
  label: { display:'block', fontSize:12, color:'#8A8577', marginBottom:5, marginTop:12, fontWeight:500 },
  input: { width:'100%', border:'1px solid #E3DFD5', borderRadius:8, padding:'9px 11px',
           fontSize:14, boxSizing:'border-box' },
  row: { display:'flex', gap:12 },
}