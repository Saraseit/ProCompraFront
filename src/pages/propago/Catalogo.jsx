import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, FlaskConical, BookOpen } from 'lucide-react'
import api from '../../api'
import { money, mensajeError } from '../../constants'
import Modal, { ModalHead, Label } from '../../ui/Modal'
import { useToast, useConfirm } from '../../ui/feedback-context'
import { CargaTarjetas } from '../../ui/Carga'
import Vacio from '../../ui/Vacio'
import { refrescarProPago } from './comun'
import { s } from '../pagos/estilos'

const PLACEHOLDERS = ['VERBO', 'CONCEPTO', 'ITEMS', 'PROVEEDOR', 'FOLIO', 'DOC']
const TIPOS_CUENTA = [['gasto', 'Gasto'], ['iva', 'IVA (H01)'], ['retencion_isr', 'Retención ISR'], ['retencion_iva', 'Retención IVA']]

const lista = (texto) => texto.split(',').map((p) => p.trim()).filter(Boolean)
const corto = (c) => c ? `${c.clave} · ${c.nombre_erp.replace(/^100 - [^-]+ - /, '')}` : '—'

function Pie({ onClose, onGuardar, guardando, invalido }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
      <button style={s.btnGhost} onClick={onClose}>Cancelar</button>
      <button style={{ ...s.btnPrimary, opacity: invalido || guardando ? 0.45 : 1 }} disabled={invalido || guardando} onClick={onGuardar}>
        {guardando ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}

// Alta o cambio de una fila del catálogo con un formulario simple.
function useGuardar(ruta, onListo) {
  const toast = useToast()
  const [guardando, setGuardando] = useState(false)
  const guardar = async (id, datos, mensaje) => {
    setGuardando(true)
    try {
      if (id) await api.patch(`${ruta}/${id}`, datos)
      else await api.post(ruta, datos)
      toast(mensaje)
      onListo()
    } catch (e) {
      toast('No se pudo guardar: ' + mensajeError(e), 'error')
    }
    setGuardando(false)
  }
  return [guardar, guardando]
}

// ── Cuentas ──────────────────────────────────────────

function ModalCuenta({ cuenta, onClose, onListo }) {
  const [d, setD] = useState({ clave: '', nombre_erp: '', grupo: '', tipo: 'gasto', cdv: false, verificada_erp: false, activa: true, ...cuenta })
  const [guardar, guardando] = useGuardar('/propago/cuentas', onListo)
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }))
  return (
    <Modal onClose={onClose} maxWidth={600}>
      <ModalHead titulo={cuenta?.id ? `Cuenta ${cuenta.clave}` : 'Nueva cuenta'} subtitulo="El nombre debe ser exactamente el del ERP" onClose={onClose} />
      <div style={{ padding: '14px 24px 22px', display: 'grid', gap: 12 }}>
        <div style={s.grid2}>
          <label><Label requerido>Clave</Label><input style={s.input} value={d.clave} placeholder="A09.1" onChange={(e) => set('clave', e.target.value)} /></label>
          <label><Label>Tipo</Label>
            <select style={s.input} value={d.tipo} onChange={(e) => set('tipo', e.target.value)}>
              {TIPOS_CUENTA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </div>
        <label><Label requerido>Nombre en el ERP</Label>
          <input style={s.input} value={d.nombre_erp} placeholder="100 - A09.1 - INSUMOS Y GASTOS EN PREPARACION DE PEDIDOS"
            onChange={(e) => set('nombre_erp', e.target.value)} />
        </label>
        {[['cdv', 'Sus renglones llevan [CDV] (C06 y serie B). El IVA nunca lo lleva.'],
          ['verificada_erp', 'Nombre confirmado contra el ERP'], ['activa', 'Activa (una cuenta usada no se borra: se desactiva)']].map(([k, texto]) => (
          <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
            <input type="checkbox" checked={!!d[k]} disabled={k === 'cdv' && d.tipo === 'iva'} onChange={(e) => set(k, e.target.checked)} /> {texto}
          </label>
        ))}
        {cuenta?.id && <p style={s.nota}>Los renglones ya exportados conservan el nombre con que salieron.</p>}
        <Pie onClose={onClose} guardando={guardando} invalido={!d.clave.trim() || !d.nombre_erp.trim()}
          onGuardar={() => guardar(cuenta?.id, { clave: d.clave, nombre_erp: d.nombre_erp, grupo: d.grupo || d.clave.slice(0, 1),
                                                 tipo: d.tipo, cdv: d.tipo === 'iva' ? false : d.cdv, verificada_erp: d.verificada_erp, activa: d.activa },
                                 'Cuenta guardada')} />
      </div>
    </Modal>
  )
}

function Cuentas({ cuentas, onCambio }) {
  const [editando, setEditando] = useState(null)
  return (
    <div>
      <button style={{ ...s.btnGhost, marginBottom: 12 }} onClick={() => setEditando({})}><Plus size={13} /> Nueva cuenta</button>
      <div style={s.seccion}>
        <div style={s.tablaWrap}>
          <table style={{ ...s.table, minWidth: 720 }}>
            <thead><tr>
              <th style={s.th}>Clave</th><th style={s.th}>Nombre en el ERP</th><th style={s.th}>Tipo</th>
              <th style={s.th}>[CDV]</th><th style={s.th}>Verificada</th><th style={s.th} />
            </tr></thead>
            <tbody>
              {cuentas.map((c) => (
                <tr key={c.id} style={c.activa ? undefined : { opacity: 0.5 }}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{c.clave}</td>
                  <td style={s.td}>{c.nombre_erp}{!c.activa && <div style={s.sub}>desactivada</div>}</td>
                  <td style={s.td}>{TIPOS_CUENTA.find(([k]) => k === c.tipo)?.[1]}</td>
                  <td style={s.td}>{c.cdv ? 'Sí' : '—'}</td>
                  <td style={s.td}>{c.verificada_erp ? 'Sí' : <span style={{ color: 'var(--pc-ambar-texto)' }}>No</span>}</td>
                  <td style={s.td}><button style={{ ...s.btnGhost, padding: '5px 8px' }} aria-label={`Editar ${c.clave}`} onClick={() => setEditando(c)}><Pencil size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editando && <ModalCuenta cuenta={editando} onClose={() => setEditando(null)} onListo={() => { setEditando(null); onCambio() }} />}
    </div>
  )
}

// ── Reglas ───────────────────────────────────────────

function ModalRegla({ regla, cuentas, plantillas, proveedores, cajas, onClose, onListo }) {
  const [d, setD] = useState({
    nombre: '', prioridad: 50, proveedor_id: '', caja_id: '', plaza: '', con_cfdi: null, cuenta_id: '', categoria_texto: '',
    plantilla_id: '', fuerza_nd: false, desglosa_iva: false, activa: true, ...regla,
    palabras: (regla?.palabras || []).join(', '), palabras_excluir: (regla?.palabras_excluir || []).join(', '),
  })
  const [guardar, guardando] = useGuardar('/propago/reglas', onListo)
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }))
  const sinCondicion = !lista(d.palabras).length && !d.proveedor_id && !d.caja_id && !d.plaza && d.con_cfdi === null
  return (
    <Modal onClose={onClose} maxWidth={720}>
      <ModalHead titulo={regla?.id ? regla.nombre : 'Nueva regla'} subtitulo="Aplica si se cumplen todas las condiciones que llenes" onClose={onClose} />
      <div style={{ padding: '14px 24px 22px', display: 'grid', gap: 12 }}>
        <div style={s.grid2}>
          <label><Label requerido>Nombre</Label><input style={s.input} value={d.nombre} placeholder="Telas en compras" onChange={(e) => set('nombre', e.target.value)} /></label>
          <label><Label>Prioridad (menor gana)</Label><input type="number" min="0" style={s.input} value={d.prioridad} onChange={(e) => set('prioridad', e.target.value)} /></label>
        </div>
        <div style={{ fontWeight: 650, fontSize: 13.5, marginTop: 4 }}>Cuándo aplica</div>
        <label><Label>Palabras (basta una; separadas por coma)</Label>
          <input style={s.input} value={d.palabras} placeholder="TELA, TERGAL, TAFETAN" onChange={(e) => set('palabras', e.target.value)} /></label>
        <label><Label>Excepto si dice</Label>
          <input style={s.input} value={d.palabras_excluir} placeholder="SERVILLETA" onChange={(e) => set('palabras_excluir', e.target.value)} /></label>
        <div style={s.grid2}>
          <label><Label>Proveedor</Label>
            <select style={s.input} value={d.proveedor_id || ''} onChange={(e) => set('proveedor_id', e.target.value)}>
              <option value="">Cualquiera</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select></label>
          <label><Label>Caja</Label>
            <select style={s.input} value={d.caja_id || ''} onChange={(e) => set('caja_id', e.target.value)}>
              <option value="">Cualquiera</option>
              {cajas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></label>
          <label><Label>Plaza</Label>
            <select style={s.input} value={d.plaza || ''} onChange={(e) => set('plaza', e.target.value)}>
              <option value="">Cualquiera</option><option value="MID">Mérida</option><option value="CUN">Cancún</option>
            </select></label>
          <label><Label>Factura</Label>
            <select style={s.input} value={d.con_cfdi === null ? '' : String(d.con_cfdi)} onChange={(e) => set('con_cfdi', e.target.value === '' ? null : e.target.value === 'true')}>
              <option value="">Da igual</option><option value="true">Con factura</option><option value="false">Sin factura</option>
            </select></label>
        </div>
        <div style={{ fontWeight: 650, fontSize: 13.5, marginTop: 4 }}>Qué hace</div>
        <div style={s.grid2}>
          <label><Label>Cuenta</Label>
            <select style={s.input} value={d.cuenta_id || ''} onChange={(e) => set('cuenta_id', e.target.value)}>
              <option value="">Ninguna (solo modifica)</option>
              {cuentas.filter((c) => c.activa && c.tipo === 'gasto').map((c) => <option key={c.id} value={c.id}>{corto(c)}</option>)}
            </select></label>
          <label><Label>Categoría en el texto</Label>
            <input style={s.input} value={d.categoria_texto || ''} placeholder="TELA, PINTURA, LAVADO, #LOG" onChange={(e) => set('categoria_texto', e.target.value)} /></label>
          <label><Label>Plantilla del texto</Label>
            <select style={s.input} value={d.plantilla_id || ''} onChange={(e) => set('plantilla_id', e.target.value)}>
              <option value="">La general</option>
              {plantillas.filter((p) => p.activa).map((p) => <option key={p.id} value={p.id}>{p.codigo}</option>)}
            </select></label>
        </div>
        {[['fuerza_nd', 'Siempre ND: importe completo sin IVA aunque haya factura'],
          ['desglosa_iva', 'Separar el IVA del total aunque no haya factura (AMEX: CFE, Telmex, combustible)'],
          ['activa', 'Activa']].map(([k, texto]) => (
          <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
            <input type="checkbox" checked={!!d[k]} onChange={(e) => set(k, e.target.checked)} /> {texto}
          </label>
        ))}
        {sinCondicion && <div style={s.aviso}>Sin condiciones la regla aplica a todo. Agrega al menos una palabra, proveedor, caja o plaza.</div>}
        <Pie onClose={onClose} guardando={guardando} invalido={!d.nombre.trim() || sinCondicion}
          onGuardar={() => guardar(regla?.id, {
            nombre: d.nombre, prioridad: Number(d.prioridad) || 0, palabras: lista(d.palabras), palabras_excluir: lista(d.palabras_excluir),
            proveedor_id: d.proveedor_id || null, caja_id: d.caja_id || null, plaza: d.plaza || null, con_cfdi: d.con_cfdi,
            cuenta_id: d.cuenta_id || null, categoria_texto: d.categoria_texto || null, plantilla_id: d.plantilla_id || null,
            fuerza_nd: d.fuerza_nd, desglosa_iva: d.desglosa_iva, activa: d.activa,
          }, 'Regla guardada')} />
      </div>
    </Modal>
  )
}

function Probar({ proveedores, cajas }) {
  const [d, setD] = useState({ concepto: '', proveedor_id: '', caja_id: '', con_cfdi: false, importe: '1000' })
  const [resultado, setResultado] = useState(null)
  const toast = useToast()
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }))
  async function probar() {
    try {
      const { data } = await api.post('/propago/reglas/probar', {
        concepto: d.concepto, proveedor_id: d.proveedor_id || null, caja_id: d.caja_id || null,
        con_cfdi: d.con_cfdi, importe: Number(d.importe) || 100,
      })
      setResultado(data)
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }
  return (
    <div style={{ ...s.seccion, padding: '13px 16px' }}>
      <div style={{ ...s.seccionTitulo, marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}><FlaskConical size={15} /> Probar un concepto</div>
      <div style={s.grid2}>
        <input style={s.input} placeholder="Concepto: hielo 5 kg evento Majestic" value={d.concepto} aria-label="Concepto"
          onChange={(e) => set('concepto', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && d.concepto.trim()) probar() }} />
        <select style={s.input} value={d.proveedor_id} aria-label="Proveedor" onChange={(e) => set('proveedor_id', e.target.value)}>
          <option value="">Sin proveedor (pago sin orden)</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select style={s.input} value={d.caja_id} aria-label="Caja" onChange={(e) => set('caja_id', e.target.value)}>
          <option value="">Sin caja</option>
          {cajas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="number" style={{ ...s.input, width: 110 }} value={d.importe} aria-label="Importe" onChange={(e) => set('importe', e.target.value)} />
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={d.con_cfdi} onChange={(e) => set('con_cfdi', e.target.checked)} /> Con factura
          </label>
          <button style={s.btnGhost} disabled={!d.concepto.trim()} onClick={probar}>Probar</button>
        </div>
      </div>
      {resultado && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          <div style={s.sub}>
            Aplican: {resultado.aplican.length ? resultado.aplican.map((r) => `${r.nombre} (${r.prioridad})`).join(', ') : 'ninguna regla'}
          </div>
          {resultado.renglones.map((r, i) => (
            <div key={i} style={{ fontFamily: 'var(--pc-mono)', fontSize: 12, marginTop: 6 }}>
              {money(r.cargo)} · {r.cuenta_nombre_erp || <span style={{ color: 'var(--pc-ambar-texto)' }}>sin cuenta</span>}
              <div>{r.ref}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Reglas({ reglas, cuentas, plantillas, proveedores, cajas, onCambio }) {
  const [editando, setEditando] = useState(null)
  const toast = useToast()
  const confirmar = useConfirm()
  const porId = Object.fromEntries(cuentas.map((c) => [c.id, c]))
  const plantilla = Object.fromEntries(plantillas.map((p) => [p.id, p.codigo]))

  async function borrar(r) {
    if (!await confirmar({ titulo: `Borrar la regla «${r.nombre}»`, mensaje: 'Los renglones ya armados no cambian.', textoBoton: 'Borrar', peligro: true })) return
    try {
      await api.delete(`/propago/reglas/${r.id}`)
      toast('Regla borrada')
      onCambio()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  const condicion = (r) => [
    r.palabras?.length && `dice ${r.palabras.join(' / ')}`,
    r.palabras_excluir?.length && `no dice ${r.palabras_excluir.join(' / ')}`,
    r.proveedor?.nombre && `proveedor ${r.proveedor.nombre}`,
    r.caja?.nombre && `caja ${r.caja.nombre}`,
    r.plaza && `plaza ${r.plaza}`,
    r.con_cfdi === true && 'con factura', r.con_cfdi === false && 'sin factura',
  ].filter(Boolean).join(' · ')
  const efecto = (r) => [
    r.cuenta_id && corto(porId[r.cuenta_id]), r.categoria_texto, r.plantilla_id && `plantilla ${plantilla[r.plantilla_id]}`,
    r.fuerza_nd && 'siempre ND', r.desglosa_iva && 'separa IVA',
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Probar proveedores={proveedores} cajas={cajas} />
      <div><button style={s.btnGhost} onClick={() => setEditando({})}><Plus size={13} /> Nueva regla</button></div>
      <div style={s.seccion}>
        <div style={s.tablaWrap}>
          <table style={{ ...s.table, minWidth: 760 }}>
            <thead><tr>
              <th style={{ ...s.th, width: 60 }}>Prior.</th><th style={s.th}>Regla</th><th style={s.th}>Cuándo</th><th style={s.th}>Qué hace</th><th style={{ ...s.th, width: 80 }} />
            </tr></thead>
            <tbody>
              {reglas.map((r) => (
                <tr key={r.id} style={r.activa ? undefined : { opacity: 0.5 }}>
                  <td style={s.td}>{r.prioridad}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{r.nombre}{!r.activa && <div style={s.sub}>desactivada</div>}</td>
                  <td style={{ ...s.td, fontSize: 12.5 }}>{condicion(r) || '—'}</td>
                  <td style={{ ...s.td, fontSize: 12.5 }}>{efecto(r) || '—'}</td>
                  <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                    <button style={{ ...s.btnGhost, padding: '5px 8px', marginRight: 4 }} aria-label={`Editar ${r.nombre}`} onClick={() => setEditando(r)}><Pencil size={12} /></button>
                    <button style={s.btnBorrar} aria-label={`Borrar ${r.nombre}`} onClick={() => borrar(r)}><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editando && (
        <ModalRegla regla={editando.id ? editando : null} cuentas={cuentas} plantillas={plantillas} proveedores={proveedores} cajas={cajas}
          onClose={() => setEditando(null)} onListo={() => { setEditando(null); onCambio() }} />
      )}
    </div>
  )
}

// ── Plantillas ───────────────────────────────────────

function ModalPlantilla({ plantilla, onClose, onListo }) {
  const [d, setD] = useState({ codigo: '', plantilla: '', descripcion: '', activa: true, ...plantilla })
  const [guardar, guardando] = useGuardar('/propago/plantillas', onListo)
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }))
  const desconocidos = [...d.plantilla.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]).filter((p) => !PLACEHOLDERS.includes(p))
  return (
    <Modal onClose={onClose} maxWidth={640}>
      <ModalHead titulo={plantilla?.id ? plantilla.codigo : 'Nueva plantilla'} subtitulo="El cuerpo del texto, entre la categoría y el contrato" onClose={onClose} />
      <div style={{ padding: '14px 24px 22px', display: 'grid', gap: 12 }}>
        <label><Label requerido>Código</Label><input style={s.input} value={d.codigo} placeholder="LAVANDERIA" onChange={(e) => set('codigo', e.target.value)} /></label>
        <label><Label requerido>Plantilla</Label>
          <input style={{ ...s.input, fontFamily: 'var(--pc-mono)', fontSize: 13 }} value={d.plantilla}
            placeholder="PAGO DE LAVANDERIA DE {ITEMS} A {PROVEEDOR}" onChange={(e) => set('plantilla', e.target.value)} /></label>
        <p style={s.nota}>
          Datos: {PLACEHOLDERS.map((p) => `{${p}}`).join(' ')}. ITEMS lleva la cantidad («19 ASIENTO MARFIL»); DOC es la serie y folio
          de la factura. Lo que va entre corchetes se omite si falta el dato: «[ A {'{PROVEEDOR}'}]».
        </p>
        {desconocidos.length > 0 && <div style={s.aviso}>No existe {desconocidos.map((p) => `{${p}}`).join(', ')}.</div>}
        <label><Label>Descripción</Label><input style={s.input} value={d.descripcion || ''} onChange={(e) => set('descripcion', e.target.value)} /></label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
          <input type="checkbox" checked={!!d.activa} onChange={(e) => set('activa', e.target.checked)} /> Activa
        </label>
        <Pie onClose={onClose} guardando={guardando} invalido={!d.codigo.trim() || !d.plantilla.trim() || desconocidos.length > 0}
          onGuardar={() => guardar(plantilla?.id, { codigo: d.codigo, plantilla: d.plantilla, descripcion: d.descripcion || null, activa: d.activa }, 'Plantilla guardada')} />
      </div>
    </Modal>
  )
}

function Plantillas({ plantillas, onCambio }) {
  const [editando, setEditando] = useState(null)
  return (
    <div>
      <button style={{ ...s.btnGhost, marginBottom: 12 }} onClick={() => setEditando({})}><Plus size={13} /> Nueva plantilla</button>
      <div style={s.seccion}>
        <div style={s.tablaWrap}>
          <table style={{ ...s.table, minWidth: 640 }}>
            <thead><tr><th style={s.th}>Código</th><th style={s.th}>Plantilla</th><th style={s.th}>Para qué</th><th style={s.th} /></tr></thead>
            <tbody>
              {plantillas.map((p) => (
                <tr key={p.id} style={p.activa ? undefined : { opacity: 0.5 }}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{p.codigo}</td>
                  <td style={{ ...s.td, fontFamily: 'var(--pc-mono)', fontSize: 12 }}>{p.plantilla}</td>
                  <td style={{ ...s.td, fontSize: 12.5 }}>{p.descripcion || '—'}</td>
                  <td style={s.td}><button style={{ ...s.btnGhost, padding: '5px 8px' }} aria-label={`Editar ${p.codigo}`} onClick={() => setEditando(p)}><Pencil size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editando && <ModalPlantilla plantilla={editando.id ? editando : null} onClose={() => setEditando(null)} onListo={() => { setEditando(null); onCambio() }} />}
    </div>
  )
}

// ── Parámetros ───────────────────────────────────────

function Parametros({ parametros, cuentas, onCambio }) {
  const [valores, setValores] = useState(() => Object.fromEntries(parametros.map((p) => [p.clave, p.valor || ''])))
  const toast = useToast()
  async function guardar(clave) {
    try {
      await api.put(`/propago/parametros/${clave}`, { valor: valores[clave] })
      toast('Parámetro guardado')
      onCambio()
    } catch (e) {
      toast('No se pudo guardar: ' + mensajeError(e), 'error')
    }
  }
  return (
    <div style={{ ...s.seccion, padding: '6px 16px' }}>
      {parametros.map((p) => (
        <div key={p.clave} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '10px 0', borderBottom: '1px solid var(--pc-linea)' }}>
          <div style={{ flex: 1, minWidth: 240, fontSize: 13.5 }}>{p.descripcion}</div>
          {p.clave.startsWith('cuenta_') ? (
            <select style={{ ...s.input, width: 300 }} value={valores[p.clave]} aria-label={p.descripcion}
              onChange={(e) => setValores((v) => ({ ...v, [p.clave]: e.target.value }))}>
              <option value="">Sumar al renglón principal</option>
              {cuentas.filter((c) => c.activa && c.tipo === 'gasto').map((c) => <option key={c.id} value={c.id}>{corto(c)}</option>)}
            </select>
          ) : (
            <input style={{ ...s.input, width: 140 }} value={valores[p.clave]} aria-label={p.descripcion}
              onChange={(e) => setValores((v) => ({ ...v, [p.clave]: e.target.value }))} />
          )}
          <button style={s.btnGhost} disabled={(valores[p.clave] || '') === (p.valor || '')} onClick={() => guardar(p.clave)}>Guardar</button>
        </div>
      ))}
    </div>
  )
}

// ── Catálogo ─────────────────────────────────────────

function ModalReaplicar({ onClose, onHecho }) {
  const [datos, setDatos] = useState(null)
  const [aplicando, setAplicando] = useState(false)
  const toast = useToast()
  useEffect(() => {
    api.post('/propago/reaplicar', { confirmar: false }).then(({ data }) => setDatos(data))
      .catch((e) => { toast('Error: ' + mensajeError(e), 'error'); onClose() })
    // Solo al abrir: onClose cambia en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  async function aplicar() {
    setAplicando(true)
    try {
      await api.post('/propago/reaplicar', { confirmar: true })
      toast(`${datos.cambios.length} pago(s) armados de nuevo`)
      onHecho()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
      setAplicando(false)
    }
  }
  return (
    <Modal onClose={onClose} maxWidth={860}>
      <ModalHead titulo="Volver a aplicar las reglas" subtitulo="Solo pagos por exportar y sin cambios a mano" onClose={onClose} />
      <div style={{ padding: '14px 24px 22px' }}>
        {!datos && <CargaTarjetas n={2} alto={60} minimo={200} />}
        {datos && !datos.cambios.length && <p style={s.nota}>Las reglas actuales dan lo mismo que ya está armado. No hay nada que cambiar.</p>}
        {datos?.cambios.map((c) => (
          <div key={c.movimiento_id} style={{ ...s.seccion, padding: '10px 14px', fontFamily: 'var(--pc-mono)', fontSize: 11.5 }}>
            <div style={{ ...s.sub, fontFamily: 'inherit' }}>Pago del {c.fecha_pago}</div>
            <div style={s.grid2}>
              <div><b>Antes</b>{c.antes.map((r, i) => <div key={i}>{money(r.cargo)} · {r.cuenta_nombre_erp || 'sin cuenta'}<br />{r.ref}</div>)}</div>
              <div><b>Después</b>{c.despues.map((r, i) => <div key={i}>{money(r.cargo)} · {r.cuenta_nombre_erp || 'sin cuenta'}<br />{r.ref}</div>)}</div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          <button style={s.btnGhost} onClick={onClose}>Cerrar</button>
          {datos?.cambios.length > 0 && (
            <button style={{ ...s.btnPrimary, opacity: aplicando ? 0.5 : 1 }} disabled={aplicando} onClick={aplicar}>
              {aplicando ? 'Aplicando...' : `Aplicar a ${datos.cambios.length} pago(s)`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function Catalogo({ estado, onCambio }) {
  const [vista, setVista] = useState('reglas')
  const [datos, setDatos] = useState(null)
  const [proveedores, setProveedores] = useState([])
  const [cajas, setCajas] = useState([])
  const [cargandoInicial, setCargandoInicial] = useState(false)
  const [reaplicar, setReaplicar] = useState(false)
  const toast = useToast()

  const cargar = useCallback(async () => {
    try {
      const [cuentas, reglas, plantillas, parametros] = await Promise.all(
        ['cuentas', 'reglas', 'plantillas', 'parametros'].map((r) => api.get(`/propago/${r}`).then((x) => x.data)))
      setDatos({ cuentas, reglas, plantillas, parametros })
    } catch (e) {
      toast('No se pudo cargar el catálogo: ' + mensajeError(e), 'error')
    }
  }, [toast])

  useEffect(() => {
    const t = setTimeout(cargar, 0)
    api.get('/proveedores').then(({ data }) => setProveedores(data)).catch(() => {})
    api.get('/propago/cajas', { params: { todas: true } }).then(({ data }) => setCajas(data)).catch(() => {})
    return () => clearTimeout(t)
  }, [cargar])

  async function cargarInicial() {
    setCargandoInicial(true)
    try {
      const { data } = await api.post('/propago/catalogo/inicial')
      toast(`Catálogo cargado: ${data.cuentas} cuentas, ${data.plantillas} plantillas, ${data.reglas} reglas`)
      await cargar()
      refrescarProPago()
      onCambio?.()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
    setCargandoInicial(false)
  }

  const alCambiar = () => { cargar(); onCambio?.() }
  if (!datos) return <CargaTarjetas n={3} alto={70} minimo={250} />
  const vacio = !datos.cuentas.length

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={s.vistas} role="tablist" aria-label="Catálogo">
          {[['reglas', `Reglas (${datos.reglas.length})`], ['cuentas', `Cuentas (${datos.cuentas.length})`],
            ['plantillas', 'Plantillas'], ['parametros', 'Parámetros']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={vista === k} style={vista === k ? s.vistaActiva : s.vista} onClick={() => setVista(k)}>{label}</button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {!vacio && estado.por_exportar > 0 && (
          <button style={s.btnGhost} onClick={() => setReaplicar(true)}>Volver a aplicar reglas a lo pendiente</button>
        )}
        <button style={s.btnGhost} disabled={cargandoInicial} onClick={cargarInicial}
          title="Agrega las cuentas, plantillas y reglas de la especificación que falten; no toca lo ya editado">
          <BookOpen size={13} /> {cargandoInicial ? 'Cargando...' : vacio ? 'Cargar catálogo inicial' : 'Completar con el catálogo inicial'}
        </button>
      </div>

      {vacio ? (
        <Vacio icono={BookOpen} titulo="El catálogo está vacío">
          Carga el catálogo inicial (cuentas del ERP, plantillas de texto y reglas de la especificación) y ajústalo aquí.
        </Vacio>
      ) : (<>
        {vista === 'cuentas' && <Cuentas cuentas={datos.cuentas} onCambio={alCambiar} />}
        {vista === 'reglas' && <Reglas reglas={datos.reglas} cuentas={datos.cuentas} plantillas={datos.plantillas}
          proveedores={proveedores} cajas={cajas} onCambio={alCambiar} />}
        {vista === 'plantillas' && <Plantillas plantillas={datos.plantillas} onCambio={alCambiar} />}
        {vista === 'parametros' && <Parametros key={JSON.stringify(datos.parametros)} parametros={datos.parametros} cuentas={datos.cuentas} onCambio={alCambiar} />}
      </>)}
      {reaplicar && <ModalReaplicar onClose={() => setReaplicar(false)} onHecho={() => { setReaplicar(false); onCambio?.() }} />}
    </div>
  )
}
