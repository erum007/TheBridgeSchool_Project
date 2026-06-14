import api from './axios.js'

export const resultsApi = {
  list: () => api.get('/api/results'),
  upload: (formData) => api.post('/api/results/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
}

