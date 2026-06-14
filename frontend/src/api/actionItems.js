import api from './axios.js'

export const actionItemsApi = {
  list: () => api.get('/api/action-items'),
  create: (payload) => api.post('/api/action-items', payload),
  update: (id, payload) => api.patch(`/api/action-items/${id}`, payload),
  remove: (id) => api.delete(`/api/action-items/${id}`),
}

