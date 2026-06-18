'use client'
import { useState } from 'react'
import { Card } from '@/components/cards/Card'
import { ChecklistModal } from './ChecklistModal'
import { CompareStrip } from './CompareStrip'
import type { Board, BoardListing, AdvisorBrief } from '@/types'
import type { FilterState } from '@/components/layout/FilterSidebar'

type SortKey = 'precio_asc' | 'precio_desc' | 'año_desc' | 'km_asc' | 'recomendado'
type FilterKey = 'all' | 'new' | 'shortlisted' | 'contacted'

interface ListingsPaneProps {
  board: Board
  externalFilters?: FilterState
  onUpdate?: (boardId: string, listingId: string, update: Partial<{ status: string; shortlisted: boolean; notes: string }>) => Promise<void>
  onAskAdvisor?: (title: string, price: number) => void
}

function parseM(val: string): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(/[$.\s]/g, '').replace(',', '.'))
  if (isNaN(n)) return null
  return n < 1000 ? n * 1_000_000 : n
}

export function ListingsPane({ board, externalFilters, onUpdate, onAskAdvisor }: ListingsPaneProps) {
  const [sort, setSort] = useState<SortKey>('recomendado')
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [checklistListing, setChecklistListing] = useState<BoardListing | null>(null)

  const listings = board.listings || []
  const brief = board.advisor_brief as AdvisorBrief | null | undefined

  const f = externalFilters
  const priceMinN = f ? parseM(f.priceMin) : null
  const priceMaxN = f ? parseM(f.priceMax) : null
  const kmMaxN = f?.kmMax ? parseInt(f.kmMax.replace(/\D/g, ''), 10) : null
  const yearMinN = f?.yearMin ? parseInt(f.yearMin, 10) : null

  const filtered = listings.filter(l => {
    // Status filter
    if (statusFilter === 'new' && !l.is_new) return false
    if (statusFilter === 'shortlisted' && !l.shortlisted) return false
    if (statusFilter === 'contacted' && l.status !== 'contacted') return false
    if (statusFilter === 'all' && l.status === 'discarded') return false

    // External filters (price, km, year, trans)
    const p = l.precio ?? l.price ?? 0
    if (priceMinN !== null && p && p < priceMinN) return false
    if (priceMaxN !== null && p && p > priceMaxN) return false
    const k = l.kilometros ?? l.km ?? 0
    if (kmMaxN !== null && k && k > kmMaxN) return false
    const y = l.año ?? l.year ?? 0
    if (yearMinN !== null && y && y < yearMinN) return false
    if (f?.trans && f.trans !== 'all') {
      const t = (l.transmision || l.transmission || '').toLowerCase()
      if (f.trans === 'auto' && !t.includes('auto') && !t.includes('cvt')) return false
      if (f.trans === 'manual' && !t.includes('manual')) return false
    }

    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'precio_asc') return (a.precio ?? a.price ?? Infinity) - (b.precio ?? b.price ?? Infinity)
    if (sort === 'precio_desc') return (b.precio ?? b.price ?? 0) - (a.precio ?? a.price ?? 0)
    if (sort === 'año_desc') return (b.año ?? b.year ?? 0) - (a.año ?? a.year ?? 0)
    if (sort === 'km_asc') return (a.kilometros ?? a.km ?? Infinity) - (b.kilometros ?? b.km ?? Infinity)
    const aScore = (a.recomendado ? 2 : 0) + (a._mercado === 'barato' ? 1 : 0)
    const bScore = (b.recomendado ? 2 : 0) + (b._mercado === 'barato' ? 1 : 0)
    return bScore - aScore
  })

  async function handleContact(listingId: string) {
    setUpdating(listingId)
    try { await onUpdate?.(board.id, listingId, { status: 'contacted' }) }
    finally { setUpdating(null) }
  }

  async function handleSave(listingId: string) {
    setUpdating(listingId)
    try { await onUpdate?.(board.id, listingId, { shortlisted: true }) }
    finally { setUpdating(null) }
  }

  async function handleDiscard(listingId: string) {
    setUpdating(listingId)
    try { await onUpdate?.(board.id, listingId, { status: 'discarded' }) }
    finally { setUpdating(null) }
  }

  const filterCounts = {
    all: listings.filter(l => l.status !== 'discarded').length,
    new: listings.filter(l => l.is_new).length,
    shortlisted: listings.filter(l => l.shortlisted).length,
    contacted: listings.filter(l => l.status === 'contacted').length,
  }

  const shortlistedListings = listings.filter(l => l.shortlisted)

  function handleAskAdvisorCompare() {
    if (!onAskAdvisor) return
    const names = shortlistedListings.slice(0, 4)
      .map(l => `${l.titulo || l.title} a $${(l.precio || l.price || 0).toLocaleString('es-AR')}`)
      .join(', ')
    onAskAdvisor(`Comparame estos candidatos que tengo guardados: ${names}. ¿Cuál me conviene más?`, 0)
  }

  return (
    <div>
      {/* Status filter pills */}
      <div className="listings-controls">
        <div className="listings-filter-pills">
          {([
            ['all', `Todos (${filterCounts.all})`],
            ['new', `Nuevos (${filterCounts.new})`],
            ['shortlisted', `Guardados (${filterCounts.shortlisted})`],
            ['contacted', `Contactados (${filterCounts.contacted})`],
          ] as [FilterKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`filter-pill${statusFilter === key ? ' active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="plp-topbar-sort"
          style={{ marginLeft: 'auto' }}
        >
          <option value="recomendado">Recomendados</option>
          <option value="precio_asc">Precio ↑</option>
          <option value="precio_desc">Precio ↓</option>
          <option value="año_desc">Año ↓</option>
          <option value="km_asc">Km ↑</option>
        </select>
      </div>

      {/* Compare strip */}
      {statusFilter === 'shortlisted' && shortlistedListings.length >= 2 && (
        <CompareStrip
          listings={shortlistedListings}
          onAskAdvisor={onAskAdvisor ? handleAskAdvisorCompare : undefined}
        />
      )}

      {/* Grid */}
      {sorted.length === 0 ? (
        <div className="empty-state">
          <h2>Sin avisos</h2>
          <p>
            {statusFilter !== 'all'
              ? 'No hay avisos en esta categoría.'
              : 'Ningún aviso coincide con los filtros seleccionados.'}
          </p>
        </div>
      ) : (
        <div className="plp-grid">
          {sorted.map((l: BoardListing) => (
            <div key={l.id} style={{ opacity: updating === l.id ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <Card
                listing={l}
                onSave={!l.shortlisted ? handleSave : undefined}
                onContact={l.status !== 'contacted' ? handleContact : undefined}
                onDiscard={l.status !== 'discarded' ? handleDiscard : undefined}
                onChecklist={() => setChecklistListing(l)}
                onAskAdvisor={onAskAdvisor ? () => onAskAdvisor(
                  l.titulo || l.title || '',
                  l.precio || l.price || 0
                ) : undefined}
              />
            </div>
          ))}
        </div>
      )}

      {/* Checklist modal */}
      {checklistListing && (
        <ChecklistModal
          listing={checklistListing}
          brief={brief}
          onClose={() => setChecklistListing(null)}
          onContact={checklistListing.status !== 'contacted'
            ? () => { handleContact(checklistListing.id); setChecklistListing(null) }
            : undefined}
        />
      )}
    </div>
  )
}
