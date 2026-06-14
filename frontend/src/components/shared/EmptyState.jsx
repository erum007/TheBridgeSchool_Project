export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-6 py-16 text-center">
      {Icon ? <Icon className="h-10 w-10 text-[var(--border-strong)]" /> : null}
      <h3 className="mt-4 font-display text-base font-semibold text-[var(--brand-navy)]">{title}</h3>
      <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--text-muted)]">{message}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="portal-button-primary mt-5"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
