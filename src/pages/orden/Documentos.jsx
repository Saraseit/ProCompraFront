import { useState } from 'react'
import api from '../../api'
import { TIPOS_ADJUNTO, esAdmin, etiquetaAdjunto, money, fechaCorta, mensajeError, tamanoArchivo } from '../../constants'
import { useToast, useConfirm } from '../../ui/feedback-context'
import { s, bloqueado } from './estilos'
import BotonArchivo from './BotonArchivo'
import { ACEPTA_DOCUMENTOS, ACEPTA_FACTURA, abrirEnPestana, subirAdjunto } from './archivos'

// Pestaña "Documentos": cotización, comprobantes, tickets y facturas de la orden.
export default function Documentos({ orden, usuario, onCambio }) {
  const [tipo, setTipo] = useState(orden.estado === 'comprobacion' ? 'ticket' : 'cotizacion')
  const [subiendo, setSubiendo] = useState(false)
  const toast = useToast()
  const confirmar = useConfirm()

  const adjuntos = orden.adjuntos || []
  const facturas = orden.facturas || []
  const cancelada = orden.estado === 'rechazada'
  const cerrada = orden.estado === 'cerrada'

  async function subir([archivo]) {
    setSubiendo(true)
    try {
      const { data } = await subirAdjunto(orden.id, tipo, archivo)
      toast(data.factura ? data.factura.mensaje : `${etiquetaAdjunto(tipo)} adjuntada`)
      await onCambio()
    } catch (e) {
      toast('No se pudo subir: ' + mensajeError(e), 'error')
    }
    setSubiendo(false)
  }

  async function abrir(ruta) {
    try { await abrirEnPestana(ruta) } catch (e) { toast('No se pudo abrir: ' + mensajeError(e), 'error') }
  }

  async function quitar(adj) {
    const ok = await confirmar({
      titulo: 'Quitar documento',
      mensaje: `¿Quitar "${adj.nombre_archivo}" de la orden? El archivo se borra.`,
      textoBoton: 'Quitar',
      peligro: true,
    })
    if (!ok) return
    try {
      await api.delete(`/adjuntos/${adj.id}`)
      toast('Documento quitado')
      await onCambio()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  const puedeQuitar = (adj) => !cerrada && (esAdmin(usuario.rol) || adj.subido_por === usuario.id)

  return (
    <>
      {!cancelada && (
        <div style={s.panel}>
          <p style={s.panelTitulo}>Adjuntar documento</p>
          <p style={s.panelAyuda}>
            PDF o imagen de hasta 10 MB. Una factura en XML se lee automáticamente y queda
            vinculada a esta orden.
          </p>
          <div style={s.fila}>
            <select style={{ ...s.input, width:'auto', minWidth:200 }} value={tipo}
              onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_ADJUNTO.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <BotonArchivo accept={tipo === 'factura' ? ACEPTA_FACTURA : ACEPTA_DOCUMENTOS}
              disabled={subiendo} style={bloqueado(s.btnAqua, subiendo)} onArchivos={subir}>
              {subiendo ? 'Subiendo...' : 'Elegir archivo'}
            </BotonArchivo>
          </div>
        </div>
      )}

      <div style={s.box}>
        <div style={s.boxTitle}>Documentos ({adjuntos.length})</div>
        {adjuntos.length === 0 && (
          <div style={{ fontSize:12.5, color:'var(--pc-gris-3)' }}>Aún no hay documentos adjuntos.</div>
        )}
        {adjuntos.map((a) => (
          <div key={a.id} style={s.docFila}>
            <span style={s.docTipo}>{etiquetaAdjunto(a.tipo)}</span>
            <span style={s.docNombre} title={a.nombre_archivo}>{a.nombre_archivo}</span>
            <span style={s.docMeta}>
              {tamanoArchivo(a.tamano)} · {a.subido?.nombre || '—'} · {fechaCorta(a.created_at)}
            </span>
            <button style={s.btnChico} onClick={() => abrir(`/adjuntos/${a.id}/url`)}>Ver</button>
            {puedeQuitar(a) && (
              <button style={{ ...s.btnChico, color:'var(--pc-rojo)' }} onClick={() => quitar(a)}>Quitar</button>
            )}
          </div>
        ))}
      </div>

      <div style={s.box}>
        <div style={s.boxTitle}>Facturas CFDI vinculadas ({facturas.length})</div>
        {facturas.length === 0 && (
          <div style={{ fontSize:12.5, color:'var(--pc-gris-3)' }}>
            Sin factura XML. Puedes subirla aquí como "Factura" o cargarla en la sección Facturas.
          </div>
        )}
        {facturas.map((f) => (
          <div key={f.id} style={s.docFila}>
            <span style={{ ...s.docTipo, background:'var(--pc-aqua-bg)', color:'var(--pc-aqua)' }}>CFDI</span>
            <span style={s.docNombre} title={f.uuid_fiscal || ''}>
              {f.nombre_emisor || f.rfc_emisor} · {f.serie || ''}{f.folio || 'sin folio'}
            </span>
            <span style={s.docMeta}>
              {money(f.total)} · {fechaCorta(f.fecha_emision)} · {f.vinculacion === 'automatica' ? 'automática' : 'manual'}
            </span>
            <button style={s.btnChico} onClick={() => abrir(`/facturas/${f.id}/xml`)}>XML</button>
          </div>
        ))}
      </div>
    </>
  )
}
