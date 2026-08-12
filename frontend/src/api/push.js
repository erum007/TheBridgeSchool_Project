import api from './axios.js'

export const pushApi = {
  publicKey: () => api.get('/api/push/public-key'),
  subscribe: (subscription) => api.post('/api/push/subscriptions', subscription),
  unsubscribe: (subscription) => api.delete('/api/push/subscriptions', { data: subscription }),
  sendTest: () => api.post('/api/push/test'),
}
