import axios from 'axios'

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
export const apiBaseUrl = configuredApiUrl
  ? `${/^https?:\/\//i.test(configuredApiUrl) ? '' : 'https://'}${configuredApiUrl.replace(/\/$/, '')}`
  : ''

export const api = axios.create({
  // Leave this empty when the frontend and API are served from the same origin.
  // Set VITE_API_URL only when the API is hosted on a separate origin.
  baseURL: apiBaseUrl,
})

let runtimeToken = null
export const setApiToken = (token) => { runtimeToken = token || null }

api.interceptors.request.use((config) => {
  const token = runtimeToken || window.localStorage.getItem('bridge_school_token')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      setApiToken(null)
      window.localStorage.removeItem('bridge_school_token')
      window.localStorage.removeItem('bridge_school_user')
      if (import.meta.env.VITE_CORDOVA === 'true') {
        if (window.location.hash !== '#/login') window.location.hash = '#/login'
      } else if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)
export default api
