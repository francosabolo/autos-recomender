export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { buscarEnPortales, PORTALS } from '@/lib/scraper.js'
import { parseDiscoverRequest } from '@/lib/validation.js'
import { mergeSearchFilters } from '@/lib/search-filters.js'
import { logger } from '@/lib/logger.js'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = parseDiscoverRequest(body)
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] discover validación fallida')
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  }

  const { query, filters, portalIds, limit } = parsed.data
  const mergedFilters = mergeSearchFilters(query, filters)
  const selectedPortals = portalIds?.length ? portalIds : PORTALS.map((p: any) => p.id)

  try {
    const t0 = Date.now()
    const result = await buscarEnPortales(mergedFilters, { portalIds: selectedPortals, limit: limit || 48, async: true })
    const portalResults = result.portal_results.map((r: any) => ({
      portal: r.portal, portal_label: r.portal_label, url: r.url, total: r.listings?.length || 0, status: r.status || null, error: r.error || null
    }))
    const pending = portalResults.some((r: any) => r.status === 'pending')

    logger.info({ duration_ms: Date.now() - t0, listings: result.listings.length, pending, portals: selectedPortals }, '[api] discover ok')
    return NextResponse.json({ ok: true, filters: mergedFilters, listings: result.listings, portal_results: portalResults, pending })
  } catch (e: any) {
    logger.error({ err: e.message, stack: e.stack }, '[api] discover error')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
