import axios from 'axios'
import { translateText } from './labels'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

/** The server writes its messages in French: they are shown in the user's language. */
function translateMessages(data: any) {
  if (!data || typeof data !== 'object' || data instanceof Blob) return
  if (typeof data.message === 'string') data.message = translateText(data.message)
  if (typeof data.error === 'string') data.error = translateText(data.error)
}

api.interceptors.response.use(
  (response) => { translateMessages(response.data); return response },
  (error) => {
    // Trial/plan ended or cabinet suspended: keep the session, show the renewal page.
    if (error.response?.status === 402 && error.response?.data?.code === 'CABINET_BLOCKED') {
      window.dispatchEvent(new CustomEvent('auth:refresh'))
    }
    if (error.response?.status === 401) {
      const message = error.response?.data?.message || error.response?.data?.error
      if (message) sessionStorage.setItem('authError', translateText(message))
      localStorage.removeItem('token')
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    if (error.response?.status === 403 && error.response?.data?.error?.toLowerCase().includes('désactiv')) {
      sessionStorage.setItem('authError', translateText(error.response.data.error))
      localStorage.removeItem('token')
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    if (error.response?.status === 403) {
      const message = error.response?.data?.message || error.response?.data?.error
      if (typeof message === 'string' && message.toLowerCase().includes('permission')) {
        window.dispatchEvent(new CustomEvent('auth:refresh'))
      }
    }
    // After the checks above, which read the French text.
    translateMessages(error.response?.data)
    return Promise.reject(error)
  },
)

export default api
