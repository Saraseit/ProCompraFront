import { createContext, useContext } from 'react'

export const FeedbackContext = createContext(null)

// toast(mensaje, tipo?) — tipo: 'exito' (por defecto) | 'error'
export const useToast = () => useContext(FeedbackContext).toast

// confirmar({ titulo, mensaje, textoBoton, peligro, pedirTexto, placeholder })
// Resuelve con null si se cancela; con el texto capturado si pedirTexto; si no, con true.
export const useConfirm = () => useContext(FeedbackContext).confirmar
