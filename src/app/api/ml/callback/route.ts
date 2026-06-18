export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { mlExchangeCode } from '@/lib/mercadolibre-api.js'
import { logger } from '@/lib/logger.js'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return new NextResponse('Falta el parámetro code de autorización.', { status: 400 })
  try {
    await mlExchangeCode(code)
    logger.info('[api] ML conectado')
    return NextResponse.redirect(new URL('/?ml=connected', req.url))
  } catch (e: any) {
    logger.error({ err: e.message }, '[api] ml callback')
    return new NextResponse(`No se pudo conectar MercadoLibre: ${e.message}`, { status: 500 })
  }
}
