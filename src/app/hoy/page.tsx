'use client'
import Link from 'next/link'
import { useAppStore, MOCK_TODAY } from '@/store/useAppStore'
import { Card } from '@/components/cards/Card'
import type { BoardListing } from '@/types'

// ─── Market pulse data (mock + real blend) ────────────────────────────────────

const TRENDING_MODELS = [
  { rank: 1, name: 'Toyota Corolla XEI', price: '$15.8M–$17.2M', delta: '+1.2%', direction: 'up' as const },
  { rank: 2, name: 'Honda Civic 2019', price: '$18.4M–$19.8M', delta: '-0.8%', direction: 'down' as const },
  { rank: 3, name: 'VW Vento Highline', price: '$12.5M–$13.9M', delta: '+2.1%', direction: 'up' as const },
  { rank: 4, name: 'Chevrolet Cruze LTZ', price: '$13.2M–$14.8M', delta: '-1.5%', direction: 'down' as const },
  { rank: 5, name: 'Peugeot 3008 2019', price: '$24.8M–$27.4M', delta: '+3.2%', direction: 'up' as const },
  { rank: 6, name: 'Ford Focus III Titanium', price: '$9.8M–$11.5M', delta: '-2.3%', direction: 'down' as const },
]

const MARKET_ALERTS = [
  { icon: '↑', type: 'suba', text: 'Los Toyota Corolla subieron ~4% respecto al mes pasado. Si estás mirando uno, conviene no esperar.' },
  { icon: '↓', type: 'baja', text: 'Los Ford Focus III bajaron. Hay mucha oferta y vendedores con urgencia — buen momento para negociar.' },
  { icon: '!', type: 'alerta', text: 'Alta actividad en SUV compactas: Volkswagen T-Cross y Jeep Renegade con más avisos que en semanas anteriores.' },
]

const NOW = new Date()
const FORMAT_DATE = NOW.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

// ─── Price drop listing (extended mock) ──────────────────────────────────────

const MOCK_DROPS: BoardListing[] = [
  {
    id: 'drop1', source: 'mercadolibre', source_listing_id: 'dr1',
    title: 'Honda Civic EXL 2019 · Precio bajó',
    price: 17900000, currency: 'ARS', year: 2019, km: 48000,
    location: 'Buenos Aires', link: '#',
    image: null, brand: 'Honda', model: 'Civic', fuel: 'Nafta', traction: 'Delantera',
    transmission: 'CVT', raw: {}, created_at: Date.now(), updated_at: Date.now(),
    status: 'saved', notes: '', is_new: false, shortlisted: false, checklist: {},
    precio_anterior: 19500000,
    recomendado: true, _mercado: 'barato',
    titulo: 'Honda Civic EXL 2019', precio: 17900000, moneda: 'ARS',
    año: 2019, kilometros: 48000, ubicacion: 'Buenos Aires', fuente: 'MercadoLibre',
    board_id: 'mock-2', board_name: 'Honda Civic 2016+'
  },
  {
    id: 'drop2', source: 'kavak', source_listing_id: 'dr2',
    title: 'Toyota Corolla XEI 2017 · Precio bajó',
    price: 13900000, currency: 'ARS', year: 2017, km: 79000,
    location: 'Rosario', link: '#',
    image: null, brand: 'Toyota', model: 'Corolla', fuel: 'Nafta', traction: 'Delantera',
    transmission: 'Automática', raw: {}, created_at: Date.now(), updated_at: Date.now(),
    status: 'saved', notes: '', is_new: false, shortlisted: false, checklist: {},
    precio_anterior: 15200000,
    recomendado: true, _mercado: 'barato',
    titulo: 'Toyota Corolla XEI 2017', precio: 13900000, moneda: 'ARS',
    año: 2017, kilometros: 79000, ubicacion: 'Rosario', fuente: 'Kavak',
    board_id: 'mock-1', board_name: 'Toyota Corolla 2015-2019'
  },
]

const MOCK_NEW: BoardListing[] = [
  {
    id: 'new1', source: 'mercadolibre', source_listing_id: 'n1',
    title: 'VW Vento Comfortline 2018 — Nuevo aviso',
    price: 12500000, currency: 'ARS', year: 2018, km: 64000,
    location: 'Córdoba', link: '#',
    image: null, brand: 'Volkswagen', model: 'Vento', fuel: 'Nafta', traction: 'Delantera',
    transmission: 'Automática', raw: {}, created_at: Date.now(), updated_at: Date.now(),
    status: 'saved', notes: '', is_new: true, shortlisted: false, checklist: {},
    recomendado: true, _mercado: 'barato',
    titulo: 'VW Vento Comfortline 2018', precio: 12500000, moneda: 'ARS',
    año: 2018, kilometros: 64000, ubicacion: 'Córdoba', fuente: 'MercadoLibre',
    board_id: 'mock-1', board_name: 'Toyota Corolla 2015-2019'
  },
  {
    id: 'new2', source: 'mercadolibre', source_listing_id: 'n2',
    title: 'Toyota Corolla XEI 2019 - Único dueño',
    price: 17400000, currency: 'ARS', year: 2019, km: 52000,
    location: 'Buenos Aires', link: '#',
    image: null, brand: 'Toyota', model: 'Corolla', fuel: 'Nafta', traction: 'Delantera',
    transmission: 'Automática', raw: {}, created_at: Date.now(), updated_at: Date.now(),
    status: 'saved', notes: '', is_new: true, shortlisted: false, checklist: {},
    _mercado: 'normal',
    titulo: 'Toyota Corolla XEI 2019 - Único dueño', precio: 17400000, moneda: 'ARS',
    año: 2019, kilometros: 52000, ubicacion: 'Buenos Aires', fuente: 'MercadoLibre',
    board_id: 'mock-1', board_name: 'Toyota Corolla 2015-2019'
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function HoyPage() {
  const { today, loading, mockMode, boards } = useAppStore()

  const isLoading = loading.today
  const data = today || (mockMode ? MOCK_TODAY : null)
  const nuevos: BoardListing[] = data?.nuevos?.length ? data.nuevos : MOCK_NEW
  const bajaron: BoardListing[] = data?.bajaron?.length ? data.bajaron : MOCK_DROPS

  const totalNuevos = nuevos.length
  const totalBajaron = bajaron.length
  const totalBoards = boards.length || 2
  const avisosSeguidos = boards.reduce((sum, b) => sum + (b.total || 0), 0) || 78

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px', width: 32, height: 32 }} />
        <p style={{ fontSize: 14, color: 'var(--mute)', fontWeight: 600 }}>Actualizando…</p>
      </div>
    )
  }

  return (
    <div>
      {/* ─── Market header ─────────────────────────────────────────────────── */}
      <div className="market-header">
        <div className="market-date">{FORMAT_DATE}</div>
        <h1 className="market-title">Tu mercado de hoy</h1>
        <div className="market-stats-row">
          {[
            { value: String(totalNuevos), label: 'Avisos nuevos', delta: null },
            { value: String(totalBajaron), label: 'Bajaron de precio', delta: '-8.3% vs ayer' },
            { value: String(totalBoards), label: 'Búsquedas activas', delta: null },
            { value: String(avisosSeguidos), label: 'Avisos en seguimiento', delta: null },
          ].map(s => (
            <div key={s.label} className="market-stat">
              <div className="market-stat-value">{s.value}</div>
              <div className="market-stat-label">{s.label}</div>
              {s.delta && <div className="market-stat-delta down">{s.delta}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Market alerts ─────────────────────────────────────────────────── */}
      <div style={{ padding: 'var(--s4) var(--s5)', display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap', borderBottom: '1px solid var(--hairline)', background: 'var(--surface-soft)' }}>
        {MARKET_ALERTS.map((a, i) => (
          <div key={i} style={{
            flex: '1 1 260px', padding: 'var(--s3) var(--s4)',
            border: `1px solid ${a.type === 'suba' ? 'var(--error)' : a.type === 'baja' ? 'var(--success)' : 'var(--stone)'}`,
            background: 'var(--canvas)', fontSize: 12, color: 'var(--body-color)', lineHeight: 1.55
          }}>
            <span style={{ fontWeight: 800, marginRight: 4, color: a.type === 'suba' ? 'var(--error)' : a.type === 'baja' ? 'var(--success)' : 'var(--mute)' }}>
              {a.icon}
            </span>
            {a.text}
          </div>
        ))}
      </div>

      {/* ─── Price drops ───────────────────────────────────────────────────── */}
      {bajaron.length > 0 && (
        <div className="today-section">
          <div className="today-section-label">
            ↓ BAJARON DE PRECIO
            <span className="today-section-count">{bajaron.length}</span>
            <span style={{ fontWeight: 500, color: 'var(--mute)', marginLeft: 4, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>en tus búsquedas</span>
          </div>
          <div className="today-grid">
            {bajaron.map((l: BoardListing) => (
              <Card key={l.id} listing={l} showBoardBadge />
            ))}
          </div>
        </div>
      )}

      {/* ─── New listings ──────────────────────────────────────────────────── */}
      {nuevos.length > 0 && (
        <div className="today-section" style={{ borderTop: '1px solid var(--hairline)' }}>
          <div className="today-section-label">
            ✦ AVISOS NUEVOS
            <span className="today-section-count">{nuevos.length}</span>
            <span style={{ fontWeight: 500, color: 'var(--mute)', marginLeft: 4, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>que coinciden con tus búsquedas</span>
          </div>
          <div className="today-grid">
            {nuevos.map((l: BoardListing) => (
              <Card key={l.id} listing={l} showBoardBadge />
            ))}
          </div>
        </div>
      )}

      {/* ─── Trending models ───────────────────────────────────────────────── */}
      <div className="trending-section">
        <div className="section-label">MODELOS MÁS ACTIVOS ESTA SEMANA</div>
        <div className="trending-grid">
          {TRENDING_MODELS.map(m => (
            <div key={m.rank} className="trending-card">
              <div className="trending-rank">#{m.rank}</div>
              <div className="trending-info">
                <div className="trending-name">{m.name}</div>
                <div className="trending-price">{m.price}</div>
              </div>
              <div className={`trending-delta ${m.direction}`}>{m.delta}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Empty state if no boards ──────────────────────────────────────── */}
      {boards.length === 0 && (
        <div className="empty-state" style={{ borderTop: '1px solid var(--hairline)' }}>
          <h2>Creá tu primera búsqueda</h2>
          <p>Una vez que guardés una búsqueda, te mostramos acá cuando aparecen avisos nuevos o bajan los precios.</p>
          <Link href="/" className="btn btn-primary">Empezar a buscar →</Link>
        </div>
      )}
    </div>
  )
}
