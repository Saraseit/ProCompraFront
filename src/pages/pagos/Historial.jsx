import { useState, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import api from '../../api'
import { etiquetaMetodo, money, fechaCorta, mensajeError, puedeBorrarTodo } from '../../constants'
import { useToast, useConfirm } from '../../ui/feedback-context'
import { CargaTabla } from '../../ui/Carga'
import { s } from './estilos'

export default function Historial({ usuario, onAbrirOrden, version, onCambio }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const toast = useToast()
  const confirmar = useConfirm()
  const admin = puedeBorrarTodo(usuario.rol)

  const cargar = useCallback(async () => {
    try {
      const res = await api.get('/pagos?limite=200')
      setDatos(res.data)
      setError('')
    } catch (e) {
      setError('No se pudo cargar el historial de pagos: ' + mensajeError(e))
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(cargar, 150)
    return () => clearTimeout(timer)
  }, [cargar, version])

  async function borrar(m) {
    const n = m.ordenes.length
    const ok = await confirmar({
      titulo: `Borrar el pago de ${money(m.monto)}`,
      mensaje: `Se quita de ${n === 1 ? 'la orden' : `las ${n} órdenes`} ${m.ordenes.map((o) => `#${o.folio}`).join(', ')} `
        + 'y su saldo vuelve a quedar pendiente. Una orden de contado que solo estaba pagada regresa a autorizada.',
      textoBoton: 'Borrar pago', peligro: true,
    })
    if (!ok) return
    try {
      await api.delete(`/pagos/${m.id}`)
      toast('Pago borrado')
      await cargar()
      onCambio?.()
    } catch (e) {
      toast('No se pudo borrar el pago: ' + mensajeError(e), 'error')
    }
  }

  if (error) return <div style={s.error}>{error}</div>
  if (!datos) return <CargaTabla filas={6} columnas={6} />

  const t = busqueda.trim().toLowerCase()
  const visibles = t
    ? datos.pagos.filter((m) =>
        (m.referencia || '').toLowerCase().includes(t) || (m.entregado_a || '').toLowerCase().includes(t) ||
        m.ordenes.some((o) => String(o.folio).includes(t) || (o.proveedor || '').toLowerCase().includes(t)))
    : datos.pagos

  return (
    <div>
      {!datos.agrupa && (
        <p style={s.nota}>
          Los pagos que cubren varias órdenes se verán como un solo renglón cuando se active la actualización
          de la base de datos de pagos; mientras, aparece un renglón por orden.
        </p>
      )}
      <input style={s.buscador} placeholder="Buscar por folio, proveedor, referencia o a quién se entregó..."
        value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      <div style={s.seccion}>
        <div style={s.tablaWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Fecha</th>
                <th style={s.th}>Forma</th>
                <th style={s.th}>Referencia</th>
                <th style={s.th}>Órdenes</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Monto</th>
                <th style={s.th}>Registró</th>
                {admin && <th style={s.th} aria-label="Acciones" />}
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr><td colSpan={admin ? 7 : 6} style={s.vacio}>
                  {t ? 'Ningún pago coincide con la búsqueda.' : 'Todavía no hay pagos registrados.'}
                </td></tr>
              )}
              {visibles.map((m) => (
                <tr key={m.id}>
                  <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{fechaCorta(m.fecha_pago)}</td>
                  <td style={s.td}>{etiquetaMetodo(m.metodo)}</td>
                  <td style={s.td}>
                    {m.referencia || '—'}
                    {m.entregado_a && <div style={s.sub}>entregado a {m.entregado_a}</div>}
                    {m.notas && <div style={s.sub}>{m.notas}</div>}
                  </td>
                  <td style={s.td}>
                    {m.ordenes.map((o) => (
                      <div key={o.pago_id} style={{ whiteSpace: 'nowrap' }}>
                        <button style={s.folio} onClick={() => onAbrirOrden(o.orden_id)}>#{o.folio}</button>
                        <span style={{ color: 'var(--pc-gris)' }}> {o.proveedor}</span>
                        {m.ordenes.length > 1 && <span style={{ color: 'var(--pc-gris-3)' }}> · {money(o.monto)}</span>}
                      </div>
                    ))}
                  </td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>{money(m.monto)}</td>
                  <td style={s.td}>{m.registrado || '—'}</td>
                  {admin && (
                    <td style={s.td}>
                      <button style={s.btnBorrar} onClick={() => borrar(m)}
                        title="Borrar este pago (solo admin)" aria-label={`Borrar el pago de ${money(m.monto)}`}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
