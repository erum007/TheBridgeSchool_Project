import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { usersApi } from '../../api/users.js'
import { meetingsApi } from '../../api/meetings.js'
import { useApi } from '../../hooks/useApi.js'
import Modal from './Modal.jsx'

const departments = ['Academic', 'Operations', 'Admissions', 'Student Affairs', 'Finance', 'Custom']

export default function CreateMeetingModal({ isOpen, onClose, onCreated }) {
  const { data: users = [] } = useApi(() => usersApi.list(), [isOpen])
  const [form, setForm] = useState({ title: '', scheduled_at: '', department: 'Academic', customDepartment: '', attendee_ids: [] })

  useEffect(() => {
    if (isOpen) {
      setForm({ title: '', scheduled_at: '', department: 'Academic', customDepartment: '', attendee_ids: [] })
    }
  }, [isOpen])

  const submit = async () => {
    try {
      await meetingsApi.create({
        title: form.title,
        scheduled_at: form.scheduled_at,
        department: form.department === 'Custom' ? form.customDepartment : form.department,
        attendee_ids: form.attendee_ids,
      })
      toast.success('Meeting created')
      onCreated?.()
      onClose?.()
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not create meeting')
    }
  }

  const toggleAttendee = (id) => {
    setForm((current) => {
      const next = new Set(current.attendee_ids)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...current, attendee_ids: Array.from(next) }
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Meeting"
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" className="portal-button-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="portal-button-primary" onClick={submit}>Create</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="portal-label block">Title</label>
          <input className="portal-input mt-1" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </div>
        <div>
          <label className="portal-label block">Date & time</label>
          <input type="datetime-local" className="portal-input mt-1" value={form.scheduled_at} onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })} />
        </div>
        <div>
          <label className="portal-label block">Department</label>
          <select className="portal-input mt-1" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}>
            {departments.map((department) => <option key={department}>{department}</option>)}
          </select>
          {form.department === 'Custom' ? (
            <input className="portal-input mt-2" placeholder="Custom department" value={form.customDepartment} onChange={(event) => setForm({ ...form, customDepartment: event.target.value })} />
          ) : null}
        </div>
        <div>
          <div className="portal-label block">Attendees</div>
          <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-[var(--border-default)] p-3">
            {users.map((user) => (
              <label key={user.id} className="flex items-center gap-3 border-b border-[#f0f2f8] py-2 text-sm last:border-b-0">
                <input type="checkbox" checked={form.attendee_ids.includes(user.id)} onChange={() => toggleAttendee(user.id)} />
                <span className="text-[var(--text-primary)]">{user.name}</span>
                <span className="text-xs capitalize text-[var(--text-muted)]">{user.role}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
