import type { Metadata } from 'next'
import './globals.css'
import { ShellNav } from '@/components/layout/ShellNav'
import { BottomNav } from '@/components/layout/BottomNav'
import { AdvisorDock } from '@/components/layout/AdvisorDock'
import { AppInit } from '@/components/layout/AppInit'
import { DemoBanner } from '@/components/layout/DemoBanner'
import { ToastStack } from '@/components/layout/ToastStack'

export const metadata: Metadata = {
  title: 'El Garaje — Buscador de autos usado',
  description: 'Encontrá el auto usado ideal en Argentina con asesoramiento inteligente',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AppInit />
        <DemoBanner />
        <div className="app-shell">
          <ShellNav />
          <main className="shell-main">
            {children}
          </main>
          <AdvisorDock />
        </div>
        <BottomNav />
        <ToastStack />
      </body>
    </html>
  )
}
