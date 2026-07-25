import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import BlotFormatter from "@enzedonline/quill-blot-formatter2";
import "@enzedonline/quill-blot-formatter2/dist/css/quill-blot-formatter2.css";
Quill.register("modules/blotFormatter2", BlotFormatter);
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import {
  BookOpen,
  CalendarDays,
  ChartColumnBig,
  CirclePlus,
  Download,
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
  Trash2,
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
import { authApi } from '../api/auth.js'
import { departmentsApi } from '../api/departments.js'
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
  const [actionForm, setActionForm] = useState({ meeting_id: '', description: '', assigned_to: '', due_date: '', whatsapp_reminder_frequency: 'none', whatsapp_reminder_at: '' })

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
      setActionForm({ meeting_id: '', description: '', assigned_to: '', due_date: '', whatsapp_reminder_frequency: 'none', whatsapp_reminder_at: '' })
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
                  <select className="portal-input" value={actionForm.whatsapp_reminder_frequency} onChange={(event) => setActionForm({ ...actionForm, whatsapp_reminder_frequency: event.target.value })}>
                    <option value="none">No WhatsApp reminder</option>
                    <option value="hourly">WhatsApp: hourly</option>
                    <option value="daily">WhatsApp: daily</option>
                    <option value="weekly">WhatsApp: weekly</option>
                    <option value="custom">WhatsApp: once at custom time</option>
                  </select>
                  <div className="flex gap-3">
                    <input type="date" className="portal-input" value={actionForm.due_date} onChange={(event) => setActionForm({ ...actionForm, due_date: event.target.value })} />
                    <button type="submit" className="portal-button-primary whitespace-nowrap">Add Action Item</button>
                  </div>
                  {actionForm.whatsapp_reminder_frequency !== 'none' ? (
                    <div className="lg:col-span-2">
                      <label className="portal-label block">First reminder date and time (UTC)</label>
                      <input type="datetime-local" required className="portal-input mt-1" value={actionForm.whatsapp_reminder_at} onChange={(event) => setActionForm({ ...actionForm, whatsapp_reminder_at: event.target.value })} />
                    </div>
                  ) : null}
                  {actionForm.whatsapp_reminder_frequency !== 'none' ? (
                    <p className="lg:col-span-2 text-xs text-[var(--text-muted)]">The assignee must have a WhatsApp number saved in their profile. Reminders stop when the action item is marked done.</p>
                  ) : null}
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
  const [compose, setCompose] = useState({ recipient_group: 'parents', individual_emails: '', template_id: '', subject: '', body: '', scheduled_at: '', attachments: [] })
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [editingDraftId, setEditingDraftId] = useState(null)
  const [deliveryMode, setDeliveryMode] = useState('now')
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '', attachments: [] })
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templatePendingDeletion, setTemplatePendingDeletion] = useState(null)
  const [draftPendingDeletion, setDraftPendingDeletion] = useState(null)
  const [templateEditorKey, setTemplateEditorKey] = useState(0)
  const attachmentTargetRef = useRef('compose')
  const draftEmails = emails.filter((item) => item.status === 'draft')
  const scheduledEmails = emails.filter((item) => item.status === 'scheduled')
  const sentEmails = emails.filter((item) => item.status === 'sent')
  const [previewOpen, setPreviewOpen] = useState(false);
  const minimumScheduleTime = useMemo(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 1, 0, 0)
    const offset = now.getTimezoneOffset() * 60_000
    return new Date(now.getTime() - offset).toISOString().slice(0, 16)
  }, [])
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
        editor.insertEmbed(range.index, "image", response.data.url, "user");
        editor.setSelection(range.index + 1, 0, "silent");
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

  // ReactQuill recreates its editor when `modules` changes. Keeping this object stable
  // prevents the formatter from being destroyed after the first resize pointer event.
  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        ["link", "image", "document"],
        ["clean"],
      ],
      handlers: { image: imageHandler, document: documentHandler },
    },
    blotFormatter2: {
      resize: {
        allowResizing: true,
        useRelativeSize: false,
        minimumWidthPx: 25,
      },
      image: { autoHeight: true },
    },
  }), [documentHandler, imageHandler]);
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
    try {
      const payload = {
        ...compose,
        recipient_group: compose.recipient_group === 'individual' ? individualRecipients.join(',') : compose.recipient_group,
        template_id: compose.template_id || null,
        scheduled_at: deliveryMode === 'schedule' ? compose.scheduled_at : null,
      }
      if (deliveryMode === 'schedule') {
        await emailsApi.schedule(payload)
      } else {
        await emailsApi.send(payload)
      }
      toast.success('Email saved')
      setCompose({ recipient_group: 'parents', individual_emails: '', template_id: '', subject: '', body: '', scheduled_at: '', attachments: [] })
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
      setCompose({ recipient_group: 'parents', individual_emails: '', template_id: '', subject: '', body: '', scheduled_at: '', attachments: [] })
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
        setCompose({ recipient_group: 'parents', individual_emails: '', template_id: '', subject: '', body: '', scheduled_at: '', attachments: [] })
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
    setTemplateForm({ name: '', subject: '', body: '', attachments: [] });
    setTemplateEditorKey((current) => current + 1);

    refetchTemplates();
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
        setTemplateForm({ name: '', subject: '', body: '', attachments: [] })
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
              </div>
                <div className="lg:col-span-2 flex justify-end gap-3">
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
              <div className="grid gap-6 lg:grid-cols-2">
                <Table
                  data={templates}
                  loading={false}
                  columns={[
                  { key: "name", label: "Name" },
                  { key: "subject", label: "Subject Preview" },
                  { key: "created_by_name", label: "Created By" },

                  {
                    key: "actions",
                    label: "Actions",
                    render: (row) => (
                      <div className="flex gap-2">
                       <button
                        onClick={() => {

                            setEditingTemplateId(row.id);

                            setTemplateForm({
                                name: row.name,
                                subject: row.subject,
                                body: row.body,
                                attachments: row.attachments || [],
                            });

                        }}
                      >
                        Edit
                    </button>

                        <button
                          type="button"
                          onClick={() => setTemplatePendingDeletion(row)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    ),
                  },
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
                  {/* <div>
                    <label className="portal-label block">Body</label>
                    <textarea className="portal-input mt-1 min-h-44" placeholder="Use [Student Name], [Date] placeholders." value={templateForm.body} onChange={(event) => setTemplateForm({ ...templateForm, body: event.target.value })} />
                  </div> */}
                  <div>
                  <label className="portal-label block">Body</label>

                  <div className="mt-2">
                    <ReactQuill
                    key={templateEditorKey}
                    theme="snow"
                    modules={quillModules}
                    value={templateForm.body}
                    onChange={(value) => setTemplateForm((current) => ({ ...current, body: value }))}
                    className="email-editor"
                    onFocus={() => { attachmentTargetRef.current = 'template' }}
                />
                {templateForm.attachments.length > 0 && <AttachmentList attachments={templateForm.attachments} onRemove={(storedFilename) => setTemplateForm((current) => ({ ...current, attachments: current.attachments.filter((attachment) => attachment.stored_filename !== storedFilename) }))} />}
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
                    onClick={() => setPreviewOpen(true)}
                  >
                    Preview
                  </button>

                </div>
                    {editingTemplateId && (
                  <button
                      type="button" className="portal-button-primary"
                      onClick={() => {

                          setEditingTemplateId(null);

                          setTemplateForm({
                              name: "",
                              subject: "",
                              body: "",
                              attachments: [],
                          });

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
>
    <div className="min-w-0 space-y-4">

        <div className="border-b pb-4">
            <p>
                <strong>From:</strong> school@bridge.edu
            </p>

            <p>
                <strong>To:</strong> Parents
            </p>

            <p>
                <strong>Subject:</strong> {templateForm.subject}
            </p>
        </div>

        <div
            className="email-preview-content min-w-0 max-w-full"
            dangerouslySetInnerHTML={{
                __html: templateForm.body,
            }}
        />

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
    </div>
  )
}

export function PerformanceBroadcasterView() {
  const { user } = useAuth()
  const { data: results = [], refetch } = useApi(() => resultsApi.list(), [])
  const [form, setForm] = useState({ subject: '', class_name: '', notify: true, file: null })
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
    payload.append('subject', form.subject)
    payload.append('class_name', form.class_name)
    payload.append('notify', form.notify ? 'true' : 'false')
    try {
      const result = await resultsApi.upload(payload)
      const emailMsg = form.notify && result.data.emails_sent !== undefined
        ? ` — ${result.data.emails_sent} email${result.data.emails_sent !== 1 ? 's' : ''} sent`
        : ''
      toast.success(`Results uploaded${emailMsg}`)
      setForm({ subject: '', class_name: '', notify: true, file: null })
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
          <div>
            <label className="portal-label block">Subject</label>
            <input className="portal-input mt-1" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
          </div>
          <div>
            <label className="portal-label block">Class</label>
            <input className="portal-input mt-1" value={form.class_name} onChange={(event) => setForm({ ...form, class_name: event.target.value })} />
          </div>
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
  const { data: departments = [], refetch: refetchDepartments } = useApi(() => departmentsApi.list(), [])
  const [noticeForm, setNoticeForm] = useState({ title: '', body: '', recipients: 'all', status: 'draft', publish_date: '' })
  const [opportunityForm, setOpportunityForm] = useState({ title: '', eligibility: '', deadline: '', link: '' })
  const [userForm, setUserForm] = useState({ name: '', email: '', role: '', password: '', department: '' })
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
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.role || !userForm.password || (userForm.role === 'staff' && !userForm.department)) {
      toast.error('Please fill in every user field')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email.trim())) {
      toast.error('Please enter a valid email address')
      return
    }
    try {
      const response = await usersApi.create({ ...userForm, head_teacher: false, is_active: true })
      toast.success(response.data.invitation_sent ? 'User created and credentials emailed' : 'User created, but the credential email could not be sent')
      setUserForm({ name: '', email: '', role: '', password: '', department: '' })
      refetchUsers()
      refetchDepartments()
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
            id: 'departments',
            label: 'Departments & Domains',
            content: (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-3">
                  {departments.map((department) => (
                    <div key={department.id} className="portal-panel">
                      <div className="flex items-center justify-between"><div className="font-medium text-[var(--text-primary)]">{department.name}</div><span className="text-xs text-[var(--text-muted)]">{department.members.length} member{department.members.length === 1 ? '' : 's'}</span></div>
                      <div className="mt-3 flex flex-wrap gap-2">{department.members.length ? department.members.map((member) => <span key={member.id} className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-app)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">{member.name}<button type="button" className="text-[var(--brand-red)]" onClick={() => removeDepartmentMember(department.id, member.id)} aria-label={`Remove ${member.name}`}>×</button></span>) : <span className="text-sm text-[var(--text-muted)]">No members yet.</span>}</div>
                    </div>
                  ))}
                  {!departments.length ? <EmptyState title="No departments or domains" message="Create one to organise staff, committees, or other groups." /> : null}
                </div>
                <div className="space-y-6">
                  <form className="space-y-3 portal-panel" onSubmit={createDepartment}><div className="text-sm font-medium text-[var(--text-primary)]">Create department or domain</div><input required className="portal-input" placeholder="e.g. Admissions or Graduation Committee" value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} /><button className="portal-button-primary">Create</button></form>
                  <div className="space-y-3 portal-panel"><div className="text-sm font-medium text-[var(--text-primary)]">Add a member</div><select className="portal-input" value={selectedDepartmentId} onChange={(event) => setSelectedDepartmentId(event.target.value)}><option value="">Select department/domain</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><select className="portal-input" value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)}><option value="">Select user</option>{users.map((member) => <option key={member.id} value={member.id}>{member.name} — {member.role}</option>)}</select><button type="button" className="portal-button-primary" onClick={addDepartmentMember}>Add member</button></div>
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
                  loading={false}
                  columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'role', label: 'Role', render: (row) => <Badge status={row.role} /> },
                    { key: 'departments', label: 'Departments / Domains', render: (row) => row.departments?.join(', ') || '—' },
                    { key: 'is_active', label: 'Status', render: (row) => <Badge status={row.is_active ? 'connected' : 'failed'} /> },
                    { key: 'actions', label: 'Actions', render: (row) => <button className="portal-button-danger" onClick={() => deleteUser(row.id)}>Remove</button> },
                  ]}
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
  const resultsHeading = titlePrefix ? "Your Child's Results" : 'My Results'

  return (
    <div>
      <PageHeader title={`${titlePrefix}${user?.name ? `${user.name}'s ` : 'Welcome back, '}Home`} subtitle={format(new Date(), 'EEEE, d MMMM yyyy')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="portal-panel">
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
  const heading = titlePrefix ? "Your Child's Results" : 'My Results'

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
      ) : (
        <EmptyState icon={BookOpen} title="No results published yet. Check back after your teacher uploads your report." />
      )}
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
  const [passwordForm, setPasswordForm] = useState({ otp: '', new_password: '', confirm_password: '' })
  const [passwordCodeSent, setPasswordCodeSent] = useState(false)

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
      <PageHeader title={`${titlePrefix}Settings`} subtitle="Manage contact details and notification preferences." />
      <div className="grid gap-6 lg:grid-cols-2">
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
        <div className="portal-panel">
          <div className="text-sm font-medium text-[var(--text-primary)]">Change Password</div>
          {!passwordCodeSent ? <div className="mt-4 space-y-3"><p className="text-sm text-[var(--text-secondary)]">We’ll email a six-digit verification code before changing your password.</p><button type="button" className="portal-button-primary" onClick={requestPasswordCode}>Email verification code</button></div> : <div className="mt-4 space-y-3"><input inputMode="numeric" maxLength="6" className="portal-input" placeholder="Six-digit code" value={passwordForm.otp} onChange={(event) => setPasswordForm({ ...passwordForm, otp: event.target.value })} /><input type="password" className="portal-input" placeholder="New password" value={passwordForm.new_password} onChange={(event) => setPasswordForm({ ...passwordForm, new_password: event.target.value })} /><input type="password" className="portal-input" placeholder="Confirm new password" value={passwordForm.confirm_password} onChange={(event) => setPasswordForm({ ...passwordForm, confirm_password: event.target.value })} /><p className="text-xs text-[var(--text-muted)]">12+ characters with uppercase, lowercase, a number, and a symbol.</p><button type="button" className="portal-button-primary" onClick={changePassword}>Change password</button></div>}
        </div>
      </div>
    </div>
  )
}
