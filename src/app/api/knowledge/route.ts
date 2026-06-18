export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { getKnowledge, saveKnowledge } from '@/lib/db.js'
import { getCuratedKnowledge } from '@/lib/knowledge.js'
import { hasLlmKey } from '@/lib/llm-client.js'
import { logger } from '@/lib/logger.js'

export function GET(req: NextRequest) {
  const marca = req.nextUrl.searchParams.get('marca') || ''
  const modelo = (req.nextUrl.searchParams.get('modelo') || '').trim()
  if (!modelo) return NextResponse.json({ ok: false, error: 'Falta el modelo.' }, { status: 400 })

  try {
    const cached = getKnowledge(marca, modelo)
    if (cached) return NextResponse.json({ ok: true, knowledge: cached.content, source: cached.source, updated_at: cached.updated_at, cached: true })
    const curated = getCuratedKnowledge(marca, modelo)
    if (curated) return NextResponse.json({ ok: true, knowledge: curated, source: 'curated', cached: false })
    return NextResponse.json({ ok: true, knowledge: null })
  } catch (e: any) {
    logger.error({ err: e.message }, '[api] knowledge get')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const marca = (body.marca || '').toString().trim()
  const modelo = (body.modelo || '').toString().trim()
  if (!modelo) return NextResponse.json({ ok: false, error: 'Falta el modelo.' }, { status: 400 })

  try {
    if (hasLlmKey()) {
      const { generarConocimientoModelo } = await import('@/lib/llm.js')
      const content = await generarConocimientoModelo({ marca, modelo })
      const saved = saveKnowledge({ marca, modelo, content, source: 'ai' }) as any
      return NextResponse.json({ ok: true, knowledge: saved?.content, source: 'ai', updated_at: saved?.updated_at })
    }
    const curated = getCuratedKnowledge(marca, modelo)
    if (curated) {
      const saved = saveKnowledge({ marca, modelo, content: curated, source: 'curated' }) as any
      return NextResponse.json({ ok: true, knowledge: saved?.content, source: 'curated', updated_at: saved?.updated_at })
    }
    return NextResponse.json({ ok: false, error: 'Para generar la ficha necesitás configurar CURSOR_API_KEY o ANTHROPIC_API_KEY.' }, { status: 400 })
  } catch (e: any) {
    logger.error({ err: e.message, marca, modelo }, '[api] knowledge generate')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
