'use client'
import { useRef, useEffect, useState, FormEvent } from 'react'
import { useAppStore } from '@/store/useAppStore'
import type { AdvisorCard } from '@/types'

const QUICK_PROMPTS_DEFAULT = [
  '¿Qué debo revisar antes de comprar?',
  '¿Cómo negocio el precio?',
  '¿Qué documentación pido?'
]

export function AdvisorDock() {
  const { advisor, advisorContext, closeAdvisor, sendAdvisorMessage, resetAdvisor } = useAppStore()
  const [input, setInput] = useState('')
  const messagesEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [advisor.messages])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || advisor.sending) return
    setInput('')
    await sendAdvisorMessage(text)
  }

  const hasContext = Boolean(advisorContext.boardId)
  const contextListingsCount = advisorContext.listings?.length || 0

  const quickPrompts = hasContext ? [
    `¿Cuál de los ${contextListingsCount} avisos te parece el mejor?`,
    '¿Están bien los precios para el mercado actual?',
    '¿Qué le pregunto al vendedor antes de ver el auto?',
    'Ayudame a preparar la negociación'
  ] : QUICK_PROMPTS_DEFAULT

  return (
    <>
      {advisor.open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199 }}
          onClick={closeAdvisor}
        />
      )}
      <aside className={`advisor-dock ${advisor.open ? 'open' : ''}`}>
        {/* Header */}
        <div className="advisor-dock-header">
          <SparkIcon />
          <div style={{ flex: 1 }}>
            <div className="advisor-dock-title">Asesor IA</div>
            {hasContext && (
              <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 1, fontWeight: 500 }}>
                Contexto: {advisorContext.boardName || 'Tablero activo'} · {contextListingsCount} avisos
              </div>
            )}
          </div>
          <button
            onClick={resetAdvisor}
            style={{ fontSize: 11, color: 'var(--mute)', fontWeight: 600, padding: '2px 8px', border: '1px solid var(--hairline)', cursor: 'pointer', background: 'none', fontFamily: 'inherit' }}
            title="Nueva sesión"
          >
            Reiniciar
          </button>
          <button
            onClick={closeAdvisor}
            style={{ marginLeft: 4, color: 'var(--ash)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 6px' }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="advisor-dock-messages">
          {advisor.messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--mute)' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>✦</div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                {hasContext ? `Analizando "${advisorContext.boardName}"` : 'Asesor IA de compra'}
              </p>
              <p style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 16 }}>
                {hasContext
                  ? `Tengo ${contextListingsCount} avisos cargados. Preguntame lo que quieras sobre esta búsqueda.`
                  : 'Preguntame qué auto te conviene, cómo negociar, qué revisar, o pedime que analice tus tableros.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {quickPrompts.map(s => (
                  <button
                    key={s}
                    onClick={() => { setInput(s) }}
                    style={{
                      background: 'var(--surface-soft)', border: '1px solid var(--hairline)',
                      padding: '7px 10px', fontSize: 12, color: 'var(--charcoal)', cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'inherit', transition: 'border-color 0.12s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ink)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--hairline)')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {advisor.messages.map((msg, i) => (
            <div key={i} className={`advisor-msg advisor-msg-${msg.role}`}>
              <div className="advisor-msg-bubble">{msg.content}</div>
              {msg.cards && msg.cards.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {msg.cards.map((card, ci) => (
                    <MiniCard key={ci} card={card} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {advisor.sending && (
            <div className="advisor-msg advisor-msg-assistant">
              <div className="advisor-msg-bubble" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <ThinkingDots />
              </div>
            </div>
          )}

          <div ref={messagesEnd} />
        </div>

        {/* Input */}
        <form className="advisor-dock-input" onSubmit={handleSubmit}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={hasContext ? `Preguntá sobre ${advisorContext.boardName || 'estos avisos'}…` : 'Preguntá algo…'}
            disabled={advisor.sending}
            autoComplete="off"
          />
          <button type="submit" disabled={advisor.sending || !input.trim()}>
            →
          </button>
        </form>
      </aside>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiniCard({ card }: { card: AdvisorCard }) {
  return (
    <a
      href={card.link || '#'}
      target="_blank"
      rel="noopener noreferrer"
      style={{ border: '1px solid var(--hairline)', padding: '8px 10px', fontSize: 11, display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--surface-soft)', textDecoration: 'none', color: 'inherit' }}
    >
      {card.imagen && (
        <img src={card.imagen} alt="" style={{ width: 48, height: 36, objectFit: 'cover', flexShrink: 0 }} />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.titulo || card.tipo || 'Auto'}
        </div>
        {card.precio && (
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', marginTop: 1 }}>
            ${card.precio.toLocaleString('es-AR')}
          </div>
        )}
        {(card.fuente || card.link) && (
          <div style={{ fontSize: 10, color: 'var(--info)', marginTop: 1 }}>
            {card.fuente || 'Ver anuncio →'}
          </div>
        )}
      </div>
    </a>
  )
}

function ThinkingDots() {
  return (
    <span style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--stone)',
            animation: `dot 1.2s ${i * 0.2}s infinite ease-in-out`
          }}
        />
      ))}
      <style>{`@keyframes dot { 0%,80%,100%{opacity:.3;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }`}</style>
    </span>
  )
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--primary)" style={{ flexShrink: 0 }}>
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z"/>
    </svg>
  )
}
