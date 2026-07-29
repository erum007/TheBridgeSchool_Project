import EmptyState from './EmptyState.jsx'
import SkeletonRow from './SkeletonRow.jsx'

export default function Table({ columns, data, loading, emptyMessage, emptyIcon, emptyAction, rowKey = 'id', onRowClick }) {
  const tableShell = 'overflow-x-auto rounded-xl border border-[var(--border-default)] bg-white'
  const headingClass = 'border-b border-[var(--border-default)] px-4 py-3 font-display text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]'
  const cellClass = 'border-b border-[#f0f2f8] px-4 py-3 text-sm text-[var(--text-primary)]'

  if (loading) {
    return (
      <div className={tableShell}>
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-[var(--bg-app)]">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`${headingClass} ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonRow key={index} columns={columns.length} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (!data?.length) {
    return <EmptyState icon={emptyIcon} title="Nothing here yet" message={emptyMessage} action={emptyAction} />
  }

  return (
    <div className={tableShell}>
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-10 bg-[var(--bg-app)]">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`${headingClass} ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row[rowKey] ?? JSON.stringify(row)} onClick={() => onRowClick?.(row)} className={`transition-colors duration-100 hover:bg-[var(--bg-app)] ${onRowClick ? 'cursor-pointer' : ''}`}>
              {columns.map((column) => (
                <td key={column.key} className={`${cellClass} ${column.align === 'right' ? 'text-right font-display font-semibold' : 'text-left'}`}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
