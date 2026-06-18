'use client'
import { useState, useEffect } from 'react'

interface NotesPaneProps {
  boardId: string
  initialNotes?: string
}

export function NotesPane({ boardId, initialNotes }: NotesPaneProps) {
  const [notes, setNotes] = useState(initialNotes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setNotes(initialNotes || '')
    setDirty(false)
  }, [boardId, initialNotes])

  async function saveNotes() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch(`/api/boards/${boardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      })
      setSaved(true)
      setDirty(false)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Notas privadas</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saved && <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700 }}>✓ Guardado</span>}
          <button
            className="btn btn-primary btn-sm"
            onClick={saveNotes}
            disabled={saving || !dirty}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 12 }}>
        Apuntes sobre esta búsqueda: qué viste, con quién hablaste, preguntas pendientes.
      </p>
      <textarea
        className="notes-textarea"
        value={notes}
        onChange={e => { setNotes(e.target.value); setDirty(true) }}
        placeholder="Escribí tus notas acá…"
        rows={10}
      />
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ash)' }}>
        {notes.length} caracteres
      </div>
    </div>
  )
}
