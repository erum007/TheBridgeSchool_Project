import axios from 'axios'

export const api = axios.create({
  // Leave this empty when the frontend and API are served from the same origin.
  // Set VITE_API_BASE_URL only when the API is hosted on a separate origin.
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
})

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('bridge_school_token')
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
      window.localStorage.removeItem('bridge_school_token')
      window.localStorage.removeItem('bridge_school_user')
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)
export default api
