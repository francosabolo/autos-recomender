export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { createBoard, getBoardById, saveListingsToBoard, touchBoardChecked, saveSearchRun } from '@/lib/db.js'
import { buscarEnPortales, PORTALS } from '@/lib/scraper.js'
import { parseRecommendSearchRequest } from '@/lib/validation.js'
import { compactFilters } from '@/lib/search-filters.js'
import { dedupeListings, sortListingsForBoard, tagRecommendedListings } from '@/lib/recommend.js'
import { enrichBriefWithTramite } from '@/lib/transaction-guide.js'
import { enrichRecommendedModels } from '@/lib/model-profiles.js'
import { hydrateBoardCatalog } from '@/app/api/_lib/helpers'
import { buildMockBrief, generateMockListings } from '@/lib/mock-listings.js'
import { logger } from '@/lib/logger.js'

const MOCK_MODE = process.env.MOCK_MODE === 'true'

async function searchListingsForBrief(brief: any, { portalIds, limit = 48 }: { portalIds: string[]; limit?: number }) {
  const baseFilters = compactFilters({
    ...(brief.filtros || {}),
    ciudad: brief.filtros?.ciudad,
    provincia: brief.filtros?.provincia
  })
  const modelos = brief.modelos_recomendados || []
  const perModelLimit = Math.max(12, Math.ceil((limit || 48) / Math.max(modelos.length, 1)))

  let allListings: any[] = []
  let portalResults: any[] = []

  if (modelos.length) {
    const searches = await Promise.all(
      modelos.map((m: any) =>
        buscarEnPortales(
          compactFilters({ ...baseFilters, marca: m.marca || (baseFilters as any).marca, modelo: m.modelo || (baseFilters as any).modelo }),
          { portalIds, limit: perModelLimit }
        )
      )
    )
    for (const r of searches) {
      allListings.push(...(r.listings || []))
      portalResults.push(...(r.portal_results || []))
    }
  } else {
    const r = await buscarEnPortales(baseFilters, { portalIds, limit })
    allListings = r.listings || []
    portalResults = r.portal_results || []
  }

  allListings = dedupeListings(allListings)
  allListings = tagRecommendedListings(allListings, modelos)
  allListings = sortListingsForBoard(allListings).slice(0, limit || 48)

  const portalSummary = portalResults.reduce((acc: any, r: any) => {
    const key = r.portal || r.portal_label
    if (!acc[key]) acc[key] = { portal: r.portal, portal_label: r.portal_label, url: r.url, total: 0, status: r.status || null, error: r.error || null }
    acc[key].total += (r as any).listings?.length || 0
    return acc
  }, {})

  return { listings: allListings, portal_results: Object.values(portalSummary) }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = parseRecommendSearchRequest(body)
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] recommend-search validación fallida')
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  }

  const { query, ciudad, provincia, portalIds, limit } = parsed.data
  const selectedPortals = portalIds?.length ? portalIds : PORTALS.filter((p: any) => p.canScrape).map((p: any) => p.id)

  // ── MOCK MODE ────────────────────────────────────────────────────────────
  if (MOCK_MODE) {
    try {
      const brief = buildMockBrief(query)
      const listings = generateMockListings(brief, 12)
      const board = createBoard({ name: brief.nombre_busqueda, filters: brief.filtros, portals: selectedPortals, advisor_brief: brief as unknown as null }) as any
      saveListingsToBoard(board.id, listings)
      touchBoardChecked(board.id)
      saveSearchRun({ boardId: board.id, filters: brief.filtros, portals: selectedPortals, totalFound: listings.length, portalResults: [] })
      const rawBoard = getBoardById(board.id) as Record<string, unknown>
      const hydrated = await hydrateBoardCatalog(rawBoard ?? {}) as any
      logger.info({ boardId: board.id, listings: listings.length }, '[api] recommend-search mock ok')
      return NextResponse.json({ ok: true, board: hydrated, advisor_brief: brief, filters: brief.filtros, used_mock_listings: true })
    } catch (e: any) {
      logger.error({ err: e.message }, '[api] recommend-search mock error')
      return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const t0 = Date.now()
    const { interpretarBusqueda } = await import('@/lib/llm.js')
    const brief = enrichBriefWithTramite(await interpretarBusqueda({ query, ciudad, provincia }))
    brief.modelos_recomendados = await enrichRecommendedModels(brief.modelos_recomendados || [], {
      query,
      precioMax: brief.filtros?.precioMax
    })
    const mergedFilters = compactFilters({
      ...(brief.filtros || {}),
      query: brief.query_original || query,
      ciudad: ciudad || brief.filtros?.ciudad,
      provincia: provincia || brief.filtros?.provincia
    })
    brief.filtros = mergedFilters

    const { listings: scrapedListings, portal_results: portalResults } = await searchListingsForBrief(brief, { portalIds: selectedPortals, limit: limit || 48 })
    let listings = scrapedListings

    // When all scrapers return nothing (blocked / structure changed), generate mock listings
    // from the AI brief so the demo flow stays intact.
    const usedMocks = listings.length === 0
    if (usedMocks) {
      listings = generateMockListings(brief, 12)
      logger.info({ count: listings.length }, '[api] recommend-search: scrapers vacíos → usando mock listings')
    }

    const board = createBoard({ name: brief.nombre_busqueda, filters: mergedFilters, portals: selectedPortals, advisor_brief: brief }) as any
    const boardId2 = board?.id
    const { ids: savedIds } = saveListingsToBoard(boardId2, listings)
    touchBoardChecked(boardId2)
    const run = saveSearchRun({ boardId: boardId2, filters: mergedFilters, portals: selectedPortals, totalFound: savedIds.length, portalResults })
    const rawBoard = getBoardById(boardId2) as Record<string, unknown> | null
    const hydrated = await hydrateBoardCatalog(rawBoard ?? {}) as any
    const taggedListings = tagRecommendedListings(hydrated?.listings || [], brief.modelos_recomendados || [])

    logger.info({ duration_ms: Date.now() - t0, boardId: boardId2, listings: listings.length, modelos: brief.modelos_recomendados?.length || 0 }, '[api] recommend-search ok')

    return NextResponse.json({
      ok: true,
      board: await hydrateBoardCatalog({ ...(hydrated as object), listings: taggedListings } as Record<string, unknown>),
      advisor_brief: brief,
      filters: mergedFilters,
      run,
      saved: savedIds.length,
      portal_results: portalResults,
      used_mock_listings: usedMocks,
    })
  } catch (e: any) {
    logger.error({ err: e.message, stack: e.stack }, '[api] recommend-search error')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
