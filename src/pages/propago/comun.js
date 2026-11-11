import { useEffect, useState } from 'react'
import api from '../../api'

// Estado de ProPago (si está activo y las cajas del usuario). Se pide una vez
// por carga de la página; refrescarProPago() lo vuelve a pedir.
let pendiente = null
const oyentes = new Set()

function pedir() {
  pendiente = api.get('/propago/estado').then((r) => r.data).catch(() => ({ disponible: false, cajas: [] }))
  pendiente.then((d) => oyentes.forEach((f) => f(d)))
  return pendiente
}

export function refrescarProPago() {
  return pedir()
}

export function useProPago() {
  const [estado, setEstado] = useState(null)
  useEffect(() => {
    let vivo = true
    const alCambiar = (d) => { if (vivo) setEstado(d) }
    oyentes.add(alCambiar)
    ;(pendiente || pedir()).then(alCambiar)
    return () => { vivo = false; oyentes.delete(alCambiar) }
  }, [])
  return estado
}

export const TIPOS_CAJA = [
  ['banco', 'Cuenta bancaria'], ['tarjeta_debito', 'Tarjeta de débito'], ['tarjeta_credito', 'Tarjeta de crédito'],
  ['amex', 'AMEX'], ['inversion', 'Inversión'], ['caja_chica_virtual', 'Caja chica'], ['fondo_fijo', 'Fondo fijo'],
]
export const etiquetaTipoCaja = (t) => TIPOS_CAJA.find(([k]) => k === t)?.[1] || t

// ¿Hace falta elegir caja? Solo si ProPago está activo y ya hay cajas.
export const exigeCaja = (estado) => !!(estado?.disponible && (estado.cajas || []).length)

// Descarga un archivo de la API. Un error llega como Blob: se lee para mostrar el detalle.
export async function descargar(peticion, nombre) {
  let res
  try {
    res = await peticion
  } catch (e) {
    const datos = e?.response?.data
    if (datos instanceof Blob) {
      try { e.response.data = JSON.parse(await datos.text()) } catch { /* se queda el mensaje genérico */ }
    }
    throw e
  }
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return res
}

export const NATURALEZAS = [
  ['abono', 'Abono'], ['anticipo', 'Anticipo'], ['saldo', 'Saldo'],
]
