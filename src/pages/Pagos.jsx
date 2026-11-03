import { useState, useEffect, useCallback } from 'react'
import api from '../api'
import { money, fechaCorta, mensajeError, etiquetaMetodo } from '../constants'
import { useToast } from '../ui/feedback-context'
import { CargaTarjetas } from '../ui/Carga'
import ModalOrden from './orden/ModalOrden'
import { descargarPdfOrden } from './orden/archivos'
import ModalPago from './pagos/ModalPago'
import Historial from './pagos/Historial'
import Calendario from './orden/Calendario'
import { s, SITUACION, cuandoVence } from './pagos/estilos'

function Chip({ situacion }) {
  const e = SITUACION[situacion] || SITUACION.sin_fecha
  return <span style={{ ...s.chip, color: e.color, background: e.bg }}>{e.label}</span>
}

// Una tabla de órdenes por pagar (esta semana o después) con su selección.
function Seccion({ titulo, ayuda, grupo, filas, sel, alternar, alternarTodas, onAbrirOrden, onProgramar, vacio }) {
  const marcadas = filas.filter((r) => sel[r.id]).length
  const todas = filas.length > 0 && marcadas === filas.length
  return (
    <div style={s.seccion}>
      <div style={s.seccionHead}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={s.seccionTitulo}>{titulo} · {money(grupo.total)}</div>
          <div style={s.seccionSub}>
            {ayuda}{grupo.vencido > 0 && <> · <b style={{ color: 'var(--pc-rojo)' }}>{money(grupo.vencido)} vencido</b></>}
          </div>
        </div>
      </div>
      <div style={s.tablaWrap}>
        <table style={{ ...s.table, tableLayout: 'fixed' }}>
          {/* Mismos anchos en las dos secciones para que las columnas se lean alineadas. */}
          <colgroup>
            {[42, 92, null, 116, 120, 118, 108, 100, 108, 112].map((w, i) => <col key={i} style={w ? { width: w } : undefined} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={s.th}>
                <input type="checkbox" checked={todas} disabled={!filas.length} aria-label={`Seleccionar todas: ${titulo}`}
                  onChange={() => alternarTodas(filas, !todas)} />
              </th>
              <th style={s.th}>Orden</th>
              <th style={s.th}>Proveedor</th>
              <th style={s.th}>Tipo</th>
              <th style={s.th}>Factura</th>
              <th style={s.th}>Vence</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Importe</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Abonado</th>
              <th style={{ ...s.th, textAlign: 'right' }}>A pagar</th>
              <th style={s.th}>Situación</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={10} style={s.vacio}>{vacio}</td></tr>}
            {filas.map((r) => (
              <tr key={r.id} style={sel[r.id] ? { background: 'var(--pc-acento-bg)' } : undefined}>
                <td style={s.td}>
                  <input type="checkbox" checked={!!sel[r.id]} onChange={() => alternar(r.id)}
                    aria-label={`Pagar la orden ${r.folio}`} />
                </td>
                <td style={s.td}>
                  <button style={s.folio} onClick={() => onAbrirOrden(r.id)}>#{r.folio}</button>
                  <div style={s.sub}>{fechaCorta(r.fecha)}</div>
                </td>
                <td style={s.td}>{r.proveedor?.nombre || '—'}</td>
                <td style={s.td}>
                  <span style={s.tipo}>{r.tipo === 'credito' ? 'Crédito' : etiquetaMetodo(r.tipo_pago)}</span>
                </td>
                <td style={{ ...s.td, fontFamily: 'var(--pc-mono)', fontSize: 12 }}>{r.factura || '—'}</td>
                <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                  {r.vencimiento ? fechaCorta(r.vencimiento) : '—'}
                  {cuandoVence(r) && <div style={s.sub}>{cuandoVence(r)}</div>}
                  {r.cuotas?.length > 1 && <div style={s.sub}>{r.cuotas.filter((c) => c.estado === 'pagada').length} de {r.cuotas.length} pagos</div>}
                  {r.tipo === 'credito' && (
                    <button style={{ ...s.enlace, display: 'block' }} onClick={() => onProgramar(r)}>
                      {r.cuotas?.length ? 'Cambiar fechas' : 'Poner fecha'}
                    </button>
                  )}
                </td>
                <td style={{ ...s.td, textAlign: 'right' }}>
                  {money(r.importe)}
                  {r.recargo > 0 && <div style={s.sub}>incl. {money(r.recargo)} recargo</div>}
                </td>
                <td style={{ ...s.td, textAlign: 'right' }}>{r.pagado > 0 ? money(r.pagado) : '—'}</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>
                  {money(r.a_pagar)}
                  {r.a_pagar < r.saldo - 0.005 && <div style={{ ...s.sub, fontWeight: 400 }}>saldo {money(r.saldo)}</div>}
                </td>
                <td style={s.td}><Chip situacion={r.situacion} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Pagos({ usuario, onCambio }) {
  const [vista, setVista] = useState('pendientes')
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [sel, setSel] = useState({})
  const [pagando, setPagando] = useState(null)
  const [programar, setProgramar] = useState(null)
  const [ordenAbierta, setOrdenAbierta] = useState(null)
  const [version, setVersion] = useState(0)
  const toast = useToast()

  const cargar = useCallback(async () => {
    try {
      const res = await api.get('/pagos/pendientes')
      setDatos(res.data)
      setError('')
      // Lo que ya no está por pagar sale de la selección.
      const vigentes = new Set([...res.data.semana.ordenes, ...res.data.despues.ordenes, ...res.data.sin_fecha.ordenes]
        .map((r) => r.id))
      setSel((x) => Object.fromEntries(Object.entries(x).filter(([id, v]) => v && vigentes.has(id))))
    } catch (e) {
      setError('No se pudieron cargar los pagos pendientes: ' + mensajeError(e))
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(cargar, 300)
    return () => clearTimeout(timer)
  }, [cargar])

  const refrescar = async () => {
    await cargar()
    setVersion((v) => v + 1)
    if (onCambio) onCambio()
  }

  async function abrirOrden(id) {
    try {
      const res = await api.get(`/ordenes/${id}`)
      setOrdenAbierta(res.data)
    } catch (e) {
      toast('Error al abrir orden: ' + mensajeError(e), 'error')
    }
  }

  async function refrescarOrden(id) {
    const res = await api.get(`/ordenes/${id}`)
    setOrdenAbierta(res.data)
    refrescar()
  }

  async function descargarPdf(orden) {
    try {
      await descargarPdfOrden(orden)
    } catch (e) {
      toast('No se pudo generar el PDF: ' + mensajeError(e), 'error')
    }
  }

  const alternar = (id) => setSel((x) => ({ ...x, [id]: !x[id] }))
  const alternarTodas = (filas, valor) =>
    setSel((x) => ({ ...x, ...Object.fromEntries(filas.map((r) => [r.id, valor])) }))

  const pestanas = (
    <div style={s.vistas} role="tablist" aria-label="Vista">
      {[['pendientes', 'Por pagar'], ['historial', 'Pagos registrados']].map(([k, label]) => (
        <button key={k} role="tab" aria-selected={vista === k}
          style={vista === k ? s.vistaActiva : s.vista} onClick={() => setVista(k)}>
          {label}
        </button>
      ))}
    </div>
  )

  const modalOrden = ordenAbierta && (
    <ModalOrden
      key={ordenAbierta.id}
      orden={ordenAbierta}
      usuario={usuario}
      onClose={() => setOrdenAbierta(null)}
      onCambio={() => refrescarOrden(ordenAbierta.id)}
      onDescargarPdf={descargarPdf}
      onAbrirOrden={abrirOrden}
      onBorrada={() => { setOrdenAbierta(null); refrescar() }}
    />
  )

  const encabezado = (
    <div style={s.header}>
      <div>
        <h2 style={s.h2}>Pagos</h2>
        <p style={s.help}>
          Marca las órdenes que cubre un pago y regístralo una sola vez: puede ser una orden o varias.
          Arriba va lo que toca pagar esta semana, según las fechas de pago de cada compra.
        </p>
      </div>
      {pestanas}
    </div>
  )

  if (vista === 'historial') {
    return (
      <div>
        {encabezado}
        <Historial usuario={usuario} onAbrirOrden={abrirOrden} version={version} onCambio={refrescar} />
        {modalOrden}
      </div>
    )
  }

  if (error) return <div>{encabezado}<div style={s.error}>{error}</div></div>
  if (!datos) return <div>{encabezado}<CargaTarjetas n={2} alto={110} minimo={260} /></div>

  const t = busqueda.trim().toLowerCase()
  const filtrar = (filas) => t
    ? filas.filter((r) => String(r.folio).includes(t) || (r.proveedor?.nombre || '').toLowerCase().includes(t)
        || (r.factura || '').toLowerCase().includes(t))
    : filas
  const todas = [...datos.semana.ordenes, ...datos.despues.ordenes, ...datos.sin_fecha.ordenes]
  const elegidas = todas.filter((r) => sel[r.id])
  const totalElegido = elegidas.reduce((x, r) => x + r.a_pagar, 0)
  const proveedoresElegidos = new Set(elegidas.map((r) => r.proveedor?.id)).size
  const contado = datos.semana.ordenes.filter((r) => r.tipo === 'contado').length

  const kpis = [
    { titulo: 'Esta semana', valor: money(datos.semana.total),
      pie: `${datos.semana.ordenes.length} orden(es) hasta el ${fechaCorta(datos.fin_semana)}` },
    { titulo: 'Vencido', valor: money(datos.semana.vencido), color: datos.semana.vencido > 0 ? 'var(--pc-rojo)' : null,
      pie: 'Pagos programados cuya fecha ya pasó' },
    { titulo: 'Después', valor: money(datos.despues.saldo), pie: `${datos.despues.ordenes.length} orden(es) con fecha más adelante` },
    { titulo: 'Sin fecha de pago', valor: money(datos.sin_fecha.saldo),
      color: datos.sin_fecha.ordenes.length ? 'var(--pc-ambar-texto)' : null,
      pie: datos.sin_fecha.ordenes.length ? `${datos.sin_fecha.ordenes.length} compra(s) a crédito por programar` : 'Todas tienen fecha' },
  ]

  return (
    <div>
      {encabezado}

      <div style={s.kpis}>
        {kpis.map((k) => (
          <div key={k.titulo} style={s.kpi}>
            <div style={{ ...s.kpiV, ...(k.color ? { color: k.color } : {}) }}>{k.valor}</div>
            <div style={s.kpiT}>{k.titulo}</div>
            <div style={s.kpiL}>{k.pie}</div>
          </div>
        ))}
      </div>

      <input style={s.buscador} placeholder="Buscar por folio, proveedor o factura..."
        value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />

      <Seccion titulo="Esta semana" grupo={datos.semana} filas={filtrar(datos.semana.ordenes)}
        ayuda={`Pagos vencidos, los que caen a más tardar el domingo ${fechaCorta(datos.fin_semana)}`
          + `${contado ? ` y ${contado} de contado que esperan su pago para comprarse` : ' y las de contado autorizadas'}`}
        vacio={t ? 'Nada de esta semana coincide con la búsqueda.' : 'Nada urgente esta semana.'}
        sel={sel} alternar={alternar} alternarTodas={alternarTodas} onAbrirOrden={abrirOrden} onProgramar={setProgramar} />

      <Seccion titulo="Después" grupo={datos.despues} filas={filtrar(datos.despues.ordenes)}
        ayuda="Compras a crédito cuyo siguiente pago cae después del domingo; se muestra lo de ese pago"
        vacio={t ? 'Nada pendiente coincide con la búsqueda.' : 'No hay pagos programados más adelante.'}
        sel={sel} alternar={alternar} alternarTodas={alternarTodas} onAbrirOrden={abrirOrden} onProgramar={setProgramar} />

      <Seccion titulo="Sin fecha de pago" grupo={datos.sin_fecha} filas={filtrar(datos.sin_fecha.ordenes)}
        ayuda="Compras a crédito sin fecha acordada todavía: ponles fecha para que aparezcan en su semana"
        vacio={t ? 'Nada sin fecha coincide con la búsqueda.' : 'Todas las compras a crédito tienen fecha de pago.'}
        sel={sel} alternar={alternar} alternarTodas={alternarTodas} onAbrirOrden={abrirOrden} onProgramar={setProgramar} />

      {elegidas.length > 0 && (
        <div style={s.barra}>
          <span style={{ flex: 1, minWidth: 200, fontSize: 13.5 }}>
            <b>{elegidas.length}</b> orden{elegidas.length === 1 ? '' : 'es'} · a pagar <b>{money(totalElegido)}</b>
            {proveedoresElegidos > 1 && <span style={{ color: 'var(--pc-gris)' }}> · {proveedoresElegidos} proveedores</span>}
          </span>
          <button style={s.btnGhost} onClick={() => setSel({})}>Quitar selección</button>
          <button style={s.btnPrimary} onClick={() => setPagando(elegidas)}>Registrar pago →</button>
        </div>
      )}

      {programar && (
        <Calendario ordenId={programar.id} folio={programar.folio}
          base={programar.importe - (programar.recargo || 0)} pagado={programar.pagado} cuotas={programar.cuotas || []}
          onClose={() => setProgramar(null)}
          onGuardado={() => { setProgramar(null); refrescar() }} />
      )}
      {pagando && (
        <ModalPago ordenes={pagando} onClose={() => setPagando(null)}
          onHecho={() => { setPagando(null); setSel({}); refrescar() }} />
      )}
      {modalOrden}
    </div>
  )
}
