import { useEffect, useState } from 'react'
import { Search, Sparkles, Undo2 } from 'lucide-react'
import api from '../../api'
import { precioUnitario, fechaCorta, mensajeError } from '../../constants'
import { useToast } from '../../ui/feedback-context'
import Vacio from '../../ui/Vacio'
import { CargaTarjetas } from '../../ui/Carga'
import { ModalAsignar } from './Modales'
import { s as base } from './estilos'

const POR_PAGINA = 30

// Textos de factura que aún no pertenecen a ningún insumo, de los más
// comprados a los menos. Clasificar uno enseña a ProCompra a reconocerlo.
export default function Clasificar({ puedeClasificar, onCambio, onAbrir }) {
  const [q, setQ] = useState('')
  const [datos, setDatos] = useState(null)
  const [mas, setMas] = useState(false)
  const [modal, setModal] = useState(null)
  const [ocupado, setOcupado] = useState(null)
  const [verIgnorados, setVerIgnorados] = useState(false)
  const [ignorados, setIgnorados] = useState(null)
  const toast = useToast()

  async function cargar(desde = 0) {
    const { data } = await api.get('/precios/por-clasificar', { params: { q, offset: desde, limite: POR_PAGINA } })
    setDatos((prev) => (desde && prev ? { ...data, grupos: [...prev.grupos, ...data.grupos] } : data))
  }

  useEffect(() => {
    const t = setTimeout(() => { cargar().catch((e) => toast('Error: ' + mensajeError(e), 'error')) }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const quitar = (texto) => setDatos((d) => d && ({ ...d, total: d.total - 1, grupos: d.grupos.filter((g) => g.texto_norm !== texto) }))

  async function clasificar(g, cuerpo, mensaje) {
    setOcupado(g.texto_norm)
    try {
      await api.post('/precios/clasificar', { textos: [g.texto_norm], ...cuerpo })
      toast(mensaje)
      quitar(g.texto_norm)
      onCambio()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
    setOcupado(null)
  }

  async function abrirIgnorados() {
    setVerIgnorados((v) => !v)
    if (ignorados === null) {
      try { setIgnorados((await api.get('/precios/ignorados')).data) } catch { setIgnorados([]) }
    }
  }

  async function regresar(texto) {
    try {
      await api.post('/precios/clasificar', { textos: [texto] })
      setIgnorados((l) => l.filter((t) => t !== texto))
      toast('Regresado a «Por clasificar»')
      onCambio()
      await cargar()
    } catch (e) {
      toast('Error: ' + mensajeError(e), 'error')
    }
  }

  async function verMas() {
    setMas(true)
    try { await cargar(datos.grupos.length) } catch (e) { toast('Error: ' + mensajeError(e), 'error') }
    setMas(false)
  }

  return (
    <div>
      <p style={{ ...base.help, marginTop: 0, marginBottom: 12 }}>
        Cada proveedor escribe distinto: aquí se juntan los textos iguales. Al clasificar un texto, sus compras se suman
        al insumo y las facturas futuras con ese texto se reconocen solas. «No es insumo» sirve para fletes, servicios o
        maniobras: quedan fuera del histórico.
      </p>

      <div style={{ position: 'relative', maxWidth: 420, marginBottom: 12 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--pc-gris)' }} />
        <input style={{ ...base.input, paddingLeft: 32 }} placeholder="Buscar texto" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {datos === null && <CargaTarjetas n={4} minimo={600} alto={92} />}
      {datos && datos.grupos.length === 0 && (
        <Vacio icono={Sparkles} titulo={q ? 'Ningún texto coincide' : 'Todo está clasificado'}>
          {q ? 'Prueba con otra palabra.' : 'Cuando lleguen facturas con textos nuevos aparecerán aquí.'}
        </Vacio>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {datos?.grupos.map((g) => {
          const sug = g.sugerencias[0]
          const espera = ocupado === g.texto_norm
          return (
            <article key={g.clave} style={{ ...s.grupo, opacity: espera ? 0.5 : 1 }}>
              <div style={{ minWidth: 0 }}>
                <button style={s.texto} onClick={() => onAbrir(g.clave)} title="Ver historial de este texto">{g.texto_norm}</button>
                <div style={s.meta}>
                  {g.compras} compra{g.compras === 1 ? '' : 's'} · {g.proveedores === 1 ? g.ultimo_proveedor : `${g.proveedores} proveedores`}
                  {' · '}{g.unidad || 'sin unidad'} · último {precioUnitario(g.ultimo_precio)} ({fechaCorta(g.ultima)})
                </div>
                {g.parecidos > 0 && <div style={{ ...s.meta, color: 'var(--pc-aqua)' }}>y {g.parecidos} texto{g.parecidos === 1 ? '' : 's'} parecido{g.parecidos === 1 ? '' : 's'} sin clasificar</div>}
              </div>
              {puedeClasificar && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {sug && (
                    <div style={{ fontSize: 12.5, color: 'var(--pc-texto-suave)' }}>
                      ¿Es <b>{sug.nombre}</b>? <span style={base.sub}>({Math.round(sug.parecido * 100)}% parecido)</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {sug && (
                      <button style={base.btnPrimario} disabled={espera}
                        onClick={() => clasificar(g, { insumo_id: sug.insumo_id }, `Agregado a «${sug.nombre}»`)}>
                        Sí, es ese
                      </button>
                    )}
                    <button style={base.btnSecundario} disabled={espera}
                      onClick={() => setModal({ grupo: g, modo: 'existente', sugerido: sug ? { id: sug.insumo_id, nombre: sug.nombre } : null })}>
                      {sug ? 'Elegir otro' : 'Elegir insumo'}
                    </button>
                    <button style={base.btnAqua} disabled={espera} onClick={() => setModal({ grupo: g, modo: 'nuevo' })}>Insumo nuevo</button>
                    <button style={base.btnTexto} disabled={espera}
                      onClick={() => clasificar(g, { ignorar: true }, 'Marcado como «no es insumo»')}>
                      No es insumo
                    </button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {datos && datos.grupos.length < datos.total && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button style={base.btnSecundario} disabled={mas} onClick={verMas}>
            {mas ? 'Cargando...' : `Ver más (${datos.total - datos.grupos.length} restantes)`}
          </button>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <button style={base.btnTexto} onClick={abrirIgnorados} aria-expanded={verIgnorados}>
          {verIgnorados ? 'Ocultar' : 'Ver'} textos marcados como «no es insumo»
        </button>
        {verIgnorados && (
          <div style={{ display: 'grid', gap: 4, marginTop: 6, maxWidth: 640 }}>
            {ignorados === null && <div style={base.sub}>Cargando...</div>}
            {ignorados?.length === 0 && <div style={base.sub}>Ninguno.</div>}
            {ignorados?.map((t) => (
              <div key={t} style={s.ignorado}>
                <span style={{ fontFamily: 'var(--pc-mono)', fontSize: 12, flex: 1, overflowWrap: 'anywhere' }}>{t}</span>
                {puedeClasificar && (
                  <button style={base.btnTexto} onClick={() => regresar(t)}><Undo2 size={13} /> Regresar</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <ModalAsignar grupo={modal.grupo} modo={modal.modo} sugerido={modal.sugerido} onClose={() => setModal(null)}
          onListo={() => { setModal(null); onCambio(); cargar() }} />
      )}
    </div>
  )
}

const s = {
  grupo: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 12, padding: '14px 16px',
           display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, alignItems: 'center',
           boxShadow: 'var(--pc-sombra-1)', transition: 'opacity 0.15s' },
  texto: { fontFamily: 'var(--pc-mono)', fontSize: 13, fontWeight: 500, overflowWrap: 'anywhere', textAlign: 'left', border: 'none',
           background: 'none', padding: 0, color: 'var(--pc-tinta)', cursor: 'pointer', textDecoration: 'underline',
           textDecorationColor: 'var(--pc-borde)', textUnderlineOffset: 3 },
  meta: { fontSize: 12, color: 'var(--pc-gris-2)', marginTop: 4, lineHeight: 1.45 },
  ignorado: { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px', background: 'var(--pc-superficie-3)', borderRadius: 8 },
}
