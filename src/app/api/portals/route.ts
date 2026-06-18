export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { PORTALS } from '@/lib/scraper.js'

export function GET() {
  return NextResponse.json({
    ok: true,
    portals: PORTALS.map((p: any) => ({ id: p.id, label: p.label, canScrape: p.canScrape }))
  })
}
