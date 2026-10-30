import { useState, useEffect, useCallback } from 'react'
import api from '../api'

const VACIO = { avisos: [], no_leidas: 0, disponible: false }

// Bandeja de avisos del usuario: se consulta al entrar, al cambiar de pantalla
// y cada minuto. Si el backend aún no tiene la tabla, queda oculta.
export function useAvisos(activo, refresco) {
  const [datos, setDatos] = useState(VACIO)

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/notificaciones')
      setDatos(data)
    } catch { /* la campana no debe estorbar si falla */ }
  }, [])

  useEffect(() => {
    if (!activo) return
    const inicio = setTimeout(cargar, 0)
    const cada = setInterval(cargar, 60000)
    return () => { clearTimeout(inicio); clearInterval(cada) }
  }, [activo, refresco, cargar])

  const marcar = useCallback(async (ids) => {
    setDatos((d) => ({
      ...d,
      no_leidas: ids ? Math.max(0, d.no_leidas - d.avisos.filter((a) => ids.includes(a.id) && !a.leida_at).length) : 0,
      avisos: d.avisos.map((a) => (!ids || ids.includes(a.id) ? { ...a, leida_at: a.leida_at || new Date().toISOString() } : a)),
    }))
    try { await api.post('/notificaciones/leer', { ids: ids || null }) } catch { cargar() }
  }, [cargar])

  return { ...datos, marcar, recargar: cargar }
}

export function haceCuanto(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return `hace ${d} día${d === 1 ? '' : 's'}`
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}
