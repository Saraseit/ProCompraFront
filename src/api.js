import axios from 'axios'
import { supabase } from './supabaseClient'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

// Asegurar que todas las URLs terminen en /
api.interceptors.request.use(async (config) => {
  // Agregar / al final si no hay query params y no termina en /
  const [path, query] = config.url.split('?')
  if (!path.endsWith('/')) {
    config.url = query ? `${path}/?${query}` : `${path}/`
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