'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { BoardRow } from '@/components/cards/BoardRow'
import type { Board } from '@/types'

export default function BusquedasPage() {
  const { boards, loading, mockMode, deleteBoard, loadBoards, showToast } = useAppStore()
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const isLoading = loading.boards

  async function createEmptyBoard() {
    const name = newName.trim() || 'Mi nueva búsqueda'
    setCreating(true)
    try {
      if (mockMode) {
        await new Promise(r => setTimeout(r, 500))
        showToast('Demo: tablero creado')
        setNewName('')
        return
      }
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters: {}, portals: [] })
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setNewName('')
      showToast('Tablero creado')
      loadBoards()
    } catch (e: any) {
      showToast(e.message || 'Error al crear tablero', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleAlerts(boardId: string, enabled: boolean) {
    if (mockMode) {
      showToast(enabled ? 'Alertas activadas (demo)' : 'Alertas desactivadas (demo)')
      return
    }
    try {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts_enabled: enabled ? 1 : 0 })
      })
      const data = await res.json()
      if (data.ok) {
        loadBoards()
        showToast(enabled ? 'Alertas activadas' : 'Alertas desactivadas')
      }
    } catch (e: any) {
      showToast(e.message || 'Error', 'error')
    }
  }

  async function handleDelete(boardId: string) {
    setConfirmDelete(null)
    await deleteBoard(boardId)
  }

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px', width: 32, height: 32 }} />
        <p style={{ fontSize: 14, color: 'var(--mute)', fontWeight: 600 }}>Cargando búsquedas…</p>
      </div>
    )
  }

  return (
    <div>
      {/* Confirm delete modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', padding: 28, maxWidth: 340, width: '100%' }}>
            <h3 style={{ marginBottom: 10, fontSize: 16 }}>¿Eliminar tablero?</h3>
            <p style={{ fontSize: 13, color: 'var(--body-color)', marginBottom: 20 }}>
              Se eliminarán todos los avisos y el historial de esta búsqueda. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button
                className="btn btn-sm"
                onClick={() => handleDelete(confirmDelete)}
                style={{ background: 'var(--error)', color: '#fff', border: 'none' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1>Mis búsquedas</h1>
            <p>{boards.length} tablero{boards.length !== 1 ? 's' : ''} activo{boards.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/" className="btn btn-yellow btn-sm">
            + Nueva búsqueda
          </Link>
        </div>
      </div>

      {boards.length === 0 ? (
        <div className="empty-state">
          <h2>Sin búsquedas guardadas</h2>
          <p>
            Usá el buscador para encontrar tu próximo auto y guardá la búsqueda como tablero de seguimiento.
          </p>
          <Link href="/" className="btn btn-primary">
            Empezar a buscar →
          </Link>
        </div>
      ) : (
        <div>
          {boards.map((board: Board) => (
            <BoardRowWithActions
              key={board.id}
              board={board}
              onDelete={() => setConfirmDelete(board.id)}
              onToggleAlerts={(enabled) => handleToggleAlerts(board.id, enabled)}
              onClick={() => router.push(`/boards/${board.id}`)}
            />
          ))}
        </div>
      )}

      {/* Quick create */}
      {boards.length > 0 && (
        <div style={{ padding: '24px', borderTop: '1px solid var(--hairline)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nombre de nueva búsqueda vacía…"
            style={{ flex: 1, border: '1px solid var(--stone)', padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            onKeyDown={e => e.key === 'Enter' && createEmptyBoard()}
          />
          <button className="btn btn-ghost btn-sm" onClick={createEmptyBoard} disabled={creating}>
            {creating ? '…' : 'Crear'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Enhanced BoardRow with actions ──────────────────────────────────────────

interface BoardRowActionsProps {
  board: Board
  onDelete: () => void
  onToggleAlerts: (enabled: boolean) => void
  onClick: () => void
}

function BoardRowWithActions({ board, onDelete, onToggleAlerts, onClick }: BoardRowActionsProps) {
  const [showMenu, setShowMenu] = useState(false)
  const alertsOn = Boolean(board.alerts_enabled)

  return (
    <div
      style={{ position: 'relative', borderBottom: '1px solid var(--hairline)' }}
      onMouseLeave={() => setShowMenu(false)}
    >
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Main board row — clickable */}
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={onClick}>
          <BoardRow board={board} />
        </div>

        {/* Action strip */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, padding: '8px 12px', borderLeft: '1px solid var(--hairline)', flexShrink: 0 }}>
          <button
            title={alertsOn ? 'Desactivar alertas' : 'Activar alertas'}
            onClick={(e) => { e.stopPropagation(); onToggleAlerts(!alertsOn) }}
            style={{
              background: alertsOn ? 'var(--primary)' : 'none',
              border: `1px solid ${alertsOn ? 'var(--primary)' : 'var(--hairline)'}`,
              color: alertsOn ? 'var(--on-primary)' : 'var(--mute)',
              fontSize: 13, width: 30, height: 28, cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            🔔
          </button>
          <button
            title="Eliminar tablero"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            style={{
              background: 'none', border: '1px solid var(--hairline)', color: 'var(--error)',
              fontSize: 13, width: 30, height: 28, cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
