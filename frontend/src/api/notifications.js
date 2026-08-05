import api from './axios.js'

export const notificationsApi = {
  list: (limit) => api.get('/api/notifications', { params: limit ? { limit } : undefined }),
  markRead: (id) => api.patch(`/api/notifications/${id}/read`),
  markAllRead: () => api.post('/api/notifications/read-all'),
}
