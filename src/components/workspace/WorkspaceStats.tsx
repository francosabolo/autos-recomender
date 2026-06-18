'use client'
import type { Board } from '@/types'

interface WorkspaceStatsProps {
  board: Board
}

export function WorkspaceStats({ board }: WorkspaceStatsProps) {
  const total = board.total || board.listings?.length || 0
  const contacted = board.contacted || board.listings?.filter(l => l.status === 'contacted').length || 0
  const shortlisted = board.listings?.filter(l => l.shortlisted).length || 0
  const newCount = board.new_count || board.listings?.filter(l => l.is_new).length || 0

  return (
    <div className="ws-stats">
      <div className="ws-stat">
        <b>{total}</b>
        <span>Avisos</span>
      </div>
      {newCount > 0 && (
        <div className="ws-stat ws-new">
          <b>{newCount}</b>
          <span>Nuevos</span>
        </div>
      )}
      <div className="ws-stat">
        <b>{shortlisted}</b>
        <span>Guardados</span>
      </div>
      <div className="ws-stat">
        <b>{contacted}</b>
        <span>Contactados</span>
      </div>
    </div>
  )
}
