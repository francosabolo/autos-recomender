'use client'
import type { BoardListing } from '@/types'

interface CompareStripProps {
  listings: BoardListing[]
  onAskAdvisor?: () => void
}

export function CompareStrip({ listings, onAskAdvisor }: CompareStripProps) {
  if (listings.length < 2) return null

  const items = listings.slice(0, 4)

  function fmt(n: number) {
    return n.toLocaleString('es-AR')
  }

  // Find best price and best km among shortlisted
  const prices = items.map(l => l.precio ?? l.price ?? 0).filter(Boolean)
  const kms = items.map(l => l.kilometros ?? l.km ?? 0).filter(Boolean)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const minKm = kms.length ? Math.min(...kms) : 0

  return (
    <div className="compare-strip">
      <div className="compare-strip-header">
        <div>
          <div className="compare-strip-label">COMPARACIÓN</div>
          <p className="compare-strip-sub">Tus {items.length} guardados cara a cara</p>
        </div>
        {onAskAdvisor && (
          <button className="btn btn-primary btn-sm" onClick={onAskAdvisor}>
            ✦ Asesor compara
          </button>
        )}
      </div>

      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="compare-th compare-th-label">Atributo</th>
              {items.map(l => {
                const name = (l.titulo || l.title || `${l.brand || ''} ${l.model || ''}`).trim()
                return (
                  <th key={l.id} className="compare-th">
                    <span className="compare-col-name">{name.length > 28 ? name.slice(0, 26) + '…' : name}</span>
                    {l.recomendado && <span className="compare-rec">✦ IA</span>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {/* Price */}
            <tr>
              <td className="compare-td compare-td-label">Precio</td>
              {items.map(l => {
                const p = l.precio ?? l.price ?? 0
                const isBest = p === minPrice
                return (
                  <td key={l.id} className={`compare-td${isBest ? ' compare-best' : ''}`}>
                    ${p ? fmt(p) : '—'}
                    {isBest && p > 0 && <span className="compare-best-badge">↓ Mejor</span>}
                  </td>
                )
              })}
            </tr>

            {/* Year */}
            <tr>
              <td className="compare-td compare-td-label">Año</td>
              {items.map(l => {
                const y = l.año ?? l.year
                const maxY = Math.max(...items.map(li => li.año ?? li.year ?? 0))
                return (
                  <td key={l.id} className={`compare-td${y === maxY ? ' compare-best' : ''}`}>
                    {y ?? '—'}
                  </td>
                )
              })}
            </tr>

            {/* Km */}
            <tr>
              <td className="compare-td compare-td-label">Kilómetros</td>
              {items.map(l => {
                const k = l.kilometros ?? l.km ?? 0
                const isBest = k > 0 && k === minKm
                return (
                  <td key={l.id} className={`compare-td${isBest ? ' compare-best' : ''}`}>
                    {k ? fmt(k) + ' km' : '—'}
                    {isBest && k > 0 && <span className="compare-best-badge">↓ Menos</span>}
                  </td>
                )
              })}
            </tr>

            {/* Transmission */}
            <tr>
              <td className="compare-td compare-td-label">Caja</td>
              {items.map(l => (
                <td key={l.id} className="compare-td">
                  {l.transmision || l.transmission || '—'}
                </td>
              ))}
            </tr>

            {/* Market position */}
            <tr>
              <td className="compare-td compare-td-label">Mercado</td>
              {items.map(l => {
                const m = l._mercado
                return (
                  <td key={l.id} className="compare-td">
                    {m === 'barato' ? <span style={{ color: 'var(--success)', fontWeight: 700 }}>↓ Buen precio</span>
                      : m === 'caro' ? <span style={{ color: 'var(--error)', fontWeight: 700 }}>↑ Caro</span>
                        : <span style={{ color: 'var(--mute)' }}>Normal</span>}
                  </td>
                )
              })}
            </tr>

            {/* Source */}
            <tr>
              <td className="compare-td compare-td-label">Portal</td>
              {items.map(l => (
                <td key={l.id} className="compare-td">
                  {l.link && l.link !== '#'
                    ? <a href={l.link} target="_blank" rel="noopener noreferrer" className="compare-link">
                        {l.fuente || l.source} ↗
                      </a>
                    : (l.fuente || l.source || '—')}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="compare-hint">
        ✦ El asesor puede ayudarte a elegir entre estos {items.length} candidatos según el historial del modelo y condición del mercado.
      </p>
    </div>
  )
}
