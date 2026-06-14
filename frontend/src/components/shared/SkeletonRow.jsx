export default function SkeletonRow({ columns = 5 }) {
  return (
    <tr className="border-b border-[#f0f2f8]">
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-4 py-3 text-sm">
          <div className={`h-4 animate-pulse rounded bg-[#f0f2f8] ${index === columns - 1 ? 'w-1/2' : 'w-3/4'}`} />
        </td>
      ))}
    </tr>
  )
}
