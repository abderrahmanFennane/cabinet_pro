import axios from 'axios'

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Trial/plan ended or cabinet suspended: keep the session, show the renewal page.
    if (error.response?.status === 402 && error.response?.data?.code === 'CABINET_BLOCKED') {
      window.dispatchEvent(new CustomEvent('auth:refresh'))
    }
    if (error.response?.status === 401) {
      const message = error.response?.data?.message || error.response?.data?.error
      if (message) sessionStorage.setItem('authError', message)
      localStorage.removeItem('token')
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    if (error.response?.status === 403 && error.response?.data?.error?.toLowerCase().includes('désactiv')) {
      sessionStorage.setItem('authError', error.response.data.error)
      localStorage.removeItem('token')
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    if (error.response?.status === 403) {
      const message = error.response?.data?.message || error.response?.data?.error
      if (typeof message === 'string' && message.toLowerCase().includes('permission')) {
        window.dispatchEvent(new CustomEvent('auth:refresh'))
      }
    }
    return Promise.reject(error)
  },
)

export default api
