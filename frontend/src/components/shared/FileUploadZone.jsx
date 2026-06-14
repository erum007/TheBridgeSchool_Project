import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'

export default function FileUploadZone({ accept, onFileSelect, label }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    onFileSelect(file)
  }

  const removeFile = (event) => {
    event.stopPropagation()
    setFileName('')
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          inputRef.current?.click()
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        handleFile(event.dataTransfer.files?.[0])
      }}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all duration-150 ${
        dragging ? 'border-[var(--brand-red)] bg-[rgba(253,242,241,0.5)]' : 'border-[var(--border-strong)] bg-white hover:border-[var(--brand-red)] hover:bg-[rgba(253,242,241,0.5)]'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <Upload className={`mx-auto h-8 w-8 ${dragging ? 'text-[var(--brand-red)]' : 'text-[var(--border-strong)]'}`} />
      <p className="mt-3 text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Supports .csv and .xlsx</p>
      {fileName ? (
        <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--brand-navy-light)] px-3 py-1 text-xs font-medium text-[var(--brand-navy)]">
          {fileName}
          <button type="button" className="portal-button-ghost p-0 text-[var(--brand-navy)]" onClick={removeFile} aria-label="Remove file">
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : null}
    </div>
  )
}
