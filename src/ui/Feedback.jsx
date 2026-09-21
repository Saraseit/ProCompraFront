import { useState, useCallback, useRef, useMemo } from 'react'
import Modal, { ModalHead, Label } from './Modal'
import { FeedbackContext } from './feedback-context'
import { C } from './tema'

export default function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialogo, setDialogo] = useState(null)
  const siguienteId = useRef(0)

  const toast = useCallback((mensaje, tipo = 'exito') => {
    const id = ++siguienteId.current
    setToasts((t) => [...t, { id, mensaje, tipo }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === 'error' ? 6000 : 3500)
  }, [])

  const confirmar = useCallback((opciones) =>
    new Promise((resolve) => setDialogo({ ...opciones, resolve })), [])

  const cerrarDialogo = (valor) => {
    dialogo.resolve(valor)
    setDialogo(null)
  }

  const valor = useMemo(() => ({ toast, confirmar }), [toast, confirmar])

  return (
    <FeedbackContext.Provider value={valor}>
      {children}

      {dialogo && <Dialogo {...dialogo} onCerrar={cerrarDialogo} />}

      <div style={s.pila} aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} style={{ ...s.toast, ...(t.tipo === 'error' ? s.toastError : s.toastExito) }}
            onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
            <span style={s.icono}>{t.tipo === 'error' ? '!' : '✓'}</span>
            <span>{t.mensaje}</span>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  )
}

function Dialogo({ titulo, mensaje, textoBoton = 'Confirmar', peligro, pedirTexto, placeholder, onCerrar }) {
  const [texto, setTexto] = useState('')
  const puede = !pedirTexto || texto.trim()
  const aceptar = () => { if (puede) onCerrar(pedirTexto ? texto.trim() : true) }

  return (
    <Modal onClose={() => onCerrar(null)} maxWidth={440} zIndex={90}>
      <ModalHead titulo={titulo} onClose={() => onCerrar(null)} />
      <div style={{ padding: '16px 24px 22px' }}>
        {mensaje && <p style={s.mensaje}>{mensaje}</p>}
        {pedirTexto && (
          <label style={{ display: 'block', marginTop: 12 }}>
            <Label requerido>{pedirTexto}</Label>
            <textarea style={s.textarea} rows={3} autoFocus value={texto}
              placeholder={placeholder}
              onChange={(e) => setTexto(e.target.value)} />
          </label>
        )}
        <div style={s.botones}>
          <button style={s.btnGhost} onClick={() => onCerrar(null)}>Cancelar</button>
          <button
            autoFocus={!pedirTexto}
            style={{ ...(peligro ? s.btnPeligro : s.btnPrimario),
                     opacity: puede ? 1 : 0.45, cursor: puede ? 'pointer' : 'not-allowed' }}
            disabled={!puede}
            onClick={aceptar}>
            {textoBoton}
          </button>
        </div>
      </div>
    </Modal>
  )
}

const s = {
  pila: { position: 'fixed', right: 20, bottom: 20, zIndex: 100, display: 'flex',
          flexDirection: 'column', gap: 10, maxWidth: 'calc(100vw - 40px)', width: 360 },
  toast: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
           borderRadius: 10, fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
           boxShadow: '0 12px 30px rgba(0,0,0,0.16)', background: '#fff',
           fontFamily: "'Inter', system-ui, sans-serif", textAlign: 'left' },
  toastExito: { border: `1px solid ${C.aqua}`, borderLeft: `4px solid ${C.aqua}`, color: C.tinta },
  toastError: { border: '1px solid #E9C9C9', borderLeft: `4px solid ${C.rojo}`, color: C.rojo },
  icono: { fontWeight: 700 },
  mensaje: { fontSize: 14, color: '#4A473D', margin: 0, lineHeight: 1.5 },
  textarea: { width: '100%', border: `1px solid ${C.borde}`, borderRadius: 8, padding: '9px 11px',
              fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' },
  botones: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  btnGhost: { background: 'transparent', border: `1px solid ${C.borde}`, padding: '10px 16px',
              borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.tinta },
  btnPrimario: { background: C.tinta, color: '#fff', border: 'none', padding: '10px 16px',
                 borderRadius: 9, fontSize: 13, fontWeight: 600 },
  btnPeligro: { background: C.rojo, color: '#fff', border: 'none', padding: '10px 16px',
                borderRadius: 9, fontSize: 13, fontWeight: 600 },
}
