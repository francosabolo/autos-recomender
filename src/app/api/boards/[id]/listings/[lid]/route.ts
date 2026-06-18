export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { updateBoardListingStatus } from '@/lib/db.js'
import { parseUpdateListingRequest } from '@/lib/validation.js'
import { hydrateBoardCatalog } from '@/app/api/_lib/helpers'
import { logger } from '@/lib/logger.js'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lid: string }> }
) {
  const { id: boardId, lid: listingId } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = parseUpdateListingRequest(body)
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] listing validación fallida')
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  }

  try {
    const board = updateBoardListingStatus({ boardId, listingId, ...parsed.data })
    if (!board) return NextResponse.json({ ok: false, error: 'Anuncio no encontrado en el tablero' }, { status: 404 })
    return NextResponse.json({ ok: true, board: await hydrateBoardCatalog(board) })
  } catch (e: any) {
    logger.error({ err: e.message, boardId, listingId }, '[api] update listing')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
