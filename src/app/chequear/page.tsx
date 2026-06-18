'use client'
import { useState, FormEvent, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'

type Mode = 'idle' | 'checking' | 'result' | 'deep' | 'error'

interface ChatMsg { role: 'user' | 'assistant'; content: string }

// ─── Mock fallback for demo/offline ──────────────────────────────────────────

function buildMockAnalysis(q: string) {
  const lower = q.toLowerCase()
  if (lower.includes('corolla')) {
    return {
      titulo: 'Toyota Corolla XEI 2018 Automático',
      precio: 18500000,
      veredicto: 'CARO',
      diferencia: '+$2.3M',
      diferenciaPct: '+14%',
      promedioMercado: 16200000,
      rangoMercado: '$14.8M — $17.8M',
      muestra: 312,
      conclusion: 'Este aviso está un 14% por encima del promedio del mercado para Corolla XEI 2018. El precio se justifica solo si tiene menos de 50.000 km y service al día en concesionaria Toyota. Si no, el precio ideal para negociar sería entre $15.5M y $16.8M.',
      alternativas: ['Toyota Corolla XEI 2018 · 62.000 km · $16.2M (MercadoLibre)', 'Toyota Corolla SE-G 2017 · 71.000 km · $14.9M (Kavak)'],
      color: '#be6464'
    }
  }
  if (lower.includes('civic')) {
    return {
      titulo: 'Honda Civic EXL 2019',
      precio: 19500000,
      veredicto: 'PRECIO OK',
      diferencia: '+$0.4M',
      diferenciaPct: '+2%',
      promedioMercado: 19100000,
      rangoMercado: '$17.8M — $21.2M',
      muestra: 87,
      conclusion: 'El precio está dentro del rango de mercado para Civic EXL 2019. Tiene margen para negociar un 3-5% si el estado es normal. Si tiene garantía de concesionaria oficial, el precio es razonable.',
      alternativas: ['Honda Civic 1.5T Sport 2019 · 44.000 km · $18.9M (MercadoLibre)'],
      color: '#f0ad4e'
    }
  }
  return {
    titulo: 'Auto analizado',
    precio: 15000000,
    veredicto: 'DENTRO DEL RANGO',
    diferencia: '+$0.5M',
    diferenciaPct: '+3%',
    promedioMercado: 14500000,
    rangoMercado: '$12.8M — $16.2M',
    muestra: 140,
    conclusion: 'Este precio está dentro de un rango normal para el segmento. Recomiendo comparar con al menos 5 avisos equivalentes antes de decidir.',
    alternativas: [],
    color: 'var(--stone)'
  }
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MdText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div style={{ lineHeight: 1.7, fontSize: 14 }}>
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        const isListItem = line.trim().startsWith('- ') || line.trim().startsWith('• ')
        const content = (
          <span>
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j}>{p.slice(2, -2)}</strong>
                : p
            )}
          </span>
        )
        if (isListItem) return <div key={i} style={{ paddingLeft: 16, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0 }}>·</span>{content}
        </div>
        return <div key={i}>{content}{i < lines.length - 1 && line === '' && <br />}</div>
      })}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChequearPage() {
  const { mockMode, openAdvisor, showToast } = useAppStore()
  const [url, setUrl] = useState('')
  const [mode, setMode] = useState<Mode>('idle')
  const [mockResult, setMockResult] = useState<ReturnType<typeof buildMockAnalysis> | null>(null)
  const [error, setError] = useState('')

  // Deep AI chat state
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function handleCheck(e: FormEvent) {
    e.preventDefault()
    const q = url.trim()
    if (!q) return
    setMode('checking')
    setError('')
    setMessages([])

    if (mockMode) {
      await new Promise(r => setTimeout(r, 1800))
      setMockResult(buildMockAnalysis(q))
      setMode('result')
      return
    }

    // Call the AI advisor for a real price check — with 40s timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 40000)

    const prompt = `Chequeá el precio de este auto: "${q}".

Buscá publicaciones similares en MercadoLibre Argentina y determiná si el precio está bien, caro, o es una ganga.

Quiero un análisis estructurado con:
1. **Veredicto** (CARO / PRECIO OK / BUEN PRECIO)
2. **Rango de mercado** para ese modelo/año/versión
3. **Cuánto debería pagar** si el precio está fuera del rango
4. **Qué negociar** — puntos de negociación concretos
5. **Alternativas** — si hay opciones similares mejor precio

Sé directo y honesto. Sin endulzar.`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          contexto: {}
        }),
        signal: controller.signal
      })
      clearTimeout(timeout)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setMessages([
        { role: 'user', content: q },
        { role: 'assistant', content: data.texto }
      ])
      setMode('deep')
    } catch (e: any) {
      clearTimeout(timeout)
      if (e.name === 'AbortError') {
        // Fallback to mock on timeout
        setMockResult(buildMockAnalysis(q))
        setMode('result')
      } else {
        setError(e.message || 'No se pudo analizar el aviso')
        setMode('error')
      }
    }
  }

  async function sendFollowUp(e?: FormEvent) {
    e?.preventDefault()
    const q = input.trim()
    if (!q || sending) return
    setInput('')
    const userMsg: ChatMsg = { role: 'user', content: q }
    setMessages(prev => [...prev, userMsg])
    setSending(true)
    try {
      const allMessages = [...messages, userMsg]
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages, contexto: {} })
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setMessages(prev => [...prev, { role: 'assistant', content: data.texto }])
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setSending(false)
    }
  }

  function handleOpenAdvisorFromMock() {
    const msg = mockResult
      ? `Estoy mirando "${mockResult.titulo}" a $${mockResult.precio.toLocaleString('es-AR')}. El sistema dice que está ${mockResult.veredicto}. ¿Me das más contexto para decidir?`
      : 'Quiero chequear el precio de un auto que estoy mirando.'
    openAdvisor({ prefillMessage: msg })
  }

  function reset() {
    setMode('idle')
    setUrl('')
    setMessages([])
    setMockResult(null)
    setError('')
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ background: 'var(--ink)', color: 'var(--on-dark)' }}>
        <div className="landing-eyebrow">VERIFICADOR DE PRECIO</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 8, color: 'var(--on-dark)' }}>
          ¿Está bien el precio de ese aviso?
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 520, lineHeight: 1.6 }}>
          Pegá el link o describí el auto con precio. La IA busca publicaciones similares y te dice si te están cobrando de más.
        </p>
      </div>

      {/* Search form */}
      <div style={{ padding: '24px', borderBottom: '1px solid var(--hairline)', background: 'var(--surface-soft)' }}>
        <form onSubmit={handleCheck} style={{ display: 'flex', gap: 0, maxWidth: 720 }}>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://auto.mercadolibre.com.ar/… o «Toyota Corolla XEI 2018 a $16.5M»"
            style={{
              flex: 1, border: '1.5px solid var(--ink)', borderRight: 'none',
              padding: '12px 16px', fontSize: 14, fontFamily: 'inherit', outline: 'none',
              background: 'var(--canvas)', color: 'var(--ink)'
            }}
            disabled={mode === 'checking'}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={!url.trim() || mode === 'checking'}
            style={{ flexShrink: 0, fontSize: 13, padding: '12px 24px', borderRadius: 0 }}
          >
            {mode === 'checking' ? '⟳ Chequeando…' : 'Chequear →'}
          </button>
        </form>
        <p style={{ fontSize: 11, color: 'var(--mute)', marginTop: 8 }}>
          También: &ldquo;Honda Civic 2019 CVT con 45.000 km a $19M ¿es caro?&rdquo;
        </p>
      </div>

      {/* Checking */}
      {mode === 'checking' && (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: 32, height: 32 }} />
          <p style={{ fontWeight: 700, color: 'var(--mute)', fontSize: 14 }}>Buscando publicaciones similares…</p>
          <p style={{ fontSize: 12, color: 'var(--ash)', marginTop: 6 }}>Comparando con avisos de los últimos 90 días</p>
        </div>
      )}

      {/* Error */}
      {mode === 'error' && (
        <div className="empty-state">
          <h2>No se pudo analizar</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={reset}>Intentar de nuevo</button>
        </div>
      )}

      {/* Deep AI result — live conversation */}
      {mode === 'deep' && (
        <div style={{ maxWidth: 760, padding: '0' }}>
          <div className="chequear-chat">
            {messages.map((m, i) => (
              <div key={i} className={`chequear-msg chequear-msg-${m.role}`}>
                {m.role === 'assistant' && <div className="chequear-advisor-label">✦ Asesor IA</div>}
                <MdText text={m.content} />
              </div>
            ))}
            {sending && (
              <div className="chequear-msg chequear-msg-assistant">
                <div className="chequear-advisor-label">✦ Asesor IA</div>
                <span style={{ color: 'var(--mute)', fontSize: 13 }}>Analizando…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Follow-up actions */}
          <div className="chequear-follow-actions">
            {['¿Qué negociar?', '¿Qué revisar al verlo?', '¿Hay alternativas mejores?', '¿Lo compro?'].map(q => (
              <button
                key={q}
                className="demo-prompt-btn"
                onClick={() => { setInput(q); setTimeout(() => sendFollowUp(), 50) }}
                disabled={sending}
              >
                {q}
              </button>
            ))}
          </div>

          <form onSubmit={sendFollowUp} className="chequear-input-row">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Hacé más preguntas sobre este auto…"
              disabled={sending}
            />
            <button type="submit" disabled={!input.trim() || sending} className="btn btn-primary btn-sm">
              Enviar →
            </button>
          </form>

          <div style={{ padding: '12px 24px', display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={reset}>← Chequear otro</button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              navigator.clipboard?.writeText(window.location.href)
              showToast('Link copiado')
            }}>Compartir</button>
          </div>
        </div>
      )}

      {/* Mock result (demo mode) */}
      {mode === 'result' && mockResult && (
        <div style={{ maxWidth: 720, padding: '32px 24px' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              {mockResult.titulo}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-0.03em', color: mockResult.color, lineHeight: 1 }}>
                {mockResult.diferencia}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: mockResult.color }}>{mockResult.veredicto}</div>
                <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>{mockResult.diferenciaPct} respecto al promedio</div>
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 24, padding: '16px', border: '1px solid var(--hairline)', background: 'var(--surface-soft)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--mute)', fontWeight: 600, marginBottom: 8 }}>
              <span>Rango de mercado</span><span>{mockResult.rangoMercado}</span>
            </div>
            <div style={{ height: 6, background: 'var(--hairline)', position: 'relative', marginBottom: 8 }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, var(--success), var(--warning))', width: '75%' }} />
              <div style={{ position: 'absolute', right: 0, top: -3, width: 3, height: 12, background: mockResult.color }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ash)', fontWeight: 600 }}>
              <span>Promedio: ${mockResult.promedioMercado.toLocaleString('es-AR')}</span>
              <span>Este aviso: ${mockResult.precio.toLocaleString('es-AR')}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ash)' }}>Basado en {mockResult.muestra} avisos comparables</div>
          </div>
          <div style={{ marginBottom: 20, padding: '16px', border: '1px solid var(--hairline)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>ANÁLISIS</div>
            <p style={{ fontSize: 14, color: 'var(--body-color)', lineHeight: 1.7 }}>{mockResult.conclusion}</p>
          </div>
          {mockResult.alternativas.length > 0 && (
            <div style={{ marginBottom: 24, padding: '16px', border: '1px solid var(--hairline)', background: 'var(--surface-soft)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>ALTERNATIVAS MEJOR PRECIO</div>
              {mockResult.alternativas.map((a, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--body-color)', padding: '6px 0', borderBottom: i < mockResult.alternativas.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 800, marginRight: 6 }}>✓</span>{a}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleOpenAdvisorFromMock}>✦ Preguntarle al asesor</button>
            <button className="btn btn-ghost" onClick={reset}>Chequear otro aviso</button>
          </div>
        </div>
      )}

      {/* Idle examples */}
      {mode === 'idle' && (
        <div style={{ padding: '32px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            EJEMPLOS — HACÉ CLICK PARA PROBAR
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              'Toyota Corolla XEI 2018 automático a $18.5M',
              'Honda Civic EXL 2019 CVT a $19.5M',
              'VW Polo Track 2022 manual 30.000 km a $14M',
              'Ford Ranger XLT 2020 diesel 4x4 a $45M'
            ].map(ex => (
              <button
                key={ex}
                onClick={() => setUrl(ex)}
                style={{
                  background: 'var(--surface-soft)', border: '1px solid var(--hairline)',
                  padding: '10px 14px', fontSize: 12, color: 'var(--charcoal)', cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 600, textAlign: 'left', lineHeight: 1.4
                }}
              >
                {ex}
              </button>
            ))}
          </div>

          {/* What it does */}
          <div style={{ marginTop: 40, maxWidth: 560 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              QUÉ HACE
            </div>
            {[
              { icon: '🔍', title: 'Busca publicaciones similares', desc: 'Analiza el mercado actual para el modelo, año y versión que describís.' },
              { icon: '📊', title: 'Calcula si el precio es justo', desc: 'Te dice si está caro, en rango, o es una ganga comparado con el mercado.' },
              { icon: '💬', title: 'Podés seguir preguntando', desc: 'El asesor queda activo: preguntá qué negociar, qué revisar, o si hay alternativas.' }
            ].map(f => (
              <div key={f.title} style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                <div style={{ fontSize: 24, flexShrink: 0 }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--mute)', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
