'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'

export function BottomNav() {
  const pathname = usePathname()
  const { today, openAdvisor } = useAppStore()
  const newCount = (today?.counts.nuevos || 0) + (today?.counts.bajaron || 0)

  return (
    <nav className="bottom-nav">
      <Link href="/" className={`bottom-nav-item ${pathname === '/' ? 'active' : ''}`}>
        <SearchIcon />
        <span>Buscar</span>
      </Link>

      <Link href="/busquedas" className={`bottom-nav-item ${pathname.startsWith('/busquedas') || pathname.startsWith('/boards') ? 'active' : ''}`}>
        <BookmarkIcon />
        <span>Búsquedas</span>
      </Link>

      <Link href="/chequear" className={`bottom-nav-item ${pathname === '/chequear' ? 'active' : ''}`}>
        <CheckCircleIcon />
        <span>Precio</span>
      </Link>

      <Link href="/hoy" className={`bottom-nav-item ${pathname === '/hoy' ? 'active' : ''}`}>
        <BellIcon />
        {newCount > 0 && <span className="bottom-nav-badge">{newCount > 99 ? '99+' : newCount}</span>}
        <span>Hoy</span>
      </Link>

      <button className="bottom-nav-item" onClick={() => openAdvisor()} style={{ border: 'none', background: 'none' }}>
        <SparkIcon />
        <span>Asesor</span>
      </button>
    </nav>
  )
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="4.5"/>
      <line x1="10.5" y1="10.5" x2="14" y2="14"/>
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 2h10v13l-5-3-5 3V2z"/>
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1a5 5 0 0 1 5 5v3l1.5 2H1.5L3 9V6a5 5 0 0 1 5-5z"/>
      <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0"/>
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 8l4 4 8-8"/>
      <circle cx="8" cy="8" r="6.5"/>
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z"/>
    </svg>
  )
}
