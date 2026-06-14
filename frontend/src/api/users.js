import api from './axios.js'

export const usersApi = {
  list: () => api.get('/api/users'),
  create: (payload) => api.post('/api/users', payload),
  remove: (id) => api.delete(`/api/users/${id}`),
  updateSettings: (payload) => api.patch('/api/users/me/settings', payload),
}

