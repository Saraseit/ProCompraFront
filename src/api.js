import axios from 'axios'
import { supabase } from './supabaseClient'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

// Patrón UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

api.interceptors.request.use(async (config) => {
  const [path, query] = (config.url || '').split('?')

  // Solo agregar / si el último segmento NO es un UUID
  const segments = path.split('/')
  const lastSegment = segments[segments.length - 1]
  const endsWithUUID = UUID_REGEX.test(lastSegment)

  if (!path.endsWith('/') && !endsWithUUID) {
    const pathConBarra = `${path}/`
    config.url = query ? `${pathConBarra}?${query}` : pathConBarra
  }

  // Adjuntar token de sesión
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export default api