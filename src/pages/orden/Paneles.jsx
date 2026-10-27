import { useState } from 'react'
import api from '../../api'
import {
  METODOS_PAGO, METODOS_CON_ENTREGA, etiquetaMetodo, money, fechaCorta, hoy,
} from '../../constants'
import { Label } from '../../ui/Modal'
import { s, bloqueado } from './estilos'
import BotonArchivo from './BotonArchivo'
import { ACEPTA_DOCUMENTOS, ACEPTA_FACTURA, subirAdjunto } from './archivos'

const sumaPagos = (orden) => (orden.pagos || []).reduce((t, p) => t + Number(p.monto || 0), 0)

function Campo({ label, requerido, children }) {
  return (
    <label style={{ display:'block' }}>
      <Label requerido={requerido}>{label}</Label>
      {children}
    </label>
  )
}

// ── Pago o entrega de recursos (contabilidad) ─────────────────────────────
export function PanelPago({ orden, ejecutar, procesando, toast }) {
  const modoCredito = orden.tipo_pago === 'credito'
  const pagado = sumaPagos(orden)
  const saldo = Math.max(0, Number(orden.total || 0) - pagado)
  const [abierto, setAbierto] = useState(!modoCredito)
  const [metodo, setMetodo] = useState(modoCredito ? 'transferencia' : orden.tipo_pago || 'transferencia')
  const [datos, setDatos] = useState({
    fecha_pago: hoy(), referencia: '', entregado_a: '',
    monto: modoCredito ? saldo : Number(orden.total || 0),
  })
  const [comprobante, setComprobante] = useState(null)
  const set = (k, v) => setDatos((d) => ({ ...d, [k]: v }))

  const conEntrega = METODOS_CON_ENTREGA.includes(metodo)
  const faltante =
    !(Number(datos.monto) > 0) ? 'Captura el monto'
    : metodo === 'transferencia' && !datos.referencia.trim() ? 'Captura la referencia de la transferencia'
    : conEntrega && !datos.entregado_a.trim() ? 'Indica a quién se le entrega'
    : null
  const ocupado = !!procesando

  const confirmarCredito = () => ejecutar('credito', async () => {
    await api.put(`/ordenes/${orden.id}`, { tipo_pago: 'credito' })
    toast(`Orden #${orden.folio} marcada como compra a crédito`)
  })

  const registrar = () => ejecutar('pago', async () => {
    await api.post(`/ordenes/${orden.id}/pago`, { ...datos, metodo, monto: Number(datos.monto) })
    if (comprobante) await subirAdjunto(orden.id, 'comprobante_pago', comprobante)
    toast(conEntrega
      ? `Entrega registrada: ${etiquetaMetodo(metodo).toLowerCase()} para ${datos.entregado_a.trim()}`
      : `Pago registrado para la orden #${orden.folio}`)
  })

  if (modoCredito && saldo <= 0.005) {
    return <div style={s.infoOk}>✓ Crédito liquidado · pagado {money(pagado)}</div>
  }

  if (modoCredito && !abierto) {
    return (
      <div style={{ ...s.panel, display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div>
          <p style={s.panelTitulo}>Crédito con el proveedor</p>
          <p style={{ ...s.panelAyuda, margin:0 }}>
            Pagado {money(pagado)} de {money(orden.total)} · saldo <b>{money(saldo)}</b>
          </p>
        </div>
        <button style={s.btnGhost} onClick={() => setAbierto(true)}>Registrar pago al proveedor</button>
      </div>
    )
  }

  return (
    <div style={s.panel}>
      <p style={s.panelTitulo}>{modoCredito ? 'Pago al proveedor (crédito)' : 'Procesar pago'}</p>
      <p style={s.panelAyuda}>
        {modoCredito
          ? `Saldo pendiente ${money(saldo)}. Registra cada pago conforme se liquide.`
          : 'Elige cómo se paga. En efectivo o tarjeta registra a quién se le entrega; a crédito, almacén puede coordinar la compra sin esperar el pago.'}
      </p>

      <div style={s.grid2}>
        <Campo label="Forma de pago" requerido>
          <select style={s.input} value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODOS_PAGO.filter(([k]) => !(modoCredito && k === 'credito')).map(([k, label]) =>
              <option key={k} value={k}>{label}</option>)}
          </select>
        </Campo>

        {metodo !== 'credito' && (<>
          {conEntrega && (
            <Campo label="Entregado a" requerido>
              <input style={s.input} value={datos.entregado_a} placeholder="Quién hará la compra"
                onChange={(e) => set('entregado_a', e.target.value)} />
            </Campo>
          )}
          <Campo label={conEntrega ? 'Monto entregado' : 'Monto'} requerido>
            <input type="number" style={s.input} value={datos.monto}
              onChange={(e) => set('monto', e.target.value)} />
          </Campo>
          <Campo label="Fecha">
            <input type="date" style={s.input} value={datos.fecha_pago}
              onChange={(e) => set('fecha_pago', e.target.value)} />
          </Campo>
          <Campo label={metodo === 'transferencia' ? 'Referencia' : conEntrega && metodo !== 'efectivo' ? 'Tarjeta (últimos 4 dígitos)' : 'Referencia (opcional)'}
            requerido={metodo === 'transferencia'}>
            <input style={s.input} value={datos.referencia}
              onChange={(e) => set('referencia', e.target.value)} />
          </Campo>
        </>)}
      </div>

      {metodo === 'credito' ? (
        <div style={s.filaFin}>
          <button style={bloqueado(s.btnPrimary, ocupado)} disabled={ocupado} onClick={confirmarCredito}>
            {procesando === 'credito' ? 'Procesando...' : 'Confirmar compra a crédito →'}
          </button>
        </div>
      ) : (
        <div style={{ ...s.filaFin, justifyContent:'space-between' }}>
          <div style={s.fila}>
            {metodo === 'transferencia' && (
              <BotonArchivo accept={ACEPTA_DOCUMENTOS} style={s.btnChico}
                onArchivos={([a]) => setComprobante(a)}>
                {comprobante ? `Comprobante: ${comprobante.name}` : '+ Comprobante (opcional)'}
              </BotonArchivo>
            )}
            {faltante && <span style={{ fontSize:12, color:'var(--pc-gris)' }}>{faltante}</span>}
          </div>
          <div style={s.fila}>
            {modoCredito && <button style={s.btnGhost} onClick={() => setAbierto(false)}>Cancelar</button>}
            <button style={bloqueado(s.btnPrimary, ocupado || !!faltante)} disabled={ocupado || !!faltante}
              onClick={registrar}>
              {procesando === 'pago' ? 'Procesando...' : conEntrega ? 'Registrar entrega →' : 'Registrar pago →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Logística (almacén decide si se recoge o se entrega en bodega) ────────
export function PanelLogistica({ orden, ejecutar, procesando, toast }) {
  const ultima = (orden.recolecciones || []).slice(-1)[0]
  const [rec, setRec] = useState({
    tipo: ultima?.tipo || 'recoleccion',
    fecha_programada: ultima?.fecha_programada || hoy(),
    responsable: ultima?.responsable || '',
    notas: '',
  })
  const set = (k, v) => setRec((r) => ({ ...r, [k]: v }))
  const ocupado = !!procesando

  const enviar = (completado) => ejecutar(completado ? 'recibido' : 'programar', async () => {
    await api.post(`/ordenes/${orden.id}/recoleccion`, { ...rec, completado })
    toast(completado
      ? `Orden #${orden.folio}: material recibido. Falta subir el ticket o la factura.`
      : 'Logística programada')
  })

  return (
    <div style={s.panel}>
      <p style={s.panelTitulo}>Logística</p>
      {ultima && !ultima.completado ? (
        <div style={{ ...s.info, marginBottom:12 }}>
          Programada: {ultima.tipo === 'entrega' ? 'entrega en bodega' : 'recolección en proveedor'} el{' '}
          {fechaCorta(ultima.fecha_programada)}{ultima.responsable ? ` · ${ultima.responsable}` : ''}
        </div>
      ) : (
        <p style={s.panelAyuda}>Define si el material se recoge con el proveedor o lo entregan en bodega.</p>
      )}
      <div style={s.grid2}>
        <Campo label="Tipo">
          <select style={s.input} value={rec.tipo} onChange={(e) => set('tipo', e.target.value)}>
            <option value="recoleccion">Recolectar / comprar en proveedor</option>
            <option value="entrega">Entrega en bodega</option>
          </select>
        </Campo>
        <Campo label="Fecha">
          <input type="date" style={s.input} value={rec.fecha_programada}
            onChange={(e) => set('fecha_programada', e.target.value)} />
        </Campo>
        <Campo label="Responsable">
          <input style={s.input} value={rec.responsable} onChange={(e) => set('responsable', e.target.value)} />
        </Campo>
        <Campo label="Notas">
          <input style={s.input} value={rec.notas} onChange={(e) => set('notas', e.target.value)} />
        </Campo>
      </div>
      <div style={s.filaFin}>
        <button style={bloqueado(s.btnGhost, ocupado)} disabled={ocupado} onClick={() => enviar(false)}>
          {procesando === 'programar' ? 'Procesando...' : 'Programar'}
        </button>
        <button style={bloqueado(s.btnOk, ocupado)} disabled={ocupado} onClick={() => enviar(true)}>
          {procesando === 'recibido' ? 'Procesando...' : 'Material recibido ✓'}
        </button>
      </div>
    </div>
  )
}

// ── Comprobación: ticket o factura + monto real ───────────────────────────
export function PanelComprobacion({ orden, ejecutar, procesando, toast }) {
  const comprobantes = (orden.adjuntos || []).filter((a) => ['ticket', 'factura'].includes(a.tipo))
  const facturas = orden.facturas || []
  const tieneComprobante = comprobantes.length > 0 || facturas.length > 0
  const entregado = sumaPagos(orden)
  const huboEfectivo = (orden.pagos || []).some((p) => p.metodo === 'efectivo')

  const sugerido = orden.monto_comprobado
    ?? (facturas.length ? facturas.reduce((t, f) => t + Number(f.total || 0), 0) : Number(orden.total || 0))
  const [monto, setMonto] = useState(sugerido)
  const [cambio, setCambio] = useState(orden.cambio_devuelto ?? '')
  const [notas, setNotas] = useState(orden.notas_comprobacion || '')
  const ocupado = !!procesando
  const cambioSugerido = huboEfectivo ? Math.max(0, entregado - Number(monto || 0)) : 0

  const subir = (tipo) => ([archivo]) => ejecutar(`subir-${tipo}`, async () => {
    const { data } = await subirAdjunto(orden.id, tipo, archivo)
    toast(data.factura ? data.factura.mensaje : `${tipo === 'ticket' ? 'Ticket' : 'Factura'} adjuntada`)
  })

  const registrar = () => ejecutar('comprobar', async () => {
    await api.post(`/ordenes/${orden.id}/comprobacion`, {
      monto_comprobado: Number(monto),
      cambio_devuelto: cambio === '' ? null : Number(cambio),
      notas,
    })
    toast('Comprobación registrada. Contabilidad la revisará para cerrar la orden.')
  })

  return (
    <div style={s.panel}>
      <p style={s.panelTitulo}>Comprobación del gasto</p>
      <p style={s.panelAyuda}>
        Sube el ticket o la factura y captura el monto real de la compra.
        {huboEfectivo && ` Se entregaron ${money(entregado)} en efectivo: registra el cambio devuelto.`}
      </p>

      <div style={{ ...s.fila, marginBottom:12 }}>
        <BotonArchivo accept={ACEPTA_DOCUMENTOS} disabled={ocupado} style={bloqueado(s.btnAqua, ocupado)}
          onArchivos={subir('ticket')}>
          {procesando === 'subir-ticket' ? 'Subiendo...' : '+ Subir ticket'}
        </BotonArchivo>
        <BotonArchivo accept={ACEPTA_FACTURA} disabled={ocupado} style={bloqueado(s.btnAqua, ocupado)}
          onArchivos={subir('factura')}>
          {procesando === 'subir-factura' ? 'Subiendo...' : '+ Subir factura (PDF o XML)'}
        </BotonArchivo>
        <span style={{ fontSize:12.5, color: tieneComprobante ? 'var(--pc-verde)' : 'var(--pc-gris)' }}>
          {tieneComprobante
            ? `✓ ${comprobantes.length + facturas.length} comprobante(s)`
            : 'Sin comprobante todavía'}
        </span>
      </div>

      <div style={s.grid2}>
        <Campo label="Monto real (ticket o factura)" requerido>
          <input type="number" style={s.input} value={monto} onChange={(e) => setMonto(e.target.value)} />
        </Campo>
        {huboEfectivo && (
          <Campo label={`Cambio devuelto${cambioSugerido ? ` (calculado ${money(cambioSugerido)})` : ''}`}>
            <input type="number" style={s.input} value={cambio} placeholder={String(cambioSugerido)}
              onChange={(e) => setCambio(e.target.value)} />
          </Campo>
        )}
        <Campo label="Notas">
          <input style={s.input} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Campo>
      </div>

      <div style={s.filaFin}>
        {!tieneComprobante && <span style={{ fontSize:12, color:'var(--pc-gris)' }}>Primero adjunta el ticket o la factura</span>}
        <button style={bloqueado(s.btnPrimary, ocupado || !tieneComprobante || !(Number(monto) > 0))}
          disabled={ocupado || !tieneComprobante || !(Number(monto) > 0)} onClick={registrar}>
          {procesando === 'comprobar' ? 'Procesando...'
            : orden.monto_comprobado != null ? 'Actualizar comprobación' : 'Registrar comprobación'}
        </button>
      </div>
    </div>
  )
}

// ── Resumen: autorizado vs. real, y lo que se pagó o entregó ──────────────
export function ResumenDinero({ orden }) {
  const pagos = orden.pagos || []
  const comprobado = orden.monto_comprobado
  if (!pagos.length && comprobado == null) return null
  const diferencia = comprobado != null ? Number(comprobado) - Number(orden.total || 0) : 0

  return (
    <div style={s.box}>
      <div style={s.boxTitle}>Pagos y comprobación</div>
      {pagos.map((p) => (
        <div key={p.id} style={s.lineItem}>
          <span style={s.lineL}>
            {fechaCorta(p.fecha_pago)} · {etiquetaMetodo(p.metodo)}
            {p.entregado_a ? ` · entregado a ${p.entregado_a}` : ''}
            {p.referencia ? ` · ${p.referencia}` : ''}
          </span>
          <span>{money(p.monto)}</span>
        </div>
      ))}
      {comprobado != null && (<>
        <div style={{ ...s.lineItem, marginTop: pagos.length ? 8 : 0, paddingTop: pagos.length ? 8 : 0,
                      borderTop: pagos.length ? '1px dashed var(--pc-borde)' : 'none' }}>
          <span style={s.lineL}>Autorizado</span><span>{money(orden.total)}</span>
        </div>
        <div style={s.lineItem}>
          <span style={s.lineL}>Real (comprobado)</span><b>{money(comprobado)}</b>
        </div>
        {Math.abs(diferencia) >= 0.01 && (
          <div style={s.lineItem}>
            <span style={s.lineL}>Diferencia</span>
            <span style={{ color: diferencia > 0 ? 'var(--pc-rojo)' : 'var(--pc-verde)', fontWeight:600 }}>
              {diferencia > 0 ? '+' : '−'}{money(Math.abs(diferencia))}
            </span>
          </div>
        )}
        {orden.cambio_devuelto != null && (
          <div style={s.lineItem}><span style={s.lineL}>Cambio devuelto</span><span>{money(orden.cambio_devuelto)}</span></div>
        )}
        {orden.notas_comprobacion && (
          <div style={{ fontSize:12.5, color:'var(--pc-gris)', marginTop:6 }}>{orden.notas_comprobacion}</div>
        )}
      </>)}
    </div>
  )
}
