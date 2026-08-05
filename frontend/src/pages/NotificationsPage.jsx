import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'

import { notificationsApi } from '../api/notifications.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useApi } from '../hooks/useApi.js'
import EmptyState from '../components/shared/EmptyState.jsx'
import PageHeader from '../components/shared/PageHeader.jsx'

const notificationTime = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : ''

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading, refetch } = useApi(() => notificationsApi.list(), [])
  const notifications = data?.notifications || []
  const unreadCount = data?.unread_count || 0

  const openNotification = async (notification) => {
    try {
      if (!notification.is_read) await notificationsApi.markRead(notification.id)
      if (notification.link) navigate(notification.link)
      else refetch()
    } catch {
      toast.error('Could not update notification')
    }
  }

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead()
      refetch()
    } catch {
      toast.error('Could not mark notifications as read')
    }
  }

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Stay up to date with meetings, action items, results, and portal updates." />
      {unreadCount > 0 ? <div className="mb-5 flex justify-end"><button type="button" onClick={markAllRead} className="portal-button-secondary"><CheckCheck className="h-4 w-4" />Mark all as read</button></div> : null}
      {loading ? <div className="portal-panel text-sm text-[var(--text-muted)]">Loading notifications…</div> : notifications.length === 0 ? <EmptyState icon={Bell} title="No notifications" message="You are all caught up." /> : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <button key={notification.id} type="button" onClick={() => openNotification(notification)} className={`portal-panel w-full text-left transition hover:border-[var(--brand-blue)] hover:shadow-sm ${notification.is_read ? '' : 'border-l-4 border-l-[var(--brand-red)] bg-[var(--brand-red-light)]/35'}`}>
              <div className="flex items-start justify-between gap-4"><div><div className="text-sm font-semibold text-[var(--text-primary)]">{notification.title}</div><p className="mt-1 text-sm text-[var(--text-secondary)]">{notification.body}</p></div>{!notification.is_read ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--brand-red)]" /> : null}</div>
              <div className="mt-3 text-xs text-[var(--text-muted)]">{notificationTime(notification.created_at)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
