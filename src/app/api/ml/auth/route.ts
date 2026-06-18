export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { mlAuthUrl, mlConfigured } from '@/lib/mercadolibre-api.js'

export function GET() {
  if (!mlConfigured()) {
    return new NextResponse('Falta configurar ML_CLIENT_ID y ML_CLIENT_SECRET en el .env', { status: 400 })
  }
  return NextResponse.redirect(mlAuthUrl())
}
