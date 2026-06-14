import api from './axios.js'

export const emailsApi = {
  list: () => api.get('/api/emails'),
  send: (payload) => api.post('/api/emails/send', payload),
  schedule: (payload) => api.post('/api/emails/schedule', payload),
  remove: (id) => api.delete(`/api/emails/${id}`),
  templates: () => api.get('/api/email-templates'),
  createTemplate: (payload) => api.post('/api/email-templates', payload),
  removeTemplate: (id) => api.delete(`/api/email-templates/${id}`),
}

