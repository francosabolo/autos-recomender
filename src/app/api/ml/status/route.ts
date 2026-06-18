export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { mlStatus } from '@/lib/mercadolibre-api.js'

export function GET() {
  return NextResponse.json({ ok: true, ...mlStatus() })
}
