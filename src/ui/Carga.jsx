// Estados de carga: esqueletos con brillo en lugar de "Cargando..." en texto.

export function Esqueleto({ ancho = '100%', alto = 12, radio = 6, style }) {
  return <div className="pc-esqueleto" style={{ width: ancho, height: alto, borderRadius: radio, ...style }} />
}

export function PantallaCarga({ texto = 'Cargando...' }) {
  return (
    <div style={s.pantalla}>
      <div className="pc-marca-logo" style={{ width: 44, height: 44, borderRadius: 12, fontSize: 15 }}>M4</div>
      <div style={s.barra}><div className="pc-esqueleto" style={{ height: '100%', borderRadius: 3 }} /></div>
      <div style={{ fontSize: 13, color: 'var(--pc-gris)' }}>{texto}</div>
    </div>
  )
}

// Encabezado de página + tabla simulada.
export function CargaTabla({ filas = 6, columnas = 5 }) {
  return (
    <div style={s.tarjeta} aria-busy="true" aria-label="Cargando">
      <div style={{ ...s.fila, background: 'var(--pc-superficie-3)' }}>
        {Array.from({ length: columnas }, (_, i) => <Esqueleto key={i} alto={9} ancho={`${50 + (i % 3) * 15}%`} />)}
      </div>
      {Array.from({ length: filas }, (_, f) => (
        <div key={f} style={s.fila}>
          {Array.from({ length: columnas }, (_, i) => (
            <Esqueleto key={i} alto={11} ancho={`${45 + ((f + i) % 4) * 13}%`} />
          ))}
        </div>
      ))}
    </div>
  )
}

// Filas simuladas para el <tbody> de una tabla que ya tiene encabezado.
export function FilasCarga({ filas = 5, columnas = 5 }) {
  return Array.from({ length: filas }, (_, f) => (
    <tr key={f} aria-hidden>
      {Array.from({ length: columnas }, (_, i) => (
        <td key={i} style={{ padding: '14px 14px', borderBottom: '1px solid var(--pc-linea)' }}>
          <Esqueleto alto={11} ancho={`${45 + ((f + i) % 4) * 13}%`} />
        </td>
      ))}
    </tr>
  ))
}

export function CargaTarjetas({ n = 6, minimo = 240, alto = 132 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minimo}px, 1fr))`, gap: 14 }}
      aria-busy="true" aria-label="Cargando">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ ...s.tarjeta, padding: 18, height: alto, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Esqueleto ancho="35%" alto={10} />
          <Esqueleto ancho="70%" alto={14} />
          <Esqueleto ancho="50%" alto={10} />
          <Esqueleto ancho="40%" alto={18} style={{ marginTop: 'auto' }} />
        </div>
      ))}
    </div>
  )
}

const s = {
  pantalla: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 16, background: 'var(--pc-fondo)' },
  barra: { width: 120, height: 4, borderRadius: 3, overflow: 'hidden' },
  tarjeta: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 12,
             overflow: 'hidden', boxShadow: 'var(--pc-sombra-1)' },
  fila: { display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '1fr', gap: 18, padding: '14px 16px',
          borderBottom: '1px solid var(--pc-linea)', alignItems: 'center' },
}
