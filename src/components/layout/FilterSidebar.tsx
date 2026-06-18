'use client'

export interface FilterState {
  priceMin: string
  priceMax: string
  kmMax: string
  yearMin: string
  trans: 'all' | 'auto' | 'manual'
}

export const DEFAULT_FILTERS: FilterState = {
  priceMin: '', priceMax: '', kmMax: '', yearMin: '', trans: 'all'
}

interface FilterSidebarProps {
  filters: FilterState
  onChange: (f: FilterState) => void
  brief?: any
  onOpenAdvisor?: () => void
  totalCount?: number
  filteredCount?: number
  /** mobile drawer: controlled open state */
  open?: boolean
  onClose?: () => void
}

export function FilterSidebar({
  filters, onChange, brief, onOpenAdvisor,
  totalCount, filteredCount, open, onClose
}: FilterSidebarProps) {
  const hasFilters = !!(
    filters.priceMin || filters.priceMax ||
    filters.kmMax || filters.yearMin ||
    filters.trans !== 'all'
  )

  function set(key: keyof FilterState, value: string) {
    onChange({ ...filters, [key]: value })
  }

  const topModel = brief?.modelos_recomendados?.[0]
  const allModels: any[] = brief?.modelos_recomendados || []

  return (
    <>
      {/* Mobile overlay */}
      {open !== undefined && open && (
        <div className="filter-overlay" onClick={onClose} />
      )}

      <aside className={`plp-sidebar${open ? ' open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <span className="sidebar-title">Filtros</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {hasFilters && (
              <button
                className="btn btn-text btn-sm"
                onClick={() => onChange(DEFAULT_FILTERS)}
                style={{ color: 'var(--ash)', fontSize: 11 }}
              >
                Limpiar
              </button>
            )}
            {onClose && (
              <button className="sidebar-close-btn" onClick={onClose} aria-label="Cerrar filtros">
                ×
              </button>
            )}
          </div>
        </div>

        {/* Result count */}
        {totalCount !== undefined && (
          <div className="sidebar-count">
            {filteredCount !== undefined && filteredCount !== totalCount
              ? `${filteredCount} de ${totalCount} avisos`
              : `${totalCount} aviso${totalCount !== 1 ? 's' : ''}`}
          </div>
        )}

        <div className="sidebar-filters">
          {/* ── Precio ── */}
          <div className="filter-group">
            <div className="filter-group-label">Precio</div>
            <div className="filter-range-row">
              <input
                className="filter-input"
                value={filters.priceMin}
                onChange={e => set('priceMin', e.target.value)}
                placeholder="Mín. ej: 10M"
                aria-label="Precio mínimo"
              />
              <span className="filter-range-sep">—</span>
              <input
                className="filter-input"
                value={filters.priceMax}
                onChange={e => set('priceMax', e.target.value)}
                placeholder="Máx. ej: 20M"
                aria-label="Precio máximo"
              />
            </div>
          </div>

          {/* ── Año ── */}
          <div className="filter-group">
            <div className="filter-group-label">Año desde</div>
            <input
              className="filter-input"
              value={filters.yearMin}
              onChange={e => set('yearMin', e.target.value)}
              placeholder="ej: 2018"
              aria-label="Año mínimo"
            />
          </div>

          {/* ── KM ── */}
          <div className="filter-group">
            <div className="filter-group-label">Kilómetros máx.</div>
            <input
              className="filter-input"
              value={filters.kmMax}
              onChange={e => set('kmMax', e.target.value)}
              placeholder="ej: 80000"
              aria-label="Kilómetros máximo"
            />
          </div>

          {/* ── Transmisión ── */}
          <div className="filter-group">
            <div className="filter-group-label">Transmisión</div>
            <div className="filter-radio-group">
              {([
                ['all', 'Todas'],
                ['auto', 'Automática / CVT'],
                ['manual', 'Manual'],
              ] as [string, string][]).map(([val, lbl]) => (
                <label key={val} className="filter-radio">
                  <input
                    type="radio"
                    name="trans-filter"
                    value={val}
                    checked={filters.trans === val}
                    onChange={() => set('trans', val as FilterState['trans'])}
                  />
                  <span>{lbl}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── AI brief section ── */}
        {topModel && (
          <div className="sidebar-brief">
            <div className="sidebar-brief-header">
              <span className="sidebar-brief-label">✦ IA recomienda</span>
              {allModels.length > 1 && (
                <span className="sidebar-brief-count">{allModels.length} modelos</span>
              )}
            </div>
            <div className="sidebar-brief-models">
              {allModels.slice(0, 3).map((m: any, i: number) => (
                <div key={i} className={`sidebar-brief-model${i === 0 ? ' top' : ''}`}>
                  <span className="sidebar-brief-model-name">{m.marca} {m.modelo}</span>
                  {m.anio_desde && (
                    <span className="sidebar-brief-model-year">{m.anio_desde}–{m.anio_hasta || '…'}</span>
                  )}
                </div>
              ))}
            </div>
            {topModel.motivo && (
              <p className="sidebar-brief-reason">{topModel.motivo}</p>
            )}
            {onOpenAdvisor && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 10, width: '100%', fontSize: 12 }}
                onClick={onOpenAdvisor}
              >
                Preguntarle al asesor ↗
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  )
}
