import axios from 'axios'
import { supabase } from './supabaseClient'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

api.interceptors.request.use(async (config) => {
  // Separar path y query string
  const [path, query] = (config.url || '').split('?')

  // Agregar / al final del path si no lo tiene
  const pathConBarra = path.endsWith('/') ? path : `${path}/`
  config.url = query ? `${pathConBarra}?${query}` : pathConBarra

  // Adjuntar token de sesión
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export default api