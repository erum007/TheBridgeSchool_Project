import { Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from '../context/AuthContext.jsx'
import ProtectedRoute from '../components/layout/ProtectedRoute.jsx'
import LoginPage, { ResetPasswordPage } from '../pages/auth/LoginPage.jsx'
import NotificationsPage from '../pages/NotificationsPage.jsx'
import { AdminDashboardView, EmailModuleView, MeetingWorkspaceView, PerformanceBroadcasterView, PortalManagementView, TeacherDashboardView, StudentHomeView, StudentProgressView, StudentResultHistoryView, NoticeBoardView, OpportunityBoardView, SettingsView } from '../pages/views.jsx'

function RoleRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  const nextPath =
    user.role === 'admin'
      ? '/admin/dashboard'
      : user.role === 'teacher'
        ? '/teacher/dashboard'
        : user.role === 'staff'
          ? '/staff/dashboard'
        : user.role === 'student'
          ? '/student/home'
          : '/parent/home'
  return <Navigate to={nextPath} replace />
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RoleRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/teacher" element={<Navigate to="/teacher/dashboard" replace />} />
      <Route path="/staff" element={<Navigate to="/staff/dashboard" replace />} />
      <Route path="/student" element={<Navigate to="/student/home" replace />} />
      <Route path="/parent" element={<Navigate to="/parent/home" replace />} />

      <Route path="/admin/dashboard" element={<ProtectedRoute roles={[ 'admin' ]}><AdminDashboardView /></ProtectedRoute>} />
      <Route path="/admin/meetings" element={<ProtectedRoute roles={[ 'admin' ]}><MeetingWorkspaceView canCreateMeeting /></ProtectedRoute>} />
      <Route path="/admin/email" element={<ProtectedRoute roles={[ 'admin' ]}><EmailModuleView /></ProtectedRoute>} />
      <Route path="/admin/results" element={<ProtectedRoute roles={[ 'admin' ]}><PerformanceBroadcasterView /></ProtectedRoute>} />
      <Route path="/admin/portal" element={<ProtectedRoute roles={[ 'admin' ]}><PortalManagementView /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute roles={[ 'admin' ]}><SettingsView /></ProtectedRoute>} />
      <Route path="/admin/notifications" element={<ProtectedRoute roles={[ 'admin' ]}><NotificationsPage /></ProtectedRoute>} />

      <Route path="/teacher/dashboard" element={<ProtectedRoute roles={[ 'teacher' ]}><TeacherDashboardView /></ProtectedRoute>} />
      <Route path="/teacher/meetings" element={<ProtectedRoute roles={[ 'teacher' ]}><MeetingWorkspaceView canCreateMeeting /></ProtectedRoute>} />
      <Route path="/teacher/results" element={<ProtectedRoute roles={[ 'teacher' ]}><PerformanceBroadcasterView /></ProtectedRoute>} />
      <Route path="/teacher/notices" element={<ProtectedRoute roles={[ 'teacher' ]}><NoticeBoardView /></ProtectedRoute>} />
      <Route path="/teacher/broadcast" element={<ProtectedRoute roles={[ 'teacher' ]}><PerformanceBroadcasterView /></ProtectedRoute>} />
      <Route path="/teacher/settings" element={<ProtectedRoute roles={[ 'teacher' ]}><SettingsView /></ProtectedRoute>} />
      <Route path="/teacher/notifications" element={<ProtectedRoute roles={[ 'teacher' ]}><NotificationsPage /></ProtectedRoute>} />

      <Route path="/staff/dashboard" element={<ProtectedRoute roles={[ 'staff' ]}><TeacherDashboardView /></ProtectedRoute>} />
      <Route path="/staff/meetings" element={<ProtectedRoute roles={[ 'staff' ]}><MeetingWorkspaceView canCreateMeeting={false} /></ProtectedRoute>} />
      <Route path="/staff/notices" element={<ProtectedRoute roles={[ 'staff' ]}><NoticeBoardView /></ProtectedRoute>} />
      <Route path="/staff/settings" element={<ProtectedRoute roles={[ 'staff' ]}><SettingsView /></ProtectedRoute>} />
      <Route path="/staff/notifications" element={<ProtectedRoute roles={[ 'staff' ]}><NotificationsPage /></ProtectedRoute>} />

      <Route path="/student/home" element={<ProtectedRoute roles={[ 'student' ]}><StudentHomeView /></ProtectedRoute>} />
      <Route path="/student/progress" element={<ProtectedRoute roles={[ 'student' ]}><StudentProgressView /></ProtectedRoute>} />
      <Route path="/student/results" element={<ProtectedRoute roles={[ 'student' ]}><StudentResultHistoryView /></ProtectedRoute>} />
      <Route path="/student/notices" element={<ProtectedRoute roles={[ 'student' ]}><NoticeBoardView /></ProtectedRoute>} />
      <Route path="/student/opportunities" element={<ProtectedRoute roles={[ 'student' ]}><OpportunityBoardView /></ProtectedRoute>} />
      <Route path="/student/settings" element={<ProtectedRoute roles={[ 'student' ]}><SettingsView /></ProtectedRoute>} />
      <Route path="/student/notifications" element={<ProtectedRoute roles={[ 'student' ]}><NotificationsPage /></ProtectedRoute>} />

      <Route path="/parent/home" element={<ProtectedRoute roles={[ 'parent' ]}><StudentHomeView /></ProtectedRoute>} />
      <Route path="/parent/progress" element={<ProtectedRoute roles={[ 'parent' ]}><StudentProgressView /></ProtectedRoute>} />
      <Route path="/parent/results" element={<ProtectedRoute roles={[ 'parent' ]}><StudentResultHistoryView /></ProtectedRoute>} />
      <Route path="/parent/notices" element={<ProtectedRoute roles={[ 'parent' ]}><NoticeBoardView /></ProtectedRoute>} />
      <Route path="/parent/opportunities" element={<ProtectedRoute roles={[ 'parent' ]}><OpportunityBoardView /></ProtectedRoute>} />
      <Route path="/parent/settings" element={<ProtectedRoute roles={[ 'parent' ]}><SettingsView /></ProtectedRoute>} />
      <Route path="/parent/notifications" element={<ProtectedRoute roles={[ 'parent' ]}><NotificationsPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
