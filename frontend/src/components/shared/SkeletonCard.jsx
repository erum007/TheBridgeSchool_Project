export default function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="h-4 w-28 animate-pulse rounded bg-[#f0f2f8]" />
        <div className="h-9 w-9 animate-pulse rounded-lg bg-[#f0f2f8]" />
      </div>
      <div className="h-9 w-24 animate-pulse rounded bg-[#f0f2f8]" />
      <div className="mt-2 h-3 w-36 animate-pulse rounded bg-[#f0f2f8]" />
    </div>
  )
}
