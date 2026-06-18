'use client'
import { useState, useCallback, FormEvent, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { Card } from '@/components/cards/Card'
import type { BoardListing } from '@/types'

// ─── Demo data for the interactive advisor ────────────────────────────────────

const DEMO_CONVOS: Record<string, { thinking: string; reply: string }> = {
  default: {
    thinking: 'Revisando últimos 90 días de publicaciones…',
    reply: `Mirá, en el mercado argentino actual ese rango de precio tiene opciones interesantes. Sin más datos (marca, modelo, presupuesto) te doy una respuesta genérica, pero si me decís qué estás mirando o qué presupuesto tenés, puedo ser mucho más específico.\n\n¿Qué auto tenés en mente?`
  },
  corolla: {
    thinking: 'Analizando 312 publicaciones de Corolla XEI…',
    reply: `**El Toyota Corolla XEI 2018 a $18.5M está caro.**\n\nRevisé 312 avisos de los últimos 90 días. El promedio del mercado para ese modelo y año es **$15.8M–$16.9M**. A $18.5M está un **12–17% por encima del mercado**.\n\nEl precio se justifica solo si tiene:\n• Service al día en concesionaria Toyota\n• Menos de 50.000 km\n• Algún equipamiento extra (techo, cuero)\n\nSi no tiene eso, te recomiendo negociar o buscar otra unidad. ¿Querés que te muestre los que están en precio?`
  },
  presupuesto: {
    thinking: 'Cruzando presupuesto con opciones del mercado…',
    reply: `Con $20M en Argentina hoy, las mejores opciones para uso familiar son:\n\n**1. Toyota Corolla 2016–2017** — Lo más confiable. Reventa fuerte, repuestos accesibles. Buscalo en automático con menos de 80k km.\n\n**2. Honda Civic 2016** — Más deportivo, mismo rango. Ojo con las cajas CVT tempranas.\n\n**3. Volkswagen Vento 2018** — Subestimado, buena relación precio/equipamiento.\n\nEvitaría los Peugeot 408 y Renault Fluence en ese rango por costo de mantenimiento. ¿Alguno te interesa para profundizar?`
  },
  tasacion: {
    thinking: 'Cruzando con 180+ publicaciones equivalentes…',
    reply: `**Tasación del Ford Focus III 2015 Full con 95.000 km:**\n\n• Rango de mercado: **$9.8M–$11.2M**\n• Precio sugerido para vender rápido: **$10.5M**\n• Precio para esperar al comprador indicado: **$11.2M**\n\nEl mercado de Focus III está activo (80+ unidades publicadas). Con full equipamiento y service al día, $11M es razonable. Sin service documentado, no pidas más de $10M.\n\n¿Cuánto necesitás sacar para armar el cambio que tenés en mente?`
  }
}

function detectDemoKey(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('focus') || lower.includes('tasar') || lower.includes('vender') || lower.includes('cambiar')) return 'tasacion'
  if (lower.includes('presupuesto') || lower.includes('millones') || lower.includes('tengo $') || lower.includes('budget')) return 'presupuesto'
  if (lower.includes('corolla') || lower.includes('18.5') || lower.includes('caro') || lower.includes('precio')) return 'corolla'
  return 'default'
}

// ─── Mock listings for discover ───────────────────────────────────────────────

const MOCK_DISCOVER: BoardListing[] = [
  {
    id: 'd1', source: 'mercadolibre', source_listing_id: '1', title: 'Toyota Corolla XEI 2018 Automático',
    price: 16200000, currency: 'ARS', year: 2018, km: 62000, location: 'Buenos Aires', link: 'https://auto.mercadolibre.com.ar',
    image: null, brand: 'Toyota', model: 'Corolla', fuel: 'Nafta', traction: 'Delantera',
    transmission: 'Automática', raw: {}, created_at: Date.now(), updated_at: Date.now(),
    status: 'saved', notes: '', is_new: true, shortlisted: false, checklist: {},
    recomendado: true, _mercado: 'barato', titulo: 'Toyota Corolla XEI 2018 Automático', precio: 16200000, moneda: 'ARS',
    año: 2018, kilometros: 62000, ubicacion: 'Buenos Aires', fuente: 'MercadoLibre'
  },
  {
    id: 'd2', source: 'kavak', source_listing_id: '2', title: 'Honda Civic EXL 2019',
    price: 18900000, currency: 'ARS', year: 2019, km: 41000, location: 'Córdoba', link: 'https://kavak.com',
    image: null, brand: 'Honda', model: 'Civic', fuel: 'Nafta', traction: 'Delantera',
    transmission: 'CVT', raw: {}, created_at: Date.now(), updated_at: Date.now(),
    status: 'saved', notes: '', is_new: false, shortlisted: false, checklist: {},
    titulo: 'Honda Civic EXL 2019', precio: 18900000, moneda: 'ARS',
    año: 2019, kilometros: 41000, ubicacion: 'Córdoba', fuente: 'Kavak'
  },
  {
    id: 'd3', source: 'mercadolibre', source_listing_id: '3', title: 'Volkswagen Vento Highline 2017',
    price: 12800000, currency: 'ARS', year: 2017, km: 78000, location: 'Rosario', link: 'https://auto.mercadolibre.com.ar',
    image: null, brand: 'Volkswagen', model: 'Vento', fuel: 'Nafta', traction: 'Delantera',
    transmission: 'Automática', raw: {}, created_at: Date.now(), updated_at: Date.now(),
    status: 'saved', notes: '', is_new: false, shortlisted: false, checklist: {},
    titulo: 'Volkswagen Vento Highline 2017', precio: 12800000, moneda: 'ARS',
    año: 2017, kilometros: 78000, ubicacion: 'Rosario', fuente: 'MercadoLibre'
  },
  {
    id: 'd4', source: 'mercadolibre', source_listing_id: '4', title: 'Chevrolet Cruze LTZ 2018',
    price: 14200000, currency: 'ARS', year: 2018, km: 55000, location: 'Buenos Aires', link: '#',
    image: null, brand: 'Chevrolet', model: 'Cruze', fuel: 'Nafta', traction: 'Delantera',
    transmission: 'Automática', raw: {}, created_at: Date.now(), updated_at: Date.now(),
    status: 'saved', notes: '', is_new: true, shortlisted: false, checklist: {},
    _mercado: 'normal',
    titulo: 'Chevrolet Cruze LTZ 2018', precio: 14200000, moneda: 'ARS',
    año: 2018, kilometros: 55000, ubicacion: 'Buenos Aires', fuente: 'MercadoLibre'
  }
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function VerdictExample() {
  return (
    <div className="verdict-card">
      <div className="verdict-card-header">
        <span className="verdict-tag verdict-tag-caro">CARO</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Toyota Corolla XEI 2018 · $18.5M</span>
      </div>
      <div className="verdict-number">+$2.3M</div>
      <div className="verdict-label">por encima del mercado</div>
      <div className="verdict-bar-wrap">
        <div className="verdict-bar-track">
          <div className="verdict-bar-fill" style={{ width: '72%' }} />
          <div className="verdict-bar-marker" />
        </div>
        <div className="verdict-bar-labels">
          <span>Mínimo $14.8M</span>
          <span>Promedio $16.2M</span>
          <span>Este aviso $18.5M</span>
        </div>
      </div>
      <p className="verdict-suggestion">
        ✦ Encontré 4 unidades comparables entre $15.4M y $16.8M con menos kilómetros.
      </p>
    </div>
  )
}

function DemoAdvisor() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [thinkingText, setThinkingText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  async function sendMessage(text?: string) {
    const q = (text || input).trim()
    if (!q || thinking) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: q }])

    const key = detectDemoKey(q)
    const convo = DEMO_CONVOS[key]
    setThinking(true)
    setThinkingText(convo.thinking)

    await new Promise(r => setTimeout(r, 1400 + Math.random() * 600))
    setThinking(false)
    setMessages(m => [...m, { role: 'assistant', text: convo.reply }])
  }

  const DEMO_PROMPTS = [
    'Estoy mirando un Corolla XEI 2018 a $18.5M',
    'Tengo $20M, quiero auto familiar',
    'Tasame mi Ford Focus III 2015 con 95k km',
  ]

  return (
    <div className="demo-advisor">
      <div className="demo-advisor-header">
        <div className="demo-advisor-dot" />
        <span>Asesor IA · Demo en vivo</span>
        <span className="demo-advisor-badge">Sin registro</span>
      </div>

      <div className="demo-advisor-messages">
        {messages.length === 0 && (
          <div className="demo-advisor-empty">
            <p>Preguntame sobre cualquier auto o precio del mercado argentino.</p>
            <div className="demo-advisor-prompts">
              {DEMO_PROMPTS.map(p => (
                <button key={p} className="demo-prompt-btn" onClick={() => sendMessage(p)}>{p}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`demo-msg demo-msg-${m.role}`}>
            <MarkdownText text={m.text} />
          </div>
        ))}

        {thinking && (
          <div className="demo-msg demo-msg-assistant">
            <div className="demo-thinking">
              <span className="demo-thinking-text">{thinkingText}</span>
              <ThinkingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form className="demo-advisor-input" onSubmit={e => { e.preventDefault(); sendMessage() }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Preguntá cualquier cosa sobre el mercado de autos…"
          disabled={thinking}
        />
        <button type="submit" disabled={thinking || !input.trim()}>→</button>
      </form>
    </div>
  )
}

function MarkdownText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <p style={{ lineHeight: 1.65, fontSize: 13 }}>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return <strong key={i}>{p.slice(2, -2)}</strong>
        }
        return p.split('\n').map((line, j) => (
          <span key={j}>{line}{j < p.split('\n').length - 1 && <br />}</span>
        ))
      })}
    </p>
  )
}

function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', marginLeft: 6 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', opacity: 0.4, animation: `dot 1.2s ${i * 0.2}s infinite ease-in-out` }} />
      ))}
      <style>{`@keyframes dot { 0%,80%,100%{opacity:.2;transform:scale(.7)} 40%{opacity:1;transform:scale(1)} }`}</style>
    </span>
  )
}

// ─── Budget parser helpers ────────────────────────────────────────────────────

function parseMoneyInput(s: string): number {
  const clean = s.replace(/[$\s.]/g, '').replace(',', '.')
  const mMatch = clean.match(/^(\d+(?:\.\d+)?)[mM]$/)
  if (mMatch) return parseFloat(mMatch[1]) * 1_000_000
  const kMatch = clean.match(/^(\d+(?:\.\d+)?)[kK]$/)
  if (kMatch) return parseFloat(kMatch[1]) * 1_000
  const num = parseFloat(clean)
  if (isNaN(num)) return 0
  return num < 1_000 ? num * 1_000_000 : num
}

function formatM(n: number): string {
  if (n <= 0) return '—'
  const m = n / 1_000_000
  return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
}

// ─── TradeInSection ───────────────────────────────────────────────────────────

function TradeInSection({ onStart }: { onStart: (q: string) => void }) {
  const [tab, setTab] = useState<'saber' | 'tasar'>('saber')

  // "Ya sé" mode
  const [valorAuto, setValorAuto] = useState('')
  const [extraCash, setExtraCash] = useState('')
  const [autoSaber, setAutoSaber] = useState('')

  // "Tasar" mode
  const [auto, setAuto] = useState('')
  const [anio, setAnio] = useState('')
  const [km, setKm] = useState('')

  const valorNum = parseMoneyInput(valorAuto)
  const extraNum = parseMoneyInput(extraCash)
  const total = valorNum + extraNum

  function buildSaberQuery() {
    if (total <= 0) return
    const parts: string[] = []
    if (autoSaber.trim()) parts.push(`Tengo un ${autoSaber.trim()} que vale ${formatM(valorNum)}`)
    else if (valorNum > 0) parts.push(`Tengo un auto que vale ${formatM(valorNum)}`)
    if (extraNum > 0) parts.push(`y pongo ${formatM(extraNum)} más en efectivo`)
    parts.push(`Presupuesto total ${formatM(total)}. Buscame opciones en ese rango.`)
    onStart(parts.join(' '))
  }

  function buildTasarQuery() {
    if (!auto.trim()) return
    const parts = [`Tengo un ${auto.trim()}`]
    if (anio) parts.push(`del ${anio}`)
    if (km) parts.push(`con ${km} km`)
    parts.push('. Tasalo y decime qué puedo comprar con lo que saque.')
    onStart(parts.join(' '))
  }

  return (
    <div className="trade-in-section">
      <div className="trade-in-label">CAMBIO DE AUTO</div>
      <h3 className="trade-in-title">¿Cuánto tenés para gastar?</h3>

      <div className="trade-in-tabs">
        <button
          className={`trade-in-tab${tab === 'saber' ? ' active' : ''}`}
          onClick={() => setTab('saber')}
        >
          Ya sé cuánto vale mi auto
        </button>
        <button
          className={`trade-in-tab${tab === 'tasar' ? ' active' : ''}`}
          onClick={() => setTab('tasar')}
        >
          Necesito que lo tasen
        </button>
      </div>

      {tab === 'saber' ? (
        <div className="budget-calc-wrap">
          <p className="trade-in-sub">
            Sumamos lo que sacás por tu auto + lo que ponés encima y buscamos opciones en ese presupuesto total.
          </p>

          <div className="budget-calc">
            <div className="budget-item">
              <label className="budget-label">Mi auto vale</label>
              <div className="budget-input-wrap">
                <span className="budget-prefix">$</span>
                <input
                  className="budget-input"
                  value={valorAuto}
                  onChange={e => setValorAuto(e.target.value)}
                  placeholder="10M"
                  inputMode="decimal"
                />
              </div>
              {valorNum > 0 && <div className="budget-parsed">{formatM(valorNum)}</div>}
            </div>

            <div className="budget-op">+</div>

            <div className="budget-item">
              <label className="budget-label">Pongo encima</label>
              <div className="budget-input-wrap">
                <span className="budget-prefix">$</span>
                <input
                  className="budget-input"
                  value={extraCash}
                  onChange={e => setExtraCash(e.target.value)}
                  placeholder="5M"
                  inputMode="decimal"
                />
              </div>
              {extraNum > 0 && <div className="budget-parsed">{formatM(extraNum)}</div>}
            </div>

            <div className="budget-op">=</div>

            <div className="budget-item budget-item-total">
              <label className="budget-label">Total</label>
              <div className={`budget-total-value${total > 0 ? ' budget-total-active' : ''}`}>
                {formatM(total)}
              </div>
            </div>
          </div>

          <input
            className="budget-car-input"
            value={autoSaber}
            onChange={e => setAutoSaber(e.target.value)}
            placeholder="¿Qué auto tenés hoy? (opcional: Toyota Corolla 2017)"
          />

          <button
            className="btn btn-primary"
            onClick={buildSaberQuery}
            disabled={total <= 0}
          >
            {total > 0 ? `Buscar autos con ${formatM(total)} →` : 'Buscar autos →'}
          </button>
        </div>
      ) : (
        <div className="budget-calc-wrap">
          <p className="trade-in-sub">
            Ingresá los datos de tu auto y estimamos su valor de mercado para calcular tu presupuesto de cambio.
          </p>
          <div className="trade-in-form">
            <div className="trade-in-field trade-in-field-wide">
              <label>Auto actual</label>
              <input value={auto} onChange={e => setAuto(e.target.value)} placeholder="Ej: Ford Focus III Titanium 2015" />
            </div>
            <div className="trade-in-field">
              <label>Año</label>
              <input value={anio} onChange={e => setAnio(e.target.value)} placeholder="2015" />
            </div>
            <div className="trade-in-field">
              <label>Km aprox.</label>
              <input value={km} onChange={e => setKm(e.target.value)} placeholder="95000" />
            </div>
            <button className="btn btn-primary trade-in-btn" onClick={buildTasarQuery} disabled={!auto.trim()}>
              Tasar + sugerir →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

const STATS = [
  { value: '32%', label: 'de avisos están inflados >10%' },
  { value: '847', label: 'avisos analizados esta semana' },
  { value: '$2.1M', label: 'ahorro promedio que detectamos' },
  { value: '<30s', label: 'para tener un análisis completo' }
]

// ─── How it works ─────────────────────────────────────────────────────────────

const HOW_STEPS = [
  { num: '01', title: 'Contanos qué buscás', body: 'En tus palabras: modelo, presupuesto, uso. O pegá el link del aviso que estás mirando.' },
  { num: '02', title: 'Analizamos el mercado', body: 'Cruzamos con miles de publicaciones reales de MercadoLibre y otros portales para darte un precio de referencia.' },
  { num: '03', title: 'Te damos una respuesta honesta', body: 'Si el precio está bien, te lo decimos. Si está caro, también. Sin endulzar.' }
]

// ─── Main page ────────────────────────────────────────────────────────────────

type SearchMode = 'idle' | 'searching' | 'results' | 'error'

interface SearchResult {
  listings: BoardListing[]
  boardId?: string
  isAI?: boolean
  briefExplicacion?: string
}

export default function DescubrirPage() {
  const router = useRouter()
  const { mockMode, openAdvisor, loadBoards, showToast } = useAppStore()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('idle')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState('')
  const [searchStep, setSearchStep] = useState(0)

  const SEARCH_STEPS = [
    'Interpretando tu búsqueda…',
    'Consultando el mercado argentino…',
    'Buscando publicaciones en MercadoLibre…',
    'Analizando precios y modelos…',
    'Casi listo…',
  ]

  const doSearch = useCallback(async (q: string) => {
    setQuery(q)
    setMode('searching')
    setSearchStep(0)
    setError('')
    setResult(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })

    if (mockMode) {
      await new Promise(r => setTimeout(r, 1800))
      setResult({
        listings: MOCK_DISCOVER,
        isAI: true,
        briefExplicacion: 'Encontré 4 avisos que coinciden con tu búsqueda. El primero está por debajo del promedio de mercado — buen candidato.',
        boardId: 'mock-1'
      })
      setMode('results')
      return
    }

    // Rotate progress messages while waiting
    let step = 0
    const stepInterval = setInterval(() => {
      step = Math.min(step + 1, SEARCH_STEPS.length - 1)
      setSearchStep(step)
    }, 6000)

    // 45-second timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)

    try {
      const res = await fetch('/api/recommend-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: controller.signal
      })
      clearInterval(stepInterval)
      clearTimeout(timeout)

      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      const boardId: string | undefined = data.board?.id
      loadBoards()
      if (boardId) {
        if (data.used_mock_listings) {
          showToast('Portales sin resultados hoy — el asesor generó avisos de muestra para tu búsqueda', 'info')
        } else {
          showToast('Tablero creado. Redirigiendo…', 'info')
        }
        setTimeout(() => router.push(`/boards/${boardId}`), 900)
        return
      }
      setResult({ listings: data.board?.listings || [], isAI: true, briefExplicacion: data.advisor_brief?.explicacion })
      setMode('results')
    } catch (e: any) {
      clearInterval(stepInterval)
      clearTimeout(timeout)
      if (e.name === 'AbortError') {
        // Timeout: show mock results with a warning toast
        showToast('La búsqueda tardó demasiado — mostrando resultados de muestra', 'info')
        setResult({
          listings: MOCK_DISCOVER,
          isAI: false,
          briefExplicacion: `Para "${q}" — el servidor tardó demasiado. Estos son resultados de muestra. Intentá de nuevo o refiná la búsqueda.`
        })
        setMode('results')
      } else {
        setError(e.message || 'Error al buscar')
        setMode('error')
      }
    }
  }, [mockMode, router, loadBoards, showToast])

  const handleSearch = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    doSearch(q)
  }, [query, doSearch])

  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className="landing-hero">
        <div className="landing-hero-left">
          <div className="landing-eyebrow">EL GARAJE · ARGENTINA</div>
          <h1 className="landing-headline">
            ¿Estás a punto<br />
            de pagar de más?
          </h1>
          <p className="landing-sub">
            Analizamos miles de avisos reales del mercado para darte una respuesta honesta sobre el auto que estás mirando.
          </p>

          {mode === 'searching' ? (
            <div className="landing-searching">
              <div className="spinner" style={{ width: 20, height: 20, borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--primary)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{SEARCH_STEPS[searchStep]}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                  Esto puede demorar hasta 30 segundos
                </div>
              </div>
            </div>
          ) : mode === 'results' && result ? (
            <div className="landing-results-header">
              {result.briefExplicacion && (
                <div className="landing-brief">
                  <span style={{ color: 'var(--primary)', fontWeight: 800 }}>✦ </span>
                  {result.briefExplicacion}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {result.boardId && (
                  <button className="btn btn-yellow btn-sm" onClick={() => router.push(`/boards/${result.boardId}`)}>
                    Ver tablero completo →
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)' }} onClick={() => { setMode('idle'); setResult(null) }}>
                  Nueva búsqueda
                </button>
              </div>
            </div>
          ) : mode === 'error' ? (
            <div className="landing-error">
              <p>{error}</p>
              <button className="btn btn-ghost btn-sm" onClick={() => setMode('idle')}>Reintentar</button>
            </div>
          ) : (
            <>
              <form className="landing-search-form" onSubmit={handleSearch}>
                <input
                  className="landing-search-input"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Ej: quiero un auto familiar nafta hasta $20M…"
                />
                <button className="landing-search-btn" type="submit" disabled={!query.trim()}>
                  Buscar →
                </button>
              </form>

              <div className="landing-quick-btns">
                {[
                  { label: 'Familiar $20M', q: 'Auto familiar nafta hasta $20 millones, confiable y con buena reventa' },
                  { label: 'Primera vez, chico', q: 'Primer auto, presupuesto $8M, ciudad, que consuma poco' },
                  { label: 'SUV 2018+', q: 'SUV o crossover 2018 en adelante hasta $28 millones' },
                  { label: 'Cambio de auto', q: '' }
                ].map(s => (
                  <button key={s.label} className="landing-quick-btn"
                    onClick={() => s.q ? doSearch(s.q) : document.getElementById('trade-in')?.scrollIntoView({ behavior: 'smooth' })}>
                    {s.label}
                  </button>
                ))}
              </div>

              <button
                className="landing-advisor-link"
                onClick={() => openAdvisor()}
              >
                ✦ O charlá directo con el asesor
              </button>
            </>
          )}
        </div>

        <div className="landing-hero-right">
          <VerdictExample />
        </div>
      </div>

      {/* ── STATS STRIP ──────────────────────────────────────────────────── */}
      <div className="stats-strip">
        {STATS.map(s => (
          <div key={s.value} className="stat-item">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── RESULTS (when searching produced results) ─────────────────── */}
      {mode === 'results' && result && result.listings.length > 0 && (
        <div>
          <div className="section-header">
            <h2>Resultados de la búsqueda</h2>
            <span style={{ fontSize: 13, color: 'var(--mute)' }}>{result.listings.length} avisos</span>
          </div>
          <div className="catalog-grid">
            {result.listings.map(l => <Card key={l.id} listing={l} />)}
          </div>
        </div>
      )}

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      {mode === 'idle' && (
        <>
          <div className="how-section">
            <div className="section-label">CÓMO FUNCIONA</div>
            <div className="how-steps">
              {HOW_STEPS.map(s => (
                <div key={s.num} className="how-step">
                  <div className="how-step-num">{s.num}</div>
                  <h3 className="how-step-title">{s.title}</h3>
                  <p className="how-step-body">{s.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── DEMO ADVISOR ──────────────────────────────────────────────── */}
          <div className="demo-section">
            <div className="demo-section-inner">
              <div className="demo-section-copy">
                <div className="section-label" style={{ color: 'var(--primary)' }}>PROBALO AHORA</div>
                <h2 className="demo-section-title">
                  El asesor que<br />te faltaba
                </h2>
                <p className="demo-section-sub">
                  Preguntá sobre cualquier auto, modelo, o precio del mercado argentino. Sin registro. Sin BS.
                </p>
                <ul className="demo-features">
                  {[
                    '¿Está bien el precio de este aviso?',
                    '¿Cuánto vale mi auto para cambiar?',
                    '¿Qué modelos me convienen con $20M?',
                    '¿Qué le pregunto al vendedor?'
                  ].map(f => (
                    <li key={f}><span className="demo-check">✓</span> {f}</li>
                  ))}
                </ul>
              </div>
              <DemoAdvisor />
            </div>
          </div>

          {/* ── TRADE IN ─────────────────────────────────────────────────── */}
          <div id="trade-in">
            <TradeInSection onStart={doSearch} />
          </div>

          {/* ── RECENT LISTINGS ──────────────────────────────────────────── */}
          <div>
            <div className="section-header">
              <div>
                <div className="section-label">AVISOS DESTACADOS</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>Del mercado esta semana</h2>
              </div>
            </div>
            <div className="catalog-grid">
              {MOCK_DISCOVER.map(l => <Card key={l.id} listing={l} />)}
            </div>
          </div>

          {/* ── TESTIMONIALS ──────────────────────────────────────────────── */}
          <div className="testimonials-section">
            <div className="section-label">LO QUE DICEN</div>
            <div className="testimonials-grid">
              {[
                { name: 'Carlos M.', city: 'Córdoba', text: 'Estaba a punto de comprar un Civic $3M más caro de lo que debía. El asesor me frenó y me mostró alternativas. Un caño.' },
                { name: 'Silvina R.', city: 'Buenos Aires', text: 'Cambié mi Gol por un Cronos. La tasación fue exacta, el precio que puse en ML lo vendí en 3 días.' },
                { name: 'Matías L.', city: 'Rosario', text: 'Le pregunté por el Vento que estaba mirando y me dijo que estaba bien de precio. Compré tranquilo. Lleva 6 meses sin problemas.' }
              ].map(t => (
                <div key={t.name} className="testimonial-card">
                  <p className="testimonial-text">&ldquo;{t.text}&rdquo;</p>
                  <div className="testimonial-author">
                    <strong>{t.name}</strong>
                    <span>{t.city}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
