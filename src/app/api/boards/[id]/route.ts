export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { getBoardById, updateBoard, getDb } from '@/lib/db.js'
import { parseUpdateBoardRequest } from '@/lib/validation.js'
import { hydrateBoardCatalog } from '@/app/api/_lib/helpers'
import { logger } from '@/lib/logger.js'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const raw = getBoardById(id)
    if (!raw) return NextResponse.json({ ok: false, error: 'Tablero no encontrado' }, { status: 404 })
    const board = await hydrateBoardCatalog(raw as Record<string, unknown>)
    return NextResponse.json({ ok: true, board })
  } catch (e: any) {
    logger.error({ err: e.message, id }, '[api] get board')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const db = getDb()
    const board = getBoardById(id)
    if (!board) return NextResponse.json({ ok: false, error: 'Tablero no encontrado' }, { status: 404 })
    db.prepare('DELETE FROM board_listings WHERE board_id = ?').run(id)
    db.prepare('DELETE FROM search_runs WHERE board_id = ?').run(id)
    db.prepare('DELETE FROM boards WHERE id = ?').run(id)
    logger.info({ id }, '[api] board deleted')
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    logger.error({ err: e.message, id }, '[api] delete board')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = parseUpdateBoardRequest(body)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  try {
    const board = updateBoard({ boardId: id, ...parsed.data })
    if (!board) return NextResponse.json({ ok: false, error: 'Tablero no encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true, board })
  } catch (e: any) {
    logger.error({ err: e.message, id }, '[api] update board')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
