export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { getTransactionGuidePayload } from '@/lib/transaction-guide.js'

export function GET() {
  return NextResponse.json({ ok: true, guide: getTransactionGuidePayload() })
}
