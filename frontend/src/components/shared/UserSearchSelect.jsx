import { useEffect, useMemo, useRef, useState } from 'react'

export default function UserSearchSelect({
  users = [],
  value = null,
  onChange,
  multiple = false,
  placeholder = 'Search person by name, email, or role...',
  excludeIds = [],
  filterRole = null,
  disabled = false,
  className = '',
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // Normalize selected IDs array/single value
  const selectedIds = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value.map(String) : []
    }
    return value !== null && value !== undefined && value !== '' ? [String(value)] : []
  }, [value, multiple])

  // Filter available users by role and excludeIds
  const eligibleUsers = useMemo(() => {
    return users.filter((user) => {
      if (excludeIds.map(String).includes(String(user.id))) return false
      if (filterRole) {
        const roles = Array.isArray(filterRole) ? filterRole : [filterRole]
        if (!roles.includes(user.role)) return false
      }
      return true
    })
  }, [users, excludeIds, filterRole])

  // Get user objects for currently selected IDs
  const selectedUsers = useMemo(() => {
    return selectedIds
      .map((id) => users.find((u) => String(u.id) === String(id)))
      .filter(Boolean)
  }, [selectedIds, users])

  // Filtered dropdown matches based on search query
  const matchingUsers = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    return eligibleUsers.filter((user) => {
      // In multi-select, exclude already selected users from dropdown
      if (multiple && selectedIds.includes(String(user.id))) {
        return false
      }
      if (!trimmed) return true

      const nameMatch = user.name?.toLowerCase().includes(trimmed)
      const emailMatch = user.email?.toLowerCase().includes(trimmed)
      const roleMatch = user.role?.toLowerCase().includes(trimmed)
      const deptMatch = Array.isArray(user.departments)
        ? user.departments.some((d) => String(d).toLowerCase().includes(trimmed))
        : String(user.department || '').toLowerCase().includes(trimmed)

      return nameMatch || emailMatch || roleMatch || deptMatch
    })
  }, [eligibleUsers, query, multiple, selectedIds])

  // Use capture so this also works inside modal dialogs, whose content stops
  // bubbling mouse events to prevent the modal itself from closing.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside, true)
    return () => document.removeEventListener('pointerdown', handleClickOutside, true)
  }, [])

  const handleSelectUser = (user) => {
    if (multiple) {
      const nextValue = [...selectedIds, String(user.id)]
      onChange?.(nextValue)
      setQuery('')
      inputRef.current?.focus()
    } else {
      onChange?.(user.id)
      setQuery('')
      setIsOpen(false)
    }
  }

  const handleRemoveUser = (idToRemove) => {
    if (disabled) return
    if (multiple) {
      const nextValue = selectedIds.filter((id) => String(id) !== String(idToRemove))
      onChange?.(nextValue)
    } else {
      onChange?.('')
      setQuery('')
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Backspace' && !query && multiple && selectedIds.length > 0) {
      const lastId = selectedIds[selectedIds.length - 1]
      handleRemoveUser(lastId)
    } else if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Selected Users Chips Container (Multi mode or Single selected mode) */}
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
        {/* Render Selected Chips in Multi mode */}
        {multiple &&
          selectedUsers.map((user) => (
            <span
              key={user.id}
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
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveUser(user.id)
                  }}
                  className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-xs text-[var(--text-muted)] hover:bg-[var(--brand-red)] hover:text-white transition-colors"
                  aria-label={`Remove ${user.name}`}
                  title={`Remove ${user.name}`}
                >
                  ✕
                </button>
              )}
            </span>
          ))}

        {/* Render Selected User Pill in Single Mode */}
        {!multiple && selectedUsers.length > 0 && !isOpen && (
          <div className="flex w-full items-center justify-between gap-2 px-1 text-sm text-[var(--text-primary)]">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="font-medium truncate">{selectedUsers[0].name}</span>
              <span className="text-xs text-[var(--text-muted)] truncate">
                — {selectedUsers[0].email || selectedUsers[0].role}
              </span>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveUser(selectedUsers[0].id)
                }}
                className="text-xs font-semibold text-[var(--brand-navy)] hover:text-[var(--brand-red)]"
              >
                Change
              </button>
            )}
          </div>
        )}

        {/* Input box for typing search query */}
        {(multiple || selectedUsers.length === 0 || isOpen) && (
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border-none focus:ring-0 p-0"
            placeholder={
              multiple
                ? selectedUsers.length === 0
                  ? placeholder
                  : 'Add more...'
                : selectedUsers.length === 0
                ? placeholder
                : 'Search to change selection...'
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>

      {/* Dropdown Overlay */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[var(--border-default)] bg-white py-1 shadow-lg">
          {matchingUsers.length > 0 ? (
            matchingUsers.slice(0, 15).map((user) => (
              <button
                key={user.id}
                type="button"
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-[var(--bg-app)] focus:bg-[var(--bg-app)] focus:outline-none transition-colors border-b border-[var(--border-default)]/30 last:border-b-0"
                onMouseDown={(e) => {
                  e.preventDefault() // prevent input blur before onClick
                  handleSelectUser(user)
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-[var(--text-primary)]">
                    {user.name}
                  </span>
                  {user.role ? (
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--brand-navy)]">
                      {user.role}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                  {user.email && <span>{user.email}</span>}
                  {user.departments?.length ? (
                    <span>• {user.departments.join(', ')}</span>
                  ) : user.department ? (
                    <span>• {user.department}</span>
                  ) : null}
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-center text-xs text-[var(--text-muted)]">
              No matching people found.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
