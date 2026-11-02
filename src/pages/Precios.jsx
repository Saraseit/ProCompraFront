import { useCallback, useEffect, useState } from 'react'
import { Search, TrendingUp, UploadCloud, Database } from 'lucide-react'
import api from '../api'
import { money, precioUnitario, fechaCorta, fechaMes, mensajeError } from '../constants'
import Vacio from '../ui/Vacio'
import { FilasCarga } from '../ui/Carga'
import Detalle from './precios/Detalle'
import Clasificar from './precios/Clasificar'
import Importar from './precios/Importar'
import { s as base } from './precios/estilos'

const FILTROS = [['todos', 'Todo'], ['insumos', 'Del catálogo'], ['sin_clasificar', 'Sin clasificar']]
const ORDENES = [['compras', 'Más comprados'], ['gastado', 'Más gasto'], ['reciente', 'Compra más reciente'], ['nombre', 'Nombre']]

export default function Precios({ claveInicial, onClaveAbierta }) {
  const [resumen, setResumen] = useState(null)
  const [error, setError] = useState('')
  const [pestana, setPestana] = useState('insumos')
  const [clave, setClave] = useState(claveInicial || null)

  const cargarResumen = useCallback(() => {
    api.get('/precios/resumen').then(({ data }) => { setResumen(data); setError('') })
      .catch((e) => setError(mensajeError(e)))
  }, [])

  useEffect(() => { cargarResumen() }, [cargarResumen])

  // Desde una orden o un requerimiento se puede abrir directo la ficha de un insumo.
  useEffect(() => {
    if (!claveInicial) return
    const t = setTimeout(() => { setClave(claveInicial); onClaveAbierta?.() }, 0)
    return () => clearTimeout(t)
  }, [claveInicial, onClaveAbierta])

  const abrir = (c) => { setClave(c); window.scrollTo({ top: 0 }) }

  if (error) return <div style={base.error}>Error al cargar precios: {error}</div>
  if (!resumen) return <div style={base.card}><table style={base.table}><tbody><FilasCarga columnas={5} filas={6} /></tbody></table></div>

  if (!resumen.disponible) {
    return (
      <Vacio icono={Database} titulo="El histórico de precios aún no está activo">
        Falta aplicar la migración de la base de datos (fase 5). En cuanto se aplique, esta pantalla queda lista para importar tus XML.
      </Vacio>
    )
  }

  if (clave) {
    return (
      <Detalle key={clave} clave={clave} puedeClasificar={resumen.puede_clasificar}
        onVolver={() => setClave(null)} onCambio={cargarResumen} onAbrir={abrir} />
    )
  }

  const pestanas = [
    ['insumos', 'Insumos'],
    ...(resumen.puede_clasificar ? [['clasificar', `Por clasificar · ${resumen.textos_por_clasificar.toLocaleString('es-MX')}`]] : []),
    ...(resumen.puede_clasificar ? [['importar', 'Importar histórico']] : []),
  ]
  const actual = pestanas.some(([k]) => k === pestana) ? pestana : 'insumos'
  const vacio = resumen.renglones === 0

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={base.h2}>Precios de insumos</h2>
        <p style={base.help}>
          Cuánto ha costado cada insumo con el tiempo, según los renglones de las facturas. Precios unitarios sin IVA.
        </p>
        {!vacio && (
          <div style={s.datos}>
            <span><b>{resumen.facturas.toLocaleString('es-MX')}</b> facturas</span>
            <span><b>{resumen.renglones.toLocaleString('es-MX')}</b> renglones</span>
            {resumen.desde && <span>{fechaMes(resumen.desde)} – {fechaMes(resumen.hasta)}</span>}
            <span><b>{resumen.insumos.toLocaleString('es-MX')}</b> insumos en el catálogo</span>
          </div>
        )}
      </div>

      <div style={{ ...base.filtros, marginBottom: 16 }} role="tablist" aria-label="Secciones">
        {pestanas.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={actual === k}
            style={{ ...base.filtro, ...(actual === k ? base.filtroActivo : {}) }} onClick={() => setPestana(k)}>
            {label}
          </button>
        ))}
      </div>

      {actual === 'insumos' && (vacio ? (
        <Vacio icono={UploadCloud} titulo="Aún no hay facturas con renglones"
          accion={resumen.puede_clasificar && <button style={base.btnPrimario} onClick={() => setPestana('importar')}>Importar XML anteriores</button>}>
          Importa los XML de tus compras anteriores para ver el histórico. Desde hoy, cada factura que se cargue en
          ProCompra también lo alimenta.
        </Vacio>
      ) : (
        <Lista onAbrir={abrir} />
      ))}
      {actual === 'clasificar' && (
        <Clasificar puedeClasificar={resumen.puede_clasificar} onCambio={cargarResumen} onAbrir={abrir} />
      )}
      {actual === 'importar' && (
        <Importar resumen={resumen} onCambio={cargarResumen} onIr={setPestana} />
      )}
    </div>
  )
}

function Lista({ onAbrir }) {
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState('todos')
  const [orden, setOrden] = useState('compras')
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  async function cargar(desde = 0) {
    setCargando(true)
    try {
      const { data } = await api.get('/precios/articulos', { params: { q, tipo, orden, offset: desde, limite: 50 } })
      setDatos((prev) => (desde && prev ? { ...data, articulos: [...prev.articulos, ...data.articulos] } : data))
      setError('')
    } catch (e) {
      setError(mensajeError(e))
    }
    setCargando(false)
  }

  useEffect(() => {
    const t = setTimeout(() => cargar(), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tipo, orden])

  return (
    <div>
      <div style={s.barra}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--pc-gris)' }} />
          <input style={{ ...base.input, paddingLeft: 32 }} placeholder="Buscar insumo, p. ej. tergal" value={q}
            onChange={(e) => setQ(e.target.value)} aria-label="Buscar insumo" />
        </div>
        <div style={base.filtros}>
          {FILTROS.map(([k, label]) => (
            <button key={k} style={{ ...base.filtro, ...(tipo === k ? base.filtroActivo : {}) }} onClick={() => setTipo(k)}>{label}</button>
          ))}
        </div>
        <select style={{ ...base.input, width: 'auto', minWidth: 180 }} value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar">
          {ORDENES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {error && <div style={{ ...base.error, marginBottom: 12 }}>{error}</div>}

      <div style={base.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ ...base.table, minWidth: 760, opacity: cargando && datos ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            <thead>
              <tr>
                <th style={base.th}>Insumo</th>
                <th style={base.thDer}>Compras</th>
                <th style={base.thDer}>Precio típico</th>
                <th style={base.thDer}>Último precio</th>
                <th style={base.thDer}>Gastado</th>
              </tr>
            </thead>
            <tbody>
              {!datos && <FilasCarga columnas={5} filas={6} />}
              {datos?.articulos.length === 0 && (
                <tr><td colSpan={5} style={{ ...base.td, textAlign: 'center', color: 'var(--pc-gris)', padding: 28 }}>
                  {q ? 'Nada coincide con la búsqueda.' : 'Sin resultados.'}
                </td></tr>
              )}
              {datos?.articulos.map((a) => (
                <tr key={a.clave} style={s.fila} onClick={() => onAbrir(a.clave)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(a.clave) }}>
                  <td style={base.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{a.nombre}</span>
                      {!a.insumo_id && <span style={base.chipAmbar}>sin clasificar</span>}
                    </div>
                    <div style={base.sub}>
                      {a.insumo_unidad || a.unidad || 'sin unidad'} · {a.proveedores === 1 ? a.ultimo_proveedor : `${a.proveedores} proveedores`}
                    </div>
                  </td>
                  <td style={base.tdDer}>{a.compras.toLocaleString('es-MX')}</td>
                  <td style={base.tdDer}>{precioUnitario(a.mediana)}</td>
                  <td style={base.tdDer}>
                    <div style={{ fontWeight: 600 }}>{precioUnitario(a.ultimo_precio)}</div>
                    <div style={base.sub}>{fechaCorta(a.ultima)}</div>
                  </td>
                  <td style={base.tdDer}>{money(Number(a.gastado))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {datos && datos.articulos.length < datos.total && (
        <div style={{ textAlign: 'center' }}>
          <button style={base.btnSecundario} disabled={cargando} onClick={() => cargar(datos.articulos.length)}>
            {cargando ? 'Cargando...' : `Ver más (${(datos.total - datos.articulos.length).toLocaleString('es-MX')} restantes)`}
          </button>
        </div>
      )}
      <p style={{ ...base.nota, display: 'flex', alignItems: 'center', gap: 6 }}>
        <TrendingUp size={13} /> «Precio típico» es la mediana de todas las compras. La referencia para los avisos (últimos 6 meses) está en la ficha de cada insumo.
      </p>
    </div>
  )
}

const s = {
  datos: { display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--pc-gris-2)', marginTop: 10 },
  barra: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 },
  fila: { cursor: 'pointer' },
}
