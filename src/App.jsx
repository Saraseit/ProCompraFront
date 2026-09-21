import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import api from './api'
import Login from './Login'
import Inicio from './pages/Inicio'
import Requerimientos from './pages/Requerimientos'
import Ordenes from './pages/Ordenes'
import Control from './pages/Control'
import Proveedores from './pages/Proveedores'
import Usuarios from './pages/Usuarios'
import { C } from './ui/tema'
import BotonTema from './ui/BotonTema'

function App() {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState('inicio')
  const [filtroOrdenes, setFiltroOrdenes] = useState('')
  const [conteos, setConteos] = useState({ reqs: 0, autorizacion: 0 })

  // El perfil cargado solo cuenta si pertenece a la sesión vigente.
  const usuario = session && perfil?.id === session.user.id ? perfil : null

  const irA = (destino, filtro = '') => {
    setFiltroOrdenes(filtro)
    setTab(destino)
  }

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
      }))
    })
  }, [])

  const hayUsuario = !!usuario
  useEffect(() => {
    if (hayUsuario) refrescarConteos()
  }, [hayUsuario, tab, refrescarConteos])

  if (cargando) return <div style={{ padding: 40 }}>Cargando...</div>
  if (!session) return <Login />
  if (!usuario) return <div style={{ padding: 40 }}>Cargando perfil...</div>

  const pestanas = [
    ['inicio', 'Inicio'],
    ['requerimientos', 'Requerimientos', conteos.reqs, 'requerimientos pendientes'],
    ['ordenes', 'Órdenes de compra', conteos.autorizacion, 'órdenes en autorización'],
    ['proveedores', 'Proveedores'],
    ...(['admin','compras','pagos'].includes(usuario.rol) ? [['control','Control de gastos']] : []),
    ...(usuario.rol === 'admin' ? [['usuarios','Usuarios']] : []),
  ]

  return (
    <div style={{ minHeight:'100vh', background:C.fondo, fontFamily:"'Inter', system-ui, sans-serif" }}>

      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                       padding:'18px 32px', background:'var(--pc-superficie)', borderBottom:`1px solid ${C.borde}` }}>
        <div>
          <span style={{ fontSize:22, fontWeight:700, color:C.tinta }}>MINIMAL 4.0</span>
          <span style={{ fontSize:13, color:C.gris, marginLeft:10 }}>ProCompra</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontSize:13, color:C.gris }}>{usuario.nombre} · {usuario.rol}</span>
          <BotonTema />
          <button onClick={() => supabase.auth.signOut()}
            style={{ background:'none', border:`1px solid ${C.borde}`, padding:'7px 14px',
                     borderRadius:8, fontSize:13, cursor:'pointer' }}>
            Salir
          </button>
        </div>
      </header>

      <nav style={{ display:'flex', gap:4, padding:'0 32px', background:'var(--pc-superficie)',
                    borderBottom:`1px solid ${C.borde}`, overflowX:'auto' }}>
        {pestanas.map(([k, label, cuenta, descripcion]) => (
          <button key={k} onClick={() => irA(k)}
            style={{ border:'none', background:'none', padding:'14px 16px', fontWeight:500,
                     fontSize:14, cursor:'pointer', color: tab === k ? C.tinta : C.gris,
                     borderBottom: tab === k ? `2px solid ${C.acento}` : '2px solid transparent',
                     marginBottom: -1, display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap' }}>
            {label}
            {cuenta > 0 && (
              <span title={`${cuenta} ${descripcion}`} style={s.badge}>
                {cuenta > 99 ? '99+' : cuenta}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main style={{ padding:'26px 32px', maxWidth:1180, margin:'0 auto' }}>
        {tab === 'inicio' && <Inicio usuario={usuario} onIr={irA} />}
        {tab === 'requerimientos' && (
          <Requerimientos
            usuario={usuario}
            onCambio={refrescarConteos}
            onOrdenCreada={() => irA('ordenes', 'borrador')}
          />
        )}
        {tab === 'ordenes' && (
          <Ordenes usuario={usuario} filtroInicial={filtroOrdenes} onCambio={refrescarConteos} />
        )}
        {tab === 'proveedores' && <Proveedores usuario={usuario} />}
        {tab === 'control' && ['admin','compras','pagos'].includes(usuario.rol) && <Control />}
        {tab === 'usuarios' && usuario.rol === 'admin' && <Usuarios usuario={usuario} />}
      </main>

    </div>
  )
}

const s = {
  badge: { minWidth:20, height:20, padding:'0 6px', borderRadius:10, boxSizing:'border-box',
           background:'var(--pc-aqua-solido)', color:'#fff', fontSize:11, fontWeight:700,
           display:'inline-flex', alignItems:'center', justifyContent:'center' },
}

export default App
