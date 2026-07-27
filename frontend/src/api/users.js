import api from './axios.js'

export const usersApi = {
  list: () => api.get('/api/users'),
  create: (payload) => api.post('/api/users', payload),
  createStudent: (payload) => api.post('/api/users/students', payload),
  import: (file) => {
    const data = new FormData()
    data.append('file', file)
    return api.post('/api/users/import', data)
  },
  cleanupInvalidFamilyRecords: () => api.post('/api/users/cleanup-invalid-family-records'),
  update: (id, payload) => api.patch(`/api/users/${id}`, payload),
  linkGuardian: (studentId, parentId) => api.post(`/api/users/${studentId}/guardians`, { parent_id: parentId }),
  unlinkGuardian: (studentId, parentId) => api.delete(`/api/users/${studentId}/guardians/${parentId}`),
  linkTeacher: (studentId, teacherId) => api.post(`/api/users/${studentId}/teachers`, { teacher_id: teacherId }),
  unlinkTeacher: (studentId, teacherId) => api.delete(`/api/users/${studentId}/teachers/${teacherId}`),
  remove: (id) => api.delete(`/api/users/${id}`),
  updateSettings: (payload) => api.patch('/api/users/me/settings', payload),
}
