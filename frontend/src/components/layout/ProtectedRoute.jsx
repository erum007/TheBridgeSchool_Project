import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext.jsx'
import { AppLayout } from './AppLayout.jsx'

export default function ProtectedRoute({ children }) {
  const { user, initialising } = useAuth()
  const location = useLocation()

  if (initialising) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <AppLayout>{children}</AppLayout>
}
