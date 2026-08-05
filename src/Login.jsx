import { useState } from 'react'
import { supabase } from './supabaseClient'

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
    justifyContent: 'center', background: '#F4F1EA',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    background: '#fff', padding: '40px', borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.08)', width: '360px',
  },
  brand: { fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px', color: '#26241D' },
  sub: { fontSize: '14px', color: '#8A8577', marginBottom: '28px' },
  form: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: '13px', color: '#8A8577', marginBottom: '6px', fontWeight: 500 },
  input: {
    padding: '11px', border: '1px solid #E3DFD5', borderRadius: '8px',
    marginBottom: '16px', fontSize: '14px',
  },
  error: {
    background: '#F7DEDE', color: '#B03A3A', padding: '10px',
    borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
  },
  btn: {
    background: '#26241D', color: '#fff', border: 'none', padding: '12px',
    borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
}