import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { usersApi } from '../../api/users.js'
import { meetingsApi } from '../../api/meetings.js'
import { useApi } from '../../hooks/useApi.js'
import Modal from './Modal.jsx'
import UserSearchSelect from './UserSearchSelect.jsx'

const departments = ['Academic', 'Operations', 'Admissions', 'Student Affairs', 'Finance', 'Custom']
const emptyForm = {
  title: '', agenda: '', scheduled_at: '', department: 'Academic', audience_departments: [], attendee_ids: [], external_emails: [],
  end_time: '',
  meeting_mode: 'in_person', meeting_link: '', location: '',
}
const localDateTimeMinimum = () => {
  const now = new Date()
  now.setMinutes(now.getMinutes() + 1, 0, 0)
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export default function CreateMeetingModal({ isOpen, onClose, onCreated }) {
  const { data: users = [] } = useApi(() => usersApi.list(), [isOpen])
  const [form, setForm] = useState(emptyForm)
  const minimumDateTime = useMemo(() => localDateTimeMinimum(), [isOpen])
  const customDepartments = useMemo(() => [...new Set(users.flatMap((user) => user.departments || []))].sort(), [users])

  useEffect(() => {
    if (isOpen) setForm(emptyForm)
  }, [isOpen])

  const toggleListValue = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
    }))
  }

  const submit = async () => {
    if (!form.title.trim() || !form.scheduled_at || !form.end_time) {
      toast.error('Title, start time, and end time are required')
      return
    }
    if (new Date(form.end_time) <= new Date(form.scheduled_at)) {
      toast.error('End time must be after the start time')
      return
    }
    if (new Date(form.scheduled_at) <= new Date() || new Date(form.end_time) <= new Date()) {
      toast.error('Meeting start and end times must be in the future')
      return
    }
    if (['online', 'choice'].includes(form.meeting_mode) && !form.meeting_link.trim()) {
      toast.error('Add a meeting link')
      return
    }
    if (['in_person', 'choice'].includes(form.meeting_mode) && !form.location.trim()) {
      toast.error('Add a meeting location')
      return
    }
    try {
      const response = await meetingsApi.create({
        ...form,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
      })
      const { invitations_sent: sent = 0, invitations_failed: failed = 0 } = response.data
      toast.success(`Meeting created${sent ? ` — ${sent} invite${sent === 1 ? '' : 's'} sent` : ''}${failed ? ` (${failed} invite${failed === 1 ? '' : 's'} failed)` : ''}`)
      onCreated?.()
      onClose?.()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not create meeting')
    }
  }

  const departmentMemberCount = users.filter((user) => user.departments?.includes(form.department) && user.is_active).length
  const externalEmailsText = form.external_emails.join('\n')

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Meeting"
      size="large"
      footer={<div className="flex justify-end gap-3"><button type="button" className="portal-button-secondary" onClick={onClose}>Cancel</button><button type="button" className="portal-button-primary" onClick={submit}>Create meeting</button></div>}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="portal-label block">Title <span className="text-[var(--brand-red)]">*</span></label>
          <input required className="portal-input mt-1" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="portal-label block">Meeting agenda <span className="text-[var(--text-muted)]">(optional)</span></label>
          <textarea className="portal-input mt-1 min-h-24" placeholder="Topics to discuss, decisions needed, or preparation required." value={form.agenda} onChange={(event) => setForm({ ...form, agenda: event.target.value })} />
        </div>
        <div>
          <label className="portal-label block">Start date & time <span className="text-[var(--brand-red)]">*</span></label>
          <input required type="datetime-local" min={minimumDateTime} className="portal-input mt-1" value={form.scheduled_at} onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })} />
        </div>
        <div>
          <label className="portal-label block">End date & time <span className="text-[var(--brand-red)]">*</span></label>
          <input required type="datetime-local" min={form.scheduled_at > minimumDateTime ? form.scheduled_at : minimumDateTime} className="portal-input mt-1" value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} />
        </div>
        <div>
          <label className="portal-label block">Department / audience</label>
          <select className="portal-input mt-1" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value, audience_departments: [], attendee_ids: [], external_emails: [] })}>
            {departments.map((department) => <option key={department}>{department}</option>)}
          </select>
          {form.department !== 'Custom' ? <p className="mt-2 text-xs text-[var(--text-muted)]">All {departmentMemberCount} active member{departmentMemberCount === 1 ? '' : 's'} of this department will be invited.</p> : null}
        </div>
        {form.department === 'Custom' ? (
          <div className="md:col-span-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] p-4">
            <div className="text-sm font-medium text-[var(--text-primary)]">Custom audience</div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Combine one or more departments with specific people. Duplicate recipients are invited only once.</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <div className="portal-label">Departments</div>
                <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-[var(--border-default)] bg-white p-2">
                  {customDepartments.length ? customDepartments.map((department) => <label key={department} className="flex items-center gap-2 py-1.5 text-sm"><input type="checkbox" checked={form.audience_departments.includes(department)} onChange={() => toggleListValue('audience_departments', department)} />{department}</label>) : <span className="text-xs text-[var(--text-muted)]">No departments have members yet.</span>}
                </div>
              </div>
              <div>
                <div className="portal-label mb-2">Specific people</div>
                <UserSearchSelect
                  multiple
                  users={users}
                  value={form.attendee_ids}
                  onChange={(attendee_ids) => setForm({ ...form, attendee_ids })}
                  placeholder="Search & select people by name, email..."
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="portal-label block">Outside guests’ email addresses</label>
              <textarea className="portal-input mt-1 min-h-20" placeholder={'guest@example.com\nanother.guest@example.com'} value={externalEmailsText} onChange={(event) => setForm({ ...form, external_emails: event.target.value.split(/[\n,;]/).map((email) => email.trim()).filter(Boolean) })} />
              <p className="mt-1 text-xs text-[var(--text-muted)]">Add one email per line (or separate with commas). Guests receive the invite but do not get portal access.</p>
            </div>
          </div>
        ) : null}
        <div className="md:col-span-2">
          <label className="portal-label block">Meeting mode</label>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[['online', 'Online'], ['in_person', 'In-person'], ['choice', "Attendee's choice"]].map(([value, label]) => <label key={value} className={`cursor-pointer rounded-lg border p-3 text-sm ${form.meeting_mode === value ? 'border-[var(--brand-navy)] bg-[var(--bg-app)] text-[var(--brand-navy)]' : 'border-[var(--border-default)]'}`}><input className="sr-only" type="radio" name="meeting-mode" value={value} checked={form.meeting_mode === value} onChange={() => setForm({ ...form, meeting_mode: value })} />{label}</label>)}
          </div>
        </div>
        {['online', 'choice'].includes(form.meeting_mode) ? <div><label className="portal-label block">Meeting link <span className="text-[var(--brand-red)]">*</span></label><input type="url" className="portal-input mt-1" placeholder="https://…" value={form.meeting_link} onChange={(event) => setForm({ ...form, meeting_link: event.target.value })} /></div> : null}
        {['in_person', 'choice'].includes(form.meeting_mode) ? <div><label className="portal-label block">Location <span className="text-[var(--brand-red)]">*</span></label><input className="portal-input mt-1" placeholder="Room, campus, or address" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></div> : null}
      </div>
    </Modal>
  )
}
