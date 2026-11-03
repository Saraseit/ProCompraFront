import { C } from '../../ui/tema'

// Cómo está cada orden por pagar.
export const SITUACION = {
  vencida:    { label: 'Vencida',      color: 'var(--pc-rojo)',        bg: 'var(--pc-rojo-bg)' },
  por_vencer: { label: 'Por vencer',   color: 'var(--pc-ambar-texto)', bg: 'var(--pc-ambar-bg)' },
  vigente:    { label: 'Al corriente', color: 'var(--pc-verde)',       bg: 'var(--pc-verde-bg)' },
  sin_fecha:  { label: 'Sin fecha',    color: 'var(--pc-gris-2)',      bg: 'var(--pc-superficie-3)' },
  contado:    { label: 'Por pagar',    color: C.aqua,                  bg: C.aquaBg },
}

export function cuandoVence(r) {
  if (r.tipo === 'contado') return 'antes de comprar'
  if (r.dias == null) return null
  if (r.dias === 0) return 'vence hoy'
  if (r.dias < 0) return `hace ${-r.dias} día${r.dias === -1 ? '' : 's'}`
  return `en ${r.dias} día${r.dias === 1 ? '' : 's'}`
}

export const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, gap: 16, flexWrap: 'wrap' },
  h2: { fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--pc-tinta)', letterSpacing: '-0.022em' },
  help: { fontSize: 13, color: 'var(--pc-gris)', marginTop: 4, maxWidth: 560 },
  error: { padding: 20, background: 'var(--pc-rojo-bg)', color: 'var(--pc-rojo)', borderRadius: 8 },
  vistas: { display: 'inline-flex', background: 'var(--pc-superficie-3)', borderRadius: 9, padding: 3, gap: 2 },
  vista: { border: 'none', background: 'none', padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600,
           color: 'var(--pc-gris-2)', cursor: 'pointer', font: 'inherit' },
  vistaActiva: { border: 'none', background: 'var(--pc-superficie)', padding: '7px 14px', borderRadius: 7, fontSize: 13,
                 fontWeight: 600, color: 'var(--pc-tinta)', cursor: 'pointer', boxShadow: 'var(--pc-sombra-1)', font: 'inherit' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 },
  kpi: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 12, padding: 18, boxShadow: 'var(--pc-sombra-1)' },
  kpiV: { fontSize: 24, fontWeight: 700, color: 'var(--pc-tinta)', lineHeight: 1.1 },
  kpiT: { fontSize: 13.5, fontWeight: 600, color: 'var(--pc-tinta)', marginTop: 8 },
  kpiL: { fontSize: 12, color: 'var(--pc-gris)', marginTop: 3 },
  buscador: { width: '100%', boxSizing: 'border-box', border: '1px solid var(--pc-borde)', borderRadius: 10,
              padding: '10px 12px', fontSize: 14, background: 'var(--pc-superficie)', color: 'var(--pc-tinta)',
              marginBottom: 14, font: 'inherit' },
  seccion: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 12,
             overflow: 'hidden', marginBottom: 16 },
  seccionHead: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '13px 16px',
                 borderBottom: '1px solid var(--pc-borde)' },
  seccionTitulo: { fontWeight: 650, fontSize: 15, color: 'var(--pc-tinta)' },
  seccionSub: { fontSize: 12.5, color: 'var(--pc-gris)' },
  tablaWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 },
  th: { textAlign: 'left', padding: '9px 12px', background: 'var(--pc-superficie-3)', color: 'var(--pc-gris-2)',
        fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' },
  td: { padding: '9px 12px', borderBottom: '1px solid var(--pc-linea)', verticalAlign: 'top' },
  sub: { fontSize: 11, color: 'var(--pc-gris-3)', marginTop: 2 },
  vacio: { padding: '22px 16px', color: 'var(--pc-gris)', fontSize: 13.5, textAlign: 'center' },
  folio: { border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: C.aqua,
           cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 },
  chip: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', display: 'inline-block' },
  tipo: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
          border: '1px solid var(--pc-borde)', color: 'var(--pc-gris-2)', display: 'inline-block' },
  barra: { position: 'sticky', bottom: 12, zIndex: 5, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
           padding: '12px 14px', borderRadius: 12, background: 'var(--pc-superficie)', border: `1px solid ${C.aqua}`,
           boxShadow: 'var(--pc-sombra-3)', marginTop: 8 },
  btnPrimary: { background: 'var(--pc-btn)', color: 'var(--pc-btn-texto)', border: 'none', padding: '10px 16px',
                borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', padding: '9px 14px',
              borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--pc-tinta)' },
  enlace: { border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 11.5, fontWeight: 600,
            color: C.aqua, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, marginTop: 3 },
  btnBorrar: { background: 'none', border: '1px solid var(--pc-borde)', padding: '5px 8px', borderRadius: 7,
               cursor: 'pointer', color: 'var(--pc-rojo)', display: 'inline-grid', placeItems: 'center' },
  nota: { fontSize: 12.5, color: 'var(--pc-gris)', margin: '0 0 12px' },
  aviso: { background: 'var(--pc-ambar-bg)', border: '1px solid var(--pc-ambar-borde)', color: 'var(--pc-ambar-texto)',
           padding: '10px 13px', borderRadius: 10, fontSize: 13, lineHeight: 1.45, marginBottom: 12 },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid var(--pc-borde)', borderRadius: 8,
           padding: '9px 11px', fontSize: 14, background: 'var(--pc-superficie)', color: 'var(--pc-tinta)', font: 'inherit' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 },
}
