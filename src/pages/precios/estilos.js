import { C } from '../../ui/tema'

// Estilos compartidos por las pantallas de precios.
export const s = {
  h2: { fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--pc-tinta)', letterSpacing: '-0.022em' },
  h3: { fontSize: 14.5, fontWeight: 650, margin: 0, color: 'var(--pc-tinta)' },
  help: { fontSize: 13, color: 'var(--pc-gris)', marginTop: 4, maxWidth: 680, lineHeight: 1.45 },
  nota: { fontSize: 12, color: 'var(--pc-gris)', margin: '10px 0 0', lineHeight: 1.45 },
  sub: { fontSize: 11.5, color: 'var(--pc-gris)', fontWeight: 400 },
  error: { padding: 20, background: 'var(--pc-rojo-bg)', color: 'var(--pc-rojo)', borderRadius: 8 },
  volver: { display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: 'var(--pc-gris-2)',
            fontSize: 13, fontWeight: 550, cursor: 'pointer', padding: '4px 0', marginBottom: 10 },
  card: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 12,
          boxShadow: 'var(--pc-sombra-1)', marginBottom: 14, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { textAlign: 'left', padding: '10px 14px', background: 'var(--pc-superficie-3)', color: 'var(--pc-gris-2)', fontWeight: 600,
        fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--pc-borde)',
        position: 'sticky', top: 0, zIndex: 1 },
  td: { padding: '10px 14px', borderBottom: '1px solid var(--pc-linea)', verticalAlign: 'top' },
  input: { width: '100%', border: '1px solid var(--pc-borde)', borderRadius: 8, padding: '9px 11px', fontSize: 14,
           boxSizing: 'border-box', background: 'var(--pc-superficie)', color: 'var(--pc-tinta)', minHeight: 40 },
  chip: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--pc-superficie-3)',
          color: 'var(--pc-gris-2)', whiteSpace: 'nowrap' },
  chipAmbar: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--pc-ambar-bg)',
               color: 'var(--pc-ambar-texto)', whiteSpace: 'nowrap' },
  filtros: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  filtro: { border: '1px solid var(--pc-borde)', background: 'var(--pc-superficie)', color: 'var(--pc-gris-2)', padding: '7px 13px',
            borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', minHeight: 36 },
  filtroActivo: { borderColor: C.aqua, background: C.aquaBg, color: C.aqua, fontWeight: 600 },
  segmento: { display: 'inline-flex', background: 'var(--pc-superficie-3)', borderRadius: 9, padding: 3, gap: 2 },
  segBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: 'var(--pc-gris-2)',
            fontSize: 12.5, fontWeight: 550, padding: '6px 10px', borderRadius: 7, cursor: 'pointer' },
  segActivo: { background: 'var(--pc-superficie)', color: 'var(--pc-tinta)', boxShadow: 'var(--pc-sombra-1)' },
  btnPrimario: { background: 'var(--pc-btn)', color: 'var(--pc-btn-texto)', border: 'none', padding: '10px 16px', borderRadius: 9,
                 fontSize: 13.5, fontWeight: 600, cursor: 'pointer', minHeight: 40 },
  btnSecundario: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--pc-superficie)', color: 'var(--pc-tinta)',
                   border: '1px solid var(--pc-borde)', padding: '8px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                   cursor: 'pointer', minHeight: 38 },
  btnAqua: { display: 'inline-flex', alignItems: 'center', gap: 6, background: C.aquaBg, color: C.aqua, border: `1px solid ${C.aqua}`,
             padding: '8px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 38 },
  btnTexto: { background: 'none', border: 'none', color: 'var(--pc-gris-2)', fontSize: 13, cursor: 'pointer', padding: '8px 8px',
              textDecoration: 'underline', textUnderlineOffset: 2, minHeight: 38 },
  iconoBtn: { border: 'none', background: 'none', color: 'var(--pc-gris)', cursor: 'pointer', width: 28, height: 28,
              borderRadius: 6, display: 'inline-grid', placeItems: 'center', flex: 'none' },
}
s.thDer = { ...s.th, textAlign: 'right' }
s.tdDer = { ...s.td, textAlign: 'right' }

// Nombre legible para un insumo nuevo a partir de la descripción de la factura.
export const nombreSugerido = (texto = '') => {
  const limpio = texto.replace(/\s+/g, ' ').trim().slice(0, 120)
  return limpio === limpio.toUpperCase() || limpio === limpio.toLowerCase()
    ? limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase()
    : limpio
}
