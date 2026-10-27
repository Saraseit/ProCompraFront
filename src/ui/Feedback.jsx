import { useState, useCallback, useRef, useMemo } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, X } from 'lucide-react'
import Modal, { Label } from './Modal'
import { FeedbackContext } from './feedback-context'
import { C } from './tema'

export default function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialogo, setDialogo] = useState(null)
  const siguienteId = useRef(0)

  const quitar = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback((mensaje, tipo = 'exito') => {
    const id = ++siguienteId.current
    setToasts((t) => [...t, { id, mensaje, tipo }])
    setTimeout(() => quitar(id), tipo === 'error' ? 6000 : 3500)
  }, [quitar])

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
        {toasts.map((t) => {
          const error = t.tipo === 'error'
          const Icono = error ? AlertCircle : CheckCircle2
          return (
            <div key={t.id} className="pc-toast" role={error ? 'alert' : 'status'}
              style={{ ...s.toast, ...(error ? s.toastError : s.toastExito) }}>
              <Icono size={18} style={{ flex: 'none', marginTop: 1, color: error ? C.rojo : C.aqua }} />
              <span style={{ flex: 1 }}>{t.mensaje}</span>
              <button style={s.toastX} onClick={() => quitar(t.id)} aria-label="Cerrar aviso">
                <X size={14} />
              </button>
            </div>
          )
        })}
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
      <div style={{ padding: '22px 24px 20px' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ ...s.iconoDialogo, ...(peligro ? s.iconoPeligro : {}) }}>
            <AlertTriangle size={19} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={s.titulo}>{titulo}</h3>
            {mensaje && <p style={s.mensaje}>{mensaje}</p>}
          </div>
        </div>
        {pedirTexto && (
          <label style={{ display: 'block', marginTop: 16 }}>
            <Label requerido>{pedirTexto}</Label>
            <textarea style={s.textarea} rows={3} autoFocus value={texto}
              placeholder={placeholder}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) aceptar() }} />
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
          flexDirection: 'column', gap: 10, maxWidth: 'calc(100vw - 40px)', width: 380 },
  toast: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 10px 12px 14px',
           borderRadius: 12, fontSize: 13.5, fontWeight: 500, lineHeight: 1.45,
           boxShadow: 'var(--pc-sombra-3)', background: 'var(--pc-superficie)', textAlign: 'left',
           border: '1px solid var(--pc-borde)', color: C.tinta },
  toastExito: { borderLeft: `3px solid ${C.aqua}` },
  toastError: { borderLeft: `3px solid ${C.rojo}` },
  toastX: { border: 'none', background: 'none', color: 'var(--pc-gris-3)', cursor: 'pointer', padding: 2,
            display: 'inline-grid', placeItems: 'center', borderRadius: 6, flex: 'none' },
  iconoDialogo: { width: 38, height: 38, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center',
                  background: 'var(--pc-ambar-bg)', color: 'var(--pc-ambar-texto)' },
  iconoPeligro: { background: 'var(--pc-rojo-bg)', color: 'var(--pc-rojo)' },
  titulo: { fontSize: 16, fontWeight: 650, margin: '7px 0 0', color: C.tinta },
  mensaje: { fontSize: 13.5, color: 'var(--pc-texto-suave)', margin: '6px 0 0', lineHeight: 1.55 },
  textarea: { width: '100%', border: `1px solid ${C.borde}`, borderRadius: 8, padding: '9px 11px',
              fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' },
  botones: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
  btnGhost: { background: 'var(--pc-superficie)', border: `1px solid ${C.borde}`, padding: '9px 16px',
              borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.tinta },
  btnPrimario: { background: 'var(--pc-btn)', color: 'var(--pc-btn-texto)', border: 'none', padding: '9px 16px',
                 borderRadius: 9, fontSize: 13, fontWeight: 600 },
  btnPeligro: { background: 'var(--pc-rojo-solido)', color: '#fff', border: 'none', padding: '9px 16px',
                borderRadius: 9, fontSize: 13, fontWeight: 600 },
}
