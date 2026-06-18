'use client'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import type { BoardListing } from '@/types'

const BRAND_PALETTE: Record<string, { bg: string; fg: string }> = {
  'Toyota':      { bg: '#EEF2FF', fg: '#4F6EF7' },
  'Volkswagen':  { bg: '#EFF6FF', fg: '#1D66DD' },
  'Honda':       { bg: '#FEF2F2', fg: '#DC2626' },
  'Chevrolet':   { bg: '#FFFBEB', fg: '#D97706' },
  'Ford':        { bg: '#EFF6FF', fg: '#1E3A8A' },
  'Fiat':        { bg: '#FDF4FF', fg: '#9333EA' },
  'Renault':     { bg: '#FFFBEB', fg: '#D97706' },
  'Peugeot':     { bg: '#F0FDF4', fg: '#16A34A' },
  'Nissan':      { bg: '#FFF5F5', fg: '#B91C1C' },
  'Jeep':        { bg: '#F0FDF4', fg: '#15803D' },
}

function CarIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 90" xmlns="http://www.w3.org/2000/svg" width="96" height="44">
      <path
        d="M32 56 L50 34 Q60 24 80 23 L120 23 Q140 24 150 34 L168 56 L174 56 Q178 56 178 61 L178 66 Q178 68 175 68 L163 68 Q161 75 154 75 Q147 75 145 68 L55 68 Q53 75 46 75 Q39 75 37 68 L25 68 Q22 68 22 66 L22 61 Q22 56 26 56 Z"
        fill={color}
      />
      <path
        d="M52 55 L63 38 Q70 30 84 29 L116 29 Q130 30 137 38 L148 55 Z"
        fill="white"
        opacity="0.35"
      />
      <circle cx="46" cy="68" r="7" fill={color} opacity="0.6" />
      <circle cx="154" cy="68" r="7" fill={color} opacity="0.6" />
    </svg>
  )
}

interface CardProps {
  listing: BoardListing
  showBoardBadge?: boolean
  onSave?: (id: string) => void
  onContact?: (id: string) => void
  onDiscard?: (id: string) => void
  onAskAdvisor?: () => void
  onChecklist?: () => void
  compact?: boolean
}

export function Card({ listing, showBoardBadge, onSave, onContact, onDiscard, onAskAdvisor, onChecklist, compact }: CardProps) {
  const { showToast } = useAppStore()
  const [actionDone, setActionDone] = useState<string | null>(null)

  const {
    id, titulo, title, precio, price, currency, moneda, año, year, kilometros, km,
    ubicacion, location, fuente, source, imagen, image, brand, model,
    status, is_new, shortlisted, recomendado, _mercado, precio_anterior, previous_price,
    transmission, transmision, fuel, combustible, link
  } = listing

  const displayTitle = titulo || title || `${brand || ''} ${model || ''}`.trim() || 'Auto'
  const displayPrice = precio ?? price
  const displayCurrency = moneda || currency || 'ARS'
  const displayYear = año || year
  const displayKm = kilometros ?? km
  const displayLocation = ubicacion || location
  const displaySource = fuente || source
  const displayImage = imagen || image
  const displayPrevPrice = precio_anterior ?? previous_price

  function fmt(n: number) {
    return n.toLocaleString('es-AR')
  }

  async function handleContact() {
    if (!onContact) return
    onContact(id)
    setActionDone('contacted')
    showToast('Marcado como contactado')
  }

  async function handleSave() {
    if (!onSave) return
    onSave(id)
    setActionDone('saved')
    showToast('Guardado en favoritos')
  }

  async function handleDiscard() {
    if (!onDiscard) return
    onDiscard(id)
    setActionDone('discarded')
  }

  const mercadoLabel = _mercado === 'barato' ? '↓ Buen precio' : _mercado === 'caro' ? '↑ Precio alto' : null
  const mercadoBadgeClass = _mercado === 'barato' ? 'badge-cheap' : _mercado === 'caro' ? 'badge-pricey' : ''

  const effectiveStatus = actionDone || status

  return (
    <div
      className={`listing-card ${shortlisted || actionDone === 'saved' ? 'shortlisted' : ''}`}
      style={{ opacity: effectiveStatus === 'discarded' ? 0.45 : 1, transition: 'opacity 0.2s' }}
    >
      {/* Media */}
      <div className="card-media">
        {displayImage ? (
          <img src={displayImage} alt={displayTitle} loading="lazy" onError={e => {
            const img = e.target as HTMLImageElement
            img.style.display = 'none'
            img.parentElement?.classList.add('card-media--no-img')
          }} />
        ) : null}
        {!displayImage && (() => {
          const palette = BRAND_PALETTE[brand || ''] || { bg: '#F3F4F6', fg: '#9CA3AF' }
          return (
            <div className="card-placeholder" style={{ background: palette.bg }}>
              <CarIcon color={palette.fg} />
              <div className="card-placeholder-brand" style={{ color: palette.fg }}>{brand || 'Auto'}</div>
              {model && <div className="card-placeholder-model">{model}</div>}
            </div>
          )
        })()}

        {/* Overlay badges */}
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4 }}>
          {is_new && <span className="badge badge-new">NUEVO</span>}
          {recomendado && <span className="badge badge-rec">✦ IA</span>}
        </div>

        {showBoardBadge && listing.board_name && (
          <div style={{ position: 'absolute', bottom: 8, left: 8 }}>
            <span style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, padding: '2px 6px', fontWeight: 600, borderRadius: 2 }}>
              {listing.board_name}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="card-body">
        <div className="card-title">{displayTitle}</div>

        {/* Price row */}
        <div>
          {displayPrevPrice && displayPrevPrice > (displayPrice || 0) && (
            <span className="card-price-prev">${fmt(displayPrevPrice)}</span>
          )}
          <span className="card-price">
            {displayPrice ? `$${fmt(displayPrice)}` : '—'}
          </span>
          {displayCurrency && displayCurrency !== 'ARS' && (
            <span style={{ fontSize: 11, color: 'var(--mute)', marginLeft: 4 }}>{displayCurrency}</span>
          )}
          {displayPrevPrice && displayPrevPrice > (displayPrice || 0) && (
            <span className="card-price-badge">
              ↓ {Math.round((1 - (displayPrice || 0) / displayPrevPrice) * 100)}%
            </span>
          )}
        </div>

        {/* Meta */}
        <div className="card-meta">
          {displayYear && <span className="card-meta-item">{displayYear}</span>}
          {displayKm !== undefined && displayKm !== null && (
            <>
              <span className="card-meta-sep">·</span>
              <span className="card-meta-item">{fmt(displayKm)} km</span>
            </>
          )}
          {displayLocation && (
            <>
              <span className="card-meta-sep">·</span>
              <span className="card-meta-item">{displayLocation}</span>
            </>
          )}
        </div>

        {/* Extra tags */}
        {!compact && (
          <div className="card-tags-row">
            {(transmision || transmission) && (
              <span style={{ fontSize: 11, background: 'var(--surface-soft)', color: 'var(--mute)', padding: '2px 6px', borderRadius: 2, fontWeight: 600 }}>
                {transmision || transmission}
              </span>
            )}
            {(combustible || fuel) && (
              <span style={{ fontSize: 11, background: 'var(--surface-soft)', color: 'var(--mute)', padding: '2px 6px', borderRadius: 2, fontWeight: 600 }}>
                {combustible || fuel}
              </span>
            )}
            {mercadoLabel && (
              <span className={`badge ${mercadoBadgeClass}`}>{mercadoLabel}</span>
            )}
          </div>
        )}

        {/* Source + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {displaySource && (
            <span className="card-source">
              {link && link !== '#' ? (
                <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                  {displaySource} ↗
                </a>
              ) : displaySource}
            </span>
          )}
          {(effectiveStatus === 'contacted' || actionDone === 'contacted') && (
            <span className="badge badge-contacted">✓ Contactado</span>
          )}
          {(shortlisted || actionDone === 'saved') && effectiveStatus !== 'contacted' && (
            <span className="badge badge-saved">★ Guardado</span>
          )}
        </div>
      </div>

      {/* Actions */}
      {(onSave || onContact || onDiscard || onAskAdvisor || onChecklist) && (
        <div className="card-actions">
          {onChecklist && (
            <button
              className="btn btn-yellow btn-sm"
              onClick={onChecklist}
              title="Checklist antes de ir a verlo"
            >
              📋 Ir a verlo
            </button>
          )}
          {onContact && effectiveStatus !== 'contacted' && (
            <button className="btn btn-primary btn-sm" onClick={handleContact}>Contactar</button>
          )}
          {onSave && !shortlisted && actionDone !== 'saved' && (
            <button className="btn btn-ghost btn-sm" onClick={handleSave}>Guardar</button>
          )}
          {onAskAdvisor && (
            <button
              className="btn btn-text btn-sm"
              onClick={onAskAdvisor}
              title="Preguntarle al asesor sobre este auto"
              style={{ fontWeight: 700, color: 'var(--primary)' }}
            >
              ✦ Asesor
            </button>
          )}
          {onDiscard && effectiveStatus !== 'discarded' && (
            <button className="btn btn-text btn-sm" style={{ marginLeft: 'auto', color: 'var(--ash)' }} onClick={handleDiscard}>×</button>
          )}
        </div>
      )}
    </div>
  )
}
