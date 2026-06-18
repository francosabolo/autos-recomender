'use client'
import { useAppStore } from '@/store/useAppStore'

export function DemoBanner() {
  const { mockMode } = useAppStore()
  if (!mockMode) return null
  return (
    <div className="demo-banner">
      Modo demo — datos de ejemplo activos. Conectá el backend para datos reales.
    </div>
  )
}
