'use client'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/store/useAppStore'
import { ListingsPane } from '@/components/workspace/ListingsPane'
import { FilterSidebar, DEFAULT_FILTERS } from '@/components/layout/FilterSidebar'
import { MOCK_LISTINGS, MOCK_BOARDS } from '@/store/useAppStore'
import type { Board } from '@/types'
import type { FilterState } from '@/components/layout/FilterSidebar'

interface Props {
  params: Promise<{ id: string }>
}

export default function ResultadosPage({ params }: Props) {
  const { id: boardId } = use(params)
  const { mockMode, openAdvisor, showToast } = useAppStore()
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadBoard() }, [boardId])

  async function loadBoard() {
    setLoading(true)
    if (mockMode) {
      await new Promise(r => setTimeout(r, 350))
      const found = MOCK_BOARDS.find(b => b.id === boardId) || MOCK_BOARDS[0]
      setBoard({ ...found, listings: MOCK_LISTINGS })
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/boards/${boardId}`)
      const data = await res.json()
      if (data.ok) setBoard(data.board)
    } catch {
      const found = MOCK_BOARDS.find(b => b.id === boardId) || MOCK_BOARDS[0]
      setBoard({ ...found, listings: MOCK_LISTINGS })
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateListing(bId: string, listingId: string, update: Record<string, unknown>) {
    if (mockMode) {
      setBoard(prev => prev ? {
        ...prev,
        listings: (prev.listings || []).map(l => l.id === listingId ? { ...l, ...update } : l)
      } : prev)
      return
    }
    try {
      const res = await fetch(`/api/boards/${bId}/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
      const data = await res.json()
      if (data.ok && data.board) setBoard(data.board)
    } catch {}
  }

  async function handleRefresh() {
    setRefreshing(true)
    if (mockMode) {
      await new Promise(r => setTimeout(r, 1200))
      showToast('Resultados actualizados')
      setRefreshing(false)
      return
    }
    try {
      const res = await fetch(`/api/boards/${boardId}/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
      })
      const data = await res.json()
      if (data.ok) { setBoard(data.board); showToast('Resultados actualizados') }
    } catch (e: any) {
      showToast(e.message || 'Error al actualizar', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  function handleOpenAdvisor() {
    openAdvisor({
      boardId,
      boardName: board?.name,
      listings: board?.listings || [],
      advisor_brief: board?.advisor_brief as Record<string, unknown> | undefined,
    })
  }

  function handleAskAdvisorAboutListing(title: string, price: number) {
    openAdvisor({
      boardId,
      boardName: board?.name,
      listings: board?.listings || [],
      advisor_brief: board?.advisor_brief as Record<string, unknown> | undefined,
      prefillMessage: `Estoy mirando "${title}" a $${price.toLocaleString('es-AR')}. ¿Está bien el precio? ¿Me conviene? Dame un análisis completo: precio vs mercado, qué negociar, y si hay algo a tener en cuenta del modelo.`,
    })
  }

  if (loading) {
    return (
      <div style={{ padding: 64, textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px', width: 32, height: 32 }} />
        <p style={{ fontSize: 14, color: 'var(--mute)', fontWeight: 600 }}>Cargando resultados…</p>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="empty-state">
        <h2>Búsqueda no encontrada</h2>
        <p>Este resultado ya no existe. Hacé una nueva búsqueda.</p>
        <Link href="/" className="btn btn-primary">Nueva búsqueda</Link>
      </div>
    )
  }

  const listings = board.listings || []
  const shortlistedCount = listings.filter(l => l.shortlisted).length
  const hasNew = (board.new_count || 0) > 0 || listings.some(l => l.is_new)

  // Compute filtered count for sidebar display
  function parseM(val: string) {
    if (!val) return null
    const n = parseFloat(val.replace(/[$.\s]/g, '').replace(',', '.'))
    if (isNaN(n)) return null
    return n < 1000 ? n * 1_000_000 : n
  }
  const priceMinN = parseM(filters.priceMin)
  const priceMaxN = parseM(filters.priceMax)
  const kmMaxN = filters.kmMax ? parseInt(filters.kmMax.replace(/\D/g, ''), 10) : null
  const yearMinN = filters.yearMin ? parseInt(filters.yearMin, 10) : null
  const filteredCount = listings.filter(l => {
    if (l.status === 'discarded') return false
    const p = l.precio ?? l.price ?? 0
    if (priceMinN !== null && p && p < priceMinN) return false
    if (priceMaxN !== null && p && p > priceMaxN) return false
    const k = l.kilometros ?? l.km ?? 0
    if (kmMaxN !== null && k && k > kmMaxN) return false
    const y = l.año ?? l.year ?? 0
    if (yearMinN !== null && y && y < yearMinN) return false
    if (filters.trans !== 'all') {
      const t = (l.transmision || l.transmission || '').toLowerCase()
      if (filters.trans === 'auto' && !t.includes('auto') && !t.includes('cvt')) return false
      if (filters.trans === 'manual' && !t.includes('manual')) return false
    }
    return true
  }).length

  const hasActiveFilters = !!(priceMinN || priceMaxN || kmMaxN || yearMinN || filters.trans !== 'all')
  const activeFilterCount = [priceMinN, priceMaxN, kmMaxN, yearMinN, filters.trans !== 'all' ? 1 : null].filter(Boolean).length

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ padding: '10px var(--s5)', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-soft)' }}>
        <Link href="/" style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 600, textDecoration: 'none' }}>
          ← Nueva búsqueda
        </Link>
        <span style={{ color: 'var(--stone)', fontSize: 12 }}>/</span>
        <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {board.name}
        </span>
        {hasNew && (
          <span style={{ background: 'var(--primary)', fontSize: 10, fontWeight: 800, padding: '1px 7px', flexShrink: 0 }}>
            {board.new_count || listings.filter(l => l.is_new).length} nuevos
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ fontSize: 12 }}
          >
            {refreshing ? '⟳ Actualizando…' : '⟳ Actualizar'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleOpenAdvisor}
            style={{ fontSize: 12 }}
          >
            ✦ Asesor
          </button>
        </div>
      </div>

      {/* PLP layout */}
      <div className="plp-layout">
        {/* Filter sidebar — desktop always visible, mobile as drawer */}
        <FilterSidebar
          filters={filters}
          onChange={setFilters}
          brief={board.advisor_brief}
          onOpenAdvisor={handleOpenAdvisor}
          totalCount={listings.filter(l => l.status !== 'discarded').length}
          filteredCount={filteredCount}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />

        {/* Main content */}
        <div className="plp-main">
          {/* Top bar */}
          <div className="plp-topbar">
            {/* Mobile: filter button */}
            <button
              className="btn btn-ghost btn-sm plp-filter-btn"
              onClick={() => setDrawerOpen(true)}
            >
              ⚙ Filtrar{hasActiveFilters ? ` (${activeFilterCount})` : ''}
            </button>

            <span className="plp-topbar-query" title={board.name}>
              {board.name}
            </span>

            {/* Guardados pill */}
            {shortlistedCount > 0 && (
              <Link href="/guardados" className="plp-saved-pill">
                ★ Guardados ({shortlistedCount})
              </Link>
            )}
          </div>

          {/* Listings */}
          <ListingsPane
            board={board}
            externalFilters={filters}
            onUpdate={handleUpdateListing}
            onAskAdvisor={handleAskAdvisorAboutListing}
          />
        </div>
      </div>
    </>
  )
}
