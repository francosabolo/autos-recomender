export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { listSessionsRecent } from '@/lib/db.js'
import { logger } from '@/lib/logger.js'

export function GET() {
  try {
    return NextResponse.json({ ok: true, sessions: listSessionsRecent(30) })
  } catch (e: any) {
    logger.error({ err: e.message }, '[api] list sessions')
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
