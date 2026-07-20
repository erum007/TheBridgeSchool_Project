import api from './axios.js'

export const resultsApi = {
  list: () => api.get('/api/results'),
  upload: (formData) => api.post('/api/results/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  downloadBatch: (batchId) => api.get(`/api/results/batch/${batchId}/download`, { responseType: 'blob' }),
  deleteBatch: (batchId) => api.delete(`/api/results/batch/${batchId}`),
}

