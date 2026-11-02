import { useEffect, useState } from 'react'
import { Check, Search } from 'lucide-react'
import api from '../../api'
import { UNIDADES, precioUnitario, mensajeError } from '../../constants'
import Modal, { ModalHead, Label } from '../../ui/Modal'
import { useToast, useConfirm } from '../../ui/feedback-context'
import { s as base, nombreSugerido } from './estilos'

// Lista de insumos del catálogo con búsqueda, para elegir uno.
function ElegirInsumo({ elegido, onElegir, excluir }) {
  const [q, setQ] = useState('')
  const [lista, setLista] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/precios/insumos', { params: { q } }).then(({ data }) => setLista(data)).catch(() => setLista([]))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const visibles = (lista || []).filter((i) => i.id !== excluir)
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <Search size={15} style={s.lupa} />
        <input style={{ ...base.input, paddingLeft: 32 }} placeholder="Buscar en el catálogo" value={q}
          onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div style={s.lista} role="listbox" aria-label="Insumos">
        {lista === null && <div style={s.vacio}>Cargando...</div>}
        {lista && visibles.length === 0 && (
          <div style={s.vacio}>{q ? 'Ningún insumo coincide.' : 'El catálogo aún está vacío: crea el primero.'}</div>
        )}
        {visibles.map((i) => (
          <button key={i.id} role="option" aria-selected={elegido?.id === i.id}
            style={{ ...s.opcion, ...(elegido?.id === i.id ? s.opcionActiva : {}) }} onClick={() => onElegir(i)}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{i.nombre}</span>
              <span style={base.sub}> · {i.unidad || 'sin unidad'} · {i.compras} compras
                {i.ultimo_precio ? ` · último ${precioUnitario(i.ultimo_precio)}` : ''}</span>
            </span>
            {elegido?.id === i.id && <Check size={15} />}
          </button>
        ))}
      </div>
    </div>
  )
}

// Clasificar un texto (y los que se le parecen): como insumo nuevo o en uno existente.
export function ModalAsignar({ grupo, modo: modoInicial = 'nuevo', sugerido, onClose, onListo }) {
  const [modo, setModo] = useState(modoInicial)
  const [nombre, setNombre] = useState(nombreSugerido(grupo.descripcion || grupo.texto_norm))
  const [unidad, setUnidad] = useState(grupo.unidad || '')
  const [elegido, setElegido] = useState(sugerido || null)
  const [similares, setSimilares] = useState(null)
  const [marcados, setMarcados] = useState(new Set())
  const [guardando, setGuardando] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!grupo.texto_norm) return
    api.get('/precios/similares', { params: { texto: grupo.texto_norm } })
      .then(({ data }) => {
        setSimilares(data)
        setMarcados(new Set(data.filter((d) => d.parecido >= 0.8).map((d) => d.texto_norm)))
      })
      .catch(() => setSimilares([]))
  }, [grupo.texto_norm])

  const alternar = (t) => setMarcados((m) => {
    const n = new Set(m)
    if (n.has(t)) n.delete(t); else n.add(t)
    return n
  })

  const textos = [grupo.texto_norm, ...marcados].filter(Boolean)
  const puede = !guardando && (modo === 'nuevo' ? nombre.trim().length > 0 : !!elegido)

  async function guardar() {
    if (!puede) return
    setGuardando(true)
    try {
      if (modo === 'nuevo') {
        const { data } = await api.post('/precios/insumos', { nombre: nombre.trim(), unidad: unidad || null, textos })
        toast(`Insumo «${data.nombre}» creado · ${data.renglones} compras agrupadas`)
        onListo(data)
      } else {
        const { data } = await api.post('/precios/clasificar', { textos, insumo_id: elegido.id })
        toast(`${data.renglones} compras agregadas a «${elegido.nombre}»`)
        onListo(elegido)
      }
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
      setGuardando(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={600}>
      <ModalHead titulo="Clasificar" subtitulo={grupo.texto_norm} onClose={onClose} />
      <div style={{ padding: '4px 24px 24px' }}>
        <div style={{ ...base.segmento, marginBottom: 14 }} role="tablist">
          <button role="tab" aria-selected={modo === 'nuevo'} style={{ ...base.segBtn, ...(modo === 'nuevo' ? base.segActivo : {}) }}
            onClick={() => setModo('nuevo')}>Insumo nuevo</button>
          <button role="tab" aria-selected={modo === 'existente'} style={{ ...base.segBtn, ...(modo === 'existente' ? base.segActivo : {}) }}
            onClick={() => setModo('existente')}>Ya existe en el catálogo</button>
        </div>

        {modo === 'nuevo' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px', gap: 10 }}>
            <div>
              <Label requerido style={s.label}>Nombre del insumo</Label>
              <input style={base.input} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus maxLength={120} />
            </div>
            <div>
              <Label style={s.label}>Unidad</Label>
              <input style={base.input} value={unidad} list="pc-unidades" onChange={(e) => setUnidad(e.target.value.toUpperCase())} maxLength={20} />
              <datalist id="pc-unidades">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
            </div>
          </div>
        ) : (
          <ElegirInsumo elegido={elegido} onElegir={setElegido} />
        )}

        <div style={s.subtitulo}>Textos que se agrupan</div>
        <div style={s.textos}>
          <label style={s.texto}>
            <input type="checkbox" checked disabled />
            <span style={s.mono}>{grupo.texto_norm}</span>
            {grupo.compras ? <span style={base.sub}>{grupo.compras} compras</span> : null}
          </label>
          {similares === null && <div style={s.vacio}>Buscando textos parecidos...</div>}
          {similares?.map((d) => (
            <label key={d.texto_norm} style={s.texto}>
              <input type="checkbox" checked={marcados.has(d.texto_norm)} onChange={() => alternar(d.texto_norm)} />
              <span style={s.mono}>{d.texto_norm}</span>
              <span style={base.sub}>{d.compras} compras · {d.unidad || '—'} · {precioUnitario(d.ultimo_precio)}</span>
            </label>
          ))}
          {similares?.length === 0 && <div style={s.vacio}>No hay otros textos parecidos sin clasificar.</div>}
        </div>
        <p style={base.nota}>Las facturas futuras con estos textos se reconocerán solas.</p>

        <button style={{ ...base.btnPrimario, width: '100%', marginTop: 14, opacity: puede ? 1 : 0.45 }} disabled={!puede} onClick={guardar}>
          {guardando ? 'Guardando...' : modo === 'nuevo'
            ? `Crear insumo con ${textos.length} texto${textos.length === 1 ? '' : 's'}`
            : `Agregar ${textos.length} texto${textos.length === 1 ? '' : 's'} a ${elegido ? `«${elegido.nombre}»` : 'el insumo'}`}
        </button>
      </div>
    </Modal>
  )
}

// Renombrar, cambiar unidad, unir con otro o borrar un insumo del catálogo.
export function ModalEditarInsumo({ insumo, onClose, onListo, onBorrado }) {
  const [datos, setDatos] = useState({
    nombre: insumo.nombre || '', unidad: insumo.unidad || '', clave_sat: insumo.clave_sat || '', notas: insumo.notas || '',
  })
  const [uniendo, setUniendo] = useState(false)
  const [destino, setDestino] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const toast = useToast()
  const confirmar = useConfirm()
  const set = (k, v) => setDatos((d) => ({ ...d, [k]: v }))

  async function ejecutar(accion) {
    setGuardando(true)
    try { await accion() } catch (e) { toast('Error: ' + mensajeError(e), 'error'); setGuardando(false) }
  }

  const guardar = () => ejecutar(async () => {
    await api.patch(`/precios/insumos/${insumo.id}`, {
      nombre: datos.nombre.trim(), unidad: datos.unidad.trim() || null,
      clave_sat: datos.clave_sat.trim() || null, notas: datos.notas.trim() || null,
    })
    toast('Insumo actualizado')
    onListo(null)
  })

  const unir = () => ejecutar(async () => {
    await api.post(`/precios/insumos/${insumo.id}/unir`, { destino_id: destino.id })
    toast(`«${insumo.nombre}» ahora es parte de «${destino.nombre}»`)
    onListo(destino.id)
  })

  async function borrar() {
    const ok = await confirmar({
      titulo: 'Borrar insumo', peligro: true, textoBoton: 'Borrar',
      mensaje: `«${insumo.nombre}» sale del catálogo. Sus compras no se pierden: sus textos vuelven a «Por clasificar».`,
    })
    if (!ok) return
    ejecutar(async () => {
      await api.delete(`/precios/insumos/${insumo.id}`)
      toast('Insumo borrado')
      onBorrado()
    })
  }

  return (
    <Modal onClose={onClose} maxWidth={560}>
      <ModalHead titulo={uniendo ? 'Unir con otro insumo' : 'Editar insumo'} subtitulo={insumo.nombre} onClose={onClose} />
      <div style={{ padding: '4px 24px 24px' }}>
        {uniendo ? (
          <>
            <p style={{ ...base.help, marginTop: 0 }}>
              Si dos insumos resultaron ser lo mismo, elige con cuál se queda. Todas las compras y textos de
              «{insumo.nombre}» pasan a ese.
            </p>
            <ElegirInsumo elegido={destino} onElegir={setDestino} excluir={insumo.id} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button style={base.btnSecundario} onClick={() => setUniendo(false)}>Atrás</button>
              <button style={{ ...base.btnPrimario, flex: 1, opacity: destino && !guardando ? 1 : 0.45 }}
                disabled={!destino || guardando} onClick={unir}>
                {destino ? `Unir con «${destino.nombre}»` : 'Elige un insumo'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px', gap: 10 }}>
              <div>
                <Label requerido style={s.label}>Nombre</Label>
                <input style={base.input} value={datos.nombre} onChange={(e) => set('nombre', e.target.value)} maxLength={120} />
              </div>
              <div>
                <Label style={s.label}>Unidad</Label>
                <input style={base.input} value={datos.unidad} list="pc-unidades-editar" maxLength={20}
                  onChange={(e) => set('unidad', e.target.value.toUpperCase())} />
                <datalist id="pc-unidades-editar">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
              </div>
            </div>
            <p style={base.nota}>La unidad decide qué compras se comparan: las de otra unidad se muestran pero no cuentan para la referencia.</p>
            <Label style={s.label}>Clave SAT (opcional)</Label>
            <input style={base.input} value={datos.clave_sat} onChange={(e) => set('clave_sat', e.target.value)} maxLength={20} />
            <Label style={s.label}>Notas (opcional)</Label>
            <input style={base.input} value={datos.notas} onChange={(e) => set('notas', e.target.value)} maxLength={500} />

            <button style={{ ...base.btnPrimario, width: '100%', marginTop: 16, opacity: datos.nombre.trim() && !guardando ? 1 : 0.45 }}
              disabled={!datos.nombre.trim() || guardando} onClick={guardar}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap' }}>
              <button style={base.btnTexto} onClick={() => setUniendo(true)}>Unir con otro insumo</button>
              <button style={{ ...base.btnTexto, color: 'var(--pc-rojo)' }} onClick={borrar}>Borrar insumo</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

const s = {
  label: { margin: '12px 0 6px' },
  lupa: { position: 'absolute', left: 10, top: 12, color: 'var(--pc-gris)' },
  lista: { marginTop: 8, maxHeight: 240, overflowY: 'auto', border: '1px solid var(--pc-borde)', borderRadius: 10 },
  opcion: { width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '10px 12px', border: 'none',
            borderBottom: '1px solid var(--pc-linea)', background: 'none', cursor: 'pointer', font: 'inherit', fontSize: 13.5,
            color: 'var(--pc-tinta)' },
  opcionActiva: { background: 'var(--pc-aqua-bg)', color: 'var(--pc-aqua)' },
  vacio: { padding: '12px', fontSize: 13, color: 'var(--pc-gris)' },
  subtitulo: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pc-gris)', fontWeight: 600,
               margin: '18px 0 8px' },
  textos: { display: 'grid', gap: 4, maxHeight: 220, overflowY: 'auto' },
  texto: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 10px', borderRadius: 8,
           background: 'var(--pc-superficie-3)', fontSize: 13, cursor: 'pointer' },
  mono: { fontFamily: 'var(--pc-mono)', fontSize: 12, overflowWrap: 'anywhere', flex: '1 1 200px' },
}
