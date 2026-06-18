export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { getTodayDigest } from '@/lib/db.js'
import { logger } from '@/lib/logger.js'

export function GET() {
  try {
    const digest = getTodayDigest()
    return NextResponse.json({ ok: true, ...digest })
  } catch (e: any) {
    logger.error({ err: e.message }, '[api] today')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
