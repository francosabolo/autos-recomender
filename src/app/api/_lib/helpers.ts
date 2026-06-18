// Shared helpers for all Route Handlers
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status })
}

export function err(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// Hydrate a board with catalog annotations, market tags, and listing analysis.
// This mirrors the hydrateBoardCatalog function from server.js.
export async function hydrateBoardCatalog(board: Record<string, unknown> | null | undefined) {
  if (!board) return board

  let b = { ...board } as any

  // enrich brief with tramite guide
  try {
    const { enrichBriefWithTramite } = await import('@/lib/transaction-guide.js')
    if (b.advisor_brief) {
      b = { ...b, advisor_brief: enrichBriefWithTramite(b.advisor_brief) }
    }
  } catch { /* non-critical */ }

  if (!b.listings?.length) return b

  // catalog annotations, market tags, listing analysis — each wrapped independently
  // because turbopack can fail to resolve dynamic imports of ESM-only lib modules
  try {
    const { annotateListingsWithCatalog } = await import('@/lib/catalog-filters.js')
    const { tagListingsWithMarket } = await import('@/lib/listing-analytics.js')
    const { buildListingAnalysis } = await import('@/lib/listing-score.js')

    const catalogs = (b.advisor_brief?.modelos_recomendados || [])
      .map((m: any) => m.catalog || m.ficha)
      .filter((c: any) => c?.generaciones?.length)

    let listings = b.listings
    if (catalogs.length) {
      listings = annotateListingsWithCatalog(listings, catalogs)
    }
    listings = tagListingsWithMarket(listings)
    listings = listings.map((l: any) => ({
      ...l,
      listing_analysis: buildListingAnalysis(l, {
        catalogs,
        brief: b.advisor_brief || null,
        mercado: l._mercado
      })
    }))
    return { ...b, listings }
  } catch (e: any) {
    // Turbopack module factory issue — return board without deep annotations
    // Market tags only (pure function, no dynamic imports)
    try {
      const { tagListingsWithMarket } = await import('@/lib/listing-analytics.js')
      return { ...b, listings: tagListingsWithMarket(b.listings) }
    } catch {
      return b
    }
  }
}
