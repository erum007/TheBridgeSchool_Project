const statusClasses = {
  done: 'bg-[#edf7ed] text-[#2d7a2d] border-[#b8ddb8]',
  sent: 'bg-[#edf7ed] text-[#2d7a2d] border-[#b8ddb8]',
  published: 'bg-[#edf7ed] text-[#2d7a2d] border-[#b8ddb8]',
  active: 'bg-[#edf7ed] text-[#2d7a2d] border-[#b8ddb8]',
  connected: 'bg-[#edf7ed] text-[#2d7a2d] border-[#b8ddb8]',
  in_progress: 'bg-[#fff8e6] text-[#8a6000] border-[#f0d88a]',
  scheduled: 'bg-[#fff8e6] text-[#8a6000] border-[#f0d88a]',
  upcoming: 'bg-[#fff8e6] text-[#8a6000] border-[#f0d88a]',
  ongoing: 'bg-[var(--brand-navy-light)] text-[var(--brand-navy)] border-[var(--border-strong)]',
  todo: 'bg-[#f0f2f8] text-[var(--text-secondary)] border-[var(--border-strong)]',
  draft: 'bg-[#f0f2f8] text-[var(--text-secondary)] border-[var(--border-strong)]',
  pending: 'bg-[#f0f2f8] text-[var(--text-secondary)] border-[var(--border-strong)]',
  overdue: 'bg-[var(--brand-red-light)] text-[var(--brand-red)] border-[#f5c6c2]',
  failed: 'bg-[var(--brand-red-light)] text-[var(--brand-red)] border-[#f5c6c2]',
  suspended: 'bg-[var(--brand-red-light)] text-[var(--brand-red)] border-[#f5c6c2]',
  admin: 'bg-[var(--brand-navy)] text-white border-transparent',
  teacher: 'bg-[rgba(232,115,74,0.15)] text-[var(--brand-coral)] border-[rgba(232,115,74,0.3)]',
  student: 'bg-[var(--brand-navy-light)] text-[var(--brand-navy)] border-[var(--border-strong)]',
  parent: 'bg-[var(--brand-red-light)] text-[var(--brand-red)] border-[#f5c6c2]',
  all: 'bg-[#f0f2f8] text-[var(--text-secondary)] border-[var(--border-strong)]',
  parents: 'bg-[var(--brand-red-light)] text-[var(--brand-red)] border-[#f5c6c2]',
  students: 'bg-[var(--brand-navy-light)] text-[var(--brand-navy)] border-[var(--border-strong)]',
  teachers: 'bg-[rgba(232,115,74,0.15)] text-[var(--brand-coral)] border-[rgba(232,115,74,0.3)]',
}

const statusLabels = {
  todo: 'To-do',
  in_progress: 'In Progress',
}

export default function Badge({ status = 'todo', label }) {
  const key = String(status).toLowerCase()
  const classes = statusClasses[key] || 'bg-[#f0f2f8] text-[var(--text-secondary)] border-[var(--border-strong)]'
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-display text-xs font-semibold capitalize ${classes}`}>{label ?? statusLabels[key] ?? status}</span>
}
