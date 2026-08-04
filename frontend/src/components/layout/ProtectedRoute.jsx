import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext.jsx'
import { AppLayout } from './AppLayout.jsx'
import { TopProgressBar } from '../shared/Skeleton.jsx'

export default function ProtectedRoute({ children }) {
  const { user, initialising } = useAuth()
  const location = useLocation()

  if (initialising) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)] text-sm text-[var(--text-muted)]">
        <TopProgressBar />
        Loading portal...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <AppLayout>{children}</AppLayout>
}
