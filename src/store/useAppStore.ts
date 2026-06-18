'use client'
import { create } from 'zustand'
import type { Board, Portal, TodayDigest, AdvisorState, AdvisorMessage, BoardListing } from '@/types'

// ─── Mock data (dev fallback) ──────────────────────────────────────────────────

export const MOCK_BOARDS: Board[] = [
  {
    id: 'mock-1',
    name: 'Toyota Corolla 2015-2019',
    description: 'Sedán confiable para uso diario — hasta $18M',
    filters: { marca: 'Toyota', modelo: 'Corolla', anioMin: 2015, anioMax: 2019, precioMax: 18000000 },
    portals: ['mercadolibre', 'kavak'],
    alerts_enabled: 1,
    last_checked_at: Date.now() - 3600000,
    created_at: Date.now() - 86400000 * 5,
    updated_at: Date.now() - 3600000,
    total: 47, contacted: 3, new_count: 4,
    advisor_brief: {
      nombre_busqueda: 'Toyota Corolla 2015-2019 hasta $18M',
      query_original: 'quiero un corolla automático hasta 18 millones, que sea confiable',
      explicacion: 'El Toyota Corolla es la opción más sólida en este segmento. Encontré 47 avisos activos entre $14.2M y $18M. Los modelos 2017-2018 tienen la mejor relación precio/km disponibles. Hay 4 avisos nuevos desde tu última revisión, incluyendo uno de Kavak con garantía.',
      modelos_recomendados: [
        { marca: 'Toyota', modelo: 'Corolla', anio_desde: 2017, anio_hasta: 2018, motivo: 'Mejor punto de precio/km. Versión XEI tiene airbags frontales y laterales de serie.' },
        { marca: 'Toyota', modelo: 'Corolla', anio_desde: 2019, anio_hasta: 2019, motivo: 'Si podés estirar el presupuesto, el 2019 tiene mejoras en conectividad y seguridad activa.' }
      ],
      evitar: [
        'Versiones 2015 con caja automática de 4 velocidades — fallas reportadas a los 100k km',
        'Unidades sin service documentado en concesionaria Toyota'
      ],
      criterios: [
        'Verificar historial de service completo (libreta o facturación Toyota)',
        'Test drive en autopista para detectar vibraciones en la caja automática',
        'Revisar estado de cinturones y airbags — cuidado con unidades accidentadas',
        'Pedir VIN para verificar en DNRPA'
      ],
      filtros: { marca: 'Toyota', modelo: 'Corolla', anioMin: 2015, anioMax: 2019 }
    }
  },
  {
    id: 'mock-2',
    name: 'Honda Civic 2016+',
    description: 'Sedán deportivo para ciudad — hasta $22M',
    filters: { marca: 'Honda', modelo: 'Civic', anioMin: 2016 },
    portals: ['mercadolibre', 'kavak'],
    alerts_enabled: 0,
    last_checked_at: Date.now() - 7200000,
    created_at: Date.now() - 86400000 * 10,
    updated_at: Date.now() - 7200000,
    total: 31, contacted: 1, new_count: 2,
    advisor_brief: {
      explicacion: 'El Honda Civic 10G (2016-2021) es un excelente auto pero tiene algunos puntos a tener en cuenta en el mercado argentino. Los precios variaron mucho en los últimos meses.',
      modelos_recomendados: [
        { marca: 'Honda', modelo: 'Civic', anio_desde: 2019, anio_hasta: 2021, motivo: 'Versiones más recientes tienen mejores opciones de reparación. El 1.5 turbo del 2016-2018 tuvo problemas con el aceite en climas fríos.' }
      ],
      evitar: ['Cívics 2016-2018 con caja CVT — revisá el estado de la correa', 'Motor 1.5T 2016-2017 por dilución de aceite'],
      criterios: ['Revisar historial de aceite del motor', 'Test drive exigido en autopista y parado']
    }
  },
  {
    id: 'mock-3',
    name: 'Mi Ford Focus III — Tasación',
    description: 'Tasación de mi Focus para el cambio',
    filters: { marca: 'Ford', modelo: 'Focus' },
    portals: ['mercadolibre'],
    alerts_enabled: 0,
    last_checked_at: Date.now() - 86400000,
    created_at: Date.now() - 86400000 * 2,
    updated_at: Date.now() - 86400000,
    total: 18, contacted: 0, new_count: 0
  }
]

export const MOCK_LISTINGS: BoardListing[] = [
  {
    id: 'l1', source: 'mercadolibre', source_listing_id: '123', title: 'Toyota Corolla XEI 2017',
    price: 14500000, currency: 'ARS', year: 2017, km: 68000, location: 'Buenos Aires', link: '#',
    image: null, brand: 'Toyota', model: 'Corolla', fuel: 'Nafta', traction: 'Delantera',
    transmission: 'Automática', raw: {}, created_at: Date.now(), updated_at: Date.now(),
    status: 'saved', notes: '', is_new: true, shortlisted: false, checklist: {},
    recomendado: true, _mercado: 'barato',
    titulo: 'Toyota Corolla XEI 2017', precio: 14500000, moneda: 'ARS',
    año: 2017, kilometros: 68000, ubicacion: 'Buenos Aires', fuente: 'MercadoLibre'
  },
  {
    id: 'l2', source: 'kavak', source_listing_id: '456', title: 'Toyota Corolla SE-G 2018 Full',
    price: 16200000, currency: 'ARS', year: 2018, km: 45000, location: 'Córdoba', link: '#',
    image: null, brand: 'Toyota', model: 'Corolla', fuel: 'Nafta', traction: 'Delantera',
    transmission: 'Automática', raw: {}, created_at: Date.now(), updated_at: Date.now(),
    status: 'saved', notes: '', is_new: false, shortlisted: true, checklist: {},
    recomendado: true, _mercado: 'normal',
    titulo: 'Toyota Corolla SE-G 2018 Full', precio: 16200000, moneda: 'ARS',
    año: 2018, kilometros: 45000, ubicacion: 'Córdoba', fuente: 'Kavak'
  },
  {
    id: 'l3', source: 'mercadolibre', source_listing_id: '789', title: 'Toyota Corolla 2016 Manual',
    price: 12800000, currency: 'ARS', year: 2016, km: 92000, location: 'Rosario', link: '#',
    image: null, brand: 'Toyota', model: 'Corolla', fuel: 'Nafta', traction: 'Delantera',
    transmission: 'Manual', raw: {}, created_at: Date.now(), updated_at: Date.now(),
    status: 'contacted', notes: 'Hablé con el dueño, service al día', is_new: false, shortlisted: false, checklist: {},
    _mercado: 'barato',
    titulo: 'Toyota Corolla 2016 Manual', precio: 12800000, moneda: 'ARS',
    año: 2016, kilometros: 92000, ubicacion: 'Rosario', fuente: 'MercadoLibre'
  }
]

export const MOCK_TODAY: TodayDigest = {
  nuevos: [{ ...MOCK_LISTINGS[0], board_id: 'mock-1', board_name: 'Toyota Corolla 2015-2019' }],
  bajaron: [{ ...MOCK_LISTINGS[1], precio_anterior: 17500000, precio_bajo: true, board_id: 'mock-1', board_name: 'Toyota Corolla 2015-2019' }],
  counts: { nuevos: 1, bajaron: 1 }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

// ─── Advisor context ──────────────────────────────────────────────────────────

export interface AdvisorContext {
  boardId?: string
  boardName?: string
  listings?: BoardListing[]
  advisor_brief?: Record<string, unknown>
  catalogs?: unknown[]
  /** Pre-filled opening message when advisor is opened */
  prefillMessage?: string
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface AppState {
  portals: Portal[]
  boards: Board[]
  today: TodayDigest | null
  activeBoardId: string | null
  mockMode: boolean
  advisor: AdvisorState
  advisorContext: AdvisorContext
  loading: { portals: boolean; boards: boolean; today: boolean }
  toasts: Toast[]

  setMockMode: (v: boolean) => void
  loadPortals: () => Promise<void>
  loadBoards: () => Promise<void>
  loadToday: () => Promise<void>
  setActiveBoardId: (id: string | null) => void
  deleteBoard: (boardId: string) => Promise<void>

  openAdvisor: (ctx?: AdvisorContext) => void
  closeAdvisor: () => void
  sendAdvisorMessage: (text: string) => Promise<void>
  resetAdvisor: () => void

  showToast: (message: string, type?: Toast['type']) => void
  dismissToast: (id: string) => void
}

// ─── API fetch helper ─────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(data.error || `Error HTTP ${res.status}`)
  return data
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  portals: [],
  boards: [],
  today: null,
  activeBoardId: null,
  mockMode: false,
  loading: { portals: false, boards: false, today: false },
  toasts: [],
  advisorContext: {},
  advisor: {
    open: false,
    messages: [],
    sending: false,
    sessionId: `session-${Date.now()}`
  },

  setMockMode: (v) => set({ mockMode: v }),

  loadPortals: async () => {
    set(s => ({ loading: { ...s.loading, portals: true } }))
    try {
      const data = await apiFetch('/api/portals')
      set({ portals: data.portals })
    } catch {
      set({ mockMode: true })
    } finally {
      set(s => ({ loading: { ...s.loading, portals: false } }))
    }
  },

  loadBoards: async () => {
    set(s => ({ loading: { ...s.loading, boards: true } }))
    try {
      const data = await apiFetch('/api/boards')
      set({ boards: data.boards })
    } catch {
      set({ boards: MOCK_BOARDS, mockMode: true })
    } finally {
      set(s => ({ loading: { ...s.loading, boards: false } }))
    }
  },

  loadToday: async () => {
    set(s => ({ loading: { ...s.loading, today: true } }))
    try {
      const data = await apiFetch('/api/today')
      set({ today: { nuevos: data.nuevos || [], bajaron: data.bajaron || [], counts: data.counts || { nuevos: 0, bajaron: 0 } } })
    } catch {
      set({ today: MOCK_TODAY, mockMode: true })
    } finally {
      set(s => ({ loading: { ...s.loading, today: false } }))
    }
  },

  setActiveBoardId: (id) => set({ activeBoardId: id }),

  deleteBoard: async (boardId) => {
    const { mockMode, boards } = get()
    if (mockMode) {
      set({ boards: boards.filter(b => b.id !== boardId) })
      get().showToast('Búsqueda eliminada')
      return
    }
    try {
      await apiFetch(`/api/boards/${boardId}`, { method: 'DELETE' })
      set({ boards: boards.filter(b => b.id !== boardId) })
      get().showToast('Búsqueda eliminada')
    } catch (e: any) {
      get().showToast(e.message || 'Error al eliminar', 'error')
    }
  },

  // ─── Advisor ────────────────────────────────────────────────────────────────

  openAdvisor: (ctx = {}) => {
    const newBoardId = ctx.boardId
    // Reset messages when switching to a different board context
    const shouldReset = newBoardId && newBoardId !== get().advisorContext.boardId
    set(s => ({
      advisorContext: ctx,
      advisor: {
        ...s.advisor,
        open: true,
        messages: shouldReset ? [] : s.advisor.messages,
        sessionId: shouldReset ? `session-${Date.now()}` : s.advisor.sessionId
      }
    }))
    // Auto-send prefill if provided
    if (ctx.prefillMessage) {
      setTimeout(() => get().sendAdvisorMessage(ctx.prefillMessage!), 50)
    }
  },

  closeAdvisor: () => set(s => ({ advisor: { ...s.advisor, open: false } })),

  resetAdvisor: () => set(s => ({
    advisorContext: {},
    advisor: { ...s.advisor, messages: [], sessionId: `session-${Date.now()}` }
  })),

  sendAdvisorMessage: async (text) => {
    const state = get()
    const userMsg: AdvisorMessage = { role: 'user', content: text }
    set(s => ({ advisor: { ...s.advisor, messages: [...s.advisor.messages, userMsg], sending: true } }))

    if (state.mockMode) {
      await new Promise(r => setTimeout(r, 700 + Math.random() * 500))
      // Use the same fallback logic that the API uses — works offline
      const { fallbackChat } = await import('@/lib/fallback-advisor')
      const ctx = state.advisorContext
      const contexto: Record<string, unknown> = {}
      if (ctx.listings?.length) contexto.listings = ctx.listings
      if (ctx.advisor_brief) contexto.advisor_brief = ctx.advisor_brief
      if (ctx.boardName) (contexto as any).nombre_busqueda = ctx.boardName
      const allMessages = [...state.advisor.messages, userMsg]
      const { texto } = fallbackChat({ messages: allMessages, contexto })
      set(s => ({ advisor: { ...s.advisor, messages: [...s.advisor.messages, { role: 'assistant', content: texto }], sending: false } }))
      return
    }

    try {
      const allMessages = [...state.advisor.messages, userMsg]
      const ctx = state.advisorContext

      // Build contexto from current board context
      const contexto: Record<string, unknown> = {}
      if (ctx.listings?.length) contexto.listings = ctx.listings
      if (ctx.advisor_brief) contexto.advisor_brief = ctx.advisor_brief
      if (ctx.catalogs?.length) contexto.catalogs = ctx.catalogs
      if (ctx.boardId) contexto.tableroActivo = ctx.boardId

      const data = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          contexto,
          sessionId: state.advisor.sessionId
        })
      })
      const assistantMsg: AdvisorMessage = { role: 'assistant', content: data.texto, cards: data.cards }
      set(s => ({ advisor: { ...s.advisor, messages: [...s.advisor.messages, assistantMsg], sending: false } }))
    } catch (e: any) {
      const errMsg: AdvisorMessage = { role: 'assistant', content: `Error: ${e.message}` }
      set(s => ({ advisor: { ...s.advisor, messages: [...s.advisor.messages, errMsg], sending: false } }))
    }
  },

  // ─── Toasts ──────────────────────────────────────────────────────────────────

  showToast: (message, type = 'success') => {
    const id = `t-${Date.now()}`
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => get().dismissToast(id), 3000)
  },

  dismissToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
}))
