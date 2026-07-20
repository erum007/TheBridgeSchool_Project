import api from './axios.js'

export const authApi = {
  login: (payload) => api.post('/api/auth/login', payload),
  me: () => api.get('/api/auth/me'),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (email, otp, new_password) => api.post('/api/auth/reset-password', { email, otp, new_password }),
  requestPasswordChange: () => api.post('/api/auth/change-password/request'),
  confirmPasswordChange: (otp, new_password) => api.post('/api/auth/change-password/confirm', { otp, new_password }),
}
