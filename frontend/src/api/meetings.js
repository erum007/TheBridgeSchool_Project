import api from './axios.js'

export const meetingsApi = {
  list: () => api.get('/api/meetings'),
  create: (payload) => api.post('/api/meetings', payload),
  get: (id) => api.get(`/api/meetings/${id}`),
  update: (id, payload) => api.patch(`/api/meetings/${id}`, payload),
  remove: (id) => api.delete(`/api/meetings/${id}`),
  summarise: (id) => api.post(`/api/meetings/${id}/summarise`),
}

