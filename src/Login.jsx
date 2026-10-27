import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, ArrowRight, ClipboardCheck, Wallet, FileCheck2 } from 'lucide-react'
import { supabase } from './supabaseClient'
import BotonTema from './ui/BotonTema'

const PUNTOS = [
  [ClipboardCheck, 'Requerimientos y órdenes en un solo lugar'],
  [Wallet, 'Autorización, pagos y crédito con proveedores'],
  [FileCheck2, 'Comprobación con tickets y facturas CFDI'],
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setCargando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Correo o contraseña incorrectos')
    }
    setCargando(false)
  }

  return (
    <div className="pc-login">
      <section className="pc-login-marca" aria-hidden>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="pc-marca-logo" style={{ background: '#FAF8F3', color: '#26241D' }}>M4</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>ProCompra</div>
            <div style={{ fontSize: 12, opacity: 0.6, letterSpacing: '0.04em' }}>MINIMAL 4.0</div>
          </div>
        </div>
        <div>
          <h1 style={s.lema}>Compras claras,<br />de la solicitud al cierre.</h1>
          <ul style={s.puntos}>
            {PUNTOS.map(([Icono, texto]) => (
              <li key={texto} style={s.punto}>
                <span style={s.puntoIcono}><Icono size={16} /></span>
                {texto}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ fontSize: 12, opacity: 0.45 }}>© {new Date().getFullYear()} Minimal 4.0</div>
      </section>

      <section className="pc-login-form">
        <BotonTema style={{ position: 'absolute', top: 18, right: 18 }} />
        <form onSubmit={handleLogin} style={s.form} className="pc-pagina">
          <h2 style={s.titulo}>Inicia sesión</h2>
          <p style={s.sub}>Usa el correo y la contraseña que te dio el administrador.</p>

          <label style={s.label} htmlFor="correo">Correo</label>
          <div style={s.campo}>
            <Mail size={16} style={s.icono} />
            <input id="correo" type="email" autoComplete="email" autoFocus required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@empresa.com" style={s.input} />
          </div>

          <label style={s.label} htmlFor="clave">Contraseña</label>
          <div style={s.campo}>
            <Lock size={16} style={s.icono} />
            <input id="clave" type={verClave ? 'text' : 'password'} autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" style={{ ...s.input, paddingRight: 40 }} />
            <button type="button" style={s.ojo} onClick={() => setVerClave((v) => !v)}
              aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && <div style={s.error} role="alert">{error}</div>}

          <button type="submit" style={{ ...s.btn, opacity: cargando ? 0.7 : 1 }} disabled={cargando}>
            {cargando ? 'Entrando...' : <>Entrar <ArrowRight size={16} /></>}
          </button>
        </form>
      </section>
    </div>
  )
}

const s = {
  lema: { fontSize: 34, lineHeight: 1.15, fontWeight: 650, margin: '0 0 28px', letterSpacing: '-0.03em', color: '#FAF8F3' },
  puntos: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  punto: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'rgba(250,248,243,0.82)' },
  puntoIcono: { width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center',
                background: 'rgba(60,196,184,0.14)', color: '#3CC4B8', flex: 'none' },
  form: { width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column' },
  titulo: { fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--pc-tinta)' },
  sub: { fontSize: 13.5, color: 'var(--pc-gris)', margin: '6px 0 26px' },
  label: { fontSize: 12.5, color: 'var(--pc-gris-2)', marginBottom: 6, fontWeight: 550 },
  campo: { position: 'relative', marginBottom: 16 },
  icono: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--pc-gris-3)', pointerEvents: 'none' },
  input: { width: '100%', padding: '11px 12px 11px 38px', fontSize: 14 },
  ojo: { position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none',
         color: 'var(--pc-gris)', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'inline-grid', placeItems: 'center' },
  error: { background: 'var(--pc-rojo-bg)', color: 'var(--pc-rojo)', padding: '10px 12px',
           borderRadius: 8, fontSize: 13, marginBottom: 16 },
  btn: { background: 'var(--pc-btn)', color: 'var(--pc-btn-texto)', border: 'none', padding: '12px',
         borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4,
         display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
}
