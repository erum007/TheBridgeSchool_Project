import SkeletonCard from './SkeletonCard.jsx'

export default function StatCard({ title, value, subtitle, icon: Icon, loading, onClick }) {
  if (loading) {
    return <SkeletonCard />
  }

  const content = (
    <>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">{title}</p>
        </div>
        {Icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-red-light)]">
            <Icon className="h-[18px] w-[18px] text-[var(--brand-red)]" />
          </div>
        ) : null}
      </div>
      <p className="font-display text-3xl font-bold text-[var(--brand-navy)]">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p> : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="rounded-xl border border-[var(--border-default)] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--brand-blue)] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30">
        {content}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-white p-5">
      {content}
    </div>
  )
}
