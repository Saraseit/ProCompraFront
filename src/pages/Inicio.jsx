import { useState, useEffect } from 'react'
import api from '../api'
import { money, mensajeError } from '../constants'

const nombreMes = (iso) => {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

export default function Inicio({ usuario, onIr }) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/reportes/dashboard')
        setDatos(res.data)
      } catch (e) {
        setError('No se pudo cargar el resumen: ' + mensajeError(e))
      }
      setCargando(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  if (error) return <div style={s.error}>{error}</div>

  const mes = datos ? nombreMes(datos.mes) : ''
  const tarjetas = [
    {
      valor: datos?.en_autorizacion,
      titulo: 'Órdenes en autorización',
      pie: 'Esperan visto bueno del área de pagos',
      ir: () => onIr('ordenes', 'autorizacion'),
    },
    {
      valor: datos?.pagadas_mes,
      titulo: 'Órdenes pagadas',
      pie: `Con pago registrado en ${mes}`,
      ir: () => onIr('ordenes', 'pagada'),
    },
    ...(datos?.incluye_montos ? [{
      valor: money(datos?.gasto_mes),
      titulo: 'Gasto del mes',
      pie: `Pagos realizados en ${mes}`,
      ir: () => onIr('control'),
    }] : []),
    {
      valor: datos?.por_recolectar,
      titulo: 'Órdenes por recolectar',
      pie: 'Pagadas y pendientes de recibir',
      ir: () => onIr('ordenes', 'recoleccion'),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={s.h2}>Hola, {usuario.nombre}</h2>
        <p style={s.help}>Resumen de {mes || 'este mes'}. Toca una tarjeta para ver el detalle.</p>
      </div>

      <div style={s.kpis}>
        {tarjetas.map((t) => (
          <button key={t.titulo} style={s.kpi} onClick={t.ir}>
            <div style={s.kpiV}>{cargando ? '—' : (t.valor ?? 0)}</div>
            <div style={s.kpiT}>{t.titulo}</div>
            <div style={s.kpiL}>{t.pie}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

const s = {
  h2: { fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--pc-tinta)' },
  help: { fontSize: 13, color: 'var(--pc-gris)', marginTop: 4 },
  error: { padding: 20, background: 'var(--pc-rojo-bg)', color: 'var(--pc-rojo)', borderRadius: 8 },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 },
  kpi: { textAlign: 'left', background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 12,
         padding: 20, cursor: 'pointer', font: 'inherit', color: 'inherit' },
  kpiV: { fontSize: 28, fontWeight: 700, color: 'var(--pc-tinta)', lineHeight: 1.1 },
  kpiT: { fontSize: 13.5, fontWeight: 600, color: 'var(--pc-tinta)', marginTop: 8 },
  kpiL: { fontSize: 12, color: 'var(--pc-gris)', marginTop: 3 },
}
