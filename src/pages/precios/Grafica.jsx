import { useEffect, useMemo, useRef, useState } from 'react'
import { precioUnitario, fechaCorta } from '../../constants'

const ALTO = 300
const M = { arriba: 16, derecha: 18, abajo: 30, izquierda: 64 }
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const tiempo = (f) => new Date(String(f).length > 10 ? f : `${f}T12:00:00`).getTime()

function marcasY(min, max) {
  const paso0 = (max - min) / 4 || 1
  const potencia = 10 ** Math.floor(Math.log10(paso0))
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= paso0)
  const marcas = []
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) marcas.push(Math.round(v * 1e4) / 1e4)
  return marcas
}

function marcasX(desde, hasta) {
  const meses = (hasta - desde) / (30.44 * 864e5)
  const cada = meses <= 8 ? 1 : meses <= 18 ? 2 : meses <= 36 ? 3 : meses <= 72 ? 6 : 12
  const d = new Date(desde)
  d.setDate(1); d.setHours(12, 0, 0, 0)
  d.setMonth(Math.ceil(d.getMonth() / cada) * cada)
  const marcas = []
  while (d.getTime() <= hasta) {
    if (d.getTime() >= desde) {
      const anio = cada === 12 || d.getMonth() === 0 || !marcas.length
      marcas.push({ t: d.getTime(), texto: cada === 12 ? String(d.getFullYear()) : `${MESES[d.getMonth()]}${anio ? ` ${String(d.getFullYear()).slice(2)}` : ''}` })
    }
    d.setMonth(d.getMonth() + cada)
  }
  return marcas
}

// Precio en el tiempo: compras facturadas (puntos y su mediana mensual),
// precios cotizados en órdenes (rombos huecos) y la franja de lo normal
// alrededor de la referencia. Solo se dibuja la unidad comparable.
export default function Grafica({ facturado, cotizado, referencia, umbral, unidad }) {
  const caja = useRef(null)
  const [ancho, setAncho] = useState(720)
  const [activo, setActivo] = useState(null)

  useEffect(() => {
    if (!caja.current) return
    const obs = new ResizeObserver(([e]) => setAncho(Math.max(300, Math.round(e.contentRect.width))))
    obs.observe(caja.current)
    return () => obs.disconnect()
  }, [])

  const datos = useMemo(() => {
    const fac = facturado.filter((p) => p.comparable && p.fecha).map((p) => ({ ...p, t: tiempo(p.fecha), serie: 'facturado' }))
    const cot = cotizado.filter((p) => p.comparable && p.fecha).map((p) => ({ ...p, t: tiempo(p.fecha), serie: 'cotizado' }))
    const todos = [...fac, ...cot]
    if (!todos.length) return null
    const precios = todos.map((p) => p.precio)
    if (referencia) precios.push(referencia * (1 + umbral.alto), referencia * (1 + umbral.bajo))
    let min = Math.min(...precios), max = Math.max(...precios)
    const holgura = (max - min) * 0.12 || max * 0.1 || 1
    min = Math.max(0, min - holgura); max += holgura
    let desde = Math.min(...todos.map((p) => p.t)), hasta = Math.max(...todos.map((p) => p.t))
    if (hasta - desde < 20 * 864e5) { desde -= 15 * 864e5; hasta += 15 * 864e5 }
    // Mediana mensual de lo facturado: la línea que se lee de un vistazo.
    const porMes = {}
    fac.forEach((p) => { const k = String(p.fecha).slice(0, 7); (porMes[k] ||= []).push(p.precio) })
    const linea = Object.entries(porMes).sort().map(([mes, v]) => {
      v.sort((a, b) => a - b)
      const m = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2
      return { t: tiempo(`${mes}-15`), precio: m }
    })
    return { fac, cot, todos, min, max, desde, hasta, linea }
  }, [facturado, cotizado, referencia, umbral])

  if (!datos) {
    return <div ref={caja} style={s.vacio}>Sin compras en {unidad || 'la unidad principal'} para graficar.</div>
  }

  const w = ancho - M.izquierda - M.derecha
  const h = ALTO - M.arriba - M.abajo
  const x = (t) => M.izquierda + ((t - datos.desde) / (datos.hasta - datos.desde || 1)) * w
  const y = (v) => M.arriba + (1 - (v - datos.min) / (datos.max - datos.min || 1)) * h
  const ys = marcasY(datos.min, datos.max)
  const xs = marcasX(datos.desde, datos.hasta)
  const corto = (v) => (v >= 1000 ? `$${(v / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })}k` : `$${v.toLocaleString('es-MX', { maximumFractionDigits: v < 10 ? 2 : 0 })}`)

  // El puntero no tiene que atinarle al punto: se elige el más cercano.
  const mover = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * ancho
    const py = ((e.clientY - r.top) / r.height) * ALTO
    let mejor = null, distancia = Infinity
    datos.todos.forEach((p) => {
      const d = (x(p.t) - px) ** 2 + (y(p.precio) - py) ** 2
      if (d < distancia) { distancia = d; mejor = p }
    })
    setActivo(distancia < 60 ** 2 ? mejor : null)
  }

  const fueraDeRango = (p) => referencia && (p.precio >= referencia * (1 + umbral.alto) || p.precio <= referencia * (1 + umbral.bajo))

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <div style={s.leyenda} aria-hidden>
        <span style={s.clave}><svg width="22" height="10"><line x1="1" y1="5" x2="21" y2="5" stroke="var(--pc-serie-facturado)" strokeWidth="2" /><circle cx="11" cy="5" r="3.5" fill="var(--pc-serie-facturado)" /></svg>Facturado</span>
        <span style={s.clave}><svg width="14" height="12"><path d="M7 1.5 12.5 6 7 10.5 1.5 6Z" fill="var(--pc-superficie)" stroke="var(--pc-serie-cotizado)" strokeWidth="2" /></svg>Cotizado en órdenes</span>
        {referencia && <span style={s.clave}><svg width="22" height="10"><line x1="1" y1="5" x2="21" y2="5" stroke="var(--pc-gris-2)" strokeWidth="1.2" strokeDasharray="4 4" /></svg>Referencia {precioUnitario(referencia)}</span>}
        {referencia && <span style={s.clave}><span style={s.franja} />Lo normal (±{Math.round(umbral.alto * 100)}%)</span>}
      </div>
      <svg width="100%" viewBox={`0 0 ${ancho} ${ALTO}`} style={{ display: 'block', touchAction: 'none' }}
        role="img" aria-label={`Precio por ${unidad || 'unidad'} en el tiempo: ${datos.fac.length} compras facturadas y ${datos.cot.length} cotizaciones`}
        onPointerMove={mover} onPointerLeave={() => setActivo(null)}>
        {ys.map((v) => (
          <g key={v}>
            <line x1={M.izquierda} x2={ancho - M.derecha} y1={y(v)} y2={y(v)} stroke="var(--pc-linea)" />
            <text x={M.izquierda - 8} y={y(v) + 4} textAnchor="end" style={s.eje}>{corto(v)}</text>
          </g>
        ))}
        {xs.map((m) => (
          <text key={m.t} x={x(m.t)} y={ALTO - 8} textAnchor="middle" style={s.eje}>{m.texto}</text>
        ))}

        {referencia && (
          <g>
            <rect x={M.izquierda} width={w} y={y(referencia * (1 + umbral.alto))}
              height={y(referencia * (1 + umbral.bajo)) - y(referencia * (1 + umbral.alto))}
              fill="var(--pc-serie-facturado)" opacity="0.08" />
            <line x1={M.izquierda} x2={ancho - M.derecha} y1={y(referencia)} y2={y(referencia)}
              stroke="var(--pc-gris-2)" strokeDasharray="4 4" strokeWidth="1.2" />
          </g>
        )}

        {datos.linea.length > 1 && (
          <polyline fill="none" stroke="var(--pc-serie-facturado)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
            points={datos.linea.map((p) => `${x(p.t)},${y(p.precio)}`).join(' ')} />
        )}
        {datos.fac.map((p, i) => (
          <circle key={`f${i}`} cx={x(p.t)} cy={y(p.precio)} r={activo === p ? 6 : 4.5}
            fill="var(--pc-serie-facturado)" stroke="var(--pc-superficie)" strokeWidth="2" />
        ))}
        {datos.cot.map((p, i) => {
          const cx = x(p.t), cy = y(p.precio), r = activo === p ? 7 : 5.5
          return (
            <path key={`c${i}`} d={`M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy}Z`}
              fill="var(--pc-superficie)" stroke="var(--pc-serie-cotizado)" strokeWidth="2" />
          )
        })}
        {activo && (
          <line x1={x(activo.t)} x2={x(activo.t)} y1={M.arriba} y2={ALTO - M.abajo} stroke="var(--pc-gris-3)" strokeWidth="1" />
        )}
      </svg>

      {activo && (
        <div style={{ ...s.tooltip,
          left: Math.max(0, Math.min(x(activo.t) + 14, ancho - 224)),
          top: Math.max(24, y(activo.precio) - 10) }}>
          <div style={s.ttValor}>{precioUnitario(activo.precio)} <span style={s.ttUnidad}>por {activo.unidad || unidad}</span></div>
          <div style={s.ttLinea}>
            <span style={{ ...s.ttClave, background: activo.serie === 'facturado' ? 'var(--pc-serie-facturado)' : 'var(--pc-serie-cotizado)' }} />
            {activo.serie === 'facturado' ? 'Facturado' : `Cotizado · orden #${activo.folio}`}
          </div>
          <div style={s.ttDato}>{activo.proveedor || 'Sin proveedor'}</div>
          <div style={s.ttDato}>{fechaCorta(activo.fecha)} · {Number(activo.cantidad).toLocaleString('es-MX')} {activo.unidad || ''}</div>
          {fueraDeRango(activo) && (
            <div style={{ ...s.ttDato, color: 'var(--pc-tinta)', fontWeight: 600 }}>
              Fuera de lo normal ({activo.precio > referencia ? '+' : '−'}{Math.abs(Math.round((activo.precio / referencia - 1) * 100))}%)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  vacio: { padding: '40px 16px', textAlign: 'center', color: 'var(--pc-gris)', fontSize: 13.5 },
  leyenda: { display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--pc-gris-2)', marginBottom: 6 },
  clave: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  franja: { width: 18, height: 10, borderRadius: 3, background: 'var(--pc-serie-facturado)', opacity: 0.18 },
  eje: { fontSize: 11, fill: 'var(--pc-gris)', fontFamily: 'inherit' },
  tooltip: { position: 'absolute', width: 220, pointerEvents: 'none', background: 'var(--pc-superficie)',
             border: '1px solid var(--pc-borde)', borderRadius: 10, padding: '10px 12px', boxShadow: 'var(--pc-sombra-2)',
             fontSize: 12, zIndex: 2 },
  ttValor: { fontSize: 15, fontWeight: 700, color: 'var(--pc-tinta)' },
  ttUnidad: { fontSize: 11.5, fontWeight: 500, color: 'var(--pc-gris)' },
  ttLinea: { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--pc-gris-2)', marginTop: 4 },
  ttClave: { width: 12, height: 2.5, borderRadius: 2 },
  ttDato: { color: 'var(--pc-gris-2)', marginTop: 2 },
}
