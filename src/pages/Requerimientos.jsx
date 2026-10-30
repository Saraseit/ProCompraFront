import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, ClipboardCheck, Sparkles } from 'lucide-react'
import api from '../api'
import { money, mensajeError, fechaCorta, hoy, isoLocal, PROVEEDOR_VACIO, UNIDADES, esOperacion } from '../constants'
import Modal, { ModalHead, Label } from '../ui/Modal'
import { useToast } from '../ui/feedback-context'
import { C } from '../ui/tema'
import { ModalProveedor } from './Proveedores'
import ComboProveedor from '../ui/ComboProveedor'
import { CargaTabla } from '../ui/Carga'
import Vacio from '../ui/Vacio'


const REQ_VACIO = {
  descripcion: '', cantidad: 1, unidad: 'PZA',
  precio_estimado: 0, contrato: '', proveedor_sug: '', fecha_requerida: '',
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const CLAVE_VISTA = 'procompra-vista-requerimientos'

function lunesDe(fecha) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

function sumarDias(fecha, n) {
  const d = new Date(fecha)
  d.setDate(d.getDate() + n)
  return d
}

function leerVista() {
  try { return localStorage.getItem(CLAVE_VISTA) === 'semana' ? 'semana' : 'lista' } catch { return 'lista' }
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
  const [vista, setVista] = useState(leerVista)
  const toast = useToast()

  const cambiarVista = (v) => {
    setVista(v)
    try { localStorage.setItem(CLAVE_VISTA, v) } catch { /* sin almacenamiento */ }
  }

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
  // Almacén y compras conviven: los dos capturan, editan y generan órdenes.
  const puedeEditar = esOperacion(usuario.rol)
  const abrirNuevo = () => setNuevo({ ...REQ_VACIO })

  const todosSeleccionados = requerimientos.length > 0 && nSel === requerimientos.length
  const alternarTodos = () =>
    setSel(todosSeleccionados
      ? {}
      : Object.fromEntries(requerimientos.map((r) => [r.id, true])))

  const grupoSinProveedor = grupos.find((g) => g.provId === '__sin_proveedor__')
  const puedeGenerar = nSel > 0 && !grupoSinProveedor && !generando

  if (cargando) return <CargaTabla filas={7} columnas={7} />
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
            <Plus size={16} /> Nuevo requerimiento
          </button>
          {puedeEditar && <button
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
              : <><Sparkles size={15} /> Generar órdenes de compra{nSel > 0 ? ` (${nSel})` : ''}</>}
          </button>}
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

      <div style={s.vistas} role="tablist" aria-label="Vista">
        {[['lista', 'Lista'], ['semana', 'Semana']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={vista === k}
            style={vista === k ? s.vistaActiva : s.vista} onClick={() => cambiarVista(k)}>
            {label}
          </button>
        ))}
      </div>

      {vista === 'semana' && (
        <VistaSemana
          requerimientos={requerimientos}
          sel={sel}
          toggle={toggle}
          seleccionar={(ids) => setSel((x) => ({ ...x, ...Object.fromEntries(ids.map((id) => [id, true])) }))}
          onEditar={puedeEditar ? (r) => setEditando({ ...r, proveedor_sug: r.proveedor_sug || '' }) : null}
          onNuevo={abrirNuevo}
        />
      )}

      {vista === 'lista' && <div style={s.card}>
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
              <th style={s.th}>Para</th>
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
              <tr><td colSpan={puedeEditar ? 9 : 8} style={s.empty}>
                <Vacio icono={ClipboardCheck} titulo="Todo listo" compacto
                  accion={<button style={s.btnPrimary} onClick={abrirNuevo}><Plus size={16} /> Nuevo requerimiento</button>}>
                  No hay requerimientos pendientes. Agrega uno para empezar.
                </Vacio>
              </td></tr>
            )}
            {requerimientos.map((r) => (
              <tr key={r.id} style={sel[r.id] ? { background:'var(--pc-acento-bg)' } : {}}>
                <td style={s.td}>
                  <input type="checkbox" checked={!!sel[r.id]} onChange={() => toggle(r.id)} />
                </td>
                <td style={{...s.td, fontWeight:500}}>{r.descripcion}</td>
                <td style={{ ...s.td, whiteSpace:'nowrap',
                             ...(r.fecha_requerida && r.fecha_requerida < hoy() ? s.atrasada : {}) }}>
                  {r.fecha_requerida ? fechaCorta(r.fecha_requerida) : '—'}
                </td>
                <td style={{...s.td, textAlign:'right'}}>{r.cantidad}</td>
                <td style={s.td}>{r.unidad}</td>
                <td style={{...s.td, fontFamily:'var(--pc-mono)', fontSize:12}}>{r.contrato || '—'}</td>
                <td style={s.td}>{r.proveedor?.nombre || '—'}</td>
                <td style={{...s.td, textAlign:'right'}}>{money(r.precio_estimado)}</td>
                {puedeEditar && (
                  <td style={s.td}>
                    <button style={s.btnGhost}
                      onClick={() => setEditando({ ...r, proveedor_sug: r.proveedor_sug || '' })}>
                      <Pencil size={12} /> Editar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

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

// Requerimientos pendientes acomodados por día de la semana según su fecha requerida.
function VistaSemana({ requerimientos, sel, toggle, seleccionar, onEditar, onNuevo }) {
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const hoyIso = hoy()
  const inicio = isoLocal(lunes)
  const fin = isoLocal(sumarDias(lunes, 6))
  const esSemanaActual = inicio === isoLocal(lunesDe(new Date()))

  const dias = DIAS.map((nombre, i) => {
    const fecha = sumarDias(lunes, i)
    const iso = isoLocal(fecha)
    return { nombre, iso, numero: fecha.getDate(), items: requerimientos.filter((r) => r.fecha_requerida === iso) }
  })
  const deLaSemana = dias.flatMap((d) => d.items)
  // Lo atrasado se muestra en la semana en curso, que es donde hay que resolverlo.
  const atrasados = esSemanaActual
    ? requerimientos.filter((r) => r.fecha_requerida && r.fecha_requerida < inicio)
    : []
  const sinFecha = requerimientos.filter((r) => !r.fecha_requerida)
  const estimado = deLaSemana.reduce((suma, r) => suma + (r.cantidad || 0) * (r.precio_estimado || 0), 0)

  const diaMes = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  const rango = `${diaMes(inicio)} – ${diaMes(fin)} ${fin.slice(0, 4)}`
  const porSeleccionar = [...atrasados, ...deLaSemana].filter((r) => !sel[r.id]).map((r) => r.id)

  const tarjeta = (r) => (
    <div key={r.id} style={{ ...s.reqCard, ...(sel[r.id] ? s.reqCardSel : {}) }}>
      <input type="checkbox" checked={!!sel[r.id]} onChange={() => toggle(r.id)}
        aria-label={`Seleccionar ${r.descripcion}`} style={{ marginTop: 2 }} />
      <div style={{ minWidth: 0, flex: 1, cursor: onEditar ? 'pointer' : 'default' }}
        onClick={onEditar ? () => onEditar(r) : undefined}
        title={onEditar ? 'Editar requerimiento' : undefined}>
        <div style={s.reqDesc}>{r.descripcion}</div>
        <div style={s.reqMeta}>{r.cantidad} {r.unidad}{r.proveedor?.nombre ? ` · ${r.proveedor.nombre}` : ''}</div>
        {r.contrato && <div style={s.reqContrato}>{r.contrato}</div>}
      </div>
    </div>
  )

  return (
    <div>
      <div style={s.semanaBarra}>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <button style={s.btnNav} onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="Semana anterior">‹</button>
          <button style={{ ...s.btnGhost, padding:'6px 12px', opacity: esSemanaActual ? 0.5 : 1 }}
            disabled={esSemanaActual} onClick={() => setLunes(lunesDe(new Date()))}>
            Esta semana
          </button>
          <button style={s.btnNav} onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="Semana siguiente">›</button>
          <span style={s.rango}>{rango}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span style={s.semanaResumen}>
            {deLaSemana.length} requerimiento{deLaSemana.length === 1 ? '' : 's'}
            {estimado > 0 && ` · ${money(estimado)} estimado`}
          </span>
          {porSeleccionar.length > 0 && (
            <button style={s.btnAqua} onClick={() => seleccionar(porSeleccionar)}>
              Seleccionar {atrasados.length ? 'semana y atrasados' : 'semana'} ({porSeleccionar.length})
            </button>
          )}
        </div>
      </div>

      {atrasados.length > 0 && (
        <div style={s.franjaAtrasados}>
          <div style={s.franjaTitulo}>Atrasados · {atrasados.length}</div>
          <div style={s.franjaItems}>
            {atrasados.map((r) => (
              <div key={r.id} style={{ display:'flex', flexDirection:'column', gap:3 }}>
                <span style={s.franjaFecha}>para el {fechaCorta(r.fecha_requerida)}</span>
                {tarjeta(r)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={s.semana}>
        {dias.map((d) => {
          const esHoy = d.iso === hoyIso
          return (
            <div key={d.iso} style={{ ...s.dia, ...(d.iso < hoyIso ? s.diaPasado : {}), ...(esHoy ? s.diaHoy : {}) }}>
              <div style={s.diaHead}>
                <span style={{ ...s.diaNombre, ...(esHoy ? { color: C.aqua } : {}) }}>{d.nombre}</span>
                <span style={{ ...s.diaNumero, ...(esHoy ? { color: C.aqua } : {}) }}>{d.numero}</span>
                {d.items.length > 0 && <span style={s.diaCuenta}>{d.items.length}</span>}
              </div>
              <div style={s.diaItems}>
                {d.items.length === 0 && <div style={s.diaVacio}>—</div>}
                {d.items.map(tarjeta)}
              </div>
            </div>
          )
        })}
      </div>

      <div style={s.franjaSinFecha}>
        <div style={s.franjaTitulo}>Sin fecha requerida · {sinFecha.length}</div>
        {sinFecha.length === 0 ? (
          <div style={s.diaVacio}>Todos los pendientes tienen fecha.</div>
        ) : (
          <>
            <p style={{ ...s.help, margin:'0 0 10px' }}>
              {onEditar ? 'Toca uno para asignarle fecha y que aparezca en su día.' : 'Aún no tienen fecha asignada.'}
            </p>
            <div style={s.franjaItems}>{sinFecha.map(tarjeta)}</div>
          </>
        )}
      </div>

      {requerimientos.length === 0 && (
        <div style={{ ...s.empty, ...s.vacioSemana }}>
          <div style={s.emptyTitulo}>Todo listo.</div>
          <div>No hay requerimientos pendientes.</div>
          <button style={{ ...s.btnPrimary, marginTop:14 }} onClick={onNuevo}><Plus size={16} /> Nuevo requerimiento</button>
        </div>
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
      fecha_requerida: data.fecha_requerida || null,
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

        <div style={s.row}>
          <div style={{flex:1}}>
            <Label style={s.labelGap}>Fecha requerida</Label>
            <input type="date" style={s.input} value={data.fecha_requerida || ''}
              onChange={(e) => set('fecha_requerida', e.target.value)} />
          </div>
          <div style={{flex:1}}>
            <Label style={s.labelGap}>Contrato (opcional)</Label>
            <input style={s.input} value={data.contrato || ''}
              onChange={(e) => set('contrato', e.target.value)} />
          </div>
        </div>

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

const s = {
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-end',
            marginBottom:16, gap:16, flexWrap:'wrap' },
  h2: { fontSize:24, fontWeight:700, margin:0, color:'var(--pc-tinta)', letterSpacing:'-0.022em' },
  help: { fontSize:13, color:'var(--pc-gris)', marginTop:4 },
  card: { background:'var(--pc-superficie)', border:'1px solid var(--pc-borde)', borderRadius:12, overflowX:'auto', boxShadow:'var(--pc-sombra-1)' },
  table: { minWidth:860, width:'100%', borderCollapse:'collapse', fontSize:14 },
  th: { textAlign:'left', padding:'11px 14px', background:'var(--pc-superficie-3)', color:'var(--pc-gris-2)',
        fontWeight:600, fontSize:11, textTransform:'uppercase', borderBottom:'1px solid var(--pc-borde)' },
  td: { padding:'11px 14px', borderBottom:'1px solid var(--pc-linea)' },
  empty: { textAlign:'center', color:'var(--pc-gris)', padding:'34px 26px', fontSize:14 },
  emptyTitulo: { fontSize:16, fontWeight:600, color:'var(--pc-tinta)', marginBottom:4 },
  msg: { padding:40, color:'var(--pc-gris)' },
  error: { padding:20, background:'var(--pc-rojo-bg)', color:'var(--pc-rojo)', borderRadius:8 },
  resumen: { marginBottom:12, background:'var(--pc-acento-bg)', border:'1px solid var(--pc-acento-borde)',
             borderRadius:10, padding:'11px 14px', fontSize:13, color:'var(--pc-gris-2)' },
  resumenAviso: { marginBottom:12, background:'var(--pc-ambar-bg)', border:'1px solid var(--pc-ambar-borde)',
                  borderRadius:10, padding:'11px 14px', fontSize:13, color:'var(--pc-ambar-texto)' },
  thCheck: { display:'flex', alignItems:'center', gap:6, cursor:'pointer',
             fontSize:11, textTransform:'uppercase', fontWeight:600, color:'var(--pc-gris-2)' },
  btnPrimary: { background:'var(--pc-btn)', color:'var(--pc-btn-texto)', border:'none', padding:'10px 16px',
                borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer' },
  btnGhostLg: { background:'var(--pc-superficie)', color:'var(--pc-tinta)', border:'1px solid var(--pc-borde)',
                padding:'10px 16px', borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer' },
  btnGhost: { background:'transparent', border:'1px solid var(--pc-borde)', padding:'5px 10px',
              borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer' },
  labelGap: { marginTop:12 },
  atrasada: { color:'var(--pc-rojo)', fontWeight:600 },
  vistas: { display:'inline-flex', gap:2, padding:3, marginBottom:12, borderRadius:9,
            background:'var(--pc-superficie-3)', border:'1px solid var(--pc-borde)' },
  vista: { border:'none', background:'none', padding:'6px 14px', borderRadius:7, fontSize:13, fontWeight:500,
           cursor:'pointer', color:'var(--pc-gris)', font:'inherit' },
  vistaActiva: { border:'none', background:'var(--pc-superficie)', padding:'6px 14px', borderRadius:7, fontSize:13,
                 fontWeight:600, cursor:'pointer', color:'var(--pc-tinta)', font:'inherit',
                 boxShadow:'0 1px 3px rgba(0,0,0,0.10)' },
  semanaBarra: { display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap',
                 marginBottom:12 },
  btnNav: { width:32, height:32, border:'1px solid var(--pc-borde)', borderRadius:8, background:'var(--pc-superficie)',
            cursor:'pointer', fontSize:18, lineHeight:1, color:'var(--pc-tinta)' },
  rango: { fontSize:15, fontWeight:600, color:'var(--pc-tinta)', marginLeft:6 },
  semanaResumen: { fontSize:13, color:'var(--pc-gris)' },
  btnAqua: { background:C.aquaBg, color:C.aqua, border:`1px solid ${C.aqua}`, padding:'6px 12px', borderRadius:8,
             fontSize:12.5, fontWeight:600, cursor:'pointer' },
  semana: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:8 },
  dia: { background:'var(--pc-superficie)', border:'1px solid var(--pc-borde)', borderRadius:10,
         minHeight:120, display:'flex', flexDirection:'column' },
  diaHoy: { borderColor:C.aqua, boxShadow:`0 0 0 2px ${C.aquaBg}` },
  diaPasado: { background:'var(--pc-superficie-2)' },
  diaHead: { display:'flex', alignItems:'baseline', gap:6, padding:'9px 10px 7px',
             borderBottom:'1px solid var(--pc-linea)' },
  diaNombre: { fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--pc-gris)' },
  diaNumero: { fontSize:16, fontWeight:700, color:'var(--pc-tinta)' },
  diaCuenta: { marginLeft:'auto', fontSize:11, fontWeight:600, color:'var(--pc-gris-2)',
               background:'var(--pc-superficie-3)', padding:'1px 7px', borderRadius:10 },
  diaItems: { padding:8, display:'flex', flexDirection:'column', gap:6, flex:1 },
  diaVacio: { fontSize:12, color:'var(--pc-gris-3)', textAlign:'center', padding:'6px 0' },
  reqCard: { display:'flex', gap:7, alignItems:'flex-start', padding:'7px 8px', borderRadius:8,
             background:'var(--pc-superficie-2)', border:'1px solid var(--pc-linea)' },
  reqCardSel: { background:'var(--pc-acento-bg)', borderColor:'var(--pc-acento-borde)' },
  reqDesc: { fontSize:12.5, fontWeight:600, color:'var(--pc-tinta)', lineHeight:1.3, overflowWrap:'anywhere' },
  reqMeta: { fontSize:11.5, color:'var(--pc-gris)', marginTop:2 },
  reqContrato: { fontSize:10.5, fontFamily:'var(--pc-mono)', color:'var(--pc-gris-3)', marginTop:2 },
  franjaAtrasados: { background:'var(--pc-rojo-bg)', border:'1px solid var(--pc-rojo-borde)', borderRadius:10,
                     padding:'10px 12px', marginBottom:10 },
  franjaSinFecha: { background:'var(--pc-superficie)', border:'1px dashed var(--pc-borde)', borderRadius:10,
                    padding:'10px 12px', marginTop:10 },
  franjaTitulo: { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em',
                  color:'var(--pc-gris-2)', marginBottom:8 },
  franjaItems: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:8 },
  franjaFecha: { fontSize:11, fontWeight:600, color:'var(--pc-rojo)' },
  vacioSemana: { background:'var(--pc-superficie)', border:'1px dashed var(--pc-borde)', borderRadius:12, marginTop:12 },
  input: { width:'100%', border:'1px solid var(--pc-borde)', borderRadius:8, padding:'9px 11px',
           fontSize:14, boxSizing:'border-box' },
  row: { display:'flex', gap:12 },
  avisoError: { marginTop:12, background:'var(--pc-rojo-bg)', color:'var(--pc-rojo)', borderRadius:8,
                padding:'8px 11px', fontSize:12.5 },
}