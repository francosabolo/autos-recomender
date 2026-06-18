export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { listBoards, createBoard } from '@/lib/db.js'
import { parseCreateBoardRequest } from '@/lib/validation.js'
import { logger } from '@/lib/logger.js'

export function GET() {
  try {
    return NextResponse.json({ ok: true, boards: listBoards(80) })
  } catch (e: any) {
    logger.error({ err: e.message }, '[api] list boards')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = parseCreateBoardRequest(body)
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] board validación fallida')
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  }
  try {
    const board = createBoard(parsed.data)
    return NextResponse.json({ ok: true, board }, { status: 201 })
  } catch (e: any) {
    logger.error({ err: e.message }, '[api] create board')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
