const shimmerStyle = `
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
.skeleton-shimmer {
  background: linear-gradient(90deg, #e8eaf0 25%, #f5f6fa 50%, #e8eaf0 75%);
  background-size: 1000px 100%;
  animation: shimmer 1.8s infinite linear;
  border-radius: 6px;
}
`

export function SkeletonStyle() {
  return <style>{shimmerStyle}</style>
}

export function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton-shimmer ${className}`} />
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={`h-4 skeleton-shimmer ${index === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

export function SkeletonCardGrid({ count = 4 }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="portal-panel">
          <div className="flex items-start justify-between gap-3">
            <div className="h-5 w-1/2 skeleton-shimmer" />
            <div className="h-5 w-16 skeleton-shimmer" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full skeleton-shimmer" />
            <div className="h-4 w-5/6 skeleton-shimmer" />
          </div>
          <div className="mt-4 h-3 w-24 skeleton-shimmer" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ columns = 5, rows = 5 }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-default)] bg-white">
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-10 bg-[var(--bg-app)]">
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} className="border-b border-[var(--border-default)] px-4 py-3 text-left">
                <div className="h-3 w-16 skeleton-shimmer" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-[#f0f2f8]">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-3">
                  <div className={`h-4 skeleton-shimmer ${colIndex === columns - 1 ? 'w-1/2' : 'w-3/4'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SkeletonStatGrid({ count = 3 }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-[var(--border-default)] bg-white p-5">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="h-4 w-28 skeleton-shimmer" />
            <div className="h-9 w-9 skeleton-shimmer" />
          </div>
          <div className="h-9 w-24 skeleton-shimmer" />
          <div className="mt-2 h-3 w-36 skeleton-shimmer" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonList({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-lg border border-[var(--border-default)] p-4">
          <div className="h-4 w-1/3 skeleton-shimmer" />
          <div className="mt-2 h-3 w-2/3 skeleton-shimmer" />
        </div>
      ))}
    </div>
  )
}

export function TopProgressBar() {
  return <div className="top-progress-bar" />
}
