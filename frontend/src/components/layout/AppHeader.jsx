import { Bell, Menu, Settings } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext.jsx'

export default function AppHeader({ onToggleSidebar, title }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const currentPage = title || location.pathname.split('/').filter(Boolean).slice(-1)[0]?.replaceAll('-', ' ') || 'Dashboard'
  const initials = (user?.name || 'BS')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const goToSettings = () => {
    const role = user?.role || 'admin'
    const target = role === 'teacher'
      ? '/teacher/settings'
      : role === 'staff'
        ? '/staff/settings'
        : role === 'student'
          ? '/student/settings'
          : role === 'parent'
            ? '/parent/settings'
            : '/admin/settings'
    navigate(target)
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border-default)] bg-white px-4 shadow-none md:px-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggleSidebar} className="portal-button-ghost h-10 w-10 md:hidden" aria-label="Open navigation">
          <Menu className="h-4 w-4" />
        </button>
        <p className="font-display text-sm font-semibold capitalize text-[var(--brand-navy)]">{currentPage}</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="portal-button-ghost h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </button>
        <button type="button" onClick={goToSettings} className="flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-white px-2 py-1.5 transition hover:bg-[var(--bg-app)]" aria-label="Open profile settings">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-red)] font-display text-xs font-bold text-white">
            {user?.profile_picture_url ? (
              <img src={user.profile_picture_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <span className="hidden text-sm text-[var(--text-primary)] sm:inline">{user?.name}</span>
          <Settings className="mr-1 h-4 w-4 text-[var(--text-muted)]" />
        </button>
      </div>
    </header>
  )
}
