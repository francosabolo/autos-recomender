'use client'
import type { AdvisorBrief } from '@/types'

interface BriefPaneProps {
  brief: AdvisorBrief | null | undefined
  onOpenAdvisor?: () => void
}

export function BriefPane({ brief, onOpenAdvisor }: BriefPaneProps) {
  if (!brief) {
    return (
      <div className="empty-state">
        <h2>Sin análisis IA</h2>
        <p>Esta búsqueda no fue creada con asistente IA. Usá la búsqueda inteligente para obtener un análisis completo.</p>
        {onOpenAdvisor && (
          <button className="btn btn-primary" onClick={onOpenAdvisor}>✦ Hablar con el asesor</button>
        )}
      </div>
    )
  }

  const { explicacion, modelos_recomendados = [], evitar = [], criterios = [] } = brief

  return (
    <div className="brief-panel">
      {/* Explicación */}
      {explicacion && (
        <div className="brief-section">
          <div className="brief-section-title">Análisis del asesor</div>
          <p style={{ fontSize: 14, color: 'var(--body-color)', lineHeight: 1.6 }}>{explicacion}</p>
        </div>
      )}

      {/* Modelos recomendados */}
      {modelos_recomendados.length > 0 && (
        <div className="brief-section">
          <div className="brief-section-title">Modelos recomendados</div>
          {modelos_recomendados.map((m, i) => (
            <div key={i} className="brief-model-card">
              <div className="brief-model-name">
                {m.marca} {m.modelo}
                {m.anio_desde && ` · ${m.anio_desde}${m.anio_hasta ? `–${m.anio_hasta}` : '+'}`}
              </div>
              {m.version && (
                <div style={{ fontSize: 12, color: 'var(--ash)', marginTop: 2, fontWeight: 600 }}>
                  {m.version}
                </div>
              )}
              {m.motivo && <div className="brief-model-reason">{m.motivo}</div>}

              {/* Catalog info */}
              {m.catalog && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
                  {m.catalog.resumen && (
                    <p style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.5 }}>{m.catalog.resumen}</p>
                  )}
                  {m.catalog.precio_orientativo_usado && (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Precio orientativo: </span>
                      <span style={{ color: 'var(--charcoal)' }}>{m.catalog.precio_orientativo_usado}</span>
                    </div>
                  )}
                  {m.catalog.distribucion_resumen && (
                    <div style={{ marginTop: 4, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Motor: </span>
                      <span style={{ color: 'var(--charcoal)' }}>{m.catalog.distribucion_resumen}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Criterios */}
      {criterios.length > 0 && (
        <div className="brief-section">
          <div className="brief-section-title">Qué revisar al ver el auto</div>
          <ul className="brief-list">
            {criterios.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      {/* Evitar */}
      {evitar.length > 0 && (
        <div className="brief-section">
          <div className="brief-section-title">Versiones / situaciones a evitar</div>
          <ul className="brief-list" style={{ '--list-color': 'var(--error)' } as React.CSSProperties}>
            {evitar.map((e, i) => (
              <li key={i} style={{ color: 'var(--error)' }}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {/* Open advisor CTA */}
      {onOpenAdvisor && (
        <div className="brief-section" style={{ background: 'var(--ink)', padding: '16px 20px', border: 'none' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 12, lineHeight: 1.5 }}>
            ¿Tenés preguntas sobre este análisis o sobre los avisos? Hablá con el asesor para profundizar.
          </p>
          <button className="btn btn-yellow" onClick={onOpenAdvisor} style={{ fontSize: 13 }}>
            ✦ Preguntar al asesor →
          </button>
        </div>
      )}
    </div>
  )
}
