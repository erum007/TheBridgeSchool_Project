export default function PageHeader({ title, subtitle, action, sectionLabel }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 border-b border-[var(--border-default)] pb-5">
      <div>
        {sectionLabel ? <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-[var(--brand-red)]">{sectionLabel}</p> : null}
        <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{subtitle}</p> : null}
      </div>
      {action ? (
        <button type="button" onClick={action.onClick} className="portal-button-primary shrink-0">
          {action.icon ? <action.icon className="h-4 w-4" /> : null}
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
