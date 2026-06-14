import api from './axios.js'

export const dashboardApi = {
  summary: () => api.get('/api/dashboard/summary'),
}

