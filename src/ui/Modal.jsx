import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { C } from './tema'

// Modales abiertos, del más antiguo al más reciente: Esc cierra solo el de arriba.
const pila = []

// Contenedor común de los modales: velo con desenfoque, tarjeta con radio 16.
export default function Modal({ onClose, maxWidth = 520, zIndex = 50, arriba = false, children }) {
  const cerrar = useRef(onClose)
  useEffect(() => { cerrar.current = onClose })

  useEffect(() => {
    const yo = {}
    pila.push(yo)
    const alTeclear = (e) => {
      if (e.key === 'Escape' && pila[pila.length - 1] === yo && cerrar.current) {
        e.stopPropagation()
        cerrar.current()
      }
    }
    window.addEventListener('keydown', alTeclear)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', alTeclear)
      pila.splice(pila.indexOf(yo), 1)
      if (!pila.length) document.body.style.overflow = overflowPrevio
    }
  }, [])

  return (
    <div
      className="pc-velo-modal"
      style={{ ...s.overlay, zIndex, alignItems: arriba ? 'flex-start' : 'center',
               padding: arriba ? '5vh 16px' : 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}>
      <div className="pc-modal" role="dialog" aria-modal="true" style={{ ...s.modal, maxWidth }}>
        {children}
      </div>
    </div>
  )
}

export function ModalHead({ titulo, subtitulo, onClose, children }) {
  return (
    <div style={s.head}>
      <div style={{ minWidth: 0 }}>
        <h3 style={s.h3}>{titulo}</h3>
        {subtitulo && <div style={s.sub}>{subtitulo}</div>}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {children}
        {onClose && <BotonCerrar onClick={onClose} />}
      </div>
    </div>
  )
}

export function BotonCerrar({ onClick }) {
  return (
    <button style={s.btnX} onClick={onClick} aria-label="Cerrar" title="Cerrar (Esc)">
      <X size={16} />
    </button>
  )
}

// Etiqueta de campo; `requerido` agrega el asterisco rojo.
export function Label({ children, requerido, style }) {
  return (
    <span style={{ ...s.label, ...style }}>
      {children}
      {requerido && <span style={{ color: C.rojo, marginLeft: 3 }}>*</span>}
    </span>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'var(--pc-velo)', display: 'flex',
             justifyContent: 'center', overflowY: 'auto' },
  modal: { background: 'var(--pc-superficie)', borderRadius: 16, width: '100%',
           boxShadow: 'var(--pc-sombra-3)', border: '1px solid var(--pc-borde)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          padding: '18px 22px', borderBottom: `1px solid ${C.borde}` },
  h3: { fontSize: 17, fontWeight: 650, margin: 0, color: C.tinta },
  sub: { fontSize: 12.5, color: C.gris, marginTop: 2 },
  label: { display: 'block', fontSize: 12.5, color: 'var(--pc-gris-2)', marginBottom: 6, fontWeight: 550 },
  btnX: { border: 'none', background: 'transparent', width: 32, height: 32, borderRadius: 8, flex: 'none',
          cursor: 'pointer', color: 'var(--pc-gris)', display: 'inline-grid', placeItems: 'center' },
}
