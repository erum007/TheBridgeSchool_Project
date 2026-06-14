import api from './axios.js'

export const opportunitiesApi = {
  list: () => api.get('/api/opportunities'),
  create: (payload) => api.post('/api/opportunities', payload),
  remove: (id) => api.delete(`/api/opportunities/${id}`),
}

