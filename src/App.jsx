import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, ClipboardList, ShoppingCart, Building2, Receipt, Wallet,
  BarChart3, Users, LogOut, Menu,
} from 'lucide-react'
import { supabase } from './supabaseClient'
import api from './api'
import Login from './Login'
import Inicio from './pages/Inicio'
import Requerimientos from './pages/Requerimientos'
import Ordenes from './pages/Ordenes'
import Control from './pages/Control'
import Proveedores from './pages/Proveedores'
import Usuarios from './pages/Usuarios'
import Facturas from './pages/Facturas'
import Credito from './pages/Credito'
import { veFacturas, etiquetaRol } from './constants'
import BotonTema from './ui/BotonTema'
import { PantallaCarga } from './ui/Carga'

const veControl = (rol) => ['admin', 'compras', 'pagos'].includes(rol)

// La pestaña vive en el hash (#ordenes) para que recargar o volver atrás la respete.
const leerHash = () => decodeURIComponent(window.location.hash.replace(/^#/, '')) || 'inicio'

const iniciales = (nombre = '') =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'

function App() {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState(leerHash)
  const [filtroOrdenes, setFiltroOrdenes] = useState('')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [conteos, setConteos] = useState({ reqs: 0, autorizacion: 0, facturas: 0, credito: 0 })

  // El perfil cargado solo cuenta si pertenece a la sesión vigente.
  const usuario = session && perfil?.id === session.user.id ? perfil : null

  const irA = (destino, filtro = '') => {
    setFiltroOrdenes(filtro)
    setTab(destino)
    setMenuAbierto(false)
    if (leerHash() !== destino) window.history.pushState(null, '', `#${destino}`)
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    const alCambiar = () => { setFiltroOrdenes(''); setTab(leerHash()) }
    window.addEventListener('popstate', alCambiar)
    return () => window.removeEventListener('popstate', alCambiar)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setCargando(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase
      .from('usuarios')
      .select('id, nombre, correo, rol, activo')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => { if (data) setPerfil(data) })
  }, [session])

  // Contadores de los badges del nav; cada consulta falla por separado sin romper la otra.
  const refrescarConteos = useCallback(() => {
    Promise.allSettled([
      api.get('/requerimientos?estado=pendiente'),
      api.get('/reportes/dashboard'),
    ]).then(([reqs, dash]) => {
      setConteos((c) => ({
        reqs: reqs.status === 'fulfilled' ? reqs.value.data.length : c.reqs,
        autorizacion: dash.status === 'fulfilled' ? dash.value.data.en_autorizacion || 0 : c.autorizacion,
        facturas: dash.status === 'fulfilled' ? dash.value.data.facturas_pendientes || 0 : c.facturas,
        credito: dash.status === 'fulfilled' ? dash.value.data.credito_ordenes_vencidas || 0 : c.credito,
      }))
    })
  }, [])

  const hayUsuario = !!usuario
  useEffect(() => {
    if (hayUsuario) refrescarConteos()
  }, [hayUsuario, tab, refrescarConteos])

  if (cargando) return <PantallaCarga />
  if (!session) return <Login />
  if (!usuario) return <PantallaCarga texto="Cargando tu perfil..." />

  const rol = usuario.rol
  const secciones = [
    [null, [
      ['inicio', 'Inicio', LayoutDashboard],
    ]],
    ['Operación', [
      ['requerimientos', 'Requerimientos', ClipboardList, conteos.reqs, 'requerimientos pendientes'],
      ['ordenes', 'Órdenes de compra', ShoppingCart, conteos.autorizacion, 'órdenes en autorización'],
      ['proveedores', 'Proveedores', Building2],
    ]],
    ['Finanzas', [
      ...(veFacturas(rol) ? [['facturas', 'Facturas', Receipt, conteos.facturas, 'facturas sin vincular']] : []),
      ...(veFacturas(rol) ? [['credito', 'Crédito', Wallet, conteos.credito, 'órdenes a crédito vencidas']] : []),
      ...(veControl(rol) ? [['control', 'Control de gastos', BarChart3]] : []),
    ]],
    ['Administración', [
      ...(rol === 'admin' ? [['usuarios', 'Usuarios', Users]] : []),
    ]],
  ].filter(([, items]) => items.length)

  const disponibles = secciones.flatMap(([, items]) => items.map(([k]) => k))
  const actual = disponibles.includes(tab) ? tab : 'inicio'
  const tituloActual = secciones.flatMap(([, items]) => items).find(([k]) => k === actual)?.[1]

  return (
    <div className="pc-shell" data-menu={menuAbierto ? 'abierto' : 'cerrado'}>
      <aside className="pc-lateral" aria-label="Navegación principal">
        <div className="pc-marca">
          <div className="pc-marca-logo">M4</div>
          <div>
            <div className="pc-marca-nombre">ProCompra</div>
            <div className="pc-marca-sub">MINIMAL 4.0</div>
          </div>
        </div>

        <nav className="pc-nav">
          {secciones.map(([titulo, items]) => (
            <div key={titulo || 'principal'}>
              {titulo && <div className="pc-nav-seccion">{titulo}</div>}
              {items.map(([k, label, Icono, cuenta, descripcion]) => (
                <button key={k} className="pc-nav-item" onClick={() => irA(k)}
                  aria-current={actual === k ? 'page' : undefined}>
                  <Icono size={17} strokeWidth={1.9} />
                  <span>{label}</span>
                  {cuenta > 0 && (
                    <span className="pc-nav-badge" title={`${cuenta} ${descripcion}`}>
                      {cuenta > 99 ? '99+' : cuenta}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="pc-usuario">
          <div className="pc-avatar" aria-hidden>{iniciales(usuario.nombre)}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="pc-usuario-nombre" title={usuario.nombre}>{usuario.nombre}</div>
            <div className="pc-usuario-rol">{etiquetaRol(rol)}</div>
          </div>
          <BotonTema />
          <button className="pc-icono-btn" onClick={() => supabase.auth.signOut()}
            title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <div className="pc-velo-menu" onClick={() => setMenuAbierto(false)} />

      <div className="pc-principal">
        <header className="pc-barra-movil">
          <button className="pc-icono-btn" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">
            <Menu size={17} />
          </button>
          <span style={{ fontWeight: 650, fontSize: 15 }}>{tituloActual}</span>
        </header>

        <main className="pc-contenido">
          <div key={actual} className="pc-pagina">
            {actual === 'inicio' && <Inicio usuario={usuario} onIr={irA} />}
            {actual === 'requerimientos' && (
              <Requerimientos
                usuario={usuario}
                onCambio={refrescarConteos}
                onOrdenCreada={() => irA('ordenes', 'borrador')}
              />
            )}
            {actual === 'ordenes' && (
              <Ordenes usuario={usuario} filtroInicial={filtroOrdenes} onCambio={refrescarConteos} />
            )}
            {actual === 'proveedores' && <Proveedores usuario={usuario} />}
            {actual === 'facturas' && <Facturas onCambio={refrescarConteos} />}
            {actual === 'credito' && <Credito usuario={usuario} onCambio={refrescarConteos} />}
            {actual === 'control' && <Control />}
            {actual === 'usuarios' && <Usuarios usuario={usuario} />}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
