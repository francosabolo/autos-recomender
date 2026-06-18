export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { getBoardById, saveListingsToBoard, touchBoardChecked, saveSearchRun } from '@/lib/db.js'
import { buscarEnPortales, PORTALS } from '@/lib/scraper.js'
import { parseRefreshBoardRequest } from '@/lib/validation.js'
import { hydrateBoardCatalog } from '@/app/api/_lib/helpers'
import { logger } from '@/lib/logger.js'

async function runBoardRefresh(board: any, limit = 60) {
  const filters = board.filters && Object.keys(board.filters).length ? board.filters : {}
  const portalIds = board.portals?.length ? board.portals : PORTALS.map((p: any) => p.id)
  const result = await buscarEnPortales(filters, { portalIds, limit })
  const { newIds } = saveListingsToBoard(board.id, result.listings, { markNew: true })
  touchBoardChecked(board.id)
  const portalResults = result.portal_results.map((r: any) => ({
    portal: r.portal,
    portal_label: r.portal_label,
    url: r.url,
    total: r.listings?.length || 0,
    status: r.status || null,
    error: r.error || null
  }))
  saveSearchRun({ boardId: board.id, filters, portals: portalIds, totalFound: newIds.length, portalResults })
  return { newIds, portalResults }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = parseRefreshBoardRequest(body)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })

  try {
    const board = getBoardById(id)
    if (!board) return NextResponse.json({ ok: false, error: 'Búsqueda no encontrada' }, { status: 404 })

    const t0 = Date.now()
    const limit = (parsed as any).data?.limit || 60
    const { newIds, portalResults } = await runBoardRefresh(board, limit)
    const fresh = getBoardById(board.id)
    const hydrated = await hydrateBoardCatalog(fresh as Record<string, unknown>)
    const newListings = (hydrated.listings || []).filter((l: any) => l.is_new)

    logger.info({ duration_ms: Date.now() - t0, boardId: board.id, new_count: newIds.length }, '[api] board refresh ok')
    return NextResponse.json({ ok: true, board: hydrated, new_count: newIds.length, new_listings: newListings, portal_results: portalResults })
  } catch (e: any) {
    logger.error({ err: e.message, id }, '[api] board refresh error')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
