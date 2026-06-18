export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionById } from '@/lib/db.js'
import { logger } from '@/lib/logger.js'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const session = getSessionById(id)
    if (!session) return NextResponse.json({ ok: false, error: 'Sesión no encontrada' }, { status: 404 })
    return NextResponse.json({ ok: true, session })
  } catch (e: any) {
    logger.error({ err: e.message, id }, '[api] get session')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
