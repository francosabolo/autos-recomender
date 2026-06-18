export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { saveSessionMessages } from '@/lib/db.js'
import { analyzeAdvisorQuery, cardsFromAnalisis } from '@/lib/advisor-query.js'
import { parseChatRequest } from '@/lib/validation.js'
import { logger } from '@/lib/logger.js'

const MOCK_MODE = process.env.MOCK_MODE === 'true'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = parseChatRequest(body)
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] validación fallida')
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  }

  const data = (parsed as any).data
  const { messages, contexto, sessionId } = data
  const ctx: any = { ...(contexto ?? {}) }
  const lastUser = [...messages].reverse().find((m: any) => m.role === 'user')

  const catalogs = Array.isArray(ctx.catalogs)
    ? ctx.catalogs
    : (ctx.advisor_brief?.modelos_recomendados || []).map((m: any) => m.catalog || m.ficha).filter((c: any) => c?.generaciones?.length)

  if (lastUser?.content && Array.isArray(ctx.listings) && ctx.listings.length) {
    ctx.analisisTablero = analyzeAdvisorQuery(lastUser.content, ctx.listings, catalogs, ctx.advisor_brief || null)
  }

  const t0 = Date.now()
  let texto: string
  let cards: any[]

  if (MOCK_MODE) {
    const { fallbackChat } = await import('@/lib/fallback-advisor.js')
    const fb = fallbackChat({ messages, contexto: ctx })
    texto = fb.texto
    cards = cardsFromAnalisis(ctx.analisisTablero)
    logger.info({ duration_ms: Date.now() - t0 }, '[api] chat mock ok')
  } else {
    try {
      const { chat } = await import('@/lib/llm.js')
      const result = await chat({ messages, contexto: ctx })
      texto = result.texto
      cards = result.cards?.length ? result.cards : cardsFromAnalisis(ctx.analisisTablero)
      logger.info({ duration_ms: Date.now() - t0, cards: cards.length, messages: messages.length, sessionId: sessionId || null }, '[api] ok')
    } catch (e: any) {
      logger.warn({ err: e.message }, '[api] chat fallback de último recurso')
      const { fallbackChat } = await import('@/lib/fallback-advisor.js')
      const fb = fallbackChat({ messages, contexto: ctx })
      texto = fb.texto
      cards = cardsFromAnalisis(ctx.analisisTablero)
    }
  }

  if (sessionId) {
    try {
      const fullMessages = [...messages, { role: 'assistant', content: texto, cards }]
      saveSessionMessages(sessionId, ctx, fullMessages)
    } catch (err: any) {
      logger.error({ err: err.message, sessionId }, '[api] guardar sesión falló')
    }
  }

  return NextResponse.json({
    ok: true,
    texto,
    cards,
    filtros: ctx.analisisTablero?.filtros || null,
    analisis: ctx.analisisTablero
      ? { mode: ctx.analisisTablero.mode, resumen: ctx.analisisTablero.resumen, modelosDestacados: ctx.analisisTablero.modelosDestacados, destacados: ctx.analisisTablero.destacados, caros: ctx.analisisTablero.caros, baratos: ctx.analisisTablero.baratos }
      : null
  })
}
