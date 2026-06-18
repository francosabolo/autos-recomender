'use client'
import { useState, useEffect } from 'react'
interface SettingsData {
  anthropicKeySet: boolean
  portals: { id: string; name: string; enabled: boolean; url?: string }[]
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const res = await fetch('/api/portals')
      const data = await res.json()
      setSettings({
        anthropicKeySet: Boolean(process.env.NEXT_PUBLIC_HAS_API_KEY),
        portals: (data.portals || []).map((p: any) => ({ id: p.id, name: p.name, enabled: p.enabled ?? true, url: p.url }))
      })
    } catch {
      setSettings({ anthropicKeySet: false, portals: [] })
    } finally {
      setLoading(false)
    }
  }

  async function handleTestConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Respond with just "OK" in one word.' }],
          contexto: {}
        })
      })
      const data = await res.json()
      if (data.ok && data.texto) {
        setTestResult({ ok: true, message: `Conexión exitosa. Respuesta: "${data.texto.slice(0, 60)}"` })
      } else {
        setTestResult({ ok: false, message: data.error || 'Error desconocido' })
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || 'No se pudo conectar' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto', width: 28, height: 28 }} />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>Configuración</h1>
        <p>Ajustá la API key, portales y preferencias de la app.</p>
      </div>

      <div style={{ maxWidth: 640, padding: '0 24px 48px' }}>

        {/* IA Section */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            Inteligencia Artificial
          </h2>

          <div style={{ marginTop: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mute)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ANTHROPIC_API_KEY
            </label>
            <p style={{ fontSize: 12, color: 'var(--charcoal)', marginBottom: 10, lineHeight: 1.5 }}>
              Necesaria para el asesor conversacional, búsqueda inteligente y análisis de avisos. Conseguí tu key en{' '}
              <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info)' }}>
                console.anthropic.com
              </a>
            </p>

            <div style={{ padding: '12px 16px', border: '1px solid var(--hairline)', background: 'var(--surface-soft)', marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: testResult?.ok ? 'var(--success)' : 'var(--ash)'
                }} />
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                  {testResult?.ok ? 'API conectada' : 'Estado desconocido'}
                </span>
              </div>
              {testResult && (
                <p style={{ fontSize: 12, marginTop: 6, color: testResult.ok ? 'var(--success)' : 'var(--error)' }}>
                  {testResult.message}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? 'Probando…' : 'Probar conexión'}
              </button>
            </div>

            <div style={{ marginTop: 20, padding: '12px 16px', border: '1px solid var(--hairline)', background: 'var(--surface-soft)', fontSize: 12, color: 'var(--body-color)', lineHeight: 1.6 }}>
              <strong>Para configurar la API key:</strong>
              <ol style={{ marginTop: 8, marginLeft: 20, lineHeight: 1.8 }}>
                <li>Creá el archivo <code style={{ background: 'var(--hairline)', padding: '1px 4px', fontFamily: 'monospace' }}>.env.local</code> en la raíz del proyecto.</li>
                <li>Agregá: <code style={{ background: 'var(--hairline)', padding: '1px 4px', fontFamily: 'monospace' }}>ANTHROPIC_API_KEY=sk-ant-...</code></li>
                <li>Reiniciá el servidor de desarrollo (<code style={{ background: 'var(--hairline)', padding: '1px 4px', fontFamily: 'monospace' }}>npm run dev</code>).</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Portals */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            Portales de búsqueda
          </h2>
          <p style={{ fontSize: 12, color: 'var(--charcoal)', marginTop: 12, marginBottom: 16, lineHeight: 1.5 }}>
            El asesor busca avisos en estos portales cuando analizás el mercado.
          </p>

          {settings?.portals.length === 0 ? (
            <div style={{ padding: '16px', border: '1px solid var(--hairline)', fontSize: 13, color: 'var(--mute)', textAlign: 'center' }}>
              No hay portales configurados.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--hairline)' }}>
              {settings?.portals.map((p, i) => (
                <div key={p.id} style={{
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                  borderBottom: i < (settings.portals.length - 1) ? '1px solid var(--hairline)' : 'none'
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: p.enabled ? 'var(--success)' : 'var(--stone)'
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</div>
                    {p.url && <div style={{ fontSize: 11, color: 'var(--mute)' }}>{p.url}</div>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: p.enabled ? 'var(--success)' : 'var(--mute)' }}>
                    {p.enabled ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* DB / Storage */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            Almacenamiento
          </h2>
          <div style={{ marginTop: 16, padding: '12px 16px', border: '1px solid var(--hairline)', background: 'var(--surface-soft)', fontSize: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>SQLite local</div>
            <p style={{ color: 'var(--charcoal)', lineHeight: 1.5 }}>
              Tableros, avisos y conversaciones se guardan localmente en <code style={{ background: 'var(--hairline)', padding: '1px 4px', fontFamily: 'monospace' }}>garaje.db</code>.
              Los datos persisten entre sesiones.
            </p>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            Acerca de
          </h2>
          <div style={{ marginTop: 16, fontSize: 13, color: 'var(--body-color)', lineHeight: 1.7 }}>
            <p><strong>El Garaje</strong> · MVP v1.0</p>
            <p style={{ marginTop: 4 }}>Asesor conversacional de compra de autos para el mercado argentino.</p>
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--mute)' }}>
              Stack: Next.js 15 · TypeScript · SQLite · Claude Sonnet · MercadoLibre scraper
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
