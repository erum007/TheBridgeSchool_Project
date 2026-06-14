import api from './axios.js'

export const noticesApi = {
  list: () => api.get('/api/notices'),
  create: (payload) => api.post('/api/notices', payload),
  update: (id, payload) => api.patch(`/api/notices/${id}`, payload),
  remove: (id) => api.delete(`/api/notices/${id}`),
}

