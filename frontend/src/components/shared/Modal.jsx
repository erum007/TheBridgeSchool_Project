import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children, footer }) {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleEscape)
    }
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(27,43,107,0.2)] px-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        className="w-full max-w-lg scale-100 rounded-2xl border border-[var(--border-default)] bg-white opacity-100 transition-all duration-150 ease-out"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#f0f2f8] px-6 pb-4 pt-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-lg font-bold text-[var(--brand-navy)]">{title}</h3>
            <button type="button" onClick={onClose} className="portal-button-ghost h-9 w-9" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-[#f0f2f8] px-6 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
