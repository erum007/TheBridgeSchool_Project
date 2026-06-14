import { useMemo, useState } from 'react'
import { CalendarDays, ClipboardList, FileText, Megaphone, MessageSquareMore, Shield, Sparkles, Trophy, Users, WalletCards } from 'lucide-react'

import { useAuth } from '../../context/AuthContext.jsx'
import AppHeader from './AppHeader.jsx'
import Sidebar from './Sidebar.jsx'

const adminNav = [
  { label: 'Operations', items: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: Shield },
    { to: '/admin/meetings', label: 'Meeting Workspace', icon: CalendarDays },
    { to: '/admin/email', label: 'Email Module', icon: MailIcon },
    { to: '/admin/results', label: 'Performance Broadcaster', icon: Trophy },
    { to: '/admin/whatsapp', label: 'WhatsApp Alerts', icon: MessageSquareMore },
    { to: '/admin/portal', label: 'Portal Management', icon: Users },
  ] },
]

function MailIcon(props) {
  return <FileText {...props} />
}

const teacherNav = [
  { label: 'Teacher', items: [
    { to: '/teacher/dashboard', label: 'Dashboard', icon: Shield },
    { to: '/teacher/meetings', label: 'Meeting Workspace', icon: CalendarDays },
    { to: '/teacher/results', label: 'Performance Broadcaster', icon: Trophy },
    { to: '/teacher/broadcast', label: 'Broadcaster', icon: Megaphone },
  ] },
]

const studentNav = [
  { label: 'Student', items: [
    { to: '/student/home', label: 'Home', icon: Shield },
    { to: '/student/progress', label: 'Progress Dashboard', icon: Sparkles },
    { to: '/student/results', label: 'Result History', icon: ClipboardList },
    { to: '/student/notices', label: 'Notice Board', icon: FileText },
    { to: '/student/opportunities', label: 'Opportunities', icon: WalletCards },
    { to: '/student/settings', label: 'Settings', icon: Users },
  ] },
]

const parentNav = [
  { label: 'Parent', items: [
    { to: '/parent/home', label: 'Home', icon: Shield },
    { to: '/parent/progress', label: 'Progress Dashboard', icon: Sparkles },
    { to: '/parent/results', label: 'Result History', icon: ClipboardList },
    { to: '/parent/notices', label: 'Notice Board', icon: FileText },
    { to: '/parent/opportunities', label: 'Opportunities', icon: WalletCards },
    { to: '/parent/settings', label: 'Settings', icon: Users },
  ] },
]

export function AppLayout({ children }) {
  const { role } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navGroups = useMemo(() => {
    if (role === 'teacher') return teacherNav
    if (role === 'student') return studentNav
    if (role === 'parent') return parentNav
    return adminNav
  }, [role])

  return (
    <div className="portal-shell">
      <Sidebar mobileOpen={mobileOpen} navGroups={navGroups} onClose={() => setMobileOpen(false)} />
      {mobileOpen ? <div className="fixed inset-0 z-30 bg-[rgba(27,43,107,0.25)] md:hidden" onClick={() => setMobileOpen(false)} /> : null}
      <div className="min-h-screen transition-all duration-200 md:pl-[240px]">
        <AppHeader onToggleSidebar={() => setMobileOpen((value) => !value)} />
        <main className="px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
