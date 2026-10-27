import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const CLAVE = 'procompra-tema'

// El tema inicial lo fija el script de index.html (preferencia guardada o del sistema);
// aquí solo se lee y se cambia el atributo de <html>.
const temaActual = () =>
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'

export default function BotonTema({ style }) {
  const [tema, setTema] = useState(temaActual)
  const oscuro = tema === 'dark'

  const alternar = () => {
    const nuevo = oscuro ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', nuevo)
    try { localStorage.setItem(CLAVE, nuevo) } catch { /* almacenamiento no disponible */ }
    setTema(nuevo)
  }

  return (
    <button onClick={alternar} className="pc-icono-btn" style={style}
      title={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
      {oscuro ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}
