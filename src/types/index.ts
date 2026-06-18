// ─── Core domain types ───────────────────────────────────────────────────────

export interface Portal {
  id: string
  label: string
  canScrape: boolean
}

export interface Board {
  id: string
  name: string
  description?: string
  filters: SearchFilters
  portals: string[]
  alerts_enabled: number
  last_checked_at: number | null
  created_at: number
  updated_at: number
  notes?: string
  advisor_brief?: AdvisorBrief
  total?: number
  contacted?: number
  new_count?: number
  listings?: BoardListing[]
  runs?: SearchRun[]
}

export interface Listing {
  id: string
  source: string
  source_listing_id: string
  title: string
  price: number | null
  currency: string
  year: number | null
  km: number | null
  location: string | null
  link: string
  image: string | null
  brand: string | null
  model: string | null
  fuel: string | null
  traction: string | null
  transmission: string | null
  raw: Record<string, unknown>
  created_at: number
  updated_at: number
  previous_price?: number | null
  price_changed_at?: number | null
  vehicle_type?: string | null
  fingerprint?: string | null
}

export interface BoardListing extends Listing {
  // from board_listings join
  status: 'saved' | 'contacted' | 'discarded'
  notes: string
  is_new: boolean
  shortlisted: boolean
  checklist: Record<string, boolean | null>
  first_seen_at?: number
  // computed
  recomendado?: boolean
  _mercado?: 'barato' | 'normal' | 'caro' | null
  catalog_esp?: boolean
  catalog_distribucion?: string
  listing_analysis?: ListingAnalysis
  insight?: string
  // display aliases (from raw scraping)
  titulo?: string
  precio?: number
  moneda?: string
  año?: number
  kilometros?: number
  ubicacion?: string
  fuente?: string
  imagen?: string
  tipo?: string
  transmision?: string
  combustible?: string
  traccion?: string
  precio_bajo?: boolean
  precio_anterior?: number
  board_id?: string
  board_name?: string
}

export interface SearchFilters {
  query?: string
  marca?: string
  modelo?: string
  precioMax?: number
  anioMin?: number
  anioMax?: number
  kmMax?: number
  combustible?: string
  transmision?: string
  traccion?: string
  tipo?: string
  [key: string]: unknown
}

export interface SearchRun {
  id: string
  board_id: string
  filters: SearchFilters
  portals: string[]
  total_found: number
  portal_results: PortalResult[]
  created_at: number
}

export interface PortalResult {
  portal: string
  portal_label: string
  total: number
  status: string
  url: string
  error?: string
}

// ─── Advisor / Brief types ────────────────────────────────────────────────────

export interface AdvisorBrief {
  nombre_busqueda?: string
  query_original?: string
  explicacion?: string
  modelos_recomendados?: ModeloRecomendado[]
  evitar?: string[]
  criterios?: string[]
  guia_compra?: GuiaCompra
  filtros?: SearchFilters
  [key: string]: unknown
}

export interface ModeloRecomendado {
  marca: string
  modelo: string
  version?: string
  version_destacada?: string
  anio_desde?: number
  anio_hasta?: number
  generacion?: string
  motivo?: string
  catalog?: VehicleCatalog
}

export interface VehicleCatalog {
  marca: string
  modelo: string
  resumen?: string
  distribucion_resumen?: string
  precio_orientativo_usado?: string
  generaciones?: Generacion[]
}

export interface Generacion {
  nombre: string
  anio_desde?: number
  anio_hasta?: number
  notas?: string
  versiones?: Version[]
}

export interface Version {
  version?: string
  nombre?: string
  anio_desde?: number
  anio_hasta?: number
  motor?: string
  potencia_cv?: number
  distribucion?: string
  transmision?: string
  airbags?: number | string
  esp?: boolean
  ncap?: string
  nota?: string
  destacado?: string
  por_anio?: VersionYearSlice[]
}

export interface VersionYearSlice {
  anio_desde?: number
  anio_hasta?: number
  motor?: string
  potencia_cv?: number
  distribucion?: string
  transmision?: string
  esp?: boolean
  airbags?: number | string
  nota?: string
  destacado?: string
}

export interface GuiaCompra {
  resumen?: string
  pasos?: GuiaPaso[]
}

export interface GuiaPaso {
  titulo: string
  destacado?: string
  items: string[]
}

// ─── Listing analysis ─────────────────────────────────────────────────────────

export interface ListingAnalysis {
  score?: number
  sin_match?: boolean
  dimensiones?: {
    seguridad?: { score?: number; estrellas?: number }
    confiabilidad?: { score?: number; label?: string }
    valor?: { score?: number }
    criterios_busqueda?: { score?: number }
  }
  ficha?: {
    marca?: string
    modelo?: string
    version?: string
    anio_desde?: number
    anio_hasta?: number
    motor?: string
    potencia_cv?: number
    distribucion?: string
    esp?: boolean
    airbags?: number
    ncap?: string
    destacado?: string
  }
  evitar_si?: string[]
  que_chequear?: string[]
}

// ─── Today digest ─────────────────────────────────────────────────────────────

export interface TodayDigest {
  nuevos: BoardListing[]
  bajaron: BoardListing[]
  counts: { nuevos: number; bajaron: number }
}

// ─── Knowledge ────────────────────────────────────────────────────────────────

export interface Knowledge {
  resumen?: string
  versiones?: string[]
  equipamiento?: Array<{ nombre: string; valor?: string; explicacion_coloquial?: string }>
  evitar_si?: string[]
  problemas_comunes?: string[]
  que_chequear?: string[]
  precio_orientativo?: string
  seguridad?: Record<string, unknown>
}

// ─── Transaction guide ────────────────────────────────────────────────────────

export interface TransactionGuide {
  titulo?: string
  aviso?: string
  checklist_unidad?: { keys: string[]; labels: Record<string, string> }
  secciones?: Array<{ titulo: string; items: string[] }>
}

// ─── Chat / Advisor dock ──────────────────────────────────────────────────────

export interface AdvisorMessage {
  role: 'user' | 'assistant'
  content: string
  cards?: AdvisorCard[]
}

export interface AdvisorCard {
  tipo: string
  titulo?: string
  precio?: number
  moneda?: string
  año?: number
  kilometros?: number
  fuente?: string
  imagen?: string
  link?: string
  score?: number
  justificacion?: string
}

export interface AdvisorState {
  open: boolean
  messages: AdvisorMessage[]
  sending: boolean
  sessionId: string
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiOk { ok: true }
export interface ApiError { ok: false; error: string }

export type ApiResponse<T> = T & ApiOk | ApiError
