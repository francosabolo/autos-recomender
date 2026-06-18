'use client'
import Link from 'next/link'
import type { Board } from '@/types'

interface BoardRowProps {
  board: Board
}

export function BoardRow({ board }: BoardRowProps) {
  const { id, name, total = 0, contacted = 0, new_count = 0, last_checked_at, filters } = board

  const progress = total > 0 ? Math.min((contacted / total) * 100, 100) : 0

  function relativeTime(ts: number | null) {
    if (!ts) return 'Nunca'
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `hace ${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `hace ${hours}h`
    const days = Math.floor(hours / 24)
    return `hace ${days}d`
  }

  const filterDesc = [
    filters?.marca,
    filters?.modelo,
    filters?.anioMin && `desde ${filters.anioMin}`,
    filters?.precioMax && `hasta $${(filters.precioMax / 1000000).toFixed(1)}M`,
  ].filter(Boolean).join(' · ')

  return (
    <Link href={`/boards/${id}`} className="board-row">
      <div className="board-row-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="board-row-name">{name}</div>
          {new_count > 0 && (
            <span style={{ background: 'var(--primary)', color: 'var(--on-primary)', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 'var(--r-full)', flexShrink: 0 }}>
              {new_count} nuevo{new_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="board-row-meta">
          {filterDesc || 'Sin filtros'} · {relativeTime(last_checked_at)}
        </div>
        <div className="board-row-progress">
          <div className="board-row-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="board-row-stats">
        <div className="board-row-stat">
          <b>{total}</b>
          <span>avisos</span>
        </div>
        <div className="board-row-stat">
          <b>{contacted}</b>
          <span>contactados</span>
        </div>
      </div>

      <div className="board-row-arrow">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 3l5 5-5 5"/>
        </svg>
      </div>
    </Link>
  )
}
