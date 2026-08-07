import { useState } from 'react'
import { Eye } from 'lucide-react'

export default function HoldToRevealPasswordInput({ className = '', containerClassName = '', ...inputProps }) {
  const [revealed, setRevealed] = useState(false)
  const hidePassword = () => setRevealed(false)

  return (
    <div className={`relative ${containerClassName}`}>
      <input
        {...inputProps}
        type={revealed ? 'text' : 'password'}
        className={`${className} pr-11`}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-11 touch-none select-none items-center justify-center text-[var(--text-muted)] transition hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-blue)]"
        aria-label="Hold to view password"
        aria-pressed={revealed}
        title="Hold to view password"
        onPointerDown={(event) => {
          event.preventDefault()
          event.currentTarget.setPointerCapture?.(event.pointerId)
          setRevealed(true)
        }}
        onPointerUp={hidePassword}
        onPointerCancel={hidePassword}
        onLostPointerCapture={hidePassword}
        onKeyDown={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault()
            setRevealed(true)
          }
        }}
        onKeyUp={(event) => {
          if (event.key === ' ' || event.key === 'Enter') hidePassword()
        }}
        onBlur={hidePassword}
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
