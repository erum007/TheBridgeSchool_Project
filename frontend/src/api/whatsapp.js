import api from './axios.js'

export const whatsappApi = {
  send: (payload) => api.post('/api/whatsapp/send', payload),
  logs: () => api.get('/api/whatsapp/log'),
}

