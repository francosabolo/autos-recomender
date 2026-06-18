export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { markBoardListingsSeen } from '@/lib/db.js'
import { logger } from '@/lib/logger.js'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const board = markBoardListingsSeen(id)
    if (!board) return NextResponse.json({ ok: false, error: 'Tablero no encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true, board })
  } catch (e: any) {
    logger.error({ err: e.message, id }, '[api] board seen')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
