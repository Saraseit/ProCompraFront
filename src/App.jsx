import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import Requerimientos from './pages/Requerimientos'
import Ordenes from './pages/Ordenes'
import Control from './pages/Control'
import Proveedores from './pages/Proveedores'
import Usuarios from './pages/Usuarios'

function App() {
  const [session, setSession] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState('requerimientos')

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
    if (!session) { setUsuario(null); return }
    supabase
      .from('usuarios')
      .select('id, nombre, correo, rol, activo')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => { if (data) setUsuario(data) })
  }, [session])

  if (cargando) return <div style={{ padding: 40 }}>Cargando...</div>
  if (!session) return <Login />
  if (!usuario) return <div style={{ padding: 40 }}>Cargando perfil...</div>

  return (
    <div style={{ minHeight:'100vh', background:'#FAF8F3', fontFamily:"'Inter', system-ui, sans-serif" }}>

      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                       padding:'18px 32px', background:'#fff', borderBottom:'1px solid #E3DFD5' }}>
        <div>
          <span style={{ fontSize:22, fontWeight:700, color:'#26241D' }}>MINIMAL 4.0</span>
          <span style={{ fontSize:13, color:'#8A8577', marginLeft:10 }}>ProCompra</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontSize:13, color:'#8A8577' }}>{usuario.nombre} · {usuario.rol}</span>
          <button onClick={() => supabase.auth.signOut()}
            style={{ background:'none', border:'1px solid #E3DFD5', padding:'7px 14px',
                     borderRadius:8, fontSize:13, cursor:'pointer' }}>
            Salir
          </button>
        </div>
      </header>

      <nav style={{ display:'flex', gap:4, padding:'0 32px', background:'#fff', borderBottom:'1px solid #E3DFD5' }}>
        {[
          ['requerimientos', 'Requerimientos'],
          ['ordenes', 'Órdenes de compra'],
          ['proveedores', 'Proveedores'],
          ...(['admin','compras','pagos'].includes(usuario.rol) ? [['control','Control de gastos']] : []),
          ...(usuario.rol === 'admin' ? [['usuarios','Usuarios']] : []),
        ].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ border:'none', background:'none', padding:'14px 16px', fontWeight:500,
                     fontSize:14, cursor:'pointer', color: tab === k ? '#26241D' : '#8A8577',
                     borderBottom: tab === k ? '2px solid #C4462B' : '2px solid transparent',
                     marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </nav>

      <main style={{ padding:'26px 32px', maxWidth:1180, margin:'0 auto' }}>
        {tab === 'requerimientos' && (
          <Requerimientos
            usuario={usuario}
            onOrdenCreada={() => setTab('ordenes')}
          />
        )}
        {tab === 'ordenes' && <Ordenes usuario={usuario} />}
        {tab === 'proveedores' && <Proveedores usuario={usuario} />}
        {tab === 'control' && ['admin','compras','pagos'].includes(usuario.rol) && <Control />}
        {tab === 'usuarios' && usuario.rol === 'admin' && <Usuarios usuario={usuario} />}
      </main>

    </div>
  )
}

export default App