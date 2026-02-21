import { useState } from 'react'

interface Props {
  value: number          // 0 = none selected
  onChange: (v: number) => void
  readOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function StarRating({ value, onChange, readOnly = false, size = 'md' }: Props) {
  const [hovered, setHovered] = useState(0)

  const sizeClass = size === 'sm' ? 'star-sm' : size === 'lg' ? 'star-lg' : 'star-md'

  return (
    <span className={`star-rating ${sizeClass}`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`star${n <= (hovered || value) ? ' filled' : ''}${readOnly ? ' readonly' : ''}`}
          onClick={() => !readOnly && onChange(n)}
          onMouseEnter={() => !readOnly && setHovered(n)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          title={readOnly ? `${value}/5` : `Rate ${n} star${n !== 1 ? 's' : ''}`}
        >
          ★
        </span>
      ))}
    </span>
  )
}
