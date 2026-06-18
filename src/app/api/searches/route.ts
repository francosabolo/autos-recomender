export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { getBoardById, createBoard, updateBoard, saveListingsToBoard, touchBoardChecked, saveSearchRun } from '@/lib/db.js'
import { buscarEnPortales, PORTALS } from '@/lib/scraper.js'
import { parseSearchRequest } from '@/lib/validation.js'
import { mergeSearchFilters } from '@/lib/search-filters.js'
import { logger } from '@/lib/logger.js'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = parseSearchRequest(body)
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] search validación fallida')
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  }

  const { query, filters, portalIds, boardId, boardName, limit } = parsed.data
  const mergedFilters = mergeSearchFilters(query, filters)
  const selectedPortals = portalIds?.length ? portalIds : PORTALS.map((p: any) => p.id)

  try {
    let board: any = boardId ? getBoardById(boardId) : null
    if (boardId && !board) return NextResponse.json({ ok: false, error: 'Tablero no encontrado' }, { status: 404 })

    const boardPreexisted = Boolean(board)
    if (!board) {
      const mf = mergedFilters as any
      const name = boardName || mf.query || [mf.marca, mf.modelo, mf.anioMin].filter(Boolean).join(' ') || 'Búsqueda de autos'
      board = createBoard({ name, filters: mergedFilters, portals: selectedPortals })
    } else {
      updateBoard({ boardId: board.id, filters: mergedFilters, portals: selectedPortals } as any)
    }

    const t0 = Date.now()
    const result = await buscarEnPortales(mergedFilters, { portalIds: selectedPortals, limit: limit || 48 })
    const { ids: savedIds, newIds } = saveListingsToBoard(board.id, result.listings, { markNew: boardPreexisted })
    touchBoardChecked(board.id)
    const portalResults = result.portal_results.map((r: any) => ({
      portal: r.portal, portal_label: r.portal_label, url: r.url, total: r.listings?.length || 0, status: r.status || null, error: r.error || null
    }))
    const run = saveSearchRun({ boardId: board.id, filters: mergedFilters, portals: selectedPortals, totalFound: savedIds.length, portalResults })
    const hydrated = getBoardById(board.id)

    logger.info({ duration_ms: Date.now() - t0, boardId: board.id, listings: result.listings.length, saved: savedIds.length, portals: selectedPortals }, '[api] search ok')
    return NextResponse.json({ ok: true, board: hydrated, filters: mergedFilters, run, saved: savedIds.length, new_count: newIds.length, portal_results: portalResults })
  } catch (e: any) {
    logger.error({ err: e.message, stack: e.stack }, '[api] search error')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
