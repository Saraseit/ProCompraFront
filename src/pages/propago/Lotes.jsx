import { useCallback, useEffect, useState } from 'react'
import { Download, CheckCircle2 } from 'lucide-react'
import api from '../../api'
import { money, fechaCorta, mensajeError } from '../../constants'
import { useToast, useConfirm } from '../../ui/feedback-context'
import { CargaTarjetas } from '../../ui/Carga'
import Vacio from '../../ui/Vacio'
import { descargar, refrescarProPago } from './comun'
import { s } from '../pagos/estilos'

const ESTADO_LOTE = {
  generado:   ['Descargado', 'var(--pc-ambar-texto)', 'var(--pc-ambar-bg)'],
  registrado: ['Subido al ERP', 'var(--pc-verde)', 'var(--pc-verde-bg)'],
  anulado:    ['Anulado', 'var(--pc-gris-2)', 'var(--pc-superficie-3)'],
}

// Cada descarga es un lote. Se vuelve a bajar igual (misma fecha), se marca
// cuando ya se subió al ERP, o se anula si el ERP lo rechazó.
export function Lotes({ onCambio }) {
  const [lotes, setLotes] = useState(null)
  const toast = useToast()
  const confirmar = useConfirm()

  const cargar = useCallback(async () => {
    try {
      setLotes((await api.get('/propago/lotes')).data)
    } catch (e) {
      toast('No se pudieron cargar los lotes: ' + mensajeError(e), 'error')
      setLotes([])
    }
  }, [toast])

  useEffect(() => {
    const t = setTimeout(cargar, 0)
    return () => clearTimeout(t)
  }, [cargar])

  async function accion(lote, tipo) {
    if (tipo === 'anular' && !await confirmar({
      titulo: 'Anular el lote',
      mensaje: 'Úsalo si el ERP rechazó el archivo. Sus renglones vuelven a «Por exportar»; las pólizas conservan su número.',
      textoBoton: 'Anular', peligro: true,
    })) return
    try {
      await api.post(`/propago/lotes/${lote.id}/${tipo}`)
      toast(tipo === 'anular' ? 'Lote anulado: sus renglones están otra vez por exportar' : 'Lote marcado como subido al ERP')
      await cargar()
      refrescarProPago()
      onCambio?.()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  async function bajar(lote) {
    try {
      await descargar(api.get(`/propago/lotes/${lote.id}/excel`, { responseType: 'blob' }), `registros_erp_${lote.fecha}.xlsx`)
    } catch (e) {
      toast('No se pudo descargar: ' + mensajeError(e), 'error')
    }
  }

  if (lotes === null) return <CargaTarjetas n={2} alto={80} minimo={200} />
  if (!lotes.length) return <Vacio icono={Download} titulo="Sin descargas todavía">Cada Excel que descargues queda aquí.</Vacio>

  return (
    <div style={s.seccion}>
      <div style={s.tablaWrap}>
        <table style={{ ...s.table, minWidth: 720 }}>
          <thead>
            <tr>
              <th style={s.th}>Fecha del archivo</th>
              <th style={s.th}>Descargó</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Renglones</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Total</th>
              <th style={s.th}>Estado</th>
              <th style={s.th} />
            </tr>
          </thead>
          <tbody>
            {lotes.map((l) => {
              const [texto, color, bg] = ESTADO_LOTE[l.estado] || ESTADO_LOTE.generado
              return (
                <tr key={l.id}>
                  <td style={s.td}>{fechaCorta(l.fecha)}<div style={s.sub}>{new Date(l.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div></td>
                  <td style={s.td}>{l.generado?.nombre || '—'}</td>
                  <td style={{ ...s.td, textAlign: 'right' }}>{l.num_renglones}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>{money(Number(l.total))}</td>
                  <td style={s.td}><span style={{ ...s.chip, color, background: bg }}>{texto}</span></td>
                  <td style={{ ...s.td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {l.estado !== 'anulado' && (
                      <button style={{ ...s.btnGhost, padding: '6px 10px', marginRight: 6 }} onClick={() => bajar(l)}>
                        <Download size={13} /> Bajar
                      </button>
                    )}
                    {l.estado === 'generado' && (<>
                      <button style={{ ...s.btnGhost, padding: '6px 10px', marginRight: 6 }} onClick={() => accion(l, 'registrado')}>
                        Ya lo subí
                      </button>
                      <button style={{ ...s.btnGhost, padding: '6px 10px', color: 'var(--pc-rojo)' }} onClick={() => accion(l, 'anular')}>
                        Anular
                      </button>
                    </>)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const ACCION = { eliminar: 'Eliminar del ERP', modificar: 'Modificar en el ERP' }

// Correcciones a renglones ya subidos: el ERP no acepta cargos negativos,
// así que se hacen a mano allá y aquí se marcan como hechas.
export function Ajustes({ onCambio }) {
  const [vista, setVista] = useState('pendiente')
  const [ajustes, setAjustes] = useState(null)
  const toast = useToast()

  const cargar = useCallback(async () => {
    try {
      setAjustes((await api.get('/propago/ajustes', { params: { estado: vista } })).data)
    } catch (e) {
      toast('No se pudieron cargar los ajustes: ' + mensajeError(e), 'error')
      setAjustes([])
    }
  }, [vista, toast])

  useEffect(() => {
    const t = setTimeout(cargar, 0)
    return () => clearTimeout(t)
  }, [cargar])

  async function aplicado(a) {
    try {
      await api.post(`/propago/ajustes/${a.id}/aplicado`)
      toast('Ajuste marcado como hecho en el ERP')
      await cargar()
      refrescarProPago()
      onCambio?.()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  const fila = (x) => x && (
    <div style={{ fontFamily: 'var(--pc-mono)', fontSize: 11.5, overflowWrap: 'anywhere' }}>
      {money(Number(x.cargo))} · {x.cuenta_nombre_erp} · ID {x.id_evento || 0}
      <div>{x.ref}</div>
    </div>
  )

  return (
    <div>
      <div style={{ ...s.vistas, marginBottom: 12 }} role="tablist" aria-label="Estado">
        {[['pendiente', 'Pendientes'], ['aplicado', 'Hechos']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={vista === k} style={vista === k ? s.vistaActiva : s.vista}
            onClick={() => { setVista(k); setAjustes(null) }}>{label}</button>
        ))}
      </div>
      {ajustes === null && <CargaTarjetas n={2} alto={80} minimo={200} />}
      {ajustes?.length === 0 && (
        <Vacio icono={CheckCircle2} titulo={vista === 'pendiente' ? 'Nada que corregir en el ERP' : 'Sin ajustes hechos'}>
          Si corriges o borras un pago ya exportado, aquí queda lo que hay que cambiar en el ERP.
        </Vacio>
      )}
      {ajustes?.map((a) => (
        <div key={a.id} style={{ ...s.seccion, padding: '13px 16px', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ flex: 1 }}>{ACCION[a.accion]}</b>
            <span style={s.sub}>{fechaCorta(a.created_at)} · {a.creado?.nombre || '—'}{a.lote?.fecha ? ` · lote del ${fechaCorta(a.lote.fecha)}` : ''}</span>
            {a.estado === 'pendiente' && <button style={s.btnGhost} onClick={() => aplicado(a)}>Ya lo hice en el ERP</button>}
          </div>
          {a.motivo && <div style={{ fontSize: 13, color: 'var(--pc-gris-2)' }}>{a.motivo}</div>}
          <div style={s.grid2}>
            <div><div style={s.sub}>Como está en el ERP</div>{fila(a.antes)}</div>
            {a.despues && <div><div style={s.sub}>Como debe quedar</div>{fila(a.despues)}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
