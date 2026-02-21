import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
  loading?: boolean
  label?: string
}

export function UploadStep({ onFile, loading = false, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a .csv file exported from Goodreads.')
      return
    }
    onFile(file)
  }

  return (
    <div
      className={`drop-zone${dragOver ? ' drag-over' : ''}${loading ? ' loading' : ''}`}
      onClick={() => !loading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        if (!loading && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
      }}
    >
      {loading ? (
        <p className="drop-zone-text">Parsing CSV...</p>
      ) : (
        <>
          <div className="drop-zone-icon">📄</div>
          <p className="drop-zone-text">{label ?? 'Drop your Goodreads CSV here, or click to browse'}</p>
          <p className="drop-zone-hint">
            Export from Goodreads: My Books → Import/Export → Export Library
          </p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        hidden
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  )
}
