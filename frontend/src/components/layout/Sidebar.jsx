import { NavLink } from 'react-router-dom'
import { LogOut, School } from 'lucide-react'

import { useAuth } from '../../context/AuthContext.jsx'

const sectionClass = 'px-4 mt-5 mb-1.5 text-[10px] uppercase tracking-widest font-semibold text-[var(--sidebar-label)]'

function NavItem({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      end={to.split('/').length <= 2}
      className={({ isActive }) =>
        [
          'mx-2 flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150',
          isActive
            ? 'rounded-l-none border-l-2 border-[var(--sidebar-active-border)] bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-active)]'
            : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white',
        ].join(' ')
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

export default function Sidebar({ mobileOpen, navGroups = [], schoolName = 'Bridge School Portal' }) {
  const { user, logout } = useAuth()
  const initials = (user?.name || 'BS')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-[240px] bg-[var(--sidebar-bg)] transition-transform duration-200 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
    >
      <div className="flex h-full flex-col">
        <div className="px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[var(--brand-navy)]">
              <School className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-white">{schoolName}</p>
              <p className="text-xs text-[var(--sidebar-text)]">Portal</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto pb-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className={sectionClass}>{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-red)] font-display text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <span className="mt-1 inline-flex rounded-full border border-white/10 px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-widest text-[var(--sidebar-text)]">
                {user?.role}
              </span>
            </div>
          </div>
          <button type="button" onClick={logout} className="portal-button-ghost w-full justify-start text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
