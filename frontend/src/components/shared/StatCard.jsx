import SkeletonCard from './SkeletonCard.jsx'

export default function StatCard({ title, value, subtitle, icon: Icon, loading }) {
  if (loading) {
    return <SkeletonCard />
  }

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-white p-5">
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
    </div>
  )
}
