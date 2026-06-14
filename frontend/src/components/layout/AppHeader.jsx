import { Bell, Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext.jsx'

export default function AppHeader({ onToggleSidebar, title }) {
  const { user } = useAuth()
  const location = useLocation()
  const currentPage = title || location.pathname.split('/').filter(Boolean).slice(-1)[0]?.replaceAll('-', ' ') || 'Dashboard'
  const initials = (user?.name || 'BS')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

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
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-red)] font-display text-xs font-bold text-white">
          {initials}
        </div>
        <span className="hidden text-sm text-[var(--text-primary)] sm:inline">{user?.name}</span>
      </div>
    </header>
  )
}
