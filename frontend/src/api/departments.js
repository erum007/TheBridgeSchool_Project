import api from './axios.js'

export const departmentsApi = {
  list: () => api.get('/api/departments'),
  create: (payload) => api.post('/api/departments', payload),
  addMember: (departmentId, userId) => api.post(`/api/departments/${departmentId}/members`, { user_id: userId }),
  removeMember: (departmentId, userId) => api.delete(`/api/departments/${departmentId}/members/${userId}`),
}
