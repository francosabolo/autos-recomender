'use client'
import { useState, useEffect } from 'react'
import type { BoardListing, AdvisorBrief } from '@/types'

interface ChecklistModalProps {
  listing: BoardListing
  brief?: AdvisorBrief | null
  onClose: () => void
  onContact?: () => void
}

interface CheckItem {
  id: string
  text: string
  warning?: boolean
  tip?: string
}

interface Section {
  title: string
  emoji: string
  items: CheckItem[]
}

function buildChecklist(listing: BoardListing, brief?: AdvisorBrief | null): Section[] {
  const brand = listing.brand || ''
  const model = listing.model || ''
  const km = listing.km ?? listing.kilometros
  const year = listing.year ?? listing.año
  const price = listing.price ?? listing.precio ?? 0
  const transmission = listing.transmission || listing.transmision || ''

  const criterios = brief?.criterios || []
  const evitar = brief?.evitar || []

  const beforeItems: CheckItem[] = [
    { id: 'dnrpa', text: 'Verificá el informe de dominio en DNRPA (registro.jus.gob.ar)', tip: 'Sin prendas, embargos ni inhibiciones' },
    { id: 'precio', text: `Confirmá que $${price.toLocaleString('es-AR')} está dentro del mercado para ${brand} ${model}${year ? ` ${year}` : ''}`, tip: 'Usá el análisis IA de tu tablero como referencia' },
    { id: 'service', text: 'Pedí libreta de service o facturas de concesionaria antes de ir', tip: 'Si no tienen nada, es una señal de alerta' },
    ...criterios.slice(0, 2).map((c, i) => ({ id: `criterio-${i}`, text: c }))
  ]

  const exteriorItems: CheckItem[] = [
    { id: 'chapa', text: 'Revisá toda la chapa en busca de ondulaciones o pintura diferente', tip: 'Ponete de rodillas para ver los paneles desde abajo' },
    { id: 'vidrios', text: 'Chequeá que todos los vidrios tengan el logo del fabricante grabado', tip: 'Vidrio sin logo = fue reemplazado (posible choque)' },
    { id: 'gomas', text: 'Estado de neumáticos: desgaste parejo en los 4', warning: true, tip: 'Desgaste irregular = problemas de alineación o suspensión' },
    { id: 'chasis', text: 'Que el número de chasis coincida con el del título', warning: true },
  ]

  const mecanicaItems: CheckItem[] = [
    { id: 'aceite', text: 'Revisá el aceite en frío: nivel y color', tip: 'Negro espeso = sin service. Con espuma = agua en el motor' },
    { id: 'humo', text: 'Al arrancar en frío: sin humo azul (quema aceite) ni negro (mezcla)', warning: true },
    { id: 'radiador', text: 'Revisar nivel y estado del agua del radiador', tip: 'Con aceite = junta de culata rota' },
    ...(transmission.toLowerCase().includes('auto') || transmission.toLowerCase().includes('cvt') ? [
      { id: 'caja-auto', text: 'Caja automática: sin golpes ni tirones al cambiar marcha', warning: true, tip: 'CVT especialmente delicada — test drive exigido' }
    ] : []),
    ...(km && km > 80000 ? [{ id: 'correa', text: 'Verificar estado o cambio de correa/cadena de distribución', warning: true }] : []),
    ...evitar.slice(0, 2).map((e, i) => ({ id: `evitar-${i}`, text: `Chequear: ${e}`, warning: true }))
  ]

  const testDriveItems: CheckItem[] = [
    { id: 'frio', text: 'Test drive en frío (sin calentar el motor previamente)', tip: 'Así se detectan ruidos y fallas que en caliente se ocultan' },
    { id: 'ciudad', text: 'Al menos 10 min por ciudad: frenadas, giros, baches' },
    { id: 'autopista', text: 'Al menos 10 min en autopista: vibración, dirección, a alta velocidad', tip: 'A 100+ km/h se detectan problemas de tren delantero' },
    { id: 'frenos', text: 'Frenos: sin vibración ni ruido al frenar fuerte', warning: true },
    { id: 'funciones', text: 'Probá todo: AC, vidrios, cierre central, luces, pantalla' },
  ]

  const negocioItems: CheckItem[] = [
    { id: 'mecanico', text: 'Llevá el auto a revisión por tu mecánico antes de cerrar', warning: true, tip: 'Nunca pagues antes de la revisión mecánica' },
    { id: 'negociar', text: 'Si encontrás algo, usalo para negociar — no para cancelar', tip: 'Cada defecto es 5-15% de margen de negociación' },
    { id: 'escrito', text: 'Nada de palabra: cualquier acuerdo por escrito' },
    { id: 'no-seña', text: 'No dejes seña sin todo en regla — documentación + revisión mecánica', warning: true },
  ]

  return [
    { title: 'Antes de ir', emoji: '📋', items: beforeItems },
    { title: 'Exterior y carrocería', emoji: '🔍', items: exteriorItems },
    { title: 'Motor y mecánica', emoji: '🔧', items: mecanicaItems },
    { title: 'Test drive', emoji: '🚗', items: testDriveItems },
    { title: 'Negociación y cierre', emoji: '🤝', items: negocioItems },
  ]
}

export function ChecklistModal({ listing, brief, onClose, onContact }: ChecklistModalProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const sections = buildChecklist(listing, brief)

  const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0)
  const checkedCount = checked.size
  const progress = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const displayTitle = listing.titulo || listing.title || `${listing.brand || ''} ${listing.model || ''}`.trim()
  const displayPrice = listing.precio ?? listing.price
  const displayYear = listing.año ?? listing.year
  const displayKm = listing.kilometros ?? listing.km

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="checklist-modal">
        {/* Header */}
        <div className="checklist-header">
          <div>
            <div className="checklist-eyebrow">CHECKLIST PRE-VISITA</div>
            <h2 className="checklist-title">{displayTitle}</h2>
            <div className="checklist-meta">
              {displayYear && <span>{displayYear}</span>}
              {displayKm != null && <span>· {displayKm.toLocaleString('es-AR')} km</span>}
              {displayPrice && <span>· ${displayPrice.toLocaleString('es-AR')}</span>}
            </div>
          </div>
          <button className="checklist-close" onClick={onClose}>✕</button>
        </div>

        {/* Progress */}
        <div className="checklist-progress-wrap">
          <div className="checklist-progress-bar">
            <div className="checklist-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="checklist-progress-label">{checkedCount} / {totalItems} items</span>
        </div>

        {/* Sections */}
        <div className="checklist-body">
          {sections.map(section => (
            <div key={section.title} className="checklist-section">
              <div className="checklist-section-title">
                {section.emoji} {section.title}
              </div>
              <div className="checklist-items">
                {section.items.map(item => (
                  <label
                    key={item.id}
                    className={`checklist-item${checked.has(item.id) ? ' checked' : ''}${item.warning ? ' warning' : ''}`}
                    onClick={() => toggle(item.id)}
                  >
                    <div className={`checklist-checkbox${checked.has(item.id) ? ' checked' : ''}`}>
                      {checked.has(item.id) && <span>✓</span>}
                    </div>
                    <div className="checklist-item-content">
                      <span className="checklist-item-text">{item.text}</span>
                      {item.tip && !checked.has(item.id) && (
                        <span className="checklist-item-tip">{item.tip}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="checklist-footer">
          {progress >= 80 && onContact && (
            <button
              className="btn btn-primary"
              onClick={() => { onContact(); onClose() }}
            >
              ✓ Todo listo — Marcar como contactado
            </button>
          )}
          {progress < 80 && (
            <p className="checklist-footer-hint">
              Chequeá al menos el 80% antes de contactar al vendedor.
              {progress > 0 && ` Vas ${progress}%.`}
            </p>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
