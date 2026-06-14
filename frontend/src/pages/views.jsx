import { useEffect, useMemo, useState } from 'react'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import {
  BookOpen,
  CalendarDays,
  ChartColumnBig,
  CirclePlus,
  FileDown,
  FileText,
  Megaphone,
  Send,
  Shield,
  Sparkles,
  Users,
  Wifi,
  WifiOff,
  WandSparkles,
  BriefcaseBusiness,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'react-hot-toast'

import { useAuth } from '../context/AuthContext.jsx'
import { useApi } from '../hooks/useApi.js'
import { dashboardApi } from '../api/dashboard.js'
import { meetingsApi } from '../api/meetings.js'
import { actionItemsApi } from '../api/actionItems.js'
import { emailsApi } from '../api/emails.js'
import { resultsApi } from '../api/results.js'
import { noticesApi } from '../api/notices.js'
import { opportunitiesApi } from '../api/opportunities.js'
import { usersApi } from '../api/users.js'
import { whatsappApi } from '../api/whatsapp.js'

import Badge from '../components/shared/Badge.jsx'
import EmptyState from '../components/shared/EmptyState.jsx'
import FileUploadZone from '../components/shared/FileUploadZone.jsx'
import KanbanBoard from '../components/shared/KanbanBoard.jsx'
import Modal from '../components/shared/Modal.jsx'
import PageHeader from '../components/shared/PageHeader.jsx'
import StatCard from '../components/shared/StatCard.jsx'
import Tabs from '../components/shared/Tabs.jsx'
import Table from '../components/shared/Table.jsx'
import CreateMeetingModal from '../components/shared/CreateMeetingModal.jsx'

const formatDate = (value, pattern = 'PPP') => (value ? format(parseISO(value), pattern) : '—')

function useMeetingData() {
  return useApi(() => meetingsApi.list(), [])
}

export function LoginPageView({ onLogin }) {
  return onLogin
}

export function AdminDashboardView() {
  const { user } = useAuth()
  const { data, loading, refetch } = useApi(() => dashboardApi.summary(), [])
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Good morning, ${user?.name || 'Administrator'}`} action={{ label: 'New Meeting', icon: CirclePlus, onClick: () => setCreateOpen(true) }} />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Pending Actions" value={data?.pending_actions ?? 0} subtitle="Tasks awaiting action" icon={Sparkles} loading={loading} />
        <StatCard title="Scheduled Emails" value={data?.scheduled_emails ?? 0} subtitle="Queued communication" icon={Send} loading={loading} />
        <StatCard title="Overdue Tasks" value={data?.overdue_tasks ?? 0} subtitle="Needs attention" icon={CalendarDays} loading={loading} />
      </div>
      <div className="mt-6 flex gap-3">
        <button type="button" className="portal-button-primary" onClick={() => setCreateOpen(true)}>New Meeting</button>
        <a href="/admin/email" className="portal-button-secondary">Schedule Email</a>
      </div>
      <CreateMeetingModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={refetch} />
    </div>
  )
}

export function MeetingWorkspaceView({ canCreateMeeting }) {
  const { user } = useAuth()
  const { data: meetings = [], loading: meetingsLoading, refetch: refetchMeetings } = useApi(() => meetingsApi.list(), [])
  const { data: actionItems = [], loading: actionItemsLoading, refetch: refetchActions } = useApi(() => actionItemsApi.list(), [])
  const { data: users = [] } = useApi(() => usersApi.list(), [])
  const [meetingModalOpen, setMeetingModalOpen] = useState(false)
  const [selectedPastMeeting, setSelectedPastMeeting] = useState(null)
  const [notes, setNotes] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summary, setSummary] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [actionForm, setActionForm] = useState({ meeting_id: '', description: '', assigned_to: '', due_date: '' })

  const visibleMeetings = meetings.filter((meeting) => meeting.status)
  const pastMeetings = meetings.filter((meeting) => meeting.status === 'past')
  const filteredActions = useMemo(() => {
    if (assigneeFilter === 'all') return actionItems
    return actionItems.filter((item) => String(item.assigned_to) === String(assigneeFilter))
  }, [actionItems, assigneeFilter])

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
    if (!selectedPastMeeting) return
    try {
      await meetingsApi.update(selectedPastMeeting, { notes })
      toast.success('Notes saved')
      refetchMeetings()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not save notes')
    }
  }

  const generateSummary = async () => {
    if (!selectedPastMeeting) return
    setSummaryLoading(true)
    try {
      const response = await meetingsApi.summarise(selectedPastMeeting)
      setSummary(response.data.summary)
      toast.success('AI summary generated')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not generate summary')
    } finally {
      setSummaryLoading(false)
    }
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
    try {
      await actionItemsApi.update(id, { status })
      refetchActions()
      toast.success('Action item updated')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not update action item')
    }
  }

  const createActionItem = async (event) => {
    event.preventDefault()
    try {
      await actionItemsApi.create(actionForm)
      setActionForm({ meeting_id: '', description: '', assigned_to: '', due_date: '' })
      refetchActions()
      toast.success('Action item created')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not create action item')
    }
  }

  return (
    <div>
      <PageHeader title="Meeting Workspace" subtitle="Coordinate discussions and track decisions." action={canCreateMeeting ? { label: 'New Meeting', icon: CirclePlus, onClick: () => setMeetingModalOpen(true) } : null} />
      <Tabs
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
                  <select className="portal-input mt-1" value={selectedPastMeeting || ''} onChange={(event) => setSelectedPastMeeting(event.target.value)}>
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
                  </div>
                  <div className="rounded-lg border-l-4 border-[var(--brand-red)] bg-[var(--brand-red-light)] p-4 text-sm text-[var(--brand-navy)]">
                    {summary || 'AI summary will appear here after generation.'}
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
                      {users.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                    </select>
                  </div>
                </div>
                <KanbanBoard columns={boardColumns} onStatusChange={changeActionStatus} />
                <form className="grid gap-4 portal-panel lg:grid-cols-4" onSubmit={createActionItem}>
                  <select className="portal-input" value={actionForm.meeting_id} onChange={(event) => setActionForm({ ...actionForm, meeting_id: event.target.value })}>
                    <option value="">Select meeting</option>
                    {meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}
                  </select>
                  <input className="portal-input" placeholder="Action item description" value={actionForm.description} onChange={(event) => setActionForm({ ...actionForm, description: event.target.value })} />
                  <select className="portal-input" value={actionForm.assigned_to} onChange={(event) => setActionForm({ ...actionForm, assigned_to: event.target.value })}>
                    <option value="">Assign to</option>
                    {users.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                  <div className="flex gap-3">
                    <input type="date" className="portal-input" value={actionForm.due_date} onChange={(event) => setActionForm({ ...actionForm, due_date: event.target.value })} />
                    <button type="submit" className="portal-button-primary whitespace-nowrap">Add Action Item</button>
                  </div>
                </form>
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
  const { data: templates = [], refetch: refetchTemplates } = useApi(() => emailsApi.templates(), [])
  const [tab, setTab] = useState('dashboard')
  const [compose, setCompose] = useState({ recipient_group: 'parents', template_id: '', subject: '', body: '', scheduled_at: '' })
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '' })

  const draftEmails = emails.filter((item) => item.status === 'draft')
  const scheduledEmails = emails.filter((item) => item.status === 'scheduled')
  const sentEmails = emails.filter((item) => item.status === 'sent')

  useEffect(() => {
    const selectedTemplate = templates.find((template) => String(template.id) === String(compose.template_id))
    if (selectedTemplate) {
      setCompose((current) => ({ ...current, subject: selectedTemplate.subject, body: selectedTemplate.body }))
    }
  }, [compose.template_id, templates])

  const submitCompose = async (event) => {
    event.preventDefault()
    try {
      const payload = { ...compose, template_id: compose.template_id || null }
      if (compose.scheduled_at) {
        await emailsApi.schedule(payload)
      } else {
        await emailsApi.send(payload)
      }
      toast.success('Email saved')
      setCompose({ recipient_group: 'parents', template_id: '', subject: '', body: '', scheduled_at: '' })
      refetchEmails()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not save email')
    }
  }

  const submitTemplate = async (event) => {
    event.preventDefault()
    try {
      await emailsApi.createTemplate(templateForm)
      toast.success('Template created')
      setTemplateForm({ name: '', subject: '', body: '' })
      refetchTemplates()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not create template')
    }
  }

  return (
    <div>
      <PageHeader title="Email Module" subtitle="Compose, schedule, and manage templates." />
      <Tabs
        tabs={[
          {
            id: 'dashboard',
            label: 'Email Dashboard',
            content: (
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Table
                    loading={emailsLoading}
                    data={scheduledEmails}
                    columns={[
                      { key: 'scheduled_at', label: 'Date', render: (row) => formatDate(row.scheduled_at) },
                      { key: 'recipient_group', label: 'Recipients' },
                      { key: 'subject', label: 'Subject' },
                      { key: 'template_id', label: 'Template', render: (row) => row.template_id || '—' },
                    ]}
                    emptyMessage="No scheduled emails yet."
                  />
                  <Table
                    loading={emailsLoading}
                    data={draftEmails}
                    columns={[
                      { key: 'recipient_group', label: 'Recipients' },
                      { key: 'subject', label: 'Subject' },
                      { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
                    ]}
                    emptyMessage="No drafts available."
                  />
                </div>
                <Table
                  loading={emailsLoading}
                  data={sentEmails}
                  columns={[
                    { key: 'scheduled_at', label: 'Date', render: (row) => formatDate(row.sent_at || row.scheduled_at) },
                    { key: 'recipient_group', label: 'To' },
                    { key: 'subject', label: 'Subject' },
                    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
                  ]}
                  emptyMessage="No sent emails yet."
                />
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
                  </select>
                </div>
                <div>
                  <label className="portal-label block">Template</label>
                  <select className="portal-input mt-1" value={compose.template_id} onChange={(event) => setCompose({ ...compose, template_id: event.target.value })}>
                    <option value="">None</option>
                    {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="portal-label block">Subject</label>
                  <input className="portal-input mt-1" value={compose.subject} onChange={(event) => setCompose({ ...compose, subject: event.target.value })} />
                </div>
                <div>
                  <label className="portal-label block">Schedule datetime</label>
                  <input type="datetime-local" className="portal-input mt-1" value={compose.scheduled_at} onChange={(event) => setCompose({ ...compose, scheduled_at: event.target.value })} />
                </div>
                <div className="lg:col-span-2">
                  <label className="portal-label block">Body</label>
                  <textarea className="portal-input mt-1 min-h-40" value={compose.body} onChange={(event) => setCompose({ ...compose, body: event.target.value })} />
                </div>
                <div className="lg:col-span-2 flex justify-end">
                  <button type="submit" className="portal-button-primary">Send</button>
                </div>
              </form>
            ),
          },
          {
            id: 'templates',
            label: 'Email Templates',
            content: (
              <div className="grid gap-6 lg:grid-cols-2">
                <Table
                  data={templates}
                  loading={false}
                  columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'subject', label: 'Subject Preview' },
                    { key: 'created_by_name', label: 'Created By' },
                  ]}
                  emptyMessage="No templates created yet."
                />
                <form className="space-y-4 portal-panel" onSubmit={submitTemplate}>
                  <div>
                    <label className="portal-label block">Name</label>
                    <input className="portal-input mt-1" value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Subject</label>
                    <input className="portal-input mt-1" value={templateForm.subject} onChange={(event) => setTemplateForm({ ...templateForm, subject: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Body</label>
                    <textarea className="portal-input mt-1 min-h-44" placeholder="Use [Student Name], [Date] placeholders." value={templateForm.body} onChange={(event) => setTemplateForm({ ...templateForm, body: event.target.value })} />
                  </div>
                  <button type="submit" className="portal-button-primary">Create Template</button>
                </form>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

export function PerformanceBroadcasterView() {
  const { user } = useAuth()
  const { data: results = [], refetch } = useApi(() => resultsApi.list(), [])
  const [form, setForm] = useState({ subject: '', class_name: '', notify: true, file: null })

  const uploads = useMemo(() => {
    const groups = new Map()
    results.forEach((result) => {
      const key = result.batch_id || result.created_at
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(result)
    })
    return Array.from(groups.entries()).map(([batchId, batchResults]) => ({ batchId, batchResults }))
  }, [results])

  const submit = async (event) => {
    event.preventDefault()
    if (!form.file) {
      toast.error('Choose a results file first')
      return
    }
    const payload = new FormData()
    payload.append('file', form.file)
    payload.append('subject', form.subject)
    payload.append('class_name', form.class_name)
    payload.append('notify', form.notify ? 'true' : 'false')
    try {
      await resultsApi.upload(payload)
      toast.success('Results uploaded')
      setForm({ subject: '', class_name: '', notify: true, file: null })
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
          <div>
            <label className="portal-label block">Subject</label>
            <input className="portal-input mt-1" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
          </div>
          <div>
            <label className="portal-label block">Class</label>
            <input className="portal-input mt-1" value={form.class_name} onChange={(event) => setForm({ ...form, class_name: event.target.value })} />
          </div>
          <FileUploadZone accept=".csv,.xlsx" label="Upload result sheet" onFileSelect={(file) => setForm({ ...form, file })} />
          <label className="flex items-center gap-3 text-sm text-[var(--text-primary)]">
            <input type="checkbox" checked={form.notify} onChange={(event) => setForm({ ...form, notify: event.target.checked })} />
            Notify parents via email and WhatsApp
          </label>
          <button type="submit" className="portal-button-primary w-full">Upload & Broadcast</button>
        </form>
        <div className="portal-panel">
          <div className="mb-4 text-sm font-medium text-[var(--text-primary)]">Recent uploads</div>
          <div className="space-y-3">
            {uploads.map((group) => (
              <div key={group.batchId} className="rounded-lg border border-[var(--border-default)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{group.batchResults[0]?.subject}</div>
                    <div className="text-xs text-[var(--text-muted)]">Batch {group.batchId}</div>
                  </div>
                  <Badge status="published" />
                </div>
                <div className="mt-3 text-sm text-[var(--text-secondary)]">{group.batchResults.length} students</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">Uploaded by {group.batchResults[0]?.uploaded_by_name || user?.name}</div>
              </div>
            ))}
            {!uploads.length ? <EmptyState title="No uploads yet" message="Broadcast result sheets to see recent batches here." /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function WhatsAppAlertsView() {
  const { user } = useAuth()
  const { data: logs = [], refetch } = useApi(() => whatsappApi.logs(), [])
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
  const { data: notices = [], refetch: refetchNotices } = useApi(() => noticesApi.list(), [])
  const { data: opportunities = [], refetch: refetchOpportunities } = useApi(() => opportunitiesApi.list(), [])
  const { data: users = [], refetch: refetchUsers } = useApi(() => usersApi.list(), [])
  const [noticeForm, setNoticeForm] = useState({ title: '', body: '', recipients: 'all', status: 'draft', publish_date: '' })
  const [opportunityForm, setOpportunityForm] = useState({ title: '', eligibility: '', deadline: '', link: '' })
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'teacher', password: '' })

  const submitNotice = async (event) => {
    event.preventDefault()
    try {
      await noticesApi.create(noticeForm)
      toast.success('Notice created')
      setNoticeForm({ title: '', body: '', recipients: 'all', status: 'draft', publish_date: '' })
      refetchNotices()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not create notice')
    }
  }

  const submitOpportunity = async (event) => {
    event.preventDefault()
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
    try {
      await usersApi.create({ ...userForm, head_teacher: false, is_active: true })
      toast.success('User created')
      setUserForm({ name: '', email: '', role: 'teacher', password: '' })
      refetchUsers()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not create user')
    }
  }

  const deleteUser = async (id) => {
    if (!window.confirm('Remove this user?')) return
    try {
      await usersApi.remove(id)
      toast.success('User removed')
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
                  loading={false}
                  columns={[
                    { key: 'title', label: 'Title' },
                    { key: 'recipients', label: 'Recipients', render: (row) => <Badge status={row.recipients} /> },
                    { key: 'publish_date', label: 'Date', render: (row) => formatDate(row.publish_date) },
                    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
                    { key: 'actions', label: 'Actions', render: (row) => <button className="portal-button-danger" onClick={() => deleteNotice(row.id)}>Delete</button> },
                  ]}
                  emptyMessage="No notices available."
                />
                <form className="space-y-4 portal-panel" onSubmit={submitNotice}>
                  <div>
                    <label className="portal-label block">Title</label>
                    <input className="portal-input mt-1" value={noticeForm.title} onChange={(event) => setNoticeForm({ ...noticeForm, title: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Body</label>
                    <textarea className="portal-input mt-1 min-h-40" value={noticeForm.body} onChange={(event) => setNoticeForm({ ...noticeForm, body: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Recipients</label>
                    <select className="portal-input mt-1" value={noticeForm.recipients} onChange={(event) => setNoticeForm({ ...noticeForm, recipients: event.target.value })}>
                      <option value="all">All</option>
                      <option value="students">Students</option>
                      <option value="parents">Parents</option>
                      <option value="teachers">Teachers</option>
                    </select>
                  </div>
                  <div>
                    <label className="portal-label block">Publish date</label>
                    <input type="date" className="portal-input mt-1" value={noticeForm.publish_date} onChange={(event) => setNoticeForm({ ...noticeForm, publish_date: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Status</label>
                    <select className="portal-input mt-1" value={noticeForm.status} onChange={(event) => setNoticeForm({ ...noticeForm, status: event.target.value })}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                  <button type="submit" className="portal-button-primary">Create Notice</button>
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
                  loading={false}
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
                    <label className="portal-label block">Title</label>
                    <input className="portal-input mt-1" value={opportunityForm.title} onChange={(event) => setOpportunityForm({ ...opportunityForm, title: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Eligibility</label>
                    <input className="portal-input mt-1" value={opportunityForm.eligibility} onChange={(event) => setOpportunityForm({ ...opportunityForm, eligibility: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Deadline</label>
                    <input type="date" className="portal-input mt-1" value={opportunityForm.deadline} onChange={(event) => setOpportunityForm({ ...opportunityForm, deadline: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Link</label>
                    <input className="portal-input mt-1" value={opportunityForm.link} onChange={(event) => setOpportunityForm({ ...opportunityForm, link: event.target.value })} />
                  </div>
                  <button type="submit" className="portal-button-primary">Create Opportunity</button>
                </form>
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
                  loading={false}
                  columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'role', label: 'Role', render: (row) => <Badge status={row.role} /> },
                    { key: 'is_active', label: 'Status', render: (row) => <Badge status={row.is_active ? 'connected' : 'failed'} /> },
                    { key: 'actions', label: 'Actions', render: (row) => <button className="portal-button-danger" onClick={() => deleteUser(row.id)}>Remove</button> },
                  ]}
                  emptyMessage="No users found."
                />
                <form className="space-y-4 portal-panel" onSubmit={submitUser}>
                  <div>
                    <label className="portal-label block">Name</label>
                    <input className="portal-input mt-1" value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Email</label>
                    <input className="portal-input mt-1" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
                  </div>
                  <div>
                    <label className="portal-label block">Role</label>
                    <select className="portal-input mt-1" value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>
                      <option value="admin">Admin</option>
                      <option value="teacher">Teacher</option>
                      <option value="student">Student</option>
                      <option value="parent">Parent</option>
                    </select>
                  </div>
                  <div>
                    <label className="portal-label block">Temporary password</label>
                    <input type="password" className="portal-input mt-1" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
                  </div>
                  <button type="submit" className="portal-button-primary">Add User</button>
                </form>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

export function TeacherDashboardView() {
  const { user } = useAuth()
  const { data, loading, refetch } = useApi(() => dashboardApi.summary(), [])
  const { data: actionItems = [] } = useApi(() => actionItemsApi.list(), [])
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
        <StatCard title="Assigned Actions" value={data?.pending_actions ?? 0} subtitle="Tasks waiting on you" icon={Sparkles} loading={loading} />
        <StatCard title="Upcoming Meetings" value={data?.upcoming_meetings ?? 0} subtitle="Your meetings this term" icon={CalendarDays} loading={loading} />
      </div>
      <div className="mt-6">
        <Table
          data={myTasks}
          loading={false}
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
  const { data: results = [], loading: resultsLoading } = useApi(() => resultsApi.list(), [])
  const { data: notices = [] } = useApi(() => noticesApi.list(), [])

  const noticeHighlights = notices.slice(0, 2)
  const recentReports = results.slice(0, 4)

  return (
    <div>
      <PageHeader title={`${titlePrefix}${user?.name ? `${user.name}'s ` : 'Welcome back, '}Home`} subtitle={format(new Date(), 'EEEE, d MMMM yyyy')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Table
          data={recentReports}
          loading={resultsLoading}
          columns={[
            { key: 'subject', label: 'Subject' },
            { key: 'student_name', label: 'Teacher', render: (row) => row.uploaded_by_name || '—' },
            { key: 'grade', label: 'Grade', render: (row) => row.grade },
            { key: 'class_average', label: 'Class Average', render: (row) => row.class_average },
            { key: 'attendance', label: 'Attendance %', render: (row) => row.attendance },
          ]}
          emptyMessage="No results released yet."
        />
        <div className="space-y-4">
          <div className="portal-panel">
            <div className="mb-3 text-sm font-medium text-[var(--text-primary)]">Recent Performance Reports</div>
            <div className="space-y-3">
              {recentReports.map((result) => (
                <div key={result.id} className="rounded-lg border border-[var(--border-default)] p-4">
                  <div className="text-sm font-medium text-[var(--text-primary)]">{result.term} - {result.subject}</div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">Grade {result.grade} released on {formatDate(result.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="portal-panel">
            <div className="mb-3 text-sm font-medium text-[var(--text-primary)]">Quick Notices</div>
            <div className="space-y-3">
              {noticeHighlights.map((notice) => (
                <div key={notice.id} className="rounded-lg border border-[var(--border-default)] p-4">
                  <div className="text-sm font-medium text-[var(--text-primary)]">{notice.title}</div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">{notice.body.slice(0, 100)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StudentProgressView({ titlePrefix = '' }) {
  const { data: results = [] } = useApi(() => resultsApi.list(), [])
  const chartData = useMemo(() => results.map((result) => ({ subject: result.subject, mine: result.grade, average: result.class_average })), [results])

  if (!results.length) {
    return <EmptyState icon={ChartColumnBig} title="No performance data yet" message="Results will appear here once they are released." />
  }

  return (
    <div>
      <PageHeader title={`${titlePrefix}Progress Dashboard`} subtitle="Track your academic performance over time." />
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
  const { data: results = [] } = useApi(() => resultsApi.list(), [])

  return (
    <div>
      <PageHeader title={`${titlePrefix}Result History`} subtitle="Review your released results." />
      <Table
        data={results}
        loading={false}
        columns={[
          { key: 'term', label: 'Term' },
          { key: 'subject', label: 'Subject' },
          { key: 'grade', label: 'Grade', render: (row) => row.grade },
          { key: 'class_average', label: 'Class Average', render: (row) => row.class_average },
          { key: 'uploaded_by_name', label: 'Teacher' },
          { key: 'created_at', label: 'Date', render: (row) => formatDate(row.created_at) },
        ]}
      />
    </div>
  )
}

export function NoticeBoardView({ titlePrefix = '' }) {
  const { data: notices = [] } = useApi(() => noticesApi.list(), [])
  const [openNotice, setOpenNotice] = useState(null)

  return (
    <div>
      <PageHeader title={`${titlePrefix}Notice Board`} subtitle="Read recent notices and announcements." />
      <div className="grid gap-4 md:grid-cols-2">
        {notices.map((notice) => (
          <button key={notice.id} type="button" className="portal-panel text-left transition hover:bg-[var(--bg-app)]" onClick={() => setOpenNotice(notice)}>
            <div className="flex items-start justify-between gap-3">
              <div className="text-base font-medium text-[var(--text-primary)]">{notice.title}</div>
              <Badge status={notice.recipients} />
            </div>
            <div className="mt-2 text-sm text-[var(--text-secondary)]">{notice.body.slice(0, 100)}</div>
            <div className="mt-4 text-xs text-[var(--text-muted)]">{formatDate(notice.publish_date || notice.created_at)}</div>
          </button>
        ))}
      </div>
      <Modal isOpen={Boolean(openNotice)} onClose={() => setOpenNotice(null)} title={openNotice?.title || 'Notice'}>
        <div className="space-y-4 text-sm text-[var(--text-secondary)]">
          <Badge status={openNotice?.recipients || 'all'} />
          <p>{openNotice?.body}</p>
          <div className="text-xs text-[var(--text-muted)]">Published {openNotice ? formatDate(openNotice.publish_date || openNotice.created_at) : ''}</div>
        </div>
      </Modal>
    </div>
  )
}

export function OpportunityBoardView({ titlePrefix = '' }) {
  const { data: opportunities = [] } = useApi(() => opportunitiesApi.list(), [])

  return (
    <div>
      <PageHeader title={`${titlePrefix}Opportunities`} subtitle="Discover scholarships and enrichment opportunities." />
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
  const { user } = useAuth()
  const [whatsappNumber, setWhatsappNumber] = useState(user?.whatsapp_number || '')
  const [emailRequest, setEmailRequest] = useState('')
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [whatsappEnabled, setWhatsappEnabled] = useState(true)

  const saveWhatsapp = async () => {
    try {
      await usersApi.updateSettings({ whatsapp_number: whatsappNumber })
      toast.success('WhatsApp number updated')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not update WhatsApp number')
    }
  }

  const requestEmailChange = (event) => {
    event.preventDefault()
    toast.success('Email change request submitted for review')
    setEmailRequest('')
  }

  const savePreferences = () => {
    toast.success('Notification preferences saved')
  }

  return (
    <div>
      <PageHeader title={`${titlePrefix}Settings`} subtitle="Manage contact details and notification preferences." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="portal-panel">
          <div className="text-sm font-medium text-[var(--text-primary)]">Update WhatsApp Number</div>
          <div className="mt-4 space-y-3">
            <input className="portal-input" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} placeholder="Phone number" />
            <button type="button" className="portal-button-primary" onClick={saveWhatsapp}>Save</button>
          </div>
        </div>
        <form className="portal-panel" onSubmit={requestEmailChange}>
          <div className="text-sm font-medium text-[var(--text-primary)]">Request Email Change</div>
          <div className="mt-4 space-y-3">
            <input className="portal-input" value={emailRequest} onChange={(event) => setEmailRequest(event.target.value)} placeholder="New email address" />
            <button type="submit" className="portal-button-primary">Submit Request</button>
          </div>
        </form>
        <div className="portal-panel">
          <div className="text-sm font-medium text-[var(--text-primary)]">Notification Preferences</div>
          <div className="mt-4 space-y-3 text-sm text-[var(--text-primary)]">
            <label className="flex items-center gap-3"><input type="checkbox" checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} /> Email</label>
            <label className="flex items-center gap-3"><input type="checkbox" checked={whatsappEnabled} onChange={(event) => setWhatsappEnabled(event.target.checked)} /> WhatsApp</label>
            <button type="button" className="portal-button-primary" onClick={savePreferences}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

