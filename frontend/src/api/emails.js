import api from './axios.js'

export const emailsApi = {
  list: () => api.get('/api/emails'),
  saveDraft: (payload) => api.post('/api/emails/draft', payload),
  updateDraft: (id, payload) => api.put(`/api/emails/draft/${id}`, payload),
  send: (payload) => api.post('/api/emails/send', payload),
  schedule: (payload) => api.post('/api/emails/schedule', payload),
  remove: (id) => api.delete(`/api/emails/${id}`),
  templates: () => api.get('/api/email-templates'),
  createTemplate: (payload) => api.post('/api/email-templates', payload),
  deleteTemplate: (id) => api.delete(`/api/email-templates/${id}`),
  updateTemplate: (id, data) => api.put(`/api/email-templates/${id}`, data),
  uploadImage: (formData) => api.post('/api/upload-image', formData),
  uploadDocument: (formData) => api.post('/api/upload-email-document', formData),
}
