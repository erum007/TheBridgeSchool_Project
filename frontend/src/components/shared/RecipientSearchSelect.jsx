import { useEffect, useMemo, useRef, useState } from 'react'

const predefinedRoles = [
  { id: 'all', name: 'All Users', type: 'role' },
  { id: 'parents', name: 'Parents', type: 'role' },
  { id: 'teachers', name: 'Teachers', type: 'role' },
  { id: 'students', name: 'Students', type: 'role' },
  { id: 'staff', name: 'Staff', type: 'role' },
]

export default function RecipientSearchSelect({
  users = [],
  departments = [],
  value = { roles: [], department_ids: [], user_ids: [] },
  onChange,
  placeholder = 'Search by role, department, or person...',
  disabled = false,
  className = '',
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // Normalize selected arrays
  const selectedRoles = useMemo(() => value?.roles || [], [value])
  const selectedDeptIds = useMemo(() => (value?.department_ids || []).map(String), [value])
  const selectedUserIds = useMemo(() => (value?.user_ids || []).map(String), [value])

  // Build a master list of all selectable items
  const allItems = useMemo(() => {
    const items = []
    // Add Roles
    items.push(...predefinedRoles)
    // Add Departments
    departments.forEach((d) => {
      items.push({ id: String(d.id), name: d.name, type: 'department' })
    })
    // Add Users
    users.forEach((u) => {
      items.push({ id: String(u.id), name: u.name, email: u.email, role: u.role, type: 'user' })
    })
    return items
  }, [users, departments])

  // Filtered dropdown matches based on search query
  const matchingItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    return allItems.filter((item) => {
      // Exclude already selected items
      if (item.type === 'role' && selectedRoles.includes(item.id)) return false
      if (item.type === 'department' && selectedDeptIds.includes(item.id)) return false
      if (item.type === 'user' && selectedUserIds.includes(item.id)) return false

      if (!trimmed) return true

      const nameMatch = item.name?.toLowerCase().includes(trimmed)
      const emailMatch = item.email?.toLowerCase().includes(trimmed)
      const roleMatch = item.role?.toLowerCase().includes(trimmed)

      return nameMatch || emailMatch || roleMatch
    })
  }, [allItems, query, selectedRoles, selectedDeptIds, selectedUserIds])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectItem = (item) => {
    const nextValue = {
      roles: [...selectedRoles],
      department_ids: [...selectedDeptIds].map(Number),
      user_ids: [...selectedUserIds].map(Number),
    }
    if (item.type === 'role') nextValue.roles.push(item.id)
    if (item.type === 'department') nextValue.department_ids.push(Number(item.id))
    if (item.type === 'user') nextValue.user_ids.push(Number(item.id))

    onChange?.(nextValue)
    setQuery('')
    inputRef.current?.focus()
  }

  const handleRemoveItem = (type, idToRemove) => {
    if (disabled) return
    const nextValue = {
      roles: [...selectedRoles],
      department_ids: [...selectedDeptIds].map(Number),
      user_ids: [...selectedUserIds].map(Number),
    }

    if (type === 'role') nextValue.roles = nextValue.roles.filter((r) => r !== idToRemove)
    if (type === 'department') nextValue.department_ids = nextValue.department_ids.filter((id) => String(id) !== String(idToRemove))
    if (type === 'user') nextValue.user_ids = nextValue.user_ids.filter((id) => String(id) !== String(idToRemove))

    onChange?.(nextValue)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Backspace' && !query) {
      if (selectedUserIds.length > 0) {
        handleRemoveItem('user', selectedUserIds[selectedUserIds.length - 1])
      } else if (selectedDeptIds.length > 0) {
        handleRemoveItem('department', selectedDeptIds[selectedDeptIds.length - 1])
      } else if (selectedRoles.length > 0) {
        handleRemoveItem('role', selectedRoles[selectedRoles.length - 1])
      }
    } else if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  // Get rich objects for selected chips
  const selectedRoleItems = selectedRoles.map((id) => predefinedRoles.find((r) => r.id === id)).filter(Boolean)
  const selectedDeptItems = selectedDeptIds.map((id) => departments.find((d) => String(d.id) === id)).filter(Boolean)
  const selectedUserItems = selectedUserIds.map((id) => users.find((u) => String(u.id) === id)).filter(Boolean)

  const hasSelections = selectedRoleItems.length > 0 || selectedDeptItems.length > 0 || selectedUserItems.length > 0

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Selected Chips Container */}
      <div
        className={`portal-input flex min-h-[42px] flex-wrap items-center gap-1.5 p-2 transition-colors duration-150 ${
          isOpen ? 'ring-2 ring-[var(--brand-navy)]/10 border-[var(--brand-navy)]' : ''
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-[var(--bg-app)]' : 'cursor-text bg-white'}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true)
            inputRef.current?.focus()
          }
        }}
      >
        {/* Role Chips */}
        {selectedRoleItems.map((role) => (
          <span
            key={`role-${role.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-blue)]/10 border border-[var(--brand-blue)]/30 px-2.5 py-1 text-xs font-medium text-[var(--brand-blue)] shadow-sm animate-fadeIn"
          >
            <span className="font-semibold">{role.name}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-70">(Role)</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemoveItem('role', role.id) }}
                className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-xs hover:bg-[var(--brand-blue)] hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </span>
        ))}

        {/* Department Chips */}
        {selectedDeptItems.map((dept) => (
          <span
            key={`dept-${dept.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 border border-purple-200 px-2.5 py-1 text-xs font-medium text-purple-700 shadow-sm animate-fadeIn"
          >
            <span className="font-semibold">{dept.name}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-70">(Dept)</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemoveItem('department', dept.id) }}
                className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-xs hover:bg-purple-600 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </span>
        ))}

        {/* User Chips */}
        {selectedUserItems.map((user) => (
          <span
            key={`user-${user.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--bg-app)] border border-[var(--border-default)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] shadow-sm animate-fadeIn"
          >
            <span className="font-semibold">{user.name}</span>
            {user.role ? (
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                ({user.role})
              </span>
            ) : null}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemoveItem('user', user.id) }}
                className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-xs text-[var(--text-muted)] hover:bg-[var(--brand-red)] hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </span>
        ))}

        {/* Input box for typing search query */}
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          className="flex-1 min-w-[150px] bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border-none focus:ring-0 p-0"
          placeholder={hasSelections ? 'Add more...' : placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Dropdown Overlay */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[var(--border-default)] bg-white py-1 shadow-lg">
          {matchingItems.length > 0 ? (
            matchingItems.slice(0, 20).map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-[var(--bg-app)] focus:bg-[var(--bg-app)] focus:outline-none transition-colors border-b border-[var(--border-default)]/30 last:border-b-0"
                onMouseDown={(e) => {
                  e.preventDefault() // prevent input blur before onClick
                  handleSelectItem(item)
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-[var(--text-primary)]">
                    {item.name}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    item.type === 'role' ? 'bg-blue-50 text-blue-700' :
                    item.type === 'department' ? 'bg-purple-50 text-purple-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {item.type} {item.role ? `(${item.role})` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                  {item.email && <span>{item.email}</span>}
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-center text-xs text-[var(--text-muted)]">
              No matching recipients found.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
