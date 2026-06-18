'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'

const NAV_ITEMS = [
  { href: '/', label: 'Buscar', icon: SearchIcon, exact: true },
  { href: '/guardados', label: 'Guardados', icon: HeartIcon },
  { href: '/chequear', label: 'Verificar precio', icon: CheckIcon },
]

export function ShellNav() {
  const pathname = usePathname()
  const { openAdvisor, mockMode } = useAppStore()

  return (
    <nav className="shell-nav">
      <div className="shell-nav-logo">
        <div className="shell-nav-logo-mark">G</div>
        <span className="shell-nav-logo-name">El Garaje</span>
      </div>

      <div className="shell-nav-links">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shell-nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </div>

      {mockMode && (
        <div style={{ padding: '8px 16px' }}>
          <div style={{ background: 'rgba(255,237,0,0.1)', border: '1px solid rgba(255,237,0,0.3)', padding: '6px 10px', fontSize: 11, color: '#ffed00', fontWeight: 700, textAlign: 'center', letterSpacing: '0.04em' }}>
            MODO DEMO
          </div>
        </div>
      )}

      <div className="shell-nav-footer">
        <button className="shell-nav-advisor-btn btn" onClick={() => openAdvisor()}>
          <SparkIcon size={14} />
          Asesor IA
        </button>
      </div>
    </nav>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="4.5"/>
      <line x1="10.5" y1="10.5" x2="14" y2="14"/>
    </svg>
  )
}

function HeartIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 13.5S2 9.5 2 5.5A3.5 3.5 0 0 1 8 3.2 3.5 3.5 0 0 1 14 5.5C14 9.5 8 13.5 8 13.5z"/>
    </svg>
  )
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 8l4 4 8-8"/>
      <circle cx="8" cy="8" r="6.5"/>
    </svg>
  )
}

function GearIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5"/>
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"/>
    </svg>
  )
}

function SparkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z"/>
    </svg>
  )
}
