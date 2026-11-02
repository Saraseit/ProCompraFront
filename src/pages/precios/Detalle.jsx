import { useEffect, useState } from 'react'
import { ArrowLeft, Pencil, Table2, LineChart, X } from 'lucide-react'
import api from '../../api'
import { precioUnitario, porcentaje, fechaCorta, mensajeError } from '../../constants'
import { useToast, useConfirm } from '../../ui/feedback-context'
import { CargaTarjetas } from '../../ui/Carga'
import Grafica from './Grafica'
import { ModalAsignar, ModalEditarInsumo } from './Modales'
import { s as base } from './estilos'

export default function Detalle({ clave, puedeClasificar, onVolver, onCambio, onAbrir }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [vista, setVista] = useState('grafica')
  const [modal, setModal] = useState(null)
  const toast = useToast()
  const confirmar = useConfirm()

  async function cargar() {
    try {
      const { data } = await api.get('/precios/articulo', { params: { clave } })
      setDatos(data)
      setError('')
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  useEffect(() => {
    const t = setTimeout(cargar, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  async function quitarTexto(texto) {
    const ok = await confirmar({
      titulo: 'Quitar este texto del insumo',
      mensaje: `«${texto}» volverá a «Por clasificar» con todas sus compras.`,
      textoBoton: 'Quitar',
    })
    if (!ok) return
    try {
      await api.post('/precios/clasificar', { textos: [texto] })
      toast('Texto regresado a «Por clasificar»')
      onCambio()
      await cargar()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  if (error) {
    return (
      <div>
        <button style={base.volver} onClick={onVolver}><ArrowLeft size={15} /> Precios de insumos</button>
        <div style={base.error}>{error}</div>
      </div>
    )
  }
  if (!datos) {
    return (
      <div>
        <button style={base.volver} onClick={onVolver}><ArrowLeft size={15} /> Precios de insumos</button>
        <CargaTarjetas n={4} minimo={200} alto={86} />
      </div>
    )
  }

  const { articulo: a, stats: st, facturado, cotizado, umbral } = datos
  const unidad = st.unidad || 'unidad'
  const compras = [...facturado].reverse()
  const enOtraUnidad = facturado.filter((p) => !p.comparable).length

  return (
    <div>
      <button style={base.volver} onClick={onVolver}><ArrowLeft size={15} /> Precios de insumos</button>

      <div style={s.cabeza}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={base.h2}>{a.nombre}</h2>
            {!a.insumo_id && <span style={base.chipAmbar}>Sin clasificar</span>}
          </div>
          <p style={base.help}>
            Precio por {unidad}, sin IVA · {st.compras} compra{st.compras === 1 ? '' : 's'} facturada{st.compras === 1 ? '' : 's'}
            {a.clave_sat ? ` · clave SAT ${a.clave_sat}` : ''}
          </p>
        </div>
        {puedeClasificar && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {a.insumo_id ? (
              <button style={base.btnSecundario} onClick={() => setModal({ tipo: 'editar' })}>
                <Pencil size={14} /> Editar insumo
              </button>
            ) : (
              <>
                <button style={base.btnSecundario} onClick={() => setModal({ tipo: 'asignar', modo: 'existente' })}>Es un insumo que ya existe</button>
                <button style={base.btnAqua} onClick={() => setModal({ tipo: 'asignar', modo: 'nuevo' })}>Crear insumo</button>
              </>
            )}
          </div>
        )}
      </div>

      <div style={s.kpis}>
        <Kpi titulo="Precio de referencia" valor={st.referencia ? precioUnitario(st.referencia) : '—'}
          nota={st.referencia ? `Mediana de ${st.ventana_meses} meses · ${st.compras_ventana} compras`
            : `Hacen falta ${3} compras en 12 meses`} destacado />
        <Kpi titulo="Última compra" valor={st.ultima ? precioUnitario(st.ultima.precio) : '—'}
          nota={st.ultima ? `${st.ultima.proveedor || '—'} · ${fechaCorta(st.ultima.fecha)}` : ''} />
        <Kpi titulo="Mínimo y máximo · 12 meses"
          valor={st.minimo_12m != null ? `${precioUnitario(st.minimo_12m)} – ${precioUnitario(st.maximo_12m)}` : '—'}
          nota={st.mas_barata ? `Más barato: ${st.mas_barata.proveedor || '—'}` : 'Sin compras en el último año'} />
        <Kpi titulo="Cambio en un año" valor={st.cambio_anual != null ? porcentaje(st.cambio_anual) : '—'}
          nota={st.cambio_anual != null ? 'Últimos 3 meses contra hace un año' : 'Sin compras de hace un año para comparar'} />
      </div>

      <section style={base.card}>
        <div style={s.cardCabeza}>
          <h3 style={base.h3}>Precio en el tiempo</h3>
          <div style={base.segmento} role="tablist" aria-label="Vista">
            <button role="tab" aria-selected={vista === 'grafica'} style={{ ...base.segBtn, ...(vista === 'grafica' ? base.segActivo : {}) }}
              onClick={() => setVista('grafica')}><LineChart size={14} /> Gráfica</button>
            <button role="tab" aria-selected={vista === 'tabla'} style={{ ...base.segBtn, ...(vista === 'tabla' ? base.segActivo : {}) }}
              onClick={() => setVista('tabla')}><Table2 size={14} /> Tabla por mes</button>
          </div>
        </div>
        <div style={{ padding: '4px 16px 16px' }}>
          {vista === 'grafica' ? (
            <Grafica facturado={facturado} cotizado={cotizado} referencia={st.referencia} umbral={umbral} unidad={st.unidad} />
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 320 }}>
              <table style={base.table}>
                <thead><tr><th style={base.th}>Mes</th><th style={base.thDer}>Mediana facturada</th><th style={base.thDer}>Compras</th></tr></thead>
                <tbody>
                  {[...st.por_mes].reverse().map((m) => (
                    <tr key={m.mes}><td style={base.td}>{fechaMesLargo(m.mes)}</td>
                      <td style={base.tdDer}>{precioUnitario(m.mediana)}</td><td style={base.tdDer}>{m.compras}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {enOtraUnidad > 0 && (
            <p style={base.nota}>
              {enOtraUnidad} compra{enOtraUnidad === 1 ? '' : 's'} en otra unidad no se grafica{enOtraUnidad === 1 ? '' : 'n'} ni cuenta{enOtraUnidad === 1 ? '' : 'n'} para la referencia (aparecen abajo).
            </p>
          )}
        </div>
      </section>

      <div style={s.columnas}>
        <section style={base.card}>
          <div style={s.cardCabeza}><h3 style={base.h3}>Por proveedor</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={base.table}>
              <thead><tr><th style={base.th}>Proveedor</th><th style={base.thDer}>Mediana</th><th style={base.thDer}>Último</th><th style={base.thDer}>Compras</th></tr></thead>
              <tbody>
                {st.por_proveedor.map((p, i) => (
                  <tr key={p.proveedor}>
                    <td style={base.td}>
                      <div style={{ fontWeight: 550 }}>{p.proveedor}</div>
                      <div style={base.sub}>Última: {fechaCorta(p.ultima_fecha)}</div>
                    </td>
                    <td style={{ ...base.tdDer, fontWeight: 600 }}>
                      {precioUnitario(p.mediana)}
                      {i === 0 && st.por_proveedor.length > 1 && <div style={{ ...base.sub, color: 'var(--pc-aqua)' }}>el más barato</div>}
                    </td>
                    <td style={base.tdDer}>{precioUnitario(p.ultimo)}</td>
                    <td style={base.tdDer}>{p.compras}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={base.card}>
          <div style={s.cardCabeza}>
            <h3 style={base.h3}>Cómo lo escriben los proveedores</h3>
          </div>
          <div style={{ padding: '4px 16px 14px', display: 'grid', gap: 6 }}>
            {a.textos.map((t) => (
              <div key={t.texto_norm} style={s.texto}>
                <span style={{ fontFamily: 'var(--pc-mono)', fontSize: 12, overflowWrap: 'anywhere', flex: 1 }}>{t.texto_norm}</span>
                <span style={base.sub}>{t.compras} compra{t.compras === 1 ? '' : 's'}</span>
                {a.insumo_id && puedeClasificar && (
                  <button style={base.iconoBtn} title="Quitar del insumo" aria-label={`Quitar ${t.texto_norm}`}
                    onClick={() => quitarTexto(t.texto_norm)}><X size={13} /></button>
                )}
              </div>
            ))}
            {a.insumo_id && (
              <p style={{ ...base.nota, margin: '4px 0 0' }}>Las facturas nuevas con cualquiera de estos textos se suman solas a este insumo.</p>
            )}
          </div>
        </section>
      </div>

      <section style={base.card}>
        <div style={s.cardCabeza}><h3 style={base.h3}>Compras facturadas</h3><span style={base.sub}>{compras.length}</span></div>
        <div style={{ overflowX: 'auto', maxHeight: 460 }}>
          <table style={{ ...base.table, minWidth: 720 }}>
            <thead>
              <tr>
                <th style={base.th}>Fecha</th><th style={base.th}>Proveedor</th><th style={base.th}>Descripción en la factura</th>
                <th style={base.thDer}>Cantidad</th><th style={base.thDer}>P. unit.</th><th style={base.th}>Factura</th>
              </tr>
            </thead>
            <tbody>
              {compras.slice(0, 300).map((p, i) => {
                const dif = st.referencia && p.comparable ? p.precio / st.referencia - 1 : null
                const fuera = dif != null && (dif >= umbral.alto || dif <= umbral.bajo)
                return (
                  <tr key={i}>
                    <td style={{ ...base.td, whiteSpace: 'nowrap' }}>{fechaCorta(p.fecha)}</td>
                    <td style={base.td}>{p.proveedor || '—'}</td>
                    <td style={{ ...base.td, fontSize: 12.5, color: 'var(--pc-gris-2)' }}>{p.descripcion}</td>
                    <td style={{ ...base.tdDer, whiteSpace: 'nowrap' }}>
                      {Number(p.cantidad).toLocaleString('es-MX')} {p.unidad}
                      {!p.comparable && <div style={{ ...base.sub, color: 'var(--pc-ambar-texto)' }}>otra unidad</div>}
                    </td>
                    <td style={{ ...base.tdDer, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {precioUnitario(p.precio)}
                      {fuera && <div style={{ ...base.sub, color: dif > 0 ? 'var(--pc-acento)' : 'var(--pc-ambar-texto)' }}>{porcentaje(dif)}</div>}
                    </td>
                    <td style={{ ...base.td, fontSize: 12 }}>
                      <span style={{ fontFamily: 'var(--pc-mono)' }}>{p.factura || '—'}</span>
                      {p.orden_folio && <div style={base.sub}>Orden #{p.orden_folio}</div>}
                      {p.historica && <div style={base.sub}>histórica</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {cotizado.length > 0 && (
        <section style={base.card}>
          <div style={s.cardCabeza}><h3 style={base.h3}>Cotizado en órdenes de compra</h3><span style={base.sub}>{cotizado.length}</span></div>
          <div style={{ overflowX: 'auto', maxHeight: 320 }}>
            <table style={base.table}>
              <thead><tr><th style={base.th}>Fecha</th><th style={base.th}>Orden</th><th style={base.th}>Proveedor</th><th style={base.thDer}>P. unit.</th></tr></thead>
              <tbody>
                {[...cotizado].reverse().map((c, i) => (
                  <tr key={i}>
                    <td style={base.td}>{fechaCorta(c.fecha)}</td>
                    <td style={base.td}>#{c.folio} <span style={base.sub}>{c.concepto}</span></td>
                    <td style={base.td}>{c.proveedor || '—'}</td>
                    <td style={{ ...base.tdDer, fontWeight: 600 }}>{precioUnitario(c.precio)} <span style={base.sub}>{c.unidad}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modal?.tipo === 'asignar' && (
        <ModalAsignar grupo={{ texto_norm: a.texto_norm, descripcion: a.nombre, unidad: st.unidad, compras: st.compras }}
          modo={modal.modo} onClose={() => setModal(null)}
          onListo={(insumo) => { setModal(null); onCambio(); onAbrir(insumo.id) }} />
      )}
      {modal?.tipo === 'editar' && (
        <ModalEditarInsumo insumo={{ id: a.insumo_id, nombre: a.nombre, unidad: a.unidad, clave_sat: a.clave_sat, notas: a.notas }}
          onClose={() => setModal(null)}
          onListo={(destino) => { setModal(null); onCambio(); if (destino) onAbrir(destino); else cargar() }}
          onBorrado={() => { setModal(null); onCambio(); onVolver() }} />
      )}
    </div>
  )
}

const fechaMesLargo = (mes) =>
  new Date(`${mes}-15T12:00:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

function Kpi({ titulo, valor, nota, destacado }) {
  return (
    <div style={{ ...s.kpi, ...(destacado ? s.kpiDestacado : {}) }}>
      <div style={s.kpiTitulo}>{titulo}</div>
      <div style={s.kpiValor}>{valor}</div>
      {nota && <div style={s.kpiNota}>{nota}</div>}
    </div>
  )
}

const s = {
  cabeza: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 14 },
  kpi: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 12, padding: '13px 15px', boxShadow: 'var(--pc-sombra-1)' },
  kpiDestacado: { borderColor: 'var(--pc-aqua)', background: 'var(--pc-aqua-bg)' },
  kpiTitulo: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--pc-gris-2)' },
  kpiValor: { fontSize: 21, fontWeight: 700, color: 'var(--pc-tinta)', marginTop: 4, letterSpacing: '-0.01em' },
  kpiNota: { fontSize: 12, color: 'var(--pc-gris-2)', marginTop: 3 },
  cardCabeza: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 16px', flexWrap: 'wrap' },
  columnas: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 },
  texto: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--pc-superficie-3)', borderRadius: 8 },
}
