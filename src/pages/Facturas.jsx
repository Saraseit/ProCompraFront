import { useState, useEffect } from 'react'
import api from '../api'
import { money, fechaCorta, mensajeError, etiquetaEstado } from '../constants'
import Modal, { ModalHead } from '../ui/Modal'
import { useToast } from '../ui/feedback-context'
import { C } from '../ui/tema'
import BotonArchivo from './orden/BotonArchivo'
import { abrirEnPestana } from './orden/archivos'

const FILTROS = [
  ['pendiente', 'Sin vincular'],
  ['vinculada', 'Vinculadas'],
  ['', 'Todas'],
]

const RESULTADOS = {
  vinculada: { label: 'Vinculadas',  color: 'var(--pc-verde)',  bg: 'var(--pc-verde-bg)' },
  pendiente: { label: 'Por vincular', color: 'var(--pc-ambar-texto)', bg: 'var(--pc-ambar-bg)' },
  duplicada: { label: 'Ya cargadas', color: 'var(--pc-gris-2)', bg: 'var(--pc-superficie-3)' },
  ignorada:  { label: 'Ignoradas',   color: 'var(--pc-gris-2)', bg: 'var(--pc-superficie-3)' },
  invalida:  { label: 'Con error',   color: 'var(--pc-rojo)',   bg: 'var(--pc-rojo-bg)' },
}

export default function Facturas({ onCambio }) {
  const [facturas, setFacturas] = useState([])
  const [filtro, setFiltro] = useState('pendiente')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [carga, setCarga] = useState(null)
  const [vinculando, setVinculando] = useState(null)
  const toast = useToast()

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const res = await api.get(`/facturas${filtro ? `?estado=${filtro}` : ''}`)
      setFacturas(res.data)
    } catch (e) {
      setError('Error al cargar facturas: ' + mensajeError(e))
    }
    setCargando(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => { cargar() }, 200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro])

  async function subir(archivos) {
    const xmls = archivos.filter((a) => a.name.toLowerCase().endsWith('.xml'))
    if (!xmls.length) {
      toast('Selecciona archivos .xml de facturas', 'error')
      return
    }
    setSubiendo(true)
    try {
      const datos = new FormData()
      xmls.forEach((a) => datos.append('archivos', a))
      const { data } = await api.post('/facturas/xml', datos)
      setCarga(data)
      const n = data.resumen.vinculada || 0
      toast(`${xmls.length} XML procesados · ${n} vinculada${n === 1 ? '' : 's'} automáticamente`)
      await cargar()
      if (onCambio) onCambio()
    } catch (e) {
      toast('No se pudieron cargar: ' + mensajeError(e), 'error')
    }
    setSubiendo(false)
  }

  async function desvincular(f) {
    try {
      await api.patch(`/facturas/${f.id}`, { orden_id: null })
      toast('Factura desvinculada')
      await cargar()
      if (onCambio) onCambio()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  async function verXml(f) {
    try { await abrirEnPestana(`/facturas/${f.id}/xml`) } catch (e) { toast('No se pudo abrir: ' + mensajeError(e), 'error') }
  }

  if (error) return <div style={s.error}>{error}</div>

  return (
    <div>
      <div style={s.header}>
        <div>
          <h2 style={s.h2}>Facturas</h2>
          <p style={s.help}>
            Carga los XML de tus proveedores. ProCompra vincula cada factura con su orden cuando
            coinciden el RFC del proveedor, el total y la fecha; si hay duda, queda aquí para vincularla a mano.
          </p>
        </div>
      </div>

      <div
        style={{ ...s.zona, ...(arrastrando ? s.zonaActiva : {}) }}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastrando(false)
          if (!subiendo) subir(Array.from(e.dataTransfer.files || []))
        }}>
        <div style={{ fontSize:15, fontWeight:600, color:'var(--pc-tinta)' }}>
          {subiendo ? 'Procesando facturas...' : 'Arrastra aquí los XML'}
        </div>
        <div style={{ fontSize:12.5, color:'var(--pc-gris)', margin:'4px 0 12px' }}>
          Puedes cargar hasta 200 a la vez. Las repetidas se detectan por su folio fiscal (UUID).
        </div>
        <BotonArchivo multiple accept=".xml,text/xml,application/xml" disabled={subiendo}
          style={{ ...s.btnAqua, opacity: subiendo ? 0.5 : 1 }} onArchivos={subir}>
          {subiendo ? 'Subiendo...' : 'Elegir archivos XML'}
        </BotonArchivo>
      </div>

      {carga && <ResultadoCarga carga={carga} onCerrar={() => setCarga(null)} />}

      <div style={s.filtros}>
        {FILTROS.map(([k, label]) => (
          <button key={k} style={{ ...s.filtro, ...(filtro === k ? s.filtroActivo : {}) }}
            onClick={() => setFiltro(k)}>
            {label}
          </button>
        ))}
      </div>

      <div style={s.card}>
        <div style={{ overflowX:'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Emisor</th>
                <th style={s.th}>Serie / folio</th>
                <th style={s.th}>Fecha</th>
                <th style={{ ...s.th, textAlign:'right' }}>Total</th>
                <th style={s.th}>Orden</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {cargando && <tr><td colSpan={6} style={s.empty}>Cargando...</td></tr>}
              {!cargando && facturas.length === 0 && (
                <tr><td colSpan={6} style={s.empty}>
                  {filtro === 'pendiente'
                    ? 'Todo vinculado. No hay facturas pendientes.'
                    : 'Aún no hay facturas cargadas.'}
                </td></tr>
              )}
              {facturas.map((f) => (
                <tr key={f.id}>
                  <td style={s.td}>
                    <div style={{ fontWeight:500 }}>{f.nombre_emisor || '—'}</div>
                    <div style={s.rfc}>{f.rfc_emisor}</div>
                  </td>
                  <td style={{ ...s.td, fontFamily:'monospace', fontSize:12 }}>
                    {(f.serie || '') + (f.folio || '') || '—'}
                  </td>
                  <td style={s.td}>{fechaCorta(f.fecha_emision)}</td>
                  <td style={{ ...s.td, textAlign:'right', fontWeight:600 }}>{money(f.total)}</td>
                  <td style={s.td}>
                    {f.orden ? (
                      <span>
                        <b>#{f.orden.folio}</b>{' '}
                        <span style={s.chip}>{f.vinculacion === 'automatica' ? 'automática' : 'manual'}</span>
                      </span>
                    ) : (
                      <span style={{ ...s.chip, color:'var(--pc-ambar-texto)', background:'var(--pc-ambar-bg)' }}>
                        Sin vincular
                      </span>
                    )}
                  </td>
                  <td style={{ ...s.td, whiteSpace:'nowrap', textAlign:'right' }}>
                    <button style={s.btnChico} onClick={() => verXml(f)}>XML</button>{' '}
                    {f.orden ? (
                      <button style={s.btnChico} onClick={() => desvincular(f)}>Desvincular</button>
                    ) : (
                      <button style={{ ...s.btnChico, ...s.btnChicoAqua }} onClick={() => setVinculando(f)}>
                        Vincular
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {vinculando && (
        <ModalVincular
          factura={vinculando}
          onClose={() => setVinculando(null)}
          onVinculada={async () => {
            setVinculando(null)
            await cargar()
            if (onCambio) onCambio()
          }}
        />
      )}
    </div>
  )
}

function ResultadoCarga({ carga, onCerrar }) {
  const [verDetalle, setVerDetalle] = useState(false)
  const conProblema = carga.resultados.filter((r) => r.estado !== 'vinculada')
  return (
    <div style={s.resultado}>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <b style={{ marginRight:4 }}>Resultado de la carga:</b>
        {Object.entries(carga.resumen).map(([k, n]) => (
          <span key={k} style={{ ...s.chip, color:RESULTADOS[k]?.color, background:RESULTADOS[k]?.bg }}>
            {n} {RESULTADOS[k]?.label || k}
          </span>
        ))}
        <span style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          {conProblema.length > 0 && (
            <button style={s.btnChico} onClick={() => setVerDetalle(!verDetalle)}>
              {verDetalle ? 'Ocultar detalle' : 'Ver detalle'}
            </button>
          )}
          <button style={s.btnChico} onClick={onCerrar}>✕</button>
        </span>
      </div>
      {verDetalle && (
        <div style={{ marginTop:10 }}>
          {conProblema.map((r, i) => (
            <div key={i} style={s.resultadoLinea}>
              <span style={{ ...s.chip, color:RESULTADOS[r.estado]?.color, background:RESULTADOS[r.estado]?.bg }}>
                {RESULTADOS[r.estado]?.label || r.estado}
              </span>
              <span style={{ fontFamily:'monospace', fontSize:12 }}>{r.archivo}</span>
              <span style={{ color:'var(--pc-gris)' }}>{r.mensaje}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ModalVincular({ factura, onClose, onVinculada }) {
  const [candidatas, setCandidatas] = useState(null)
  const [folio, setFolio] = useState('')
  const [guardando, setGuardando] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api.get(`/facturas/${factura.id}/candidatas`)
      .then((res) => setCandidatas(res.data))
      .catch(() => setCandidatas([]))
  }, [factura.id])

  async function vincular(ordenId, folioOrden) {
    setGuardando(true)
    try {
      await api.patch(`/facturas/${factura.id}`, { orden_id: ordenId })
      toast(`Factura vinculada a la orden #${folioOrden}`)
      await onVinculada()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
      setGuardando(false)
    }
  }

  async function vincularPorFolio() {
    const n = Number(folio)
    if (!n) return
    setGuardando(true)
    try {
      const { data } = await api.get('/ordenes')
      const orden = data.find((o) => o.folio === n)
      if (!orden) {
        toast(`No hay una orden activa con folio #${n}`, 'error')
        setGuardando(false)
        return
      }
      await vincular(orden.id, n)
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
      setGuardando(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={620}>
      <ModalHead titulo="Vincular factura" onClose={onClose} />
      <div style={{ padding:'16px 24px 24px' }}>
        <div style={s.facturaResumen}>
          <b>{factura.nombre_emisor || factura.rfc_emisor}</b>
          <span style={s.rfc}>{factura.rfc_emisor}</span>
          <span style={{ marginLeft:'auto', fontWeight:700 }}>{money(factura.total)}</span>
          <span style={{ width:'100%', fontSize:12, color:'var(--pc-gris)' }}>
            {(factura.serie || '') + (factura.folio || '')} · {fechaCorta(factura.fecha_emision)}
            {factura.uuid_fiscal ? ` · UUID ${factura.uuid_fiscal}` : ''}
          </span>
        </div>

        <div style={s.subtitulo}>Órdenes sugeridas</div>
        {candidatas === null && <div style={s.ayuda}>Buscando...</div>}
        {candidatas?.length === 0 && (
          <div style={s.ayuda}>
            No hay órdenes del mismo RFC ni con un total que cuadre. Escribe el folio abajo.
          </div>
        )}
        {candidatas?.map((o) => (
          <div key={o.id} style={s.candidata}>
            <div style={{ flex:1, minWidth:0 }}>
              <div><b>#{o.folio}</b> · {o.proveedor?.nombre || '—'}</div>
              <div style={{ fontSize:12, color:'var(--pc-gris)', display:'flex', gap:6, flexWrap:'wrap', marginTop:3 }}>
                <span>{money(o.total)}</span>
                <span>· {etiquetaEstado(o.estado)}</span>
                <span>· {fechaCorta(o.fecha)}</span>
                {o.mismo_rfc && <span style={s.okChip}>✓ mismo RFC</span>}
                {o.total_cuadra && <span style={s.okChip}>✓ total cuadra</span>}
                {o.ya_facturada && <span style={{ ...s.chip, color:'var(--pc-ambar-texto)', background:'var(--pc-ambar-bg)' }}>ya tiene factura</span>}
              </div>
            </div>
            <button style={{ ...s.btnChico, ...s.btnChicoAqua, opacity: guardando ? 0.5 : 1 }}
              disabled={guardando} onClick={() => vincular(o.id, o.folio)}>
              Vincular
            </button>
          </div>
        ))}

        <div style={s.subtitulo}>O por folio de orden</div>
        <div style={{ display:'flex', gap:10 }}>
          <input style={s.input} type="number" placeholder="Folio, p. ej. 846" value={folio}
            onChange={(e) => setFolio(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') vincularPorFolio() }} />
          <button style={{ ...s.btnPrimary, opacity: guardando || !folio ? 0.5 : 1 }}
            disabled={guardando || !folio} onClick={vincularPorFolio}>
            Vincular
          </button>
        </div>
      </div>
    </Modal>
  )
}

const s = {
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:16, gap:16, flexWrap:'wrap' },
  h2: { fontSize:22, fontWeight:600, margin:0, color:'var(--pc-tinta)' },
  help: { fontSize:13, color:'var(--pc-gris)', marginTop:4, maxWidth:640, lineHeight:1.45 },
  error: { padding:20, background:'var(--pc-rojo-bg)', color:'var(--pc-rojo)', borderRadius:8 },
  zona: { border:'2px dashed var(--pc-borde)', borderRadius:12, padding:'22px 18px', textAlign:'center',
          background:'var(--pc-superficie)', marginBottom:14, transition:'border-color 0.15s, background 0.15s' },
  zonaActiva: { borderColor:C.aqua, background:C.aquaBg },
  resultado: { background:'var(--pc-superficie)', border:'1px solid var(--pc-borde)', borderRadius:10,
               padding:'12px 14px', marginBottom:14, fontSize:13 },
  resultadoLinea: { display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', padding:'6px 0',
                    borderTop:'1px dashed var(--pc-borde)', fontSize:12.5 },
  filtros: { display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' },
  filtro: { border:'1px solid var(--pc-borde)', background:'var(--pc-superficie)', color:'var(--pc-gris)',
            padding:'7px 13px', borderRadius:20, fontSize:13, fontWeight:500, cursor:'pointer' },
  filtroActivo: { borderColor:C.aqua, background:C.aquaBg, color:C.aqua, fontWeight:600 },
  card: { background:'var(--pc-superficie)', border:'1px solid var(--pc-borde)', borderRadius:12, overflow:'hidden' },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13.5 },
  th: { textAlign:'left', padding:'11px 14px', background:'var(--pc-superficie-3)', color:'var(--pc-gris-2)',
        fontWeight:600, fontSize:11, textTransform:'uppercase', borderBottom:'1px solid var(--pc-borde)' },
  td: { padding:'11px 14px', borderBottom:'1px solid var(--pc-linea)', verticalAlign:'top' },
  empty: { textAlign:'center', color:'var(--pc-gris)', padding:28 },
  rfc: { fontFamily:'monospace', fontSize:11.5, color:'var(--pc-gris-3)' },
  chip: { fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'var(--pc-superficie-3)',
          color:'var(--pc-gris-2)', whiteSpace:'nowrap' },
  okChip: { fontSize:11, fontWeight:600, padding:'1px 7px', borderRadius:20, background:'var(--pc-verde-bg)',
            color:'var(--pc-verde)', whiteSpace:'nowrap' },
  btnChico: { background:'var(--pc-superficie)', border:'1px solid var(--pc-borde)', padding:'5px 10px',
              borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer', color:'var(--pc-tinta)' },
  btnChicoAqua: { borderColor:C.aqua, color:C.aqua, background:C.aquaBg, fontWeight:600 },
  btnAqua: { background:C.aquaBg, color:C.aqua, border:`1px solid ${C.aqua}`, padding:'9px 16px',
             borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer' },
  btnPrimary: { background:'var(--pc-btn)', color:'var(--pc-btn-texto)', border:'none', padding:'10px 16px',
                borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer' },
  input: { width:'100%', border:'1px solid var(--pc-borde)', borderRadius:8, padding:'9px 11px', fontSize:14, boxSizing:'border-box' },
  facturaResumen: { display:'flex', gap:8, alignItems:'baseline', flexWrap:'wrap', background:'var(--pc-superficie-2)',
                    border:'1px solid var(--pc-borde)', borderRadius:10, padding:'12px 14px', fontSize:14 },
  subtitulo: { fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--pc-gris)',
               fontWeight:600, margin:'18px 0 8px' },
  ayuda: { fontSize:13, color:'var(--pc-gris)' },
  candidata: { display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px dashed var(--pc-borde)', fontSize:13.5 },
}
