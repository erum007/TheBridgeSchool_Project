import api from './axios.js'

export const authApi = {
  login: (payload) => api.post('/api/auth/login', payload),
  me: () => api.get('/api/auth/me'),
}

