export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { getBoardById, createBoard, saveListingsToBoard } from '@/lib/db.js'
import { parsePinListingRequest } from '@/lib/validation.js'
import { logger } from '@/lib/logger.js'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = parsePinListingRequest(body)
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] pin validación fallida')
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  }

  try {
    const { boardId, boardName, listing } = parsed.data
    let board: any = boardId ? getBoardById(boardId) : null
    if (boardId && !board) return NextResponse.json({ ok: false, error: 'Tablero no encontrado' }, { status: 404 })
    if (!board) board = createBoard({ name: boardName, filters: {} })

    const { ids: [listingId] } = saveListingsToBoard(board.id, [listing])
    const hydrated = getBoardById(board.id)
    return NextResponse.json({ ok: true, board: hydrated, listingId }, { status: 201 })
  } catch (e: any) {
    logger.error({ err: e.message, stack: e.stack }, '[api] pin error')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
