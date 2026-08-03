import api from './axios.js'

export const actionItemsApi = {
  list: () => api.get('/api/action-items'),
  create: (payload) => api.post('/api/action-items', payload),
  update: (id, payload) => api.patch(`/api/action-items/${id}`, payload),
  sendReminderNow: (id) => api.post(`/api/action-items/${id}/send-reminder-now`),
  remove: (id) => api.delete(`/api/action-items/${id}`),
}

