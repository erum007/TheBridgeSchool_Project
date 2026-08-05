import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import BlotFormatter from "@enzedonline/quill-blot-formatter2";
import "@enzedonline/quill-blot-formatter2/dist/css/quill-blot-formatter2.css";
Quill.register("modules/blotFormatter2", BlotFormatter);
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
Quill.register("modules/blotFormatter", BlotFormatter);
const BlockEmbed = Quill.import('blots/block/embed')

class DividerBlot extends BlockEmbed {
  static blotName = 'divider'
  static tagName = 'hr'
}
class EmailButtonBlot extends BlockEmbed {
  static blotName = 'emailButton'
  static tagName = 'div'
  static className = 'email-button-block'
  static create(value) {
    const node = super.create()
    const link = document.createElement('a')
    link.href = value.url
    link.textContent = value.text
    link.style.cssText = `display:inline-block;padding:12px 22px;border-radius:6px;background:${value.color || '#1b2b6b'};color:#fff;text-decoration:none;font-weight:700;`
    node.appendChild(link)
    return node
  }
  static value(node) { const link = node.querySelector('a'); return { text: link?.textContent, url: link?.href } }
}
Quill.register(DividerBlot)
Quill.register(EmailButtonBlot)
import axios from "axios";
import { jsPDF } from 'jspdf'
import { format, parseISO } from 'date-fns'
import {
  BookOpen,
  CalendarDays,
  ChartColumnBig,
  CirclePlus,
  Download,
  FileText,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'react-hot-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext.jsx'
import { useApi } from '../hooks/useApi.js'
import { formatApiError, isValidPortalPassword } from '../utils/apiErrors.js'
import { dashboardApi } from '../api/dashboard.js'
import { meetingsApi } from '../api/meetings.js'
import { actionItemsApi } from '../api/actionItems.js'
import { emailsApi } from '../api/emails.js'
import { resultsApi } from '../api/results.js'
import { noticesApi } from '../api/notices.js'
import { opportunitiesApi } from '../api/opportunities.js'
import { usersApi } from '../api/users.js'
import { authApi } from '../api/auth.js'
import { departmentsApi } from '../api/departments.js'
import { whatsappApi } from '../api/whatsapp.js'

import Badge from '../components/shared/Badge.jsx'
import EmptyState from '../components/shared/EmptyState.jsx'
import FileUploadZone from '../components/shared/FileUploadZone.jsx'
import KanbanBoard from '../components/shared/KanbanBoard.jsx'
import Modal from '../components/shared/Modal.jsx'
import PageHeader from '../components/shared/PageHeader.jsx'
import Table from '../components/shared/Table.jsx'
import StatCard from '../components/shared/StatCard.jsx'
import Tabs from '../components/shared/Tabs.jsx'
import { SkeletonCardGrid, SkeletonStatGrid, SkeletonTable, SkeletonList, TopProgressBar } from '../components/shared/Skeleton.jsx'
import CreateMeetingModal from '../components/shared/CreateMeetingModal.jsx'
import UserSearchSelect from '../components/shared/UserSearchSelect.jsx'
import RecipientSearchSelect from '../components/shared/RecipientSearchSelect.jsx'
const formatDate = (value, pattern = 'PPP') => (value ? format(parseISO(value), pattern) : '—')
const parentChildPrefix = (user) => user?.role === 'parent' && user.children?.[0]?.name ? `${user.children[0].name}'s ` : ''
const todayInputValue = () => new Date().toISOString().slice(0, 10)
const futureDateTimeInputValue = () => {
  const now = new Date()
  now.setMinutes(now.getMinutes() + 1, 0, 0)
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const prepareProfileImage = (file) => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file'))
  const source = new Image()
  const objectUrl = URL.createObjectURL(file)
  source.onload = () => {
    URL.revokeObjectURL(objectUrl)
    const cropSize = Math.min(source.naturalWidth, source.naturalHeight)
    const startX = Math.floor((source.naturalWidth - cropSize) / 2)
    const startY = Math.floor((source.naturalHeight - cropSize) / 2)
    for (const size of [256, 192, 160, 128, 96]) {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      canvas.getContext('2d').drawImage(source, startX, startY, cropSize, cropSize, 0, 0, size, size)
      for (const quality of [0.78, 0.62, 0.46]) {
        const image = canvas.toDataURL('image/jpeg', quality)
        if (image.length <= 3000) return resolve(image)
      }
    }
    reject(new Error('This image could not be optimized. Please choose another image.'))
  }
  source.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('The image could not be read')) }
  source.src = objectUrl
})
const formatDateTime = (value, pattern = 'PPP p') => (value ? format(parseISO(value), pattern) : '—')
const createEmptyNoticeForm = () => ({ title: '', body: '', recipient_roles: ['all'], recipient_department_ids: [], recipient_user_ids: [], status: 'published', publish_mode: 'now', publish_datetime: '' })
const noticeRoleLabels = {
  all: 'All',
  students: 'Students',
  parents: 'Parents',
  teachers: 'Teachers',
  staff: 'Staff',
}
const getNoticeRecipientSummary = (notice) => {
  const roles = Array.isArray(notice?.recipient_roles) ? notice.recipient_roles : []
  const departments = Array.isArray(notice?.recipient_department_names) ? notice.recipient_department_names : []
  const usersCount = Array.isArray(notice?.recipient_users) ? notice.recipient_users.length : 0
  if (!roles.length && !departments.length && !usersCount) return 'All recipients'
  const roleSummary = roles.includes('all') ? 'All' : roles.map((role) => noticeRoleLabels[role] || role).join(', ')
  const departmentSummary = departments.length ? `Departments: ${departments.join(', ')}` : ''
  const usersSummary = usersCount > 0 ? `${usersCount} user${usersCount !== 1 ? 's' : ''}` : ''
  return [roleSummary, departmentSummary, usersSummary].filter(Boolean).join(' • ')
}

function AttachmentList({ attachments, onRemove }) {
  return (
    <div className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Email attachments</div>
      <div className="space-y-1">
        {attachments.map((attachment) => (
          <div key={attachment.stored_filename} className="flex items-center justify-between gap-3 text-sm text-[var(--text-primary)]">
            <span className="min-w-0 truncate">{attachment.filename}</span>
            <button type="button" className="portal-button-ghost shrink-0 text-[var(--brand-red)]" onClick={() => onRemove(attachment.stored_filename)} aria-label={`Remove ${attachment.filename}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LoginPageView({ onLogin }) {
  return onLogin
}

export function AdminDashboardView() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading, refetch } = useApi(() => dashboardApi.summary(), [])
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Good morning, ${user?.name || 'Administrator'}`} action={{ label: 'New Meeting', icon: CirclePlus, onClick: () => setCreateOpen(true) }} />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Pending Actions" value={data?.pending_actions ?? 0} subtitle="Tasks awaiting action" icon={Sparkles} loading={loading} onClick={() => navigate('/admin/meetings?tab=board')} />
        <StatCard title="Scheduled Emails" value={data?.scheduled_emails ?? 0} subtitle="Queued communication" icon={Send} loading={loading} onClick={() => navigate('/admin/email')} />
        <StatCard title="Overdue Tasks" value={data?.overdue_tasks ?? 0} subtitle="Needs attention" icon={CalendarDays} loading={loading} onClick={() => navigate('/admin/meetings?tab=board')} />
      </div>
      <div className="mt-6 flex gap-3">
        <button type="button" className="portal-button-primary" onClick={() => setCreateOpen(true)}>New Meeting</button>
        <button type="button" className="portal-button-secondary" onClick={() => navigate('/admin/email')}>Schedule Email</button>
      </div>
      <CreateMeetingModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={refetch} />
    </div>
  )
}

export function MeetingWorkspaceView({ canCreateMeeting }) {
  const [searchParams] = useSearchParams()
  const { data: meetings = [], loading: meetingsLoading, error: meetingsError, refetch: refetchMeetings } = useApi(() => meetingsApi.list(), [])
  const { data: actionItems = [], error: actionItemsError, refetch: refetchActions } = useApi(() => actionItemsApi.list(), [])
  const { data: users = [], error: usersError } = useApi(() => usersApi.list(), [])
  const [meetingModalOpen, setMeetingModalOpen] = useState(false)
  const [localActionItems, setLocalActionItems] = useState([])
  const [pendingActionStatusIds, setPendingActionStatusIds] = useState({})
  const [pendingReminderIds, setPendingReminderIds] = useState({})
  const [cooldownReminderIds, setCooldownReminderIds] = useState({})
  const localActionItemsRef = useRef([])
  const [selectedPastMeeting, setSelectedPastMeeting] = useState(null)
  const [notes, setNotes] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summary, setSummary] = useState('')
  const [keyDecisions, setKeyDecisions] = useState([])
  const [generatedActionItems, setGeneratedActionItems] = useState([])
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const initialWorkspaceTab = searchParams.get('tab')
  const [workspaceTab, setWorkspaceTab] = useState(['meetings', 'past', 'board'].includes(initialWorkspaceTab) ? initialWorkspaceTab : 'meetings')
  const [actionForm, setActionForm] = useState({ meeting_id: '', description: '', assigned_to: '', due_date: '', email_reminder_frequency: 'none', email_reminder_at: '' })
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false)

  const visibleMeetings = meetings.filter((meeting) => meeting.status)
  const pastMeetings = useMemo(() => meetings.filter((meeting) => meeting.status === 'past'), [meetings])
  useEffect(() => {
    setLocalActionItems(actionItems)
    localActionItemsRef.current = actionItems
  }, [actionItems])
  const filteredActions = useMemo(() => {
    const visibleItems = localActionItems.length ? localActionItems : actionItems
    if (assigneeFilter === 'all') return visibleItems
    return visibleItems.filter((item) => String(item.assigned_to) === String(assigneeFilter))
  }, [actionItems, assigneeFilter, localActionItems])
  const assignableUsers = useMemo(() => users.filter((person) => person.is_active && ['admin', 'teacher', 'staff'].includes(person.role)), [users])
  const assigneeMatches = useMemo(() => {
    const query = assigneeSearch.trim().toLowerCase()
    return (query ? assignableUsers.filter((person) => `${person.name} ${person.email} ${person.role}`.toLowerCase().includes(query)) : assignableUsers).slice(0, 8)
  }, [assignableUsers, assigneeSearch])

  useEffect(() => {
    if (meetingsError) console.error('Failed to load meetings for the workspace', meetingsError)
  }, [meetingsError])

  useEffect(() => {
    if (actionItemsError) console.error('Failed to load workspace action items', actionItemsError)
  }, [actionItemsError])

  useEffect(() => {
    if (usersError) console.error('Failed to load workspace users', usersError)
  }, [usersError])

  useEffect(() => {
    if (!selectedPastMeeting && pastMeetings.length) {
      setSelectedPastMeeting(pastMeetings[0].id)
      setNotes(pastMeetings[0].notes || '')
      setSummary(pastMeetings[0].ai_summary || '')
    }
  }, [pastMeetings, selectedPastMeeting])

  useEffect(() => {
    const nextMeeting = pastMeetings.find((meeting) => meeting.id === Number(selectedPastMeeting))
    if (nextMeeting) {
      setNotes(nextMeeting.notes || '')
      setSummary(nextMeeting.ai_summary || '')
    }
  }, [selectedPastMeeting, pastMeetings])

  const saveNotes = async () => {
    if (!selectedPastMeeting) {
      toast.error('Select a past meeting before saving notes')
      return
    }
    try {
      await meetingsApi.update(selectedPastMeeting, { notes })
      toast.success('Notes saved')
      refetchMeetings()
    } catch (error) {
      console.error('Failed to save meeting notes', error)
      toast.error(error?.response?.data?.detail || 'Could not save notes')
    }
  }

  const generateSummary = async () => {
    if (!selectedPastMeeting) {
      toast.error('Select a past meeting before generating an AI summary')
      return
    }
    const transcript = notes.trim()
    if (!transcript) {
      toast.error('Add meeting notes before generating an AI summary')
      return
    }
    setSummaryLoading(true)
    try {
      const response = await meetingsApi.generateAiWorkspace(selectedPastMeeting, { transcript, notes: transcript })
      const result = response.data || {}
      setSummary(typeof result.summary === 'string' ? result.summary : '')
      setKeyDecisions(Array.isArray(result.key_decisions) ? result.key_decisions : [])
      setGeneratedActionItems(Array.isArray(result.action_items) ? result.action_items : [])
      refetchMeetings()
      refetchActions()
      toast.success('AI workspace generated')
    } catch (error) {
      console.error('Failed to generate AI meeting workspace', error)
      toast.error(error?.response?.data?.detail || 'Could not generate summary')
    } finally {
      setSummaryLoading(false)
    }
  }

  const downloadSummaryPdf = () => {
    const meeting = pastMeetings.find((item) => item.id === Number(selectedPastMeeting))
    if (!meeting || !summary) {
      toast.error('Generate or select a meeting summary before downloading it')
      return
    }

    const document = new jsPDF()
    const margin = 18
    const pageWidth = document.internal.pageSize.getWidth()
    const pageHeight = document.internal.pageSize.getHeight()
    const contentWidth = pageWidth - (margin * 2)
    let y = 20
    const addLines = (text, size = 11) => {
      document.setFontSize(size)
      const lines = document.splitTextToSize(String(text), contentWidth)
      lines.forEach((line) => {
        if (y > pageHeight - 18) {
          document.addPage()
          y = 20
        }
        document.text(line, margin, y)
        y += size * 0.48 + 2
      })
    }
    const meetingDate = format(parseISO(meeting.scheduled_at), 'd MMMM yyyy, h:mm a')

    document.setFont('helvetica', 'bold')
    addLines(`Summary for: ${meeting.title} - ${meetingDate}`, 16)
    y += 4
    document.setFont('helvetica', 'normal')
    addLines(`Meeting date and time: ${meetingDate}`)
    y += 5
    document.setFont('helvetica', 'bold')
    addLines('AI-generated summary', 13)
    document.setFont('helvetica', 'normal')
    addLines(summary)

    if (keyDecisions.length) {
      y += 4
      document.setFont('helvetica', 'bold')
      addLines('Key decisions', 13)
      document.setFont('helvetica', 'normal')
      keyDecisions.forEach((decision) => addLines(`- ${decision}`))
    }

    if (generatedActionItems.length) {
      y += 4
      document.setFont('helvetica', 'bold')
      addLines('Action items', 13)
      document.setFont('helvetica', 'normal')
      generatedActionItems.forEach((item) => {
        const owner = item.owner || 'Unassigned'
        const dueDate = item.due_date || 'No due date'
        addLines(`- ${item.task || 'Untitled action'} - Owner: ${owner}; Due: ${dueDate}`)
      })
    }

    const slug = meeting.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meeting'
    const dateForFilename = format(parseISO(meeting.scheduled_at), 'yyyy-MM-dd')
    document.save(`meeting-summary-${slug}-${dateForFilename}.pdf`)
  }

  const boardColumns = ['todo', 'in_progress', 'done'].map((status) => ({
    id: status,
    title: status.replace('_', ' ').toUpperCase(),
    items: filteredActions.filter((item) => item.status === status).map((item) => ({
      ...item,
      assignedToName: item.assigned_to_name,
      dueDate: item.due_date ? formatDate(item.due_date) : '',
    })),
  }))

  const changeActionStatus = async (id, status) => {
    const actionItemId = String(id)
    const previousStatus = localActionItemsRef.current.find((item) => String(item.id) === actionItemId)?.status

    setPendingActionStatusIds((current) => ({ ...current, [actionItemId]: true }))
    setLocalActionItems((current) => current.map((item) => (String(item.id) === actionItemId ? { ...item, status } : item)))
    localActionItemsRef.current = localActionItemsRef.current.map((item) => (String(item.id) === actionItemId ? { ...item, status } : item))

    try {
      await actionItemsApi.update(id, { status })
      refetchActions()
      toast.success('Action item updated')
    } catch (error) {
      setLocalActionItems((current) => current.map((item) => (String(item.id) === actionItemId ? { ...item, status: previousStatus || item.status } : item)))
      localActionItemsRef.current = localActionItemsRef.current.map((item) => (String(item.id) === actionItemId ? { ...item, status: previousStatus || item.status } : item))
      console.error('Failed to update action item status', error)
      toast.error(error?.response?.data?.detail || 'Could not update action item')
    } finally {
      setPendingActionStatusIds((current) => {
        const next = { ...current }
        delete next[actionItemId]
        return next
      })
    }
  }

  const createActionItem = async (event) => {
    event.preventDefault()
    try {
      await actionItemsApi.create(actionForm)
      setActionForm({ meeting_id: '', description: '', assigned_to: '', due_date: '', email_reminder_frequency: 'none', email_reminder_at: '' })
      setAssigneeSearch('')
      setAssigneePickerOpen(false)
      refetchActions()
      toast.success('Action item created')
    } catch (error) {
      console.error('Failed to create action item', error)
      toast.error(error?.response?.data?.detail || 'Could not create action item')
    }
  }

  const sendReminderNow = async (id) => {
    const actionItemId = String(id)
    if (pendingReminderIds[actionItemId] || cooldownReminderIds[actionItemId]) {
      return
    }
    setPendingReminderIds((current) => ({ ...current, [actionItemId]: true }))
    try {
      const response = await actionItemsApi.sendReminderNow(id)
      toast.success(response?.data?.detail || 'Reminder sent')
      setCooldownReminderIds((current) => ({ ...current, [actionItemId]: true }))
      window.setTimeout(() => {
        setCooldownReminderIds((current) => {
          const next = { ...current }
          delete next[actionItemId]
          return next
        })
      }, 4000)
    } catch (error) {
      console.error('Failed to send reminder now', error)
      toast.error(error?.response?.data?.detail || 'Could not send reminder')
    } finally {
      setPendingReminderIds((current) => {
        const next = { ...current }
        delete next[actionItemId]
        return next
      })
    }
  }

  return (
    <div>
      <PageHeader title="Meeting Workspace" subtitle="Coordinate discussions and track decisions." action={canCreateMeeting ? { label: 'New Meeting', icon: CirclePlus, onClick: () => setMeetingModalOpen(true) } : null} />
      <Tabs
        activeTab={workspaceTab}
        onTabChange={setWorkspaceTab}
        tabs={[
          {
            id: 'meetings',
            label: 'All Meetings',
            content: (
              <Table
                loading={meetingsLoading}
                data={visibleMeetings}
                columns={[
                  { key: 'scheduled_at', label: 'Date', render: (row) => formatDate(row.scheduled_at) },
                  { key: 'title', label: 'Title' },
                  { key: 'department', label: 'Department' },
                  { key: 'attendees', label: 'Attendees', render: (row) => row.attendees?.length ?? 0, align: 'right' },
                  { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
                ]}
                emptyMessage="No meetings have been scheduled yet."
              />
            ),
          },
          {
            id: 'past',
            label: 'Past Meetings & AI Summary',
            content: (
              <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-xl border border-[var(--border-default)] bg-white p-4">
                  <label className="portal-label block">Past meetings</label>
                  <select className="portal-input mt-1" value={selectedPastMeeting || ''} onChange={(event) => {
                    setSelectedPastMeeting(event.target.value)
                    setKeyDecisions([])
                    setGeneratedActionItems([])
                  }}>
                    {pastMeetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}
                  </select>
                  <div className="mt-4 text-sm text-[var(--text-secondary)]">
                    Select a completed meeting to review notes and generate a summary.
                  </div>
                </div>
                <div className="space-y-4 portal-panel">
                  <div>
                    <label className="portal-label block">Meeting notes</label>
                    <textarea className="portal-input mt-1 min-h-40" value={notes} onChange={(event) => setNotes(event.target.value)} onBlur={saveNotes} />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="portal-button-primary" onClick={generateSummary} disabled={summaryLoading}>{summaryLoading ? 'Generating...' : 'Generate AI Summary'}</button>
                    <button type="button" className="portal-button-secondary" onClick={saveNotes}>Save Notes</button>
                    {summary ? <button type="button" className="portal-button-secondary" onClick={downloadSummaryPdf}>Download Summary as PDF</button> : null}
                  </div>
                  <div className="rounded-lg border-l-4 border-[var(--brand-red)] bg-[var(--brand-red-light)] p-4 text-sm text-[var(--brand-navy)]">
                    <p>{summary || 'AI summary will appear here after generation.'}</p>
                    {keyDecisions.length > 0 && (
                      <div className="mt-3">
                        <p className="font-semibold">Key decisions</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {keyDecisions.map((decision, index) => <li key={`${decision}-${index}`}>{decision}</li>)}
                        </ul>
                      </div>
                    )}
                    {generatedActionItems.length > 0 && (
                      <div className="mt-3">
                        <p className="font-semibold">Generated action items</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {generatedActionItems.map((item, index) => (
                            <li key={`${item.task || 'action'}-${index}`}>
                              {item.task || 'Untitled action'}{item.owner ? ` — ${item.owner}` : ''}{item.due_date ? ` (due ${item.due_date})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: 'board',
            label: 'Action Items Board',
            content: (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="portal-label block">Filter by assignee</label>
                    <select className="portal-input mt-1" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
                      <option value="all">All assignees</option>
                      {assignableUsers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                    </select>
                  </div>
                </div>
                <KanbanBoard columns={boardColumns} onStatusChange={changeActionStatus} pendingStatusItemIds={pendingActionStatusIds} onSendReminderNow={sendReminderNow} pendingReminderIds={pendingReminderIds} cooldownReminderIds={cooldownReminderIds} />
                {canCreateMeeting ? <form className="grid gap-4 portal-panel lg:grid-cols-4" onSubmit={createActionItem}>
                  <select className="portal-input" value={actionForm.meeting_id} onChange={(event) => setActionForm({ ...actionForm, meeting_id: event.target.value })}>
                    <option value="">Select meeting</option>
                    {meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}
                  </select>
                  <input className="portal-input" placeholder="Action item description" value={actionForm.description} onChange={(event) => setActionForm({ ...actionForm, description: event.target.value })} />
                  <UserSearchSelect
                    users={assignableUsers}
                    value={actionForm.assigned_to}
                    onChange={(id) => setActionForm({ ...actionForm, assigned_to: id })}
                    placeholder="Search staff or teacher to assign..."
                  />
                  <select className="portal-input" value={actionForm.email_reminder_frequency} onChange={(event) => setActionForm({ ...actionForm, email_reminder_frequency: event.target.value })}>
                    <option value="none">No email reminder</option>
                    <option value="hourly">Email: hourly</option>
                    <option value="daily">Email: daily</option>
                    <option value="weekly">Email: weekly</option>
                    <option value="custom">Email: once at custom time</option>
                  </select>
                  <div className="flex flex-col gap-2">
                    <label className="portal-label block">Action due date</label>
                    <input type="date" min={todayInputValue()} className="portal-input" value={actionForm.due_date} onChange={(event) => setActionForm({ ...actionForm, due_date: event.target.value })} />
                  </div>
                  <button type="submit" className="portal-button-primary whitespace-nowrap">Add Action Item</button>
                  {actionForm.email_reminder_frequency !== 'none' ? (
                    <div className="lg:col-span-2">
                      <label className="portal-label block">When should the first reminder be sent?</label>
                      <input type="datetime-local" min={futureDateTimeInputValue()} required className="portal-input mt-1" value={actionForm.email_reminder_at} onChange={(event) => setActionForm({ ...actionForm, email_reminder_at: event.target.value })} />
                      <p className="mt-2 text-xs text-[var(--text-muted)]">This is separate from the action due date. The reminder time controls when the first email is sent, while the due date controls the task deadline.</p>
                    </div>
                  ) : null}
                  {actionForm.email_reminder_frequency !== 'none' ? (
                    <p className="lg:col-span-2 text-xs text-[var(--text-muted)]">Reminders are sent to the assignee&apos;s registered email address and stop once the action item is marked done.</p>
                  ) : null}
                </form> : null}
              </div>
            ),
          },
        ]}
      />
      {canCreateMeeting ? <CreateMeetingModal isOpen={meetingModalOpen} onClose={() => setMeetingModalOpen(false)} onCreated={() => { refetchMeetings(); refetchActions() }} /> : null}
    </div>
  )
}

export function EmailModuleView() {
  const { data: emails = [], loading: emailsLoading, refetch: refetchEmails } = useApi(() => emailsApi.list(), [])
  const { data: templates = [], loading: templatesLoading, refetch: refetchTemplates } = useApi(() => emailsApi.templates(), [])
  const [tab, setTab] = useState('dashboard')
  const emptyCompose = { recipient_group: 'parents', individual_emails: '', template_id: '', subject: '', preheader: '', body: '', scheduled_at: '', attachments: [] }
  const emptyTemplate = { name: '', subject: '', preheader: '', body: '', attachments: [], category: '', tags: [], is_favorite: false, publication_status: 'published' }
  const [compose, setCompose] = useState(emptyCompose)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [editingDraftId, setEditingDraftId] = useState(null)
  const [deliveryMode, setDeliveryMode] = useState('now')
  const [templateForm, setTemplateForm] = useState(emptyTemplate)
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templatePendingDeletion, setTemplatePendingDeletion] = useState(null)
  const [draftPendingDeletion, setDraftPendingDeletion] = useState(null)
  const attachmentTargetRef = useRef('compose')
  const draftEmails = emails.filter((item) => item.status === 'draft')
  const scheduledEmails = emails.filter((item) => item.status === 'scheduled')
  const sentEmails = emails.filter((item) => item.status === 'sent')
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState('template')
  const [previewDevice, setPreviewDevice] = useState('desktop')
  const [previewDark, setPreviewDark] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateCategory, setTemplateCategory] = useState('')
  const [editorDialog, setEditorDialog] = useState(null)
  const [dialogForm, setDialogForm] = useState({})
  const [historyTemplate, setHistoryTemplate] = useState(null)
  const pendingEditorRef = useRef(null)
  const pendingImageRef = useRef(null)
  const testSourceRef = useRef(null)
  const filteredTemplates = templates.filter((item) => {
    const query = templateSearch.toLowerCase()
    const tags = Array.isArray(item.tags) ? item.tags : []
    return (!query || `${item.name || ''} ${item.subject || ''} ${tags.join(' ')}`.toLowerCase().includes(query)) && (!templateCategory || item.category === templateCategory)
  })
  const minimumScheduleTime = useMemo(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 1, 0, 0)
    const offset = now.getTimezoneOffset() * 60_000
    return new Date(now.getTime() - offset).toISOString().slice(0, 16)
  }, [])
  useEffect(() => {
    const labels = { document: 'Attach file', table: 'Insert table', button: 'Insert button', divider: 'Insert divider', variable: 'Insert personalization', blocks: 'Insert content block', undo: 'Undo', redo: 'Redo' }
    const applyLabels = () => Object.entries(labels).forEach(([name, label]) => {
      document.querySelectorAll(`.email-editor .ql-${name}`).forEach((button) => {
        button.title = label
        button.setAttribute('aria-label', label)
      })
    })
    applyLabels()
    const observer = new MutationObserver(applyLabels)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [tab])
  const imageHandler = useCallback(function imageHandler() {
    const editor = this.quill;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await emailsApi.uploadImage(formData);
        const range = editor.getSelection(true);
        pendingImageRef.current = { editor, range, url: response.data.url }
        setDialogForm({ alt: file.name.replace(/\.[^.]+$/, '') })
        setEditorDialog('image')
      } catch (error) {
        console.error("Image upload failed", error);
        toast.error("Image upload failed.");
      }
    };

    input.click();
  }, []);

  const documentHandler = useCallback(function documentHandler() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await emailsApi.uploadDocument(formData);
        const attachment = response.data;
        if (attachmentTargetRef.current === 'template') {
          setTemplateForm((current) => ({ ...current, attachments: [...current.attachments, attachment] }));
        } else {
          setCompose((current) => ({ ...current, attachments: [...current.attachments, attachment] }));
        }
        toast.success(`${attachment.filename} attached`);
      } catch (error) {
        console.error("Document upload failed", error);
        toast.error(error?.response?.data?.detail || "Document upload failed.");
      }
    };

    input.click();
  }, []);

  const insertAtSelection = (editor, blot, value) => {
    const range = editor.getSelection(true)
    editor.insertText(range.index, '\n', 'silent')
    editor.insertEmbed(range.index + 1, blot, value, 'user')
    editor.setSelection(range.index + 2, 0, 'silent')
  }
  const tableHandler = useCallback(function tableHandler() {
    pendingEditorRef.current = this.quill
    setDialogForm({ rows: 3, cols: 3 })
    setEditorDialog('table')
  }, [])
  const buttonHandler = useCallback(function buttonHandler() {
    pendingEditorRef.current = this.quill
    setDialogForm({ text: 'View details', url: 'https://', color: '#1b2b6b' })
    setEditorDialog('button')
  }, [])
  const dividerHandler = useCallback(function dividerHandler() { insertAtSelection(this.quill, 'divider', true) }, [])
  const variableHandler = useCallback(function variableHandler() {
    pendingEditorRef.current = this.quill
    setDialogForm({ variable: 'student_name' })
    setEditorDialog('variable')
  }, [])
  const blocksHandler = useCallback(function blocksHandler() {
    pendingEditorRef.current = this.quill
    setDialogForm({ block: 'announcement' })
    setEditorDialog('blocks')
  }, [])
  const undoHandler = useCallback(function undoHandler() { this.quill.history.undo() }, [])
  const redoHandler = useCallback(function redoHandler() { this.quill.history.redo() }, [])

  // ReactQuill recreates its editor when `modules` changes. Keeping this object stable
  // prevents the formatter from being destroyed after the first resize pointer event.
  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ indent: '-1' }, { indent: '+1' }, { align: [] }, { direction: 'rtl' }],
        [{ script: 'sub' }, { script: 'super' }, 'blockquote'],
        ["link", "image", "document", "table", "button", "divider", "variable", "blocks"],
        ['undo', 'redo'],
        ["clean"],
      ],
      handlers: { image: imageHandler, document: documentHandler, table: tableHandler, button: buttonHandler, divider: dividerHandler, variable: variableHandler, blocks: blocksHandler, undo: undoHandler, redo: redoHandler },
    },
    blotFormatter2: {
      resize: {
        allowResizing: true,
        useRelativeSize: false,
        minimumWidthPx: 25,
      },
      image: { autoHeight: true },
    },
    history: { delay: 500, maxStack: 100, userOnly: true },
    table: true,
  }), [blocksHandler, buttonHandler, dividerHandler, documentHandler, imageHandler, redoHandler, tableHandler, undoHandler, variableHandler]);
  useEffect(() => {
    if (compose.template_id) return

    setCompose((current) => {
      if (!current.subject && !current.body && current.attachments.length === 0) return current
      return { ...current, subject: '', body: '', attachments: [] }
    })
  }, [compose.template_id])
  // useEffect(() => {
  //   const selectedTemplate = templates.find((template) => String(template.id) === String(compose.template_id))
  //   if (selectedTemplate) {
  //     setCompose((current) => ({ ...current, subject: selectedTemplate.subject, body: selectedTemplate.body }))
  //   }
  // }, [compose.template_id, templates])

  const submitCompose = async (event) => {
    event.preventDefault()
    const individualRecipients = compose.individual_emails.split(/[\s,;]+/).map((email) => email.trim()).filter(Boolean)
    if (compose.recipient_group === 'individual' && individualRecipients.length === 0) {
      toast.error('Please enter at least one email address')
      return
    }
    if (deliveryMode === 'schedule' && (!compose.scheduled_at || new Date(compose.scheduled_at) <= new Date())) {
      toast.error('Schedule time must be in the future')
      return
    }
    const issues = emailQualityIssues(compose)
    if (issues.some((issue) => issue.level === 'error')) {
      toast.error(issues.find((issue) => issue.level === 'error').message)
      return
    }
    try {
      const payload = {
        ...compose,
        recipient_group: compose.recipient_group === 'individual' ? individualRecipients.join(',') : compose.recipient_group,
        template_id: compose.template_id || null,
        scheduled_at: deliveryMode === 'schedule' ? compose.scheduled_at : null,
        draft_id: editingDraftId,
      }
      if (deliveryMode === 'schedule') {
        await emailsApi.schedule(payload)
      } else {
        await emailsApi.send(payload)
      }
      toast.success('Email saved')
      setCompose(emptyCompose)
      setSelectedTemplateId('')
      setEditingDraftId(null)
      setDeliveryMode('now')
      refetchEmails()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not save email')
    }
  }

  const saveDraft = async () => {
    const individualRecipients = compose.individual_emails.split(/[\s,;]+/).map((email) => email.trim()).filter(Boolean)
    if (compose.recipient_group === 'individual' && individualRecipients.length === 0) {
      toast.error('Please enter at least one email address')
      return
    }
    try {
      const payload = {
        ...compose,
        recipient_group: compose.recipient_group === 'individual' ? individualRecipients.join(',') : compose.recipient_group,
        template_id: compose.template_id || null,
        scheduled_at: null,
      }
      if (editingDraftId) {
        await emailsApi.updateDraft(editingDraftId, payload)
        toast.success('Draft updated')
      } else {
        const response = await emailsApi.saveDraft(payload)
        setEditingDraftId(response.data.id)
        toast.success('Draft saved')
      }
      setCompose(emptyCompose)
      setSelectedTemplateId('')
      setEditingDraftId(null)
      setDeliveryMode('now')
      refetchEmails()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not save draft')
    }
  }

  const loadDraft = (draft) => {
    const groupOptions = ['parents', 'students', 'teachers', 'all']
    const recipientGroup = groupOptions.includes(draft.recipient_group) ? draft.recipient_group : 'individual'
    setCompose({
      recipient_group: recipientGroup,
      individual_emails: recipientGroup === 'individual' ? draft.recipient_group : '',
      template_id: draft.template_id ? String(draft.template_id) : '',
      subject: draft.subject,
      preheader: draft.preheader || '',
      body: draft.body,
      scheduled_at: '',
      attachments: draft.attachments || [],
    })
    setSelectedTemplateId(draft.template_id ? String(draft.template_id) : '')
    setEditingDraftId(draft.id)
    setDeliveryMode('now')
    setTab('compose')
  }

  const deleteDraft = async () => {
    if (!draftPendingDeletion) return
    try {
      await emailsApi.remove(draftPendingDeletion.id)
      if (editingDraftId === draftPendingDeletion.id) {
        setEditingDraftId(null)
        setCompose(emptyCompose)
        setSelectedTemplateId('')
      }
      toast.success('Draft deleted')
      refetchEmails()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not delete draft')
    } finally {
      setDraftPendingDeletion(null)
    }
  }

  const submitTemplate = async (event) => {
    event.preventDefault()
    const visibleBody = templateForm.body
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .trim()
    if (!visibleBody) {
      toast.error('Body is required')
      return
    }
    try {
      if (editingTemplateId) {

        await emailsApi.updateTemplate(
            editingTemplateId,
            templateForm
        );

        toast.success("Template updated");

    } else {

        await emailsApi.createTemplate(templateForm);

        toast.success("Template created");

    }

    setEditingTemplateId(null);
    setTemplateForm(emptyTemplate);
    await refetchTemplates();
    } catch (error) {
      console.log(error)
      console.log(error.response)
      console.log(error.response?.data)
      
      toast.error(error?.response?.data?.detail || 'Could not create template')
    }
  }

  const deleteTemplate = async () => {
    if (!templatePendingDeletion) return
    const template = templatePendingDeletion
    try {
      await emailsApi.deleteTemplate(template.id)

      if (editingTemplateId === template.id) {
        setEditingTemplateId(null)
        setTemplateForm(emptyTemplate)
      }
      if (String(compose.template_id) === String(template.id)) {
        setSelectedTemplateId('')
        setCompose((current) => ({
          ...current,
          template_id: '',
          subject: '',
          body: '',
          attachments: [],
        }))
      }

      toast.success('Template deleted')
      refetchTemplates()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not delete template')
    } finally {
      setTemplatePendingDeletion(null)
    }
  }

  const sendTestEmail = (source) => {
    testSourceRef.current = source
    setDialogForm({ toEmail: '' })
    setEditorDialog('test')
  }

  const closeEditorDialog = () => {
    setEditorDialog(null)
    setDialogForm({})
    pendingEditorRef.current = null
    pendingImageRef.current = null
  }

  const applyEditorDialog = async () => {
    const editor = pendingEditorRef.current
    if (editorDialog === 'table') {
      const rows = Math.min(12, Math.max(1, Number(dialogForm.rows)))
      const cols = Math.min(8, Math.max(1, Number(dialogForm.cols)))
      const tableModule = editor.getModule('table')
      if (!tableModule?.insertTable) return toast.error('The table editor is unavailable')
      tableModule.insertTable(rows, cols)
    } else if (editorDialog === 'button') {
      if (!dialogForm.text?.trim() || !/^https?:\/\//i.test(dialogForm.url || '')) return toast.error('Enter button text and a valid http(s) link')
      insertAtSelection(editor, 'emailButton', dialogForm)
    } else if (editorDialog === 'variable') {
      const range = editor.getSelection(true)
      editor.insertText(range.index, `{{${dialogForm.variable}}}`, { bold: true, color: '#1b2b6b' }, 'user')
    } else if (editorDialog === 'blocks') {
      const blocks = {
        header: '<div style="text-align:center;padding:20px;background:#1b2b6b;color:#fff;"><h1 style="margin:0;">The Bridge School</h1></div>',
        announcement: '<div style="padding:18px;border-left:5px solid #c62828;background:#fff5f5;"><h2 style="margin-top:0;">Important announcement</h2><p>Add announcement details here.</p></div>',
        event: '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="padding:16px;background:#f2f4f8;"><strong>Event</strong><br>Date: {{date}}<br>Location: Add location</td></tr></table>',
        'two-column': '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td width="50%" valign="top" style="padding:12px;border:1px solid #ddd;">Left column</td><td width="50%" valign="top" style="padding:12px;border:1px solid #ddd;">Right column</td></tr></table>',
        signature: '<p>Kind regards,<br><strong>{{teacher_name}}</strong><br>The Bridge School</p>',
        footer: '<div style="padding:18px;text-align:center;background:#f2f4f8;color:#5b6170;font-size:12px;">The Bridge School · {{school_email}}<br><a href="{{preferences_url}}">Email preferences</a></div>',
      }
      const range = editor.getSelection(true)
      editor.clipboard.dangerouslyPasteHTML(range.index, blocks[dialogForm.block], 'user')
    } else if (editorDialog === 'image') {
      const pending = pendingImageRef.current
      pending.editor.insertEmbed(pending.range.index, 'image', pending.url, 'user')
      const [leaf] = pending.editor.getLeaf(pending.range.index)
      if (leaf?.domNode) leaf.domNode.setAttribute('alt', dialogForm.alt || '')
      pending.editor.setSelection(pending.range.index + 1, 0, 'silent')
    } else if (editorDialog === 'test') {
      if (!/^\S+@\S+\.\S+$/.test(dialogForm.toEmail || '')) return toast.error('Enter a valid email address')
      const source = testSourceRef.current
      try {
        await emailsApi.sendTest({ to_email: dialogForm.toEmail, subject: source.subject, body: source.body, preheader: source.preheader })
        toast.success('Test email sent')
      } catch (error) { toast.error(error?.response?.data?.detail || 'Could not send test email'); return }
    }
    closeEditorDialog()
  }

  function emailQualityIssues(source) {
    const issues = []
    const visible = source.body.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim()
    if (!source.subject.trim()) issues.push({ level: 'error', message: 'Subject is required' })
    if (!visible && !/<(?:img|table)\b/i.test(source.body)) issues.push({ level: 'error', message: 'Email body is required' })
    if (source.subject.length > 70) issues.push({ level: 'warning', message: 'Subject is longer than 70 characters' })
    if ((source.preheader || '').length > 140) issues.push({ level: 'warning', message: 'Preheader is longer than 140 characters' })
    if (/<img\b(?![^>]*\balt=)[^>]*>/i.test(source.body)) issues.push({ level: 'warning', message: 'Some images are missing alt text' })
    if (/href=["'](?!https?:\/\/|mailto:|tel:|{{)[^"']*["']/i.test(source.body)) issues.push({ level: 'warning', message: 'Some links may be invalid' })
    const unresolved = source.body.match(/{{[^}]+}}/g) || []
    const supported = ['{{recipient_email}}', '{{school_name}}', '{{school_email}}', '{{date}}', '{{student_name}}', '{{parent_name}}', '{{teacher_name}}', '{{class_name}}', '{{student_id}}', '{{preferences_url}}']
    if (unresolved.some((token) => !supported.includes(token))) issues.push({ level: 'warning', message: 'Some personalization variables need recipient data not currently available' })
    return issues
  }

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-white p-6 shadow-sm">
      <PageHeader title="Email Module" subtitle="Compose, schedule, and manage templates." />
      <Tabs
        activeTab={tab}
        onTabChange={setTab}
        tabs={[
          {
            id: 'dashboard',
            label: 'Email Dashboard',
            content: (
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <section>
                    <h2 className="mb-3 font-display text-base font-bold text-[var(--brand-navy)]">Scheduled Emails</h2>
                    <Table
                    loading={emailsLoading}
                    data={scheduledEmails}
                    columns={[
                      { key: 'scheduled_at', label: 'Date & Time', render: (row) => formatDate(row.scheduled_at, 'PPP p') },
                      { key: 'recipient_group', label: 'Recipients' },
                      { key: 'subject', label: 'Subject' },
                      { key: 'template_id', label: 'Template', render: (row) => row.template_id || '—' },
                    ]}
                    emptyMessage="No scheduled emails yet."
                  />
                  </section>
                  <section>
                    <h2 className="mb-3 font-display text-base font-bold text-[var(--brand-navy)]">Drafts</h2>
                    <Table
                    loading={emailsLoading}
                    data={draftEmails}
                    columns={[
                      { key: 'recipient_group', label: 'Recipients' },
                      { key: 'subject', label: 'Subject' },
                      { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
                      { key: 'actions', label: 'Actions', render: (row) => <div className="flex gap-2"><button type="button" className="portal-button-secondary" onClick={() => loadDraft(row)}>Load draft</button><button type="button" className="portal-button-ghost text-[var(--brand-red)]" onClick={() => setDraftPendingDeletion(row)}>Delete</button></div> },
                    ]}
                    emptyMessage="No drafts available."
                  />
                  </section>
                </div>
                <section>
                  <h2 className="mb-3 font-display text-base font-bold text-[var(--brand-navy)]">Sent Emails</h2>
                  <Table
                  loading={emailsLoading}
                  data={sentEmails}
                  columns={[
                    { key: 'scheduled_at', label: 'Date & Time', render: (row) => formatDate(row.sent_at || row.scheduled_at, 'PPP p') },
                    { key: 'recipient_group', label: 'To' },
                    { key: 'subject', label: 'Subject' },
                    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
                  ]}
                  emptyMessage="No sent emails yet."
                />
                </section>
              </div>
            ),
          },
          {
            id: 'compose',
            label: 'Compose & Schedule',
            content: (
              <form className="grid gap-4 portal-panel lg:grid-cols-2" onSubmit={submitCompose}>
                <div>
                  <label className="portal-label block">Recipient group</label>
                  <select className="portal-input mt-1" value={compose.recipient_group} onChange={(event) => setCompose({ ...compose, recipient_group: event.target.value })}>
                    <option value="parents">Parents</option>
                    <option value="students">Students</option>
                    <option value="teachers">Teachers</option>
                    <option value="all">All</option>
                    <option value="individual">Individual email address</option>
                  </select>
                  {compose.recipient_group === 'individual' && (
                    <div className="mt-2">
                      <textarea
                        placeholder={'parent.one@example.com\nparent.two@example.com'}
                        value={compose.individual_emails}
                        onChange={(event) => setCompose((current) => ({ ...current, individual_emails: event.target.value }))}
                        className="w-full min-h-24 border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] bg-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-navy)] focus:ring-2 focus:ring-[var(--brand-navy)]/10 transition-colors duration-150"
                      />
                      <p className="mt-1 text-xs text-[var(--text-muted)]">Add one address per line, or separate addresses with commas.</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="portal-label block">Template</label>
                  <select
                    className="portal-input mt-1"
                    value={selectedTemplateId}
                    
                    onChange={(e) => {
                        const id = e.target.value;
                        setSelectedTemplateId(id);
                        if (!id) {
                          setCompose((current) => ({
                            ...current,
                            template_id: '',
                            subject: '',
                            preheader: '',
                            body: '',
                            attachments: [],
                          }));
                          return;
                        }

                        const template = templates.find((item) => String(item.id) === id);
                        if (template) {
                          setCompose((current) => ({
                            ...current,
                            template_id: id,
                            subject: template.subject,
                            preheader: template.preheader || '',
                            body: template.body,
                            attachments: template.attachments || [],
                          }));
                        }
                    }}
                >
                    <option value="">None</option>

                    {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                            {template.name}
                        </option>
                    ))}
                </select>
                </div>
                <div>
                  <label className="portal-label block">Subject</label>
                  <input className="portal-input mt-1" value={compose.subject} onChange={(event) => setCompose({ ...compose, subject: event.target.value })} />
                </div>
                <div><label className="portal-label block">Inbox preview text</label><input maxLength={255} className="portal-input mt-1" value={compose.preheader} onChange={(event) => setCompose({ ...compose, preheader: event.target.value })} placeholder="Short summary shown beside the subject" /></div>
                <div>
                  <label className="portal-label block">Delivery</label>
                  <div className="mt-1 flex flex-wrap gap-4 text-sm text-[var(--text-primary)]">
                    <label className="flex items-center gap-2"><input type="radio" name="delivery-mode" checked={deliveryMode === 'now'} onChange={() => { setDeliveryMode('now'); setCompose((current) => ({ ...current, scheduled_at: '' })) }} /> Send now</label>
                    <label className="flex items-center gap-2"><input type="radio" name="delivery-mode" checked={deliveryMode === 'schedule'} onChange={() => setDeliveryMode('schedule')} /> Schedule for later</label>
                  </div>
                  {deliveryMode === 'schedule' && <input type="datetime-local" min={minimumScheduleTime} className="portal-input mt-3" value={compose.scheduled_at} onChange={(event) => setCompose((current) => ({ ...current, scheduled_at: event.target.value }))} />}
                </div>
                <div className="lg:col-span-2">
                <label className="portal-label block">Body</label>

                <ReactQuill
                  theme="snow"
                  modules={quillModules}
                  value={compose.body}
                  onChange={(value) => setCompose((current) => ({ ...current, body: value }))}
                  className="email-editor"
                  onFocus={() => { attachmentTargetRef.current = 'compose' }}
                />
                {compose.attachments.length > 0 && <AttachmentList attachments={compose.attachments} onRemove={(storedFilename) => setCompose((current) => ({ ...current, attachments: current.attachments.filter((attachment) => attachment.stored_filename !== storedFilename) }))} />}
                {emailQualityIssues(compose).length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{emailQualityIssues(compose).map((issue) => <div key={issue.message}>• {issue.message}</div>)}</div>}
              </div>
                <div className="lg:col-span-2 flex justify-end gap-3">
                  <button type="button" className="portal-button-secondary" onClick={() => { setPreviewTarget('compose'); setPreviewOpen(true) }}>Preview</button>
                  <button type="button" className="portal-button-secondary" onClick={() => sendTestEmail(compose)}>Send Test</button>
                  <button type="button" className="portal-button-secondary" onClick={saveDraft}>Save Draft</button>
                  <button type="submit" className="portal-button-primary">{deliveryMode === 'schedule' ? 'Schedule Email' : 'Send Now'}</button>
                </div>
              </form>
            ),
          },
          {
            id: 'templates',
            label: 'Email Templates',
            content: (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,9fr)_minmax(360px,11fr)]">
                <input className="portal-input w-full" placeholder="Search templates…" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} />
                <select className="portal-input w-full" value={templateCategory} onChange={(event) => setTemplateCategory(event.target.value)}><option value="">All categories</option>{[...new Set(templates.map((item) => item.category).filter(Boolean))].map((category) => <option key={category}>{category}</option>)}</select>
                <div className="min-w-0 max-w-full [&>div]:overflow-hidden"><Table data={filteredTemplates} loading={templatesLoading} columns={[
                  { key: 'name', label: 'Template Name' },
                  { key: 'subject', label: 'Subject' },
                  { key: 'actions', label: 'Actions', render: (row) => <div className="flex gap-1.5 whitespace-nowrap"><button type="button" className="portal-button-secondary px-3 py-2" onClick={() => { setEditingTemplateId(row.id); setTemplateForm({ name: row.name, subject: row.subject, preheader: row.preheader || '', body: row.body, attachments: row.attachments || [], category: row.category || '', tags: Array.isArray(row.tags) ? row.tags : [], is_favorite: row.is_favorite, publication_status: row.publication_status || 'published' }) }}>Edit</button><button type="button" onClick={() => setTemplatePendingDeletion(row)} className="portal-button-ghost px-2 py-2 text-[var(--brand-red)]">Delete</button></div> },
                ]} emptyMessage="No templates created yet." /></div>
                <form className="space-y-4 portal-panel" onSubmit={submitTemplate}>
                  <div>
                    <label className="portal-label block">Name</label>
                    <input required className="portal-input mt-1" value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Subject</label>
                    <input required className="portal-input mt-1" value={templateForm.subject} onChange={(event) => setTemplateForm({ ...templateForm, subject: event.target.value })} />
                  </div>
                  <div><label className="portal-label block">Inbox preview text</label><input className="portal-input mt-1" maxLength={255} value={templateForm.preheader} onChange={(event) => setTemplateForm({ ...templateForm, preheader: event.target.value })} /></div>
                  <div><label className="portal-label block">Category</label><input className="portal-input mt-1" value={templateForm.category} onChange={(event) => setTemplateForm({ ...templateForm, category: event.target.value })} placeholder="Announcements" /></div>
                  <div><label className="portal-label block">Tags</label><input className="portal-input mt-1" value={templateForm.tags.join(', ')} onChange={(event) => setTemplateForm({ ...templateForm, tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} placeholder="parents, weekly, academic" /></div>
                  {/* <div>
                    <label className="portal-label block">Body</label>
                    <textarea className="portal-input mt-1 min-h-44" placeholder="Use [Student Name], [Date] placeholders." value={templateForm.body} onChange={(event) => setTemplateForm({ ...templateForm, body: event.target.value })} />
                  </div> */}
                  <div>
                  <label className="portal-label block">Body</label>

                  <div className="mt-2">
                    <ReactQuill
                    theme="snow"
                    modules={quillModules}
                    value={templateForm.body}
                    onChange={(value) => setTemplateForm((current) => ({ ...current, body: value }))}
                    className="email-editor"
                    onFocus={() => { attachmentTargetRef.current = 'template' }}
                />
                {templateForm.attachments.length > 0 && <AttachmentList attachments={templateForm.attachments} onRemove={(storedFilename) => setTemplateForm((current) => ({ ...current, attachments: current.attachments.filter((attachment) => attachment.stored_filename !== storedFilename) }))} />}
                {emailQualityIssues(templateForm).length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{emailQualityIssues(templateForm).map((issue) => <div key={issue.message}>• {issue.message}</div>)}</div>}
                </div>
              </div>
                  {/* <button type="submit" className="portal-button-primary">Create Template</button>
                   */}
                 <div className="flex gap-3">

                  <button
                    type="submit"
                    className="portal-button-primary"
                  >
                    {editingTemplateId
                      ? "Update Template"
                      : "Create Template"}
                  </button>

                  <button
                    type="button"
                    className="portal-button-secondary"
                    onClick={() => { setPreviewTarget('template'); setPreviewOpen(true) }}
                  >
                    Preview
                  </button>
                  <button type="button" className="portal-button-secondary" onClick={() => sendTestEmail(templateForm)}>Send Test</button>

                </div>
                    {editingTemplateId && (
                  <button
                      type="button" className="portal-button-primary"
                      onClick={() => {

                          setEditingTemplateId(null);

                          setTemplateForm(emptyTemplate);

                      }}
                  >
                      Cancel
                  </button>
              )}
                </form>
              </div>
            ),
          },
        ]}
      />
      <Modal
    isOpen={previewOpen}
    onClose={() => setPreviewOpen(false)}
    title="Email Preview"
    size="large"
>
    <div className="min-w-0 space-y-4">
        <div className="flex justify-end gap-2"><button type="button" className={`portal-button-secondary ${previewDevice === 'desktop' ? 'bg-slate-100' : ''}`} onClick={() => setPreviewDevice('desktop')}>Desktop</button><button type="button" className={`portal-button-secondary ${previewDevice === 'mobile' ? 'bg-slate-100' : ''}`} onClick={() => setPreviewDevice('mobile')}>Mobile</button><button type="button" className="portal-button-secondary" onClick={() => setPreviewDark((value) => !value)}>{previewDark ? 'Light' : 'Dark'} mode</button></div>
        <div className="border-b pb-4">
            <p>
                <strong>From:</strong> school@bridge.edu
            </p>

            <p>
                <strong>To:</strong> {previewTarget === 'compose' ? compose.recipient_group : 'Template recipient'}
            </p>

            <p>
                <strong>Subject:</strong> {previewTarget === 'compose' ? compose.subject : templateForm.subject}
            </p>
            <p className="text-sm text-[var(--text-muted)]">{previewTarget === 'compose' ? compose.preheader : templateForm.preheader}</p>
        </div>
        <div className={`mx-auto rounded-lg border border-[var(--border-default)] p-5 transition-all ${previewDark ? 'bg-slate-900 text-white' : 'bg-white'} ${previewDevice === 'mobile' ? 'max-w-[390px]' : 'max-w-full'}`}><div
            className="email-preview-content min-w-0 max-w-full"
            dangerouslySetInnerHTML={{
                __html: previewTarget === 'compose' ? compose.body : templateForm.body,
            }}
        /></div>

    </div>
</Modal>
      <Modal
        isOpen={Boolean(templatePendingDeletion)}
        onClose={() => setTemplatePendingDeletion(null)}
        title="Delete Email Template"
        footer={
          <>
            <button type="button" className="portal-button-secondary" onClick={() => setTemplatePendingDeletion(null)}>Cancel</button>
            <button type="button" className="portal-button-primary bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]" onClick={deleteTemplate}>Delete Template</button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">Delete <strong className="text-[var(--text-primary)]">{templatePendingDeletion?.name}</strong>? This cannot be undone.</p>
      </Modal>
      <Modal
        isOpen={Boolean(draftPendingDeletion)}
        onClose={() => setDraftPendingDeletion(null)}
        title="Delete Draft"
        footer={
          <>
            <button type="button" className="portal-button-secondary" onClick={() => setDraftPendingDeletion(null)}>Cancel</button>
            <button type="button" className="portal-button-primary bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]" onClick={deleteDraft}>Delete Draft</button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">Delete the draft <strong className="text-[var(--text-primary)]">{draftPendingDeletion?.subject || 'Untitled draft'}</strong>? This cannot be undone.</p>
      </Modal>
      <Modal
        isOpen={Boolean(editorDialog)}
        onClose={closeEditorDialog}
        title={{ table: 'Insert Email Table', button: 'Create Call-to-Action Button', variable: 'Insert Personalization', blocks: 'Insert Content Block', image: 'Image Accessibility', test: 'Send Test Email' }[editorDialog] || 'Email Editor'}
        footer={<><button type="button" className="portal-button-secondary" onClick={closeEditorDialog}>Cancel</button><button type="button" className="portal-button-primary" onClick={applyEditorDialog}>{editorDialog === 'test' ? 'Send Test' : 'Insert'}</button></>}
      >
        {editorDialog === 'table' && <div className="grid grid-cols-2 gap-4"><div><label className="portal-label block">Rows</label><input type="number" min="1" max="12" className="portal-input mt-1" value={dialogForm.rows} onChange={(event) => setDialogForm({ ...dialogForm, rows: event.target.value })} /></div><div><label className="portal-label block">Columns</label><input type="number" min="1" max="8" className="portal-input mt-1" value={dialogForm.cols} onChange={(event) => setDialogForm({ ...dialogForm, cols: event.target.value })} /></div></div>}
        {editorDialog === 'button' && <div className="space-y-4"><div><label className="portal-label block">Button text</label><input className="portal-input mt-1" value={dialogForm.text} onChange={(event) => setDialogForm({ ...dialogForm, text: event.target.value })} /></div><div><label className="portal-label block">Destination link</label><input type="url" className="portal-input mt-1" value={dialogForm.url} onChange={(event) => setDialogForm({ ...dialogForm, url: event.target.value })} /></div><div><label className="portal-label block">Button color</label><div className="mt-1 flex gap-3"><input type="color" className="h-11 w-14 rounded border" value={dialogForm.color} onChange={(event) => setDialogForm({ ...dialogForm, color: event.target.value })} /><input className="portal-input" value={dialogForm.color} onChange={(event) => setDialogForm({ ...dialogForm, color: event.target.value })} /></div></div></div>}
        {editorDialog === 'variable' && <div><label className="portal-label block">Personalization field</label><select className="portal-input mt-1" value={dialogForm.variable} onChange={(event) => setDialogForm({ ...dialogForm, variable: event.target.value })}>{['student_name','parent_name','teacher_name','recipient_email','class_name','student_id','school_name','school_email','date'].map((variable) => <option key={variable} value={variable}>{variable.replaceAll('_', ' ')}</option>)}</select><p className="mt-2 text-xs text-[var(--text-muted)]">This value is replaced separately for each recipient when the email is sent.</p></div>}
        {editorDialog === 'blocks' && <div><label className="portal-label block">Content block</label><div className="mt-3 grid grid-cols-2 gap-3">{[['header','School header'],['announcement','Announcement'],['event','Event details'],['two-column','Two columns'],['signature','Signature'],['footer','School footer']].map(([value, label]) => <button key={value} type="button" onClick={() => setDialogForm({ ...dialogForm, block: value })} className={`rounded-lg border p-4 text-left text-sm font-semibold ${dialogForm.block === value ? 'border-[var(--brand-navy)] bg-blue-50' : 'border-[var(--border-default)]'}`}>{label}</button>)}</div></div>}
        {editorDialog === 'image' && <div><label className="portal-label block">Alternative text</label><input autoFocus className="portal-input mt-1" value={dialogForm.alt} onChange={(event) => setDialogForm({ ...dialogForm, alt: event.target.value })} placeholder="Describe what appears in the image" /><p className="mt-2 text-xs text-[var(--text-muted)]">Screen readers use this description, and it appears if the image cannot load.</p></div>}
        {editorDialog === 'test' && <div><label className="portal-label block">Recipient email address</label><input autoFocus type="email" className="portal-input mt-1" value={dialogForm.toEmail} onChange={(event) => setDialogForm({ ...dialogForm, toEmail: event.target.value })} placeholder="you@example.com" /><p className="mt-2 text-xs text-[var(--text-muted)]">The subject will be prefixed with [TEST].</p></div>}
      </Modal>
      <Modal isOpen={Boolean(historyTemplate)} onClose={() => setHistoryTemplate(null)} title={`Version History — ${historyTemplate?.name || ''}`} size="large">
        {(historyTemplate?.version_history || []).length ? <div className="space-y-3">{historyTemplate.version_history.map((version, index) => <div key={`${version.saved_at}-${index}`} className="rounded-lg border border-[var(--border-default)] p-4"><div className="flex justify-between gap-4"><strong>Version {index + 1}</strong><span className="text-xs text-[var(--text-muted)]">{new Date(version.saved_at).toLocaleString()}</span></div><p className="mt-2 text-sm"><strong>Subject:</strong> {version.subject}</p><div className="email-preview-content mt-3 max-h-40 overflow-auto rounded bg-[var(--bg-app)] p-3 text-sm" dangerouslySetInnerHTML={{ __html: version.body }} /></div>)}</div> : <p className="text-sm text-[var(--text-muted)]">No previous versions yet. A version is saved whenever this template is updated.</p>}
      </Modal>
    </div>
  )
}

export function PerformanceBroadcasterView() {
  const { user } = useAuth()
  const { data: results = [], loading: resultsLoading, refetch } = useApi(() => resultsApi.list(), [])
  const [form, setForm] = useState({ notify: true, file: null })
  const [pendingDeleteBatchId, setPendingDeleteBatchId] = useState(null)
  const [previewRows, setPreviewRows] = useState([])
  const [fileZoneVersion, setFileZoneVersion] = useState(0)
  const [filterSubject, setFilterSubject] = useState('')
  const [filterTerm, setFilterTerm] = useState('')

  const uploads = useMemo(() => {
    const groups = new Map()
    results.forEach((result) => {
      const key = result.batch_id || result.created_at
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(result)
    })
    return Array.from(groups.entries()).map(([batchId, batchResults]) => ({ batchId, batchResults }))
  }, [results])

  const uniqueSubjects = [...new Set(results.map((result) => result.subject).filter(Boolean))]
  const uniqueTerms = [...new Set(results.map((result) => result.term).filter(Boolean))]

  const filteredUploads = uploads.filter((group) => {
    const firstResult = group.batchResults[0]
    if (filterSubject && firstResult?.subject !== filterSubject) return false
    if (filterTerm && firstResult?.term !== filterTerm) return false
    return true
  })

  const clearSelectedFile = () => {
    setForm({ ...form, file: null })
    setPreviewRows([])
    setFileZoneVersion((value) => value + 1)
  }

  const handleFileSelect = (file) => {
    if (!file) {
      clearSelectedFile()
      return
    }

    setForm({ ...form, file })

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setPreviewRows([])
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = String(event.target?.result || '')
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      if (!lines.length) {
        setPreviewRows([])
        return
      }
      const headers = lines[0].split(',').map((header) => header.trim())
      const rows = lines.slice(1).map((line) => {
        const values = line.split(',')
        return headers.reduce((accumulator, header, index) => {
          accumulator[header] = (values[index] ?? '').trim()
          return accumulator
        }, {})
      })
      setPreviewRows(rows)
    }
    reader.onerror = () => setPreviewRows([])
    reader.readAsText(file)
  }

  const downloadBatch = async (batchId) => {
    try {
      const response = await resultsApi.downloadBatch(batchId)
      const url = URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `results_${batchId}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not download batch')
    }
  }

  const confirmDeleteBatch = async (batchId) => {
    try {
      await resultsApi.deleteBatch(batchId)
      toast.success('Batch deleted')
      setPendingDeleteBatchId(null)
      refetch()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not delete batch')
    }
  }

  const downloadSampleTemplate = () => {
    const sample = [
      'student_name,student_email,subject,grade,class_average,attendance,term',
      'Ali Hassan,ali.hassan@example.com,Mathematics,85,78,92,Term 1 2026',
      'Sara Ahmed,sara.ahmed@example.com,Science,79,74,88,Term 1 2026',
    ].join('\n')
    const blob = new Blob([sample], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'results_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.file) {
      toast.error('Choose a results file first')
      return
    }
    const payload = new FormData()
    payload.append('file', form.file)
    payload.append('notify', form.notify ? 'true' : 'false')
    try {
      const result = await resultsApi.upload(payload)
      const emailMsg = form.notify && result.data.emails_sent !== undefined
        ? ` — ${result.data.emails_sent} email${result.data.emails_sent !== 1 ? 's' : ''} sent`
        : ''
      toast.success(`Results uploaded${emailMsg}`)
      setForm({ notify: true, file: null })
      setPreviewRows([])
      setFileZoneVersion((value) => value + 1)
      refetch()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not upload results')
    }
  }

  return (
    <div>
      <PageHeader title="Performance Broadcaster" subtitle="Upload result sheets and notify parents." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <form className="space-y-4 portal-panel" onSubmit={submit}>
          <FileUploadZone key={fileZoneVersion} accept=".csv,.xlsx" label="Upload result sheet" onFileSelect={handleFileSelect} />
          {form.file ? (
            <div className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-xs text-[var(--text-secondary)]">
              <span className="truncate pr-3">Selected file: {form.file.name}</span>
              <button type="button" className="portal-button-ghost h-7 px-2 text-xs text-[var(--brand-red)] hover:bg-[var(--brand-red-light)] hover:text-[var(--brand-red-dark)]" onClick={clearSelectedFile}>
                Remove
              </button>
            </div>
          ) : null}
          {previewRows.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
                Preview — {previewRows.length} student{previewRows.length !== 1 ? 's' : ''} detected
              </div>
              <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-default)] bg-[var(--bg-app)]">
                      <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[var(--text-muted)]">Student</th>
                      <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[var(--text-muted)]">Subject</th>
                      <th className="px-3 py-2 text-right font-medium uppercase tracking-wide text-[var(--text-muted)]">Grade</th>
                      <th className="px-3 py-2 text-right font-medium uppercase tracking-wide text-[var(--text-muted)]">Avg</th>
                      <th className="px-3 py-2 text-right font-medium uppercase tracking-wide text-[var(--text-muted)]">Att %</th>
                      <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[var(--text-muted)]">Term</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr key={index} className="border-b border-[var(--border-default)] transition-colors duration-100 hover:bg-[var(--bg-app)]">
                        <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{row.student_name || row.name || '—'}</td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">{row.subject || '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-semibold ${parseFloat(row.grade) >= parseFloat(row.class_average) ? 'text-emerald-600' : 'text-[var(--brand-red)]'}`}>
                            {row.grade}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-[var(--text-muted)]">{row.class_average || row.average || '—'}</td>
                        <td className="px-3 py-2 text-right text-[var(--text-muted)]">{row.attendance || row['attendance_%'] || '—'}%</td>
                        <td className="px-3 py-2 text-[var(--text-muted)]">{row.term || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <button type="button" className="text-left text-xs text-[var(--brand-red)] hover:underline cursor-pointer" onClick={downloadSampleTemplate}>↓ Download sample CSV template</button>
          <label className="flex items-center gap-3 text-sm text-[var(--text-primary)]">
            <input type="checkbox" checked={form.notify} onChange={(event) => setForm({ ...form, notify: event.target.checked })} />
            Notify parents via email and WhatsApp
          </label>
          <button type="submit" className="portal-button-primary w-full">Upload & Broadcast</button>
        </form>
        <div className="portal-panel">
          <div className="mb-4 text-sm font-medium text-[var(--text-primary)]">Recent uploads</div>
          <div className="mb-4 flex gap-2">
            <select value={filterSubject} onChange={(event) => setFilterSubject(event.target.value)} className="flex-1 rounded-lg border border-[var(--border-default)] bg-white px-2 py-1.5 text-xs text-[var(--text-secondary)] focus:border-[var(--brand-navy)] focus:outline-none">
              <option value="">All subjects</option>
              {uniqueSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
            <select value={filterTerm} onChange={(event) => setFilterTerm(event.target.value)} className="flex-1 rounded-lg border border-[var(--border-default)] bg-white px-2 py-1.5 text-xs text-[var(--text-secondary)] focus:border-[var(--brand-navy)] focus:outline-none">
              <option value="">All terms</option>
              {uniqueTerms.map((term) => <option key={term} value={term}>{term}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            {filteredUploads.map((group) => (
              <div key={group.batchId} className="rounded-lg border border-[var(--border-default)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{group.batchResults[0]?.subject}</div>
                    <div className="text-xs text-[var(--text-muted)]">Batch {group.batchId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status="published" />
                    <button type="button" className="portal-button-ghost h-8 w-8 p-0 text-[var(--brand-navy)]" onClick={() => downloadBatch(group.batchId)} aria-label="Download batch">
                      <Download className="h-[15px] w-[15px]" />
                    </button>
                    <button type="button" className="portal-button-ghost h-8 w-8 p-0 text-[var(--brand-red)] hover:bg-[var(--brand-red-light)] hover:text-[var(--brand-red-dark)]" onClick={() => setPendingDeleteBatchId(group.batchId)} aria-label="Delete batch">
                      <Trash2 className="h-[15px] w-[15px]" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-sm text-[var(--text-secondary)]">{group.batchResults.length} students</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">Uploaded by {group.batchResults[0]?.uploaded_by_name || user?.name}</div>
                {pendingDeleteBatchId === group.batchId ? (
                  <div className="mt-4 rounded-lg border border-[var(--brand-red-light)] bg-[var(--brand-red-light)] p-3">
                    <div className="text-xs font-medium text-[var(--brand-navy)]">Delete this batch? This cannot be undone.</div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" className="portal-button-danger text-xs" onClick={() => confirmDeleteBatch(group.batchId)}>Confirm</button>
                      <button type="button" className="portal-button-secondary text-xs" onClick={() => setPendingDeleteBatchId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {!filteredUploads.length && uploads.length ? (
              <div className="text-center py-6 text-xs text-[var(--text-muted)]">No uploads match the selected filters.</div>
            ) : null}
            {resultsLoading ? <SkeletonList count={3} /> : !uploads.length ? <EmptyState title="No uploads yet" message="Broadcast result sheets to see recent batches here." /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function WhatsAppAlertsView() {
  const { user } = useAuth()
  const { data: logs = [], loading: logsLoading, refetch } = useApi(() => whatsappApi.logs(), [])
  const [connected, setConnected] = useState(true)
  const [form, setForm] = useState({ recipient_name: '', phone_number: '', message: '', recipient_group: 'parents' })

  const submit = async (event) => {
    event.preventDefault()
    try {
      await whatsappApi.send(form)
      toast.success('WhatsApp message sent')
      setForm({ recipient_name: '', phone_number: '', message: '', recipient_group: 'parents' })
      refetch()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not send WhatsApp message')
    }
  }

  return (
    <div>
      <PageHeader title="WhatsApp Notifications" subtitle="Broadcast alerts to parents and students." />
      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="portal-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">Gateway Settings</div>
                <div className="text-sm text-[var(--text-secondary)]">{connected ? 'Connected gateway ready to send.' : 'Disconnected from gateway.'}</div>
              </div>
              <Badge status={connected ? 'connected' : 'failed'} />
            </div>
            <div className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] p-4 text-sm text-[var(--text-secondary)]">
              <div>Sending as: {user?.whatsapp_number || '+44 0000 000000'}</div>
            </div>
            <button type="button" className="portal-button-secondary mt-4" onClick={() => setConnected((value) => !value)}>
              {connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
          <form className="space-y-4 portal-panel" onSubmit={submit}>
            <div>
              <label className="portal-label block">Recipient group</label>
              <select className="portal-input mt-1" value={form.recipient_group} onChange={(event) => setForm({ ...form, recipient_group: event.target.value })}>
                <option value="parents">Parents</option>
                <option value="students">Students</option>
                <option value="teachers">Teachers</option>
                <option value="all">All</option>
              </select>
            </div>
            <div>
              <label className="portal-label block">Message</label>
              <textarea className="portal-input mt-1 min-h-40" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
              <div className="mt-2 text-xs text-[var(--text-muted)]">{form.message.length} characters</div>
            </div>
            <div>
              <label className="portal-label block">Recipient name</label>
              <input className="portal-input mt-1" value={form.recipient_name} onChange={(event) => setForm({ ...form, recipient_name: event.target.value })} />
            </div>
            <div>
              <label className="portal-label block">Phone number</label>
              <input className="portal-input mt-1" value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} />
            </div>
            <button type="submit" className="portal-button-primary w-full">Broadcast</button>
          </form>
        </div>
        <div className="portal-panel">
          <div className="mb-4 text-sm font-medium text-[var(--text-primary)]">Notification Log</div>
          <div className="max-h-[720px] overflow-y-auto rounded-lg border border-[var(--border-default)]">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-[var(--bg-app)] text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                <tr>
                  <th className="border-b border-[var(--border-default)] px-4 py-2.5 text-left font-medium">Timestamp</th>
                  <th className="border-b border-[var(--border-default)] px-4 py-2.5 text-left font-medium">Recipient</th>
                  <th className="border-b border-[var(--border-default)] px-4 py-2.5 text-left font-medium">Phone</th>
                  <th className="border-b border-[var(--border-default)] px-4 py-2.5 text-left font-medium">Message</th>
                  <th className="border-b border-[var(--border-default)] px-4 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[#f0f2f8] hover:bg-[var(--bg-app)]">
                    <td className="px-4 py-2.5 text-[var(--text-primary)]">{formatDate(log.sent_at, 'PP p')}</td>
                    <td className="px-4 py-2.5 text-[var(--text-primary)]">{log.recipient_name}</td>
                    <td className="px-4 py-2.5 text-[var(--text-primary)]">{log.phone_number}</td>
                    <td className="px-4 py-2.5 text-[var(--text-primary)]">{log.message.slice(0, 40)}</td>
                    <td className="px-4 py-2.5"><Badge status={log.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PortalManagementView() {
  const { data: notices = [], loading: noticesLoading, refetch: refetchNotices } = useApi(() => noticesApi.list(), [])
  const { data: opportunities = [], loading: opportunitiesLoading, refetch: refetchOpportunities } = useApi(() => opportunitiesApi.list(), [])
  const { data: users = [], loading: usersLoading, refetch: refetchUsers } = useApi(() => usersApi.list(), [])
  const { data: departments = [], loading: departmentsLoading, refetch: refetchDepartments } = useApi(() => departmentsApi.list(), [])
  const [noticeForm, setNoticeForm] = useState({ title: '', body: '', recipient_roles: ['all'], recipient_department_ids: [], recipient_user_ids: [], status: 'published', publish_mode: 'now', publish_datetime: '' })
  const [opportunityForm, setOpportunityForm] = useState({ title: '', eligibility: '', deadline: '', link: '' })
  const [userForm, setUserForm] = useState({ name: '', email: '', role: '', password: '', department: '' })
  const [guardians, setGuardians] = useState([{ name: '', email: '' }])
  const [selectedUser, setSelectedUser] = useState(null)
  const [importFile, setImportFile] = useState(null)
  const [importType, setImportType] = useState('students')
  const [importErrors, setImportErrors] = useState([])
  const [parentToLink, setParentToLink] = useState('')
  const [userPendingDeletion, setUserPendingDeletion] = useState(null)
  const [departmentName, setDepartmentName] = useState('')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [memberUserId, setMemberUserId] = useState('')

  const generateTemporaryPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const lower = 'abcdefghijkmnopqrstuvwxyz'
    const digits = '23456789'
    const symbols = '!@#$%&*?'
    const all = upper + lower + digits + symbols
    const randomCharacter = (characters) => characters[crypto.getRandomValues(new Uint32Array(1))[0] % characters.length]
    const password = [randomCharacter(upper), randomCharacter(lower), randomCharacter(digits), randomCharacter(symbols), ...Array.from({ length: 12 }, () => randomCharacter(all))]
    for (let index = password.length - 1; index > 0; index -= 1) {
      const swapIndex = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1)
      ;[password[index], password[swapIndex]] = [password[swapIndex], password[index]]
    }
    setUserForm((current) => ({ ...current, password: password.join('') }))
  }

  const toggleNoticeRole = (role) => {
    setNoticeForm((current) => {
      if (role === 'all') return { ...current, recipient_roles: ['all'] }
      const nextRoles = (current.recipient_roles || []).filter((item) => item !== 'all')
      if (nextRoles.includes(role)) {
        return { ...current, recipient_roles: nextRoles.filter((item) => item !== role) }
      }
      return { ...current, recipient_roles: [...nextRoles, role] }
    })
  }

  const submitNotice = async (event) => {
    event.preventDefault()
    if (!noticeForm.title.trim()) {
      toast.error('Title is required.')
      return
    }
    const hasRecipients = (noticeForm.recipient_roles?.length > 0) || (noticeForm.recipient_department_ids?.length > 0) || (noticeForm.recipient_user_ids?.length > 0)
    if (!hasRecipients) {
      toast.error('At least one recipient is required.')
      return
    }
    if (noticeForm.publish_mode === 'schedule' && !noticeForm.publish_datetime) {
      toast.error('Please select a date and time for the scheduled notice.')
      return
    }
    try {
      const { publish_mode, ...rest } = noticeForm
      await noticesApi.create({
        ...rest,
        recipient_roles: rest.recipient_roles || [],
        recipient_department_ids: rest.recipient_department_ids || [],
        recipient_user_ids: rest.recipient_user_ids || [],
        publish_datetime: publish_mode === 'now' ? null : rest.publish_datetime,
      })
      toast.success('Notice created')
      setNoticeForm(createEmptyNoticeForm())
      refetchNotices()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not create notice')
    }
  }

  const submitOpportunity = async (event) => {
    event.preventDefault()
    if (!opportunityForm.title.trim() || !opportunityForm.eligibility.trim() || !opportunityForm.deadline || !opportunityForm.link.trim()) {
      toast.error('Please fill in every opportunity field')
      return
    }
    if (opportunityForm.deadline < todayInputValue()) {
      toast.error('Deadline cannot be in the past')
      return
    }
    try {
      await opportunitiesApi.create(opportunityForm)
      toast.success('Opportunity created')
      setOpportunityForm({ title: '', eligibility: '', deadline: '', link: '' })
      refetchOpportunities()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not create opportunity')
    }
  }

  const submitUser = async (event) => {
    event.preventDefault()
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.role || !userForm.password || (userForm.role === 'staff' && !userForm.department)) {
      toast.error('Please fill in every user field')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email.trim())) {
      toast.error('Please enter a valid email address')
      return
    }
    if (!isValidPortalPassword(userForm.password)) {
      toast.error('Temporary password must be 12+ characters with uppercase, lowercase, a number, and a symbol')
      return
    }
    try {
      if (userForm.role === 'student') {
        if (guardians.some((guardian) => !guardian.name.trim() || !guardian.email.trim())) {
          toast.error('Add the name and email for at least one parent or guardian')
          return
        }
        await usersApi.createStudent({ name: userForm.name, email: userForm.email, password: userForm.password, guardians })
        toast.success('Student and guardian account(s) created. Credential emails are being sent.')
        setUserForm({ name: '', email: '', role: '', password: '', department: '' })
        setGuardians([{ name: '', email: '' }])
        refetchUsers()
        return
      }
      const response = await usersApi.create({ ...userForm, head_teacher: false, is_active: true })
      toast.success(response.data.invitation_queued ? 'User created. Credential email is being sent.' : 'User created')
      setUserForm({ name: '', email: '', role: '', password: '', department: '' })
      refetchUsers()
      refetchDepartments()
    } catch (error) {
      toast.error(formatApiError(error, 'Could not create user'))
    }
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    try {
      await usersApi.update(selectedUser.id, { name: selectedUser.name, email: selectedUser.email, role: selectedUser.role, is_active: selectedUser.is_active })
      toast.success('User profile updated')
      refetchUsers()
    } catch (error) {
      toast.error(formatApiError(error, 'Could not update profile'))
    }
  }

  const importUsers = async (event) => {
    event.preventDefault()
    if (!importFile) return toast.error('Choose an Excel file first')
    setImportErrors([])
    try {
      const response = await usersApi.import(importFile, importType)
      toast.success(response.data.message || `${response.data.accounts_created} account(s) created. Credential emails are being sent.`)
      setImportFile(null)
      refetchUsers()
      refetchDepartments()
    } catch (error) {
      const detail = error?.response?.data?.detail
      if (detail?.errors) setImportErrors(detail.errors)
      toast.error(formatApiError(error, 'Could not import users'))
    }
  }

  useEffect(() => {
    usersApi.cleanupInvalidFamilyRecords().then((response) => {
      if (response.data.count) {
        toast.success(`Removed ${response.data.count} invalid unlinked family account(s)`)
        refetchUsers()
      }
    }).catch(() => {})
  }, [])

  const linkGuardian = async () => {
    if (!parentToLink) return toast.error('Select a parent or guardian account')
    try {
      await usersApi.linkGuardian(selectedUser.id, parentToLink)
      toast.success('Parent/guardian linked')
      setParentToLink('')
      const updated = (await usersApi.list()).data
      setSelectedUser(updated.find((person) => person.id === selectedUser.id) || null)
      refetchUsers()
    } catch (error) { toast.error(error?.response?.data?.detail || 'Could not link guardian') }
  }

  const unlinkGuardian = async (parentId) => {
    try {
      await usersApi.unlinkGuardian(selectedUser.id, parentId)
      const updated = (await usersApi.list()).data
      setSelectedUser(updated.find((person) => person.id === selectedUser.id) || null)
      refetchUsers()
    } catch (error) { toast.error(error?.response?.data?.detail || 'Could not remove guardian') }
  }

  const deleteUser = async (id) => {
    if (id) {
      setUserPendingDeletion(users.find((person) => person.id === id) || selectedUser)
      return
    }
    const targetId = userPendingDeletion?.id
    if (!targetId) return
    try {
      await usersApi.remove(targetId)
      toast.success('User removed')
      if (selectedUser?.id === targetId) setSelectedUser(null)
      refetchUsers()
      refetchDepartments()
    } catch (error) {
      toast.error(formatApiError(error, 'Could not remove user'))
    } finally {
      setUserPendingDeletion(null)
    }
  }

  const createDepartment = async (event) => {
    event.preventDefault()
    if (!departmentName.trim()) return toast.error('Enter a department or domain name')
    try {
      await departmentsApi.create({ name: departmentName })
      setDepartmentName('')
      refetchDepartments()
      toast.success('Department/domain created')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not create department/domain')
    }
  }

  const addDepartmentMember = async () => {
    if (!selectedDepartmentId || !memberUserId) return toast.error('Select a department/domain and user')
    try {
      await departmentsApi.addMember(selectedDepartmentId, memberUserId)
      setMemberUserId('')
      refetchDepartments()
      refetchUsers()
      toast.success('User added to department/domain')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not add user')
    }
  }

  const removeDepartmentMember = async (departmentId, userId) => {
    try {
      await departmentsApi.removeMember(departmentId, userId)
      refetchDepartments()
      refetchUsers()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not remove user')
    }
  }

  const deleteNotice = async (id) => {
    await noticesApi.remove(id)
    refetchNotices()
  }

  const deleteOpportunity = async (id) => {
    await opportunitiesApi.remove(id)
    refetchOpportunities()
  }

  return (
    <div>
      <PageHeader title="Portal Management" subtitle="Manage notices, opportunities, and users." />
      <Tabs
        tabs={[
          {
            id: 'notices',
            label: 'Notice Board',
            content: (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                <Table
                  data={notices}
                  loading={noticesLoading}
                  columns={[
                    { key: 'title', label: 'Title' },
                    { key: 'recipients', label: 'Recipients', render: (row) => <span className="text-sm text-[var(--text-secondary)]">{getNoticeRecipientSummary(row)}</span> },
                    { key: 'publish_datetime', label: 'Published', render: (row) => row.publish_datetime ? formatDateTime(row.publish_datetime) : <span className="text-xs italic text-[var(--text-muted)]">Immediate</span> },
                    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
                    { key: 'actions', label: 'Actions', render: (row) => <button className="portal-button-danger" onClick={() => deleteNotice(row.id)}>Delete</button> },
                  ]}
                  emptyMessage="No notices available."
                />
                <form className="space-y-4 portal-panel" onSubmit={submitNotice}>
                  <div>
                    <label className="portal-label block">Title <span className="text-[var(--brand-red)]">*</span></label>
                    <input className="portal-input mt-1" required value={noticeForm.title} onChange={(event) => setNoticeForm({ ...noticeForm, title: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Body</label>
                    <textarea className="portal-input mt-1 min-h-40" value={noticeForm.body} onChange={(event) => setNoticeForm({ ...noticeForm, body: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Recipients <span className="text-[var(--brand-red)]">*</span></label>
                    <div className="mt-1">
                      <RecipientSearchSelect
                        users={users}
                        departments={departments}
                        value={{
                          roles: noticeForm.recipient_roles,
                          department_ids: noticeForm.recipient_department_ids,
                          user_ids: noticeForm.recipient_user_ids,
                        }}
                        onChange={(nextValue) => setNoticeForm({
                          ...noticeForm,
                          recipient_roles: nextValue.roles,
                          recipient_department_ids: nextValue.department_ids,
                          recipient_user_ids: nextValue.user_ids,
                        })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="portal-label block">When to publish</label>
                    <div className="mt-2 flex gap-2">
                      <button type="button" className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${noticeForm.publish_mode === 'now' ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)] text-white' : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-app)]'}`} onClick={() => setNoticeForm({ ...noticeForm, publish_mode: 'now', publish_datetime: '', status: 'published' })}>
                        Publish Now
                      </button>
                      <button type="button" className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${noticeForm.publish_mode === 'schedule' ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)] text-white' : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-app)]'}`} onClick={() => setNoticeForm({ ...noticeForm, publish_mode: 'schedule', publish_datetime: futureDateTimeInputValue(), status: 'published' })}>
                        Schedule
                      </button>
                      <button type="button" className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${noticeForm.publish_mode === 'draft' ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)] text-white' : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-app)]'}`} onClick={() => setNoticeForm({ ...noticeForm, publish_mode: 'draft', publish_datetime: '', status: 'draft' })}>
                        Save as Draft
                      </button>
                    </div>
                    {noticeForm.publish_mode === 'schedule' && (
                      <div className="mt-3">
                        <label className="portal-label block text-xs">Scheduled date &amp; time</label>
                        <input type="datetime-local" min={futureDateTimeInputValue()} className="portal-input mt-1" value={noticeForm.publish_datetime} onChange={(event) => setNoticeForm({ ...noticeForm, publish_datetime: event.target.value })} />
                      </div>
                    )}
                  </div>
                  <button type="submit" className="portal-button-primary">{noticeForm.publish_mode === 'now' ? 'Publish Notice' : noticeForm.publish_mode === 'schedule' ? 'Schedule Notice' : 'Save Draft'}</button>
                </form>
              </div>
            ),
          },
          {
            id: 'opportunities',
            label: 'Opportunities',
            content: (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                <Table
                  data={opportunities}
                  loading={opportunitiesLoading}
                  columns={[
                    { key: 'title', label: 'Title' },
                    { key: 'eligibility', label: 'Eligibility' },
                    { key: 'deadline', label: 'Deadline', render: (row) => formatDate(row.deadline) },
                    { key: 'actions', label: 'Actions', render: (row) => <button className="portal-button-danger" onClick={() => deleteOpportunity(row.id)}>Delete</button> },
                  ]}
                  emptyMessage="No opportunities available."
                />
                <form className="space-y-4 portal-panel" onSubmit={submitOpportunity}>
                  <div>
                    <label className="portal-label block">Title <span className="text-[var(--brand-red)]">*</span></label>
                    <input required className="portal-input mt-1" value={opportunityForm.title} onChange={(event) => setOpportunityForm({ ...opportunityForm, title: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Eligibility <span className="text-[var(--brand-red)]">*</span></label>
                    <input required className="portal-input mt-1" value={opportunityForm.eligibility} onChange={(event) => setOpportunityForm({ ...opportunityForm, eligibility: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Deadline <span className="text-[var(--brand-red)]">*</span></label>
                    <input required type="date" min={todayInputValue()} className="portal-input mt-1" value={opportunityForm.deadline} onChange={(event) => setOpportunityForm({ ...opportunityForm, deadline: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Link <span className="text-[var(--brand-red)]">*</span></label>
                    <input required type="url" className="portal-input mt-1" value={opportunityForm.link} onChange={(event) => setOpportunityForm({ ...opportunityForm, link: event.target.value })} />
                  </div>
                  <button type="submit" className="portal-button-primary">Create Opportunity</button>
                </form>
              </div>
            ),
          },
          {
            id: 'departments',
            label: 'Departments & Domains',
            content: (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-3">
                  {departments.map((department) => (
                    <div key={department.id} className="portal-panel">
                      <div className="flex items-center justify-between"><div className="font-medium text-[var(--text-primary)]">{department.name}</div><span className="text-xs text-[var(--text-muted)]">{department.members?.length || 0} member{(department.members?.length || 0) === 1 ? '' : 's'}</span></div>
                      <div className="mt-3 flex flex-wrap gap-2">{department.members?.length ? department.members.map((member) => <span key={member.id} className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">{member.name}<button type="button" className="text-[var(--brand-red)]" onClick={() => removeDepartmentMember(department.id, member.id)} aria-label={`Remove ${member.name}`}>×</button></span>) : <span className="text-sm text-[var(--text-muted)]">No members yet.</span>}</div>
                    </div>
                  ))}
                  {!departments.length ? <EmptyState title="No departments or domains" message="Create one to organise staff, committees, or other groups." /> : null}
                </div>
                <div className="space-y-6">
                  <form className="space-y-3 portal-panel" onSubmit={createDepartment}><div className="text-sm font-medium text-[var(--text-primary)]">Create department or domain</div><input required className="portal-input" placeholder="e.g. Admissions or Graduation Committee" value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} /><button className="portal-button-primary">Create</button></form>
                  <div className="space-y-3 portal-panel"><div className="text-sm font-medium text-[var(--text-primary)]">Add a member</div><select className="portal-input" value={selectedDepartmentId} onChange={(event) => setSelectedDepartmentId(event.target.value)}><option value="">Select department/domain</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><UserSearchSelect users={users} value={memberUserId} onChange={(id) => setMemberUserId(id)} placeholder="Search user to add as member..." /><button type="button" className="portal-button-primary" onClick={addDepartmentMember}>Add member</button></div>
                </div>
              </div>
            ),
          },
          {
            id: 'users',
            label: 'User Management',
            content: (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                <Table
                  data={users}
                  loading={usersLoading}
                  columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'role', label: 'Role', render: (row) => <Badge status={row.role} /> },
                    { key: 'departments', label: 'Departments / Domains', render: (row) => row.departments?.join(', ') || '—' },
                    { key: 'connections', label: 'Connections', render: (row) => row.role === 'student' ? `${row.guardians?.length || 0} guardian(s)` : row.role === 'parent' ? `${row.children?.length || 0} student${row.children?.length === 1 ? '' : 's'}` : '—' },
                    { key: 'is_active', label: 'Status', render: (row) => <Badge status={row.is_active ? 'connected' : 'failed'} /> },
                    { key: 'actions', label: 'Actions', render: (row) => <button className="portal-button-danger" onClick={() => setUserPendingDeletion(row)}>Remove</button> },
                  ]}
                  onRowClick={(row) => setSelectedUser({ ...row })}
                  emptyMessage="No users found."
                />
                <form className="space-y-4 portal-panel" onSubmit={submitUser}>
                  <div>
                    <label className="portal-label block">Name</label>
                    <input required className="portal-input mt-1" value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Email</label>
                    <input required type="email" className="portal-input mt-1" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Role</label>
                    <select required className="portal-input mt-1" value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>
                      <option value="">Select role</option>
                      <option value="admin">Admin</option>
                      <option value="teacher">Teacher</option>
                      <option value="staff">Staff</option>
                      <option value="student">Student</option>
                      <option value="parent">Parent</option>
                    </select>
                  </div>
                  {userForm.role === 'student' ? <div className="space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] p-3">
                    <div><div className="font-medium text-[var(--text-primary)]">Parent or guardian</div><p className="mt-1 text-xs text-[var(--text-muted)]">At least one is required. New guardian accounts are created automatically and emailed their secure password.</p></div>
                    {guardians.map((guardian, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input required className="portal-input" placeholder="Guardian name" value={guardian.name} onChange={(event) => setGuardians((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /><input required type="email" className="portal-input" placeholder="guardian@email.com" value={guardian.email} onChange={(event) => setGuardians((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, email: event.target.value } : item))} />{guardians.length > 1 ? <button type="button" className="portal-button-danger" onClick={() => setGuardians((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button> : <span />}</div>)}
                    {guardians.length < 2 ? <button type="button" className="portal-button-secondary" onClick={() => setGuardians((items) => [...items, { name: '', email: '' }])}>Add another guardian</button> : <p className="text-xs text-[var(--text-muted)]">Maximum of two guardians per student.</p>}
                  </div> : null}
                  {userForm.role === 'staff' ? <div>
                    <label className="portal-label block">Department</label>
                    <select required className="portal-input mt-1" value={userForm.department} onChange={(event) => setUserForm({ ...userForm, department: event.target.value })}>
                      <option value="">Select department</option>
                      {departments.map((department) => <option key={department.id} value={department.name}>{department.name}</option>)}
                    </select>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Create departments/domains in the separate management tab.</p>
                  </div> : null}
                  <div>
                    <label className="portal-label block">Temporary password</label>
                    <div className="mt-1 flex gap-2">
                      <input required type="text" className="portal-input" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
                      <button type="button" className="portal-button-secondary whitespace-nowrap" onClick={generateTemporaryPassword}>Generate</button>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Use Generate for a secure 16-character password. It will be emailed to the user.</p>
                  </div>
                  <button type="submit" className="portal-button-primary">{userForm.role === 'student' ? 'Register Student & Guardian' : 'Add User'}</button>
                </form>
                <form className="space-y-4 portal-panel lg:col-span-2" onSubmit={importUsers}>
                  <div><div className="font-semibold text-[var(--text-primary)]">Import users from Excel</div><p className="mt-1 text-sm text-[var(--text-secondary)]">Choose the correct template, complete it, and import the whole batch safely. No account is created until every row passes validation.</p></div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      { id: 'students', title: 'Students & Guardians', description: 'Creates each student and links one or two guardians.' },
                      { id: 'teachers', title: 'Teachers', description: 'Creates teacher accounts and optionally marks head teachers.' },
                      { id: 'staff', title: 'Staff', description: 'Creates staff accounts and assigns their department.' },
                    ].map((template) => <label key={template.id} className={`cursor-pointer rounded-xl border p-4 transition ${importType === template.id ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/5 ring-1 ring-[var(--brand-blue)]' : 'border-[var(--border-default)] hover:border-[var(--brand-blue)]'}`}><input className="sr-only" type="radio" name="import-type" value={template.id} checked={importType === template.id} onChange={() => { setImportType(template.id); setImportErrors([]) }} /><span className="block text-sm font-semibold text-[var(--text-primary)]">{template.title}</span><span className="mt-1 block text-xs text-[var(--text-secondary)]">{template.description}</span><a className="mt-3 inline-flex text-xs font-medium text-[var(--brand-navy)] underline" href={`${import.meta.env.VITE_API_BASE_URL || ''}/api/users/templates/${template.id}.xlsx`} onClick={(event) => event.stopPropagation()}>Download template</a></label>)}
                  </div>
                  <div className="rounded-lg bg-[var(--bg-app)] p-3 text-xs text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">Password options:</strong> leave password cells blank to generate secure temporary passwords automatically, or provide a 12+ character strong password. Credentials are emailed to newly created accounts.</div>
                  <input type="file" accept=".xlsx,.xls" className="portal-input" onChange={(event) => { setImportFile(event.target.files?.[0] || null); setImportErrors([]) }} />
                  {importErrors.length ? <div className="rounded-lg border border-[var(--brand-red)]/30 bg-[var(--brand-red-light)] p-3"><div className="text-sm font-semibold text-[var(--brand-red)]">Please correct these rows</div><ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-[var(--text-secondary)]">{importErrors.map((item, index) => <li key={`${item.row}-${index}`}>Row {item.row}: {item.message}</li>)}</ul></div> : null}
                  <button className="portal-button-primary">Validate &amp; Import {importType === 'students' ? 'Students & Guardians' : importType === 'teachers' ? 'Teachers' : 'Staff'}</button>
                </form>
              </div>
            ),
          },
          {
            id: 'user-profile',
            hidden: true,
            label: 'User Profile',
            content: selectedUser ? <div className="mx-auto max-w-3xl space-y-6"><div className="portal-panel"><div className="mb-5"><div className="text-xl font-semibold text-[var(--text-primary)]">{selectedUser.name}</div><div className="text-sm text-[var(--text-muted)]">Full user record and account controls</div></div><form className="space-y-4" onSubmit={saveProfile}><div className="grid gap-4 sm:grid-cols-2"><div><label className="portal-label block">Name</label><input required className="portal-input mt-1" value={selectedUser.name} onChange={(event) => setSelectedUser({ ...selectedUser, name: event.target.value })} /></div><div><label className="portal-label block">Email</label><input required type="email" className="portal-input mt-1" value={selectedUser.email} onChange={(event) => setSelectedUser({ ...selectedUser, email: event.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="portal-label block">Role</label><select className="portal-input mt-1" value={selectedUser.role} onChange={(event) => setSelectedUser({ ...selectedUser, role: event.target.value })}><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="staff">Staff</option><option value="student">Student</option><option value="parent">Parent / Guardian</option></select></div><label className="mt-7 flex items-center gap-2 text-sm text-[var(--text-primary)]"><input type="checkbox" checked={selectedUser.is_active} onChange={(event) => setSelectedUser({ ...selectedUser, is_active: event.target.checked })} /> Account active</label></div><div className="flex flex-wrap gap-3"><button className="portal-button-primary">Save profile</button><button type="button" className="portal-button-danger" onClick={() => deleteUser(selectedUser.id)}>Remove user</button></div></form></div>{selectedUser.role === 'student' ? <div className="portal-panel"><div className="font-medium text-[var(--text-primary)]">Parents / guardians</div><p className="mt-1 text-xs text-[var(--text-muted)]">One or two guardians are required for every student.</p><div className="mt-3 space-y-2">{selectedUser.guardians?.map((guardian) => <div key={guardian.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)]"><span>{guardian.name} <span className="text-[var(--text-muted)]">— {guardian.email}</span></span><button type="button" className="portal-button-danger" onClick={() => unlinkGuardian(guardian.id)}>Unlink</button></div>)}</div>{(selectedUser.guardians?.length || 0) < 2 ? <div className="mt-3 flex flex-wrap gap-2 items-center"><div className="flex-1 min-w-[200px]"><UserSearchSelect users={users} filterRole="parent" excludeIds={selectedUser.guardians?.map((g) => g.id) || []} value={parentToLink} onChange={(id) => setParentToLink(id)} placeholder="Search parent / guardian..." /></div><button type="button" className="portal-button-secondary" onClick={linkGuardian}>Link</button></div> : null}</div> : null}{selectedUser.role === 'parent' ? <div className="portal-panel"><div className="font-medium text-[var(--text-primary)]">Linked students</div><div className="mt-3 space-y-2">{selectedUser.children?.map((student) => <div key={student.id} className="rounded-lg bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)]">{student.name} <span className="text-[var(--text-muted)]">— {student.email}</span></div>)}</div></div> : null}</div> : <EmptyState title="Select a user" message="Choose a person in User Management to open their complete profile." />,
          },
        ]}
      />
      <Modal isOpen={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} title={selectedUser ? `${selectedUser.name} — User Profile` : 'User Profile'} size="large">
        {selectedUser ? <div className="space-y-5"><form className="space-y-4" onSubmit={saveProfile}><div className="grid gap-4 sm:grid-cols-2"><div><label className="portal-label block">Name</label><input required className="portal-input mt-1" value={selectedUser.name} onChange={(event) => setSelectedUser({ ...selectedUser, name: event.target.value })} /></div><div><label className="portal-label block">Email</label><input required type="email" className="portal-input mt-1" value={selectedUser.email} onChange={(event) => setSelectedUser({ ...selectedUser, email: event.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="portal-label block">Role</label><select className="portal-input mt-1" value={selectedUser.role} onChange={(event) => setSelectedUser({ ...selectedUser, role: event.target.value })}><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="staff">Staff</option><option value="student">Student</option><option value="parent">Parent / Guardian</option></select></div><label className="mt-7 flex items-center gap-2 text-sm text-[var(--text-primary)]"><input type="checkbox" checked={selectedUser.is_active} onChange={(event) => setSelectedUser({ ...selectedUser, is_active: event.target.checked })} /> Account active</label></div><div className="flex flex-wrap gap-3"><button className="portal-button-primary">Save profile</button><button type="button" className="portal-button-danger" onClick={() => deleteUser(selectedUser.id)}>Remove user</button></div></form>{selectedUser.role === 'student' ? <div className="border-t border-[var(--border-default)] pt-4"><div className="font-medium text-[var(--text-primary)]">Parents / guardians</div><p className="mt-1 text-xs text-[var(--text-muted)]">One or two guardians are required.</p><div className="mt-3 space-y-2">{selectedUser.guardians?.map((guardian) => <div key={guardian.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)]"><span>{guardian.name} <span className="text-[var(--text-muted)]">— {guardian.email}</span></span><button type="button" className="portal-button-danger" onClick={() => unlinkGuardian(guardian.id)}>Unlink</button></div>)}</div>{(selectedUser.guardians?.length || 0) < 2 ? <div className="mt-3 flex flex-wrap gap-2 items-center"><div className="flex-1 min-w-[200px]"><UserSearchSelect users={users} filterRole="parent" excludeIds={selectedUser.guardians?.map((g) => g.id) || []} value={parentToLink} onChange={(id) => setParentToLink(id)} placeholder="Search parent / guardian..." /></div><button type="button" className="portal-button-secondary" onClick={linkGuardian}>Link</button></div> : null}</div> : null}{selectedUser.role === 'parent' ? <div className="border-t border-[var(--border-default)] pt-4"><div className="font-medium text-[var(--text-primary)]">Linked students</div><div className="mt-3 space-y-2">{selectedUser.children?.map((student) => <div key={student.id} className="rounded-lg bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)]">{student.name} <span className="text-[var(--text-muted)]">— {student.email}</span></div>)}</div></div> : null}</div> : null}
      </Modal>
      <Modal isOpen={Boolean(userPendingDeletion)} onClose={() => setUserPendingDeletion(null)} title="Remove User" footer={<><button type="button" className="portal-button-secondary" onClick={() => setUserPendingDeletion(null)}>Cancel</button><button type="button" className="portal-button-primary bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]" onClick={() => deleteUser()}>Remove User</button></>}><p className="text-sm text-[var(--text-secondary)]">Remove <strong className="text-[var(--text-primary)]">{userPendingDeletion?.name}</strong> ({userPendingDeletion?.email})? Their access will be revoked.</p></Modal>
    </div>
  )
}

export function TeacherDashboardView() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading, refetch } = useApi(() => dashboardApi.summary(), [])
  const { data: actionItems = [], loading: actionItemsLoading } = useApi(() => actionItemsApi.list(), [])
  const myTasks = actionItems.filter((item) => String(item.assigned_to) === String(user?.id))

  const updateTask = async (id, status) => {
    try {
      await actionItemsApi.update(id, { status })
      refetch()
      toast.success('Task updated')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not update task')
    }
  }

  return (
    <div>
      <PageHeader title="Teacher Dashboard" subtitle="Your tasks and schedule at a glance." />
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard title="Assigned Actions" value={data?.pending_actions ?? 0} subtitle="Tasks waiting on you" icon={Sparkles} loading={loading} onClick={() => navigate(`/${user?.role === 'staff' ? 'staff' : 'teacher'}/meetings?tab=board`)} />
        <StatCard title="Upcoming Meetings" value={data?.upcoming_meetings ?? 0} subtitle="Your meetings this term" icon={CalendarDays} loading={loading} onClick={() => navigate(`/${user?.role === 'staff' ? 'staff' : 'teacher'}/meetings?tab=meetings`)} />
      </div>
      <div className="mt-6">
        <Table
          data={myTasks}
          loading={actionItemsLoading}
          columns={[
            { key: 'description', label: 'Description' },
            { key: 'meeting', label: 'Meeting source', render: (row) => row.meeting_id ? `Meeting #${row.meeting_id}` : '—' },
            { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
            { key: 'actions', label: 'Actions', render: (row) => (
              <div className="flex gap-2">
                <button type="button" className="portal-button-secondary" onClick={() => updateTask(row.id, 'in_progress')}>Mark In Progress</button>
                <button type="button" className="portal-button-primary" onClick={() => updateTask(row.id, 'done')}>Mark Done</button>
              </div>
            ) },
          ]}
          emptyMessage="No assigned tasks available."
        />
      </div>
    </div>
  )
}

export function StudentHomeView({ titlePrefix = '' }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: results = [], loading: resultsLoading } = useApi(() => resultsApi.list(), [])
  const { data: notices = [], loading: noticesLoading } = useApi(() => noticesApi.list(), [])

  const noticeHighlights = notices.slice(0, 2)
  const recentReports = results.slice(0, 4)
  const resultsHeading = titlePrefix ? "Your Child's Results" : 'My Results'
  const portalPath = user?.role === 'parent' ? '/parent' : '/student'
  const openResults = () => navigate(`${portalPath}/results`)
  const openResultsFromKeyboard = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openResults()
    }
  }

  return (
    <div>
      <PageHeader title={`${titlePrefix || parentChildPrefix(user)}${user?.role === 'parent' ? '' : user?.name ? `${user.name}'s ` : 'Welcome back, '}Home`} subtitle={format(new Date(), 'EEEE, d MMMM yyyy')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div role="link" tabIndex={0} aria-label={`Open ${resultsHeading}`} onClick={openResults} onKeyDown={openResultsFromKeyboard} className="portal-panel cursor-pointer transition hover:border-[var(--brand-blue)] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30">
          <div className="mb-3 text-sm font-medium text-[var(--text-primary)]">{resultsHeading}</div>
          {resultsLoading ? (
            <div className="text-sm text-[var(--text-secondary)]">Loading results...</div>
          ) : recentReports.length ? (
            <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-app)]">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Term</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">My Grade</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Class Avg</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Attendance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">vs Average</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.map((result) => {
                    const diff = result.grade - result.class_average
                    const above = diff >= 0
                    return (
                      <tr key={result.id} className="border-b border-[var(--border-default)] transition-colors duration-100 hover:bg-[var(--bg-app)]">
                        <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{result.subject}</td>
                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{result.term}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-semibold ${above ? 'text-emerald-600' : 'text-[var(--brand-red)]'}`}>{result.grade}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-[var(--text-muted)]">{result.class_average}</td>
                        <td className="px-4 py-3 text-right text-sm text-[var(--text-muted)]">{result.attendance}%</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${above ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-[var(--brand-red-light)] text-[var(--brand-red)]'}`}>
                            {above ? '▲' : '▼'} {Math.abs(diff).toFixed(1)} pts
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={BookOpen} title="No results published yet. Check back after your teacher uploads your report." />
          )}
        </div>
        <div className="space-y-4">
          <button type="button" onClick={openResults} className="portal-panel w-full text-left transition hover:border-[var(--brand-blue)] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30">
            <div className="mb-3 text-sm font-medium text-[var(--text-primary)]">Recent Performance Reports</div>
            <div className="space-y-3">
              {recentReports.map((result) => (
                <div key={result.id} className="rounded-lg border border-[var(--border-default)] p-4">
                  <div className="text-sm font-medium text-[var(--text-primary)]">{result.term} - {result.subject}</div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">Grade {result.grade} released on {formatDate(result.created_at)}</div>
                </div>
              ))}
            </div>
          </button>
          <button type="button" onClick={() => navigate(`${portalPath}/notices`)} className="portal-panel w-full text-left transition hover:border-[var(--brand-blue)] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30">
            <div className="mb-3 text-sm font-medium text-[var(--text-primary)]">Quick Notices</div>
            <div className="space-y-3">
              {noticeHighlights.map((notice) => (
                <div key={notice.id} className="rounded-lg border border-[var(--border-default)] p-4">
                  <div className="text-sm font-medium text-[var(--text-primary)]">{notice.title}</div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">{notice.body.slice(0, 100)}</div>
                </div>
              ))}
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

export function StudentProgressView({ titlePrefix = '' }) {
  const { user } = useAuth()
  const { data: results = [], loading: resultsLoading } = useApi(() => resultsApi.list(), [])
  const chartData = useMemo(() => results.map((result) => ({ subject: result.subject, mine: result.grade, average: result.class_average })), [results])
  
  if (resultsLoading) return <><TopProgressBar /><div className="portal-panel"><div className="h-80 w-full skeleton-shimmer" /></div></>
  if (!results.length) {
    return <EmptyState icon={ChartColumnBig} title="No performance data yet" message="Results will appear here once they are released." />
  }

  return (
    <div>
      <PageHeader title={`${titlePrefix || parentChildPrefix(user)}Progress Dashboard`} subtitle="Track your academic performance over time." />
      <div className="portal-panel">
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e5f0" />
              <XAxis dataKey="subject" stroke="#4a5080" />
              <YAxis stroke="#4a5080" />
              <Tooltip />
              <Legend />
              <Bar dataKey="mine" name="My Grade" fill="#1B2B6B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="average" name="Class Average" fill="#E8734A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {results.map((result) => (
          <div key={result.id} className="min-w-44 rounded-xl border border-[var(--border-default)] bg-white p-4">
            <div className="text-sm font-medium text-[var(--text-primary)]">{result.subject}</div>
            <div className="mt-2 text-sm text-[var(--text-secondary)]">Attendance {result.attendance}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StudentResultHistoryView({ titlePrefix = '' }) {
  const { user } = useAuth()
  const { data: results = [], loading: resultsLoading } = useApi(() => resultsApi.list(), [])
  const heading = user?.role === 'parent' ? `${parentChildPrefix(user) || 'Child '}Results` : titlePrefix ? "Your Child's Results" : 'My Results'

  return (
    <div>
      <PageHeader title={heading} subtitle="Review your released results." />
      {results.length ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-app)]">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Term</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">My Grade</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Class Avg</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Attendance</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">vs Average</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => {
                const diff = result.grade - result.class_average
                const above = diff >= 0
                return (
                  <tr key={result.id} className="border-b border-[var(--border-default)] transition-colors duration-100 hover:bg-[var(--bg-app)]">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{result.subject}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{result.term}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-semibold ${above ? 'text-emerald-600' : 'text-[var(--brand-red)]'}`}>{result.grade}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[var(--text-muted)]">{result.class_average}</td>
                    <td className="px-4 py-3 text-right text-sm text-[var(--text-muted)]">{result.attendance}%</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${above ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-[var(--brand-red-light)] text-[var(--brand-red)]'}`}>
                        {above ? '▲' : '▼'} {Math.abs(diff).toFixed(1)} pts
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : !resultsLoading ? (
        <EmptyState icon={BookOpen} title="No results published yet. Check back after your teacher uploads your report." />
      ) : null}
    </div>
  )
}

export function NoticeBoardView({ titlePrefix = '' }) {
  const { user } = useAuth()
  const { data: notices = [], loading: noticesLoading } = useApi(() => noticesApi.list(), [])
  const [openNotice, setOpenNotice] = useState(null)

  return (
    <div>
      <PageHeader title={`${titlePrefix || parentChildPrefix(user)}Notice Board`} subtitle="Read recent notices and announcements." />
      {noticesLoading ? (
        <SkeletonCardGrid count={4} />
      ) : notices.length === 0 ? (
        <EmptyState icon={FileText} title="No notices yet" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {notices.map((notice) => (
            <button key={notice.id} type="button" className="portal-panel text-left transition hover:bg-[var(--bg-app)]" onClick={() => setOpenNotice(notice)}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-base font-medium text-[var(--text-primary)]">{notice.title}</div>
              </div>
              <div className="mt-2 text-sm text-[var(--text-secondary)]">{notice.body?.slice(0, 120)}{notice.body?.length > 120 ? '...' : ''}</div>
              <div className="mt-4 text-xs text-[var(--text-muted)]">{formatDateTime(notice.publish_datetime || notice.created_at)}</div>
            </button>
          ))}
        </div>
      )}
      <Modal isOpen={Boolean(openNotice)} onClose={() => setOpenNotice(null)} title={openNotice?.title || 'Notice'}>
        <div className="space-y-4 text-sm text-[var(--text-secondary)]">
          <p style={{ whiteSpace: 'pre-wrap' }}>{openNotice?.body}</p>
          <div className="text-xs text-[var(--text-muted)]">{openNotice ? formatDateTime(openNotice.publish_datetime || openNotice.created_at) : ''}</div>
        </div>
      </Modal>
    </div>
  )
}

export function OpportunityBoardView({ titlePrefix = '' }) {
  const { user } = useAuth()
  const { data: opportunities = [], loading: opportunitiesLoading } = useApi(() => opportunitiesApi.list(), [])

  return (
    <div>
      <PageHeader title={`${titlePrefix || parentChildPrefix(user)}Opportunities`} subtitle="Discover scholarships and enrichment opportunities." />
      <div className="grid gap-4 md:grid-cols-2">
        {opportunities.map((opportunity) => {
          const soon = opportunity.deadline ? new Date(opportunity.deadline) - new Date() < 7 * 24 * 60 * 60 * 1000 : false
          return (
            <div key={opportunity.id} className="portal-panel">
              <div className="flex items-start justify-between gap-3">
                <div className="text-base font-medium text-[var(--text-primary)]">{opportunity.title}</div>
                <Badge status={soon ? 'overdue' : 'published'} />
              </div>
              <div className="mt-2 text-sm text-[var(--text-secondary)]">{opportunity.eligibility}</div>
              <div className={`mt-3 text-sm ${soon ? 'text-[var(--brand-red)]' : 'text-[var(--text-secondary)]'}`}>Deadline {formatDate(opportunity.deadline)}</div>
              {opportunity.link ? (
                <a href={opportunity.link} target="_blank" rel="noreferrer" className="portal-button-secondary mt-4 inline-flex">Visit link</a>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SettingsView({ titlePrefix = '' }) {
  const { user, setUser, refreshUser } = useAuth()
  const [profileName, setProfileName] = useState(user?.name || '')
  const [emailRequest, setEmailRequest] = useState('')
  const [currentEmailOtp, setCurrentEmailOtp] = useState('')
  const [newEmailOtp, setNewEmailOtp] = useState('')
  const [emailChangeStep, setEmailChangeStep] = useState('request')
  const [profilePicture, setProfilePicture] = useState('')
  const [emailEnabled, setEmailEnabled] = useState(user?.email_notifications_enabled ?? true)
  const [passwordForm, setPasswordForm] = useState({ otp: '', new_password: '', confirm_password: '' })
  const [passwordCodeSent, setPasswordCodeSent] = useState(false)

  const saveProfile = async () => {
    try {
      const updatedUser = (await usersApi.updateSettings({
        name: profileName.trim(),
        profile_picture_url: profilePicture || undefined,
      })).data
      setUser(updatedUser)
      window.localStorage.setItem('bridge_school_user', JSON.stringify(updatedUser))
      toast.success('Profile details updated')
    } catch (error) {
      toast.error(formatApiError(error, 'Could not update profile'))
    }
  }

  const handleProfilePictureChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setProfilePicture(await prepareProfileImage(file))
      toast.success('Profile picture cropped and optimized. Save profile to apply it.')
    } catch (error) { toast.error(error.message || 'Could not prepare profile picture') }
  }

  const requestEmailChange = async (event) => {
    event.preventDefault()
    if (!emailRequest.trim()) return toast.error('Enter a new email address')
    try {
      await authApi.requestEmailChange(emailRequest.trim())
      setEmailChangeStep('verify-current')
      toast.success('Enter the OTP sent to your current email address')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not start email change')
    }
  }

  const verifyCurrentEmailOtp = async (event) => {
    event.preventDefault()
    if (!currentEmailOtp.trim()) return toast.error('Enter the code sent to your current email')
    try {
      await authApi.verifyCurrentEmailOtp(currentEmailOtp.trim())
      setEmailChangeStep('verify-new')
      toast.success('Enter the OTP sent to your new email address')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not verify current email')
    }
  }

  const confirmEmailChange = async (event) => {
    event.preventDefault()
    if (!newEmailOtp.trim()) return toast.error('Enter the code sent to your new email')
    try {
      const updatedUser = (await authApi.confirmEmailChange(newEmailOtp.trim())).data
      const refreshedUser = await refreshUser()
      setUser(refreshedUser)
      window.localStorage.setItem('bridge_school_user', JSON.stringify(refreshedUser))
      toast.success('Email address updated successfully')
      setEmailChangeStep('request')
      setCurrentEmailOtp('')
      setNewEmailOtp('')
      setEmailRequest('')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not confirm email change')
    }
  }

  const savePreferences = async () => {
    try {
      const updatedUser = (await usersApi.updateSettings({
        email_notifications_enabled: emailEnabled,
      })).data
      setUser(updatedUser)
      window.localStorage.setItem('bridge_school_user', JSON.stringify(updatedUser))
      toast.success('Notification preferences saved')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not save preferences')
    }
  }

  const requestPasswordCode = async () => {
    try {
      await authApi.requestPasswordChange()
      setPasswordCodeSent(true)
      toast.success('Verification code sent to your email')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not send verification code')
    }
  }

  const changePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    try {
      await authApi.confirmPasswordChange(passwordForm.otp, passwordForm.new_password)
      toast.success('Password changed successfully')
      setPasswordCodeSent(false)
      setPasswordForm({ otp: '', new_password: '', confirm_password: '' })
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not change password')
    }
  }

  return (
    <div>
      <PageHeader title={`${titlePrefix || parentChildPrefix(user)}Settings`} subtitle="Manage your account, security, and preferences." />
      <div className="mb-6 rounded-2xl bg-[var(--brand-navy)] p-6 text-white"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Account settings</div><div className="mt-2 text-2xl font-semibold">Manage your profile, security, and preferences</div><div className="mt-1 text-sm text-white/70">Signed in as {user?.role || 'portal member'}.</div></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="portal-panel lg:col-span-2">
          <div className="text-sm font-semibold text-[var(--text-primary)]">Profile</div><p className="mt-1 text-sm text-[var(--text-secondary)]">Your profile image is automatically centre-cropped and optimized for use across the portal.</p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-[var(--border-default)] bg-[var(--bg-app)] text-xl font-semibold text-[var(--brand-navy)]">
              {profilePicture || user?.profile_picture_url ? <img src={profilePicture || user?.profile_picture_url} alt="Profile preview" className="h-full w-full object-cover" /> : (user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-base font-semibold text-[var(--text-primary)]">{user?.name || 'Your profile'}</div>
              <div className="text-sm text-[var(--text-secondary)]">{user?.email || 'Update your email and security details below.'}</div>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div><label className="portal-label block">Display name</label><input className="portal-input mt-1" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Display name" /></div>
            <div><label className="portal-label block">Profile picture</label><input type="file" accept="image/*" className="portal-input mt-1" onChange={handleProfilePictureChange} /></div>
            <button type="button" className="portal-button-primary" onClick={saveProfile}>Save profile</button>
          </div>
        </div>
        <div className="portal-panel">
          <div className="text-sm font-medium text-[var(--text-primary)]">Email Address</div>
          {emailChangeStep === 'request' ? (
            <form className="mt-4 space-y-3" onSubmit={requestEmailChange}>
              <input className="portal-input" value={emailRequest} onChange={(event) => setEmailRequest(event.target.value)} placeholder="New email address" />
              <button type="submit" className="portal-button-primary">Send verification code</button>
            </form>
          ) : emailChangeStep === 'verify-current' ? (
            <form className="mt-4 space-y-3" onSubmit={verifyCurrentEmailOtp}>
              <p className="text-sm text-[var(--text-secondary)]">Enter the six-digit code sent to your current email address.</p>
              <input inputMode="numeric" maxLength="6" className="portal-input" value={currentEmailOtp} onChange={(event) => setCurrentEmailOtp(event.target.value)} placeholder="Current email OTP" />
              <button type="submit" className="portal-button-primary">Verify current email</button>
            </form>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={confirmEmailChange}>
              <p className="text-sm text-[var(--text-secondary)]">Enter the six-digit code sent to your new email address.</p>
              <input inputMode="numeric" maxLength="6" className="portal-input" value={newEmailOtp} onChange={(event) => setNewEmailOtp(event.target.value)} placeholder="New email OTP" />
              <button type="submit" className="portal-button-primary">Confirm email change</button>
            </form>
          )}
        </div>
        <div className="portal-panel">
          <div className="text-sm font-semibold text-[var(--text-primary)]">Notification Preferences</div><p className="mt-1 text-sm text-[var(--text-secondary)]">Choose how you receive portal updates.</p>
          <div className="mt-4 space-y-3 text-sm text-[var(--text-primary)]">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-default)] p-3"><span><span className="block font-medium">Email notifications</span><span className="text-xs text-[var(--text-muted)]">Meeting invitations, reminders, and important updates.</span></span><input type="checkbox" checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} /></label>
            <button type="button" className="portal-button-primary" onClick={savePreferences}>Save preferences</button>
          </div>
        </div>
        <div className="portal-panel">
          <div className="text-sm font-medium text-[var(--text-primary)]">Change Password</div>
          {!passwordCodeSent ? <div className="mt-4 space-y-3"><p className="text-sm text-[var(--text-secondary)]">We’ll email a six-digit verification code before changing your password.</p><button type="button" className="portal-button-primary" onClick={requestPasswordCode}>Email verification code</button></div> : <div className="mt-4 space-y-3"><input inputMode="numeric" maxLength="6" className="portal-input" placeholder="Six-digit code" value={passwordForm.otp} onChange={(event) => setPasswordForm({ ...passwordForm, otp: event.target.value })} /><input type="password" className="portal-input" placeholder="New password" value={passwordForm.new_password} onChange={(event) => setPasswordForm({ ...passwordForm, new_password: event.target.value })} /><input type="password" className="portal-input" placeholder="Confirm new password" value={passwordForm.confirm_password} onChange={(event) => setPasswordForm({ ...passwordForm, confirm_password: event.target.value })} /><p className="text-xs text-[var(--text-muted)]">12+ characters with uppercase, lowercase, a number, and a symbol.</p><button type="button" className="portal-button-primary" onClick={changePassword}>Change password</button></div>}
        </div>
      </div>
    </div>
  )
}
