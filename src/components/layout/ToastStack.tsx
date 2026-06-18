'use client'
import { useAppStore } from '@/store/useAppStore'

export function ToastStack() {
  const { toasts, dismissToast } = useAppStore()
  if (!toasts.length) return null

  return (
    <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => dismissToast(t.id)}
          style={{
            background: t.type === 'error' ? 'var(--error)' : t.type === 'info' ? 'var(--info)' : 'var(--ink)',
            color: '#fff',
            padding: '10px 20px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 2,
            boxShadow: 'var(--shadow-lg)',
            pointerEvents: 'auto',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            maxWidth: 340,
            animation: 'slideUp 0.2s ease'
          }}
        >
          {t.message}
        </div>
      ))}
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  )
}
