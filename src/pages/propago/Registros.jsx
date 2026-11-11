import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import api from '../../api'
import { money, fechaCorta, mensajeError, hoy } from '../../constants'
import { useToast, useConfirm } from '../../ui/feedback-context'
import { CargaTarjetas } from '../../ui/Carga'
import Vacio from '../../ui/Vacio'
import { descargar, refrescarProPago } from './comun'
import ModalRegistro from './ModalRegistro'
import { s } from '../pagos/estilos'

function Estado({ pago }) {
  const [texto, color, bg] =
    pago.exportado ? ['Exportado', 'var(--pc-gris-2)', 'var(--pc-superficie-3)']
    : !pago.cuadra ? ['No cuadra', 'var(--pc-rojo)', 'var(--pc-rojo-bg)']
    : pago.listo ? ['Listo', 'var(--pc-verde)', 'var(--pc-verde-bg)']
    : ['Falta cuenta', 'var(--pc-ambar-texto)', 'var(--pc-ambar-bg)']
  return <span style={{ ...s.chip, color, background: bg }}>{texto}</span>
}

// Renglones para el ERP agrupados por pago. Se elige el pago completo (sus
// subtotales y su IVA viajan juntos) y se descarga el Excel de importación.
export default function Registros({ estado, usuario, onCambio }) {
  const [vista, setVista] = useState('por_exportar')
  const [cajaId, setCajaId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [datos, setDatos] = useState(null)
  const [cuentas, setCuentas] = useState([])
  const [sel, setSel] = useState({})
  const [editando, setEditando] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const toast = useToast()
  const confirmar = useConfirm()

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/propago/registros', { params: { estado: vista, ...(cajaId ? { caja_id: cajaId } : {}) } })
      setDatos(data)
      const vigentes = new Set(data.pagos.filter((p) => p.listo && !p.exportado).map((p) => p.id))
      setSel((x) => Object.fromEntries(Object.entries(x).filter(([id, v]) => v && vigentes.has(id))))
    } catch (e) {
      toast('No se pudieron cargar los registros: ' + mensajeError(e), 'error')
      setDatos({ pagos: [] })
    }
  }, [vista, cajaId, toast])

  useEffect(() => {
    const t = setTimeout(cargar, 0)
    return () => clearTimeout(t)
  }, [cargar])

  useEffect(() => {
    api.get('/propago/cuentas').then(({ data }) => setCuentas(data)).catch(() => setCuentas([]))
  }, [])

  const t = busqueda.trim().toLowerCase()
  const pagos = useMemo(() => (datos?.pagos || []).filter((p) => !t
    || p.registros.some((r) => r.ref.toLowerCase().includes(t) || String(r.id_evento).includes(t))
    || p.ordenes.some((o) => String(o.folio).includes(t) || (o.proveedor || '').toLowerCase().includes(t))
    || (p.justificacion || '').toLowerCase().includes(t)), [datos, t])

  const elegidos = pagos.filter((p) => sel[p.id])
  const renglones = elegidos.reduce((n, p) => n + p.registros.length, 0)
  const total = elegidos.reduce((x, p) => x + p.registros.reduce((y, r) => y + Number(r.cargo), 0), 0)
  const exportables = pagos.filter((p) => p.listo && !p.exportado)
  const todos = exportables.length > 0 && exportables.every((p) => sel[p.id])

  const recargar = async () => { await cargar(); refrescarProPago(); onCambio?.() }

  async function exportar() {
    if (!elegidos.length || ocupado) return
    setOcupado(true)
    try {
      await descargar(api.post('/propago/exportar', { movimientos: elegidos.map((p) => p.id) }, { responseType: 'blob' }),
        `registros_erp_${hoy()}.xlsx`)
      toast(`${renglones} renglón(es) exportados por ${money(total)}. Súbelos al ERP y márcalo en Lotes.`)
      setSel({})
      await recargar()
    } catch (e) {
      toast('No se pudo exportar: ' + mensajeError(e), 'error')
    }
    setOcupado(false)
  }

  async function regenerar(p) {
    const editado = p.registros.some((r) => r.editado_manual)
    if (editado && !await confirmar({
      titulo: 'Reemplazar los cambios a mano',
      mensaje: 'Este pago tiene renglones editados a mano. Volver a armarlo con las reglas actuales los reemplaza.',
      textoBoton: 'Reemplazar', peligro: true,
    })) return
    try {
      await api.post(`/propago/movimientos/${p.id}/regenerar`, null, { params: { forzar: editado } })
      toast('Renglones armados de nuevo con las reglas actuales')
      await recargar()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  async function borrar(p) {
    const ok = await confirmar({
      titulo: 'Borrar este pago',
      mensaje: p.exportado
        ? 'Ya se exportó: se borra de ProCompra y queda un ajuste pendiente para quitarlo del ERP.'
        : `Se borra el pago de ${money(p.monto)} y sus renglones. ${p.ordenes.length ? 'Las órdenes recuperan su saldo.' : ''}`,
      textoBoton: 'Borrar', peligro: true,
    })
    if (!ok) return
    try {
      await api.delete(`/pagos/${p.id}`)
      toast('Pago borrado')
      await recargar()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  async function cambiarCuenta(r, cuentaId) {
    try {
      await api.patch(`/propago/registros/${r.id}`, { cuenta_id: cuentaId })
      await cargar()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  const activas = cuentas.filter((c) => c.activa)

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={s.vistas} role="tablist" aria-label="Estado">
          {[['por_exportar', 'Por exportar'], ['exportado', 'Exportados']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={vista === k} style={vista === k ? s.vistaActiva : s.vista}
              onClick={() => { setVista(k); setDatos(null) }}>{label}</button>
          ))}
        </div>
        <select style={{ ...s.input, width: 'auto', minWidth: 200 }} value={cajaId} aria-label="Caja"
          onChange={(e) => { setCajaId(e.target.value); setDatos(null) }}>
          <option value="">Todas mis cajas</option>
          {(estado.cajas || []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input style={{ ...s.buscador, marginBottom: 0, flex: 1, minWidth: 220 }} placeholder="Buscar en el texto, contrato, folio o proveedor..."
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        {vista === 'por_exportar' && exportables.length > 0 && (
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', color: 'var(--pc-gris-2)' }}>
            <input type="checkbox" checked={todos}
              onChange={() => setSel(todos ? {} : Object.fromEntries(exportables.map((p) => [p.id, true])))} />
            Elegir todos los listos
          </label>
        )}
      </div>

      {datos === null && <CargaTarjetas n={3} alto={120} minimo={300} />}
      {datos && pagos.length === 0 && (
        <Vacio icono={Download} titulo={vista === 'exportado' ? 'Nada exportado todavía' : 'Nada por exportar'}>
          {vista === 'exportado' ? 'Los pagos que descargues aparecerán aquí.'
            : 'Cada pago registrado desde una caja genera aquí sus renglones para el ERP.'}
        </Vacio>
      )}

      {pagos.map((p) => (
        <div key={p.id} style={{ ...s.seccion, ...(sel[p.id] ? { borderColor: 'var(--pc-acento)' } : {}) }}>
          <div style={s.seccionHead}>
            {!p.exportado && (
              <input type="checkbox" checked={!!sel[p.id]} disabled={!p.listo} aria-label={`Exportar el pago del ${p.fecha_pago}`}
                title={p.listo ? 'Incluir en el archivo' : 'Corrige los renglones antes de exportar'}
                onChange={() => setSel((x) => ({ ...x, [p.id]: !x[p.id] }))} />
            )}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={s.seccionTitulo}>
                {fechaCorta(p.fecha_pago)} · {p.caja} · {money(p.monto)}
                {p.poliza ? <span style={{ ...s.sub, marginLeft: 8 }}>póliza {p.poliza}</span> : null}
              </div>
              <div style={s.seccionSub}>
                {p.tipo === 'sin_orden'
                  ? <>Sin orden · {p.justificacion}</>
                  : p.ordenes.map((o) => `#${o.folio} ${o.proveedor || ''}`).join(' · ')}
                {p.referencia ? ` · ${p.referencia}` : ''}
                {Number(p.comision) > 0 && ` · comisión ${money(p.comision)}`}
                {Number(p.diferencia) > 0 && ` · diferencia ${money(p.diferencia)}`}
              </div>
            </div>
            <Estado pago={p} />
            {!p.exportado && (
              <button style={{ ...s.btnGhost, padding: '6px 10px' }} onClick={() => regenerar(p)} title="Armar de nuevo con las reglas actuales">
                <RefreshCw size={13} />
              </button>
            )}
            {usuario.rol === 'admin' && (
              <button style={s.btnBorrar} onClick={() => borrar(p)} title="Borrar el pago (solo admin)" aria-label="Borrar el pago">
                <Trash2 size={13} />
              </button>
            )}
          </div>
          <div style={s.tablaWrap}>
            <table style={{ ...s.table, minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={{ ...s.th, width: 110, textAlign: 'right' }}>Cargo</th>
                  <th style={{ ...s.th, width: 270 }}>Cuenta</th>
                  <th style={s.th}>Ref</th>
                  <th style={{ ...s.th, width: 90 }}>ID evento</th>
                  <th style={{ ...s.th, width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {p.registros.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {money(Number(r.cargo))}
                      {r.es_iva && <div style={s.sub}>IVA</div>}
                    </td>
                    <td style={s.td}>
                      {r.estado === 'exportado' ? (
                        <span style={{ fontSize: 12 }}>{r.cuenta_nombre_erp}</span>
                      ) : (
                        <select style={{ ...s.input, padding: '5px 7px', fontSize: 12,
                                         ...(r.cuenta_id ? {} : { borderColor: 'var(--pc-ambar-borde)' }) }}
                          value={r.cuenta_id || ''} aria-label="Cuenta" onChange={(e) => cambiarCuenta(r, e.target.value)}>
                          <option value="" disabled>Elige la cuenta</option>
                          {activas.map((c) => <option key={c.id} value={c.id}>{c.clave} · {c.nombre_erp.replace(/^100 - [^-]+ - /, '')}</option>)}
                        </select>
                      )}
                    </td>
                    <td style={{ ...s.td, fontFamily: 'var(--pc-mono)', fontSize: 11.5, overflowWrap: 'anywhere' }}>
                      {r.ref}
                      {r.editado_manual && <span style={{ ...s.sub, marginLeft: 6, fontFamily: 'inherit' }}>· editado</span>}
                      {r.avisos?.map((a) => (
                        <div key={a} style={{ ...s.sub, color: 'var(--pc-ambar-texto)', fontFamily: 'var(--pc-fuente, inherit)' }}>{a}</div>
                      ))}
                    </td>
                    <td style={s.td}>{r.id_evento || 0}</td>
                    <td style={s.td}>
                      <button style={{ ...s.btnGhost, padding: '5px 8px' }} onClick={() => setEditando(r)} aria-label="Editar el renglón">
                        <Pencil size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {elegidos.length > 0 && (
        <div style={s.barra}>
          <span style={{ flex: 1, minWidth: 200, fontSize: 13.5 }}>
            <b>{elegidos.length}</b> pago{elegidos.length === 1 ? '' : 's'} · {renglones} renglón{renglones === 1 ? '' : 'es'} · <b>{money(total)}</b>
          </span>
          <button style={s.btnGhost} onClick={() => setSel({})}>Quitar selección</button>
          <button style={{ ...s.btnPrimary, display: 'inline-flex', gap: 7, alignItems: 'center', opacity: ocupado ? 0.5 : 1 }}
            disabled={ocupado} onClick={exportar}>
            <Download size={15} /> {ocupado ? 'Generando...' : 'Descargar Excel'}
          </button>
        </div>
      )}

      {editando && (
        <ModalRegistro registro={editando} cuentas={activas} onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); recargar() }} />
      )}
    </div>
  )
}
