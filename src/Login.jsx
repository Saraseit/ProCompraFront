import { useState } from 'react'
import { supabase } from './supabaseClient'
import BotonTema from './ui/BotonTema'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div style={styles.wrap}>
      <BotonTema style={{ position: 'fixed', top: 16, right: 16 }} />
      <div style={styles.card}>
        <div style={styles.brand}>MINIMAL 4.0</div>
        <div style={styles.sub}>ProCompra</div>

        <form onSubmit={handleLogin} style={styles.form}>
          <label style={styles.label}>Correo</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />

          <label style={styles.label}>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.btn} disabled={cargando}>
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'var(--pc-login-fondo)',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    background: 'var(--pc-superficie)', padding: '40px', borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.08)', width: '360px',
  },
  brand: { fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--pc-tinta)' },
  sub: { fontSize: '14px', color: 'var(--pc-gris)', marginBottom: '28px' },
  form: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: '13px', color: 'var(--pc-gris)', marginBottom: '6px', fontWeight: 500 },
  input: {
    padding: '11px', border: '1px solid var(--pc-borde)', borderRadius: '8px',
    marginBottom: '16px', fontSize: '14px',
  },
  error: {
    background: 'var(--pc-rojo-bg)', color: 'var(--pc-rojo)', padding: '10px',
    borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
  },
  btn: {
    background: 'var(--pc-btn)', color: 'var(--pc-btn-texto)', border: 'none', padding: '12px',
    borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
}