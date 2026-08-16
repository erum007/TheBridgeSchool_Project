import { Bell, Menu, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext.jsx'
import { notificationsApi } from '../../api/notifications.js'

export default function AppHeader({ onToggleSidebar, title }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [notificationOpen, setNotificationOpen] = useState(false)
  const notificationMenuRef = useRef(null)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
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

  const notificationPath = `/${user?.role || 'admin'}/notifications`
  const loadNotifications = async () => {
    setNotificationsLoading(true)
    try {
      const response = await notificationsApi.list(5)
      setNotifications(response.data.notifications || [])
      setUnreadCount(response.data.unread_count || 0)
    } finally {
      setNotificationsLoading(false)
    }
  }

  const toggleNotifications = () => {
    const nextOpen = !notificationOpen
    setNotificationOpen(nextOpen)
    if (nextOpen) loadNotifications()
  }

  const openNotification = async (notification) => {
    if (!notification.is_read) {
      try {
        await notificationsApi.markRead(notification.id)
        setUnreadCount((count) => Math.max(0, count - 1))
        setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, is_read: true } : item))
      } catch {
        // Navigation should still work if marking the item read is temporarily unavailable.
      }
    }
    setNotificationOpen(false)
    navigate(notification.link || notificationPath)
  }

  useEffect(() => {
    loadNotifications()
    const refreshInterval = window.setInterval(loadNotifications, 30_000)
    return () => window.clearInterval(refreshInterval)
  }, [user?.id])

  useEffect(() => {
    if (!notificationOpen) return undefined

    const closeOnOutsideInteraction = (event) => {
      if (!notificationMenuRef.current?.contains(event.target)) {
        setNotificationOpen(false)
      }
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setNotificationOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideInteraction)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideInteraction)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [notificationOpen])

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border-default)] bg-white px-4 shadow-none md:px-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggleSidebar} className="portal-button-ghost h-10 w-10 md:hidden" aria-label="Open navigation">
          <Menu className="h-4 w-4" />
        </button>
        <p className="font-display text-sm font-semibold capitalize text-[var(--brand-navy)]">{currentPage}</p>
      </div>
      <div className="flex items-center gap-3">
        <div ref={notificationMenuRef} className="relative">
          <button type="button" onClick={toggleNotifications} className="portal-button-ghost relative h-9 w-9" aria-label="Notifications" aria-expanded={notificationOpen}>
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-red)] px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
          </button>
          {notificationOpen ? (
            <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-[var(--border-default)] bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
                <span className="text-sm font-semibold text-[var(--text-primary)]">Notifications</span>
                {unreadCount > 0 ? <span className="rounded-full bg-[var(--brand-red-light)] px-2 py-0.5 text-xs font-medium text-[var(--brand-red)]">{unreadCount} new</span> : null}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notificationsLoading ? <p className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">Loading notifications…</p> : notifications.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No notifications</p> : notifications.map((notification) => (
                  <button key={notification.id} type="button" onClick={() => openNotification(notification)} className={`w-full border-b border-[var(--border-default)] px-4 py-3 text-left transition hover:bg-[var(--bg-app)] ${notification.is_read ? '' : 'bg-[var(--brand-red-light)]/40'}`}>
                    <div className="flex items-start justify-between gap-3"><span className="text-sm font-medium text-[var(--text-primary)]">{notification.title}</span>{!notification.is_read ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--brand-red)]" /> : null}</div>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{notification.body}</p>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => { setNotificationOpen(false); navigate(notificationPath) }} className="w-full px-4 py-3 text-center text-sm font-medium text-[var(--brand-navy)] transition hover:bg-[var(--bg-app)]">See all notifications</button>
            </div>
          ) : null}
        </div>
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
