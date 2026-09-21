import { C } from './tema'

// Contenedor común de los modales: overlay oscuro, tarjeta blanca con radio 16.
export default function Modal({ onClose, maxWidth = 520, zIndex = 50, arriba = false, children }) {
  return (
    <div
      style={{ ...s.overlay, zIndex, alignItems: arriba ? 'flex-start' : 'center',
               padding: arriba ? '40px 16px' : 16 }}
      onClick={onClose}>
      <div style={{ ...s.modal, maxWidth }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function ModalHead({ titulo, onClose, children }) {
  return (
    <div style={s.head}>
      <h3 style={s.h3}>{titulo}</h3>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {children}
        {onClose && <button style={s.btnX} onClick={onClose} aria-label="Cerrar">✕</button>}
      </div>
    </div>
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
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,28,22,0.5)', display: 'flex',
             justifyContent: 'center', overflowY: 'auto' },
  modal: { background: 'var(--pc-superficie)', borderRadius: 16, width: '100%',
           boxShadow: '0 30px 80px rgba(0,0,0,0.25)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          padding: '20px 24px', borderBottom: `1px solid ${C.borde}` },
  h3: { fontSize: 18, fontWeight: 600, margin: 0, color: C.tinta },
  label: { display: 'block', fontSize: 12, color: C.gris, marginBottom: 5, fontWeight: 500 },
  btnX: { border: 'none', background: 'var(--pc-superficie-3)', width: 30, height: 30, borderRadius: 8,
          cursor: 'pointer', fontSize: 14, color: 'var(--pc-gris-2)' },
}
