import api from './axios.js'

export const authApi = {
  login: (payload) => api.post('/api/auth/login', payload),
  me: () => api.get('/api/auth/me'),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => api.post('/api/auth/reset-password', { token, new_password }),
}

