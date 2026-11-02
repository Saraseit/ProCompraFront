import { precioUnitario, porcentaje, fechaCorta } from '../constants'
import { verPrecio } from './evaluacion'

const TONOS = {
  alto: { color: 'var(--pc-acento)', bg: 'var(--pc-acento-bg)', borde: 'var(--pc-acento-borde)' },
  bajo: { color: 'var(--pc-ambar-texto)', bg: 'var(--pc-ambar-bg)', borde: 'var(--pc-ambar-borde)' },
}

const ventana = (r) => `mediana de ${r.ventana_meses} meses, ${r.compras} compra${r.compras === 1 ? '' : 's'}`

// Bajo el campo de precio, en el formulario del requerimiento.
export function AvisoPrecio({ resultado }) {
  if (!resultado?.articulo) return null
  const a = resultado.articulo
  const enlace = (
    <button type="button" style={s.enlace} onClick={() => verPrecio(a.clave)}>Ver historial</button>
  )
  const reconocido = (
    <div style={s.reconocido}>
      {a.exacto ? 'Reconocido como ' : 'Parecido a '}<b>{a.nombre}</b>
      {resultado.unidad ? ` · ${resultado.unidad}` : ''}
    </div>
  )
  const tono = TONOS[resultado.nivel]
  let mensaje
  if (tono) {
    const barata = resultado.mas_barata
    mensaje = (
      <div style={{ ...s.caja, color: 'var(--pc-texto-suave)', background: tono.bg, borderColor: tono.borde }}>
        <b style={{ color: tono.color }}>
          {porcentaje(resultado.diferencia).replace('−', '')} {resultado.nivel === 'alto' ? 'arriba' : 'abajo'} de lo normal.
        </b>{' '}
        Referencia {precioUnitario(resultado.referencia)} ({ventana(resultado)})
        {barata && ` · el más barato fue ${barata.proveedor} a ${precioUnitario(barata.precio)} (${fechaCorta(barata.fecha)})`}
        {resultado.nivel === 'bajo' && '. Confirma la unidad y la cantidad'}. {enlace}
      </div>
    )
  } else if (resultado.nivel === 'normal') {
    mensaje = (
      <div style={s.suave}>
        Dentro de lo normal · referencia {precioUnitario(resultado.referencia)} ({ventana(resultado)}). {enlace}
      </div>
    )
  } else if (resultado.nivel === 'unidad_distinta') {
    mensaje = <div style={s.suave}>Se ha comprado por {resultado.unidad}: con otra unidad no se compara. {enlace}</div>
  } else if (resultado.nivel === 'sin_precio' && resultado.referencia) {
    mensaje = <div style={s.suave}>Se suele pagar {precioUnitario(resultado.referencia)} por {resultado.unidad}. {enlace}</div>
  } else {
    mensaje = <div style={s.suave}>Aún hay pocas compras para comparar. {enlace}</div>
  }
  return <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>{reconocido}{mensaje}</div>
}

// Etiqueta bajo el concepto de una partida en la orden.
export function ChipPrecio({ resultado }) {
  if (!resultado?.articulo) return null
  const tono = TONOS[resultado.nivel]
  if (tono) {
    return (
      <button type="button" style={{ ...s.chip, color: tono.color, background: tono.bg }}
        title={`${resultado.articulo.nombre}: ${ventana(resultado)}. Clic para ver el historial.`}
        onClick={() => verPrecio(resultado.articulo.clave)}>
        {porcentaje(resultado.diferencia)} vs {precioUnitario(resultado.referencia)}
        {resultado.nivel === 'bajo' ? ' · revisa unidad' : ''}
      </button>
    )
  }
  if (resultado.nivel === 'unidad_distinta') {
    return <span style={s.chipSuave}>Se compra por {resultado.unidad}</span>
  }
  if (resultado.nivel === 'sin_historial') {
    return <span style={s.chipSuave}>Sin historial suficiente</span>
  }
  return null
}

const s = {
  reconocido: { fontSize: 12, color: 'var(--pc-aqua)', background: 'var(--pc-aqua-bg)', borderRadius: 8, padding: '6px 10px' },
  caja: { fontSize: 12.5, lineHeight: 1.45, border: '1px solid', borderRadius: 8, padding: '8px 11px' },
  suave: { fontSize: 12, lineHeight: 1.45, color: 'var(--pc-gris-2)', padding: '0 2px' },
  enlace: { border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'var(--pc-aqua)', fontWeight: 600,
            cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 },
  chip: { display: 'inline-block', marginTop: 5, fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 6,
          padding: '2px 7px', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.5 },
  chipSuave: { display: 'block', marginTop: 4, fontSize: 11, color: 'var(--pc-gris-3)' },
}
