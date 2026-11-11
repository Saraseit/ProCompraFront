import { useState } from 'react'
import { refrescarProPago, useProPago } from './propago/comun'
import Registros from './propago/Registros'
import { Lotes, Ajustes } from './propago/Lotes'
import Catalogo from './propago/Catalogo'
import Cajas from './propago/Cajas'
import { CargaTarjetas } from '../ui/Carga'
import { s } from './pagos/estilos'

// ProPago: los registros que cada pago genera para el ERP, su descarga en
// Excel, las correcciones pendientes en el ERP y el catálogo que los arma.
export default function ProPago({ usuario }) {
  const estado = useProPago()
  const [vista, setVista] = useState('registros')
  const esAdmin = usuario.rol === 'admin'

  const encabezado = (
    <div style={s.header}>
      <div>
        <h2 style={s.h2}>Registros ERP</h2>
        <p style={s.help}>
          Cada pago registrado desde una caja arma aquí sus renglones para el ERP con las reglas del catálogo.
          Revísalos, elige los pagos y descarga el Excel para subirlo.
        </p>
      </div>
    </div>
  )

  if (!estado) return <div>{encabezado}<CargaTarjetas n={3} alto={100} minimo={300} /></div>
  if (!estado.disponible) {
    return (
      <div>
        {encabezado}
        <div style={s.aviso}>
          Falta aplicar la migración <b>2026-11-11_fase8_propago.sql</b> en Supabase. Mientras tanto los pagos se registran como antes,
          sin caja ni registros para el ERP.
        </div>
      </div>
    )
  }

  const pestanas = [
    ['registros', 'Registros'],
    ['lotes', 'Descargas'],
    ['ajustes', `Ajustes ERP${estado.ajustes_pendientes ? ` (${estado.ajustes_pendientes})` : ''}`],
    ['catalogo', 'Catálogo contable'],
    ...(esAdmin ? [['cajas', 'Cajas']] : []),
  ]
  const alCambiar = () => refrescarProPago()

  return (
    <div>
      {encabezado}
      {estado.catalogo_vacio && vista !== 'catalogo' && (
        <div style={s.aviso}>
          El catálogo contable está vacío: carga el inicial en <b>Catálogo contable</b> para que los pagos tengan cuenta.
        </div>
      )}
      {!estado.cajas.length && vista !== 'cajas' && (
        <div style={s.aviso}>
          {esAdmin ? <>No hay cajas. Da de alta las cuentas, tarjetas y cajas chicas en <b>Cajas</b>; mientras no haya, los pagos se registran como antes.</>
            : 'No tienes cajas asignadas. Pide a un admin que te asigne las cajas que manejas.'}
        </div>
      )}
      <div style={{ ...s.vistas, marginBottom: 14, flexWrap: 'wrap' }} role="tablist" aria-label="Sección">
        {pestanas.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={vista === k} style={vista === k ? s.vistaActiva : s.vista} onClick={() => setVista(k)}>
            {label}
          </button>
        ))}
      </div>
      {vista === 'registros' && <Registros estado={estado} usuario={usuario} onCambio={alCambiar} />}
      {vista === 'lotes' && <Lotes onCambio={alCambiar} />}
      {vista === 'ajustes' && <Ajustes onCambio={alCambiar} />}
      {vista === 'catalogo' && <Catalogo estado={estado} onCambio={alCambiar} />}
      {vista === 'cajas' && esAdmin && <Cajas />}
    </div>
  )
}
