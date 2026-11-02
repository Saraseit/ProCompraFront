import { useEffect, useState } from 'react'
import api from '../api'

// Abre la ficha de un insumo desde cualquier pantalla (App escucha el evento).
export const verPrecio = (clave) => window.dispatchEvent(new CustomEvent('pc:ver-precio', { detail: clave }))

// Compara precios capturados con su histórico. Espera medio segundo sin
// cambios antes de preguntar, para no lanzar una petición por tecla.
export function useEvaluacion(renglones, activo = true) {
  const clave = activo ? JSON.stringify(renglones) : ''
  const [estado, setEstado] = useState({ clave: '', resultados: null })

  useEffect(() => {
    if (!clave) return
    const lista = JSON.parse(clave).filter((r) => (r.descripcion || '').trim().length >= 3)
    if (!lista.length) return
    let vigente = true
    const timer = setTimeout(() => {
      api.post('/precios/evaluar', { renglones: lista })
        .then(({ data }) => {
          if (!vigente || !data.disponible) return
          // Se devuelve alineado con los renglones originales (los cortos quedan sin resultado).
          let i = 0
          const resultados = JSON.parse(clave).map((r) =>
            (r.descripcion || '').trim().length >= 3 ? data.resultados[i++] : null)
          setEstado({ clave, resultados })
        })
        .catch(() => {})
    }, 500)
    return () => { vigente = false; clearTimeout(timer) }
  }, [clave])

  return estado.clave === clave ? estado.resultados : null
}
