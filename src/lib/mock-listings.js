/**
 * mock-listings.js
 *
 * Two exports:
 *   buildMockBrief(query)        → realistic advisor_brief from a plain-text query
 *   generateMockListings(brief)  → realistic listings from a brief
 *
 * Used when MOCK_MODE=true so the product works 100% offline.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function uid() { return Math.random().toString(36).slice(2, 10) }

// ---------------------------------------------------------------------------
// Model catalog per budget range — Argentine used-car market
// ---------------------------------------------------------------------------
const MODELS_BY_BUDGET = [
  {
    maxPeso: 8_000_000,
    tipo: 'hatchback',
    modelos: [
      { marca: 'Fiat', modelo: 'Argo', anio_desde: 2017, anio_hasta: 2020, motivo: 'Excelente confiabilidad y bajo costo de mantenimiento.' },
      { marca: 'Renault', modelo: 'Sandero', anio_desde: 2016, anio_hasta: 2019, motivo: 'Buena relación precio/equipamiento en el segmento.' },
      { marca: 'Volkswagen', modelo: 'Gol Trend', anio_desde: 2015, anio_hasta: 2018, motivo: 'Motor 1.6 confiable, repuestos accesibles en todo el país.' },
      { marca: 'Chevrolet', modelo: 'Onix', anio_desde: 2015, anio_hasta: 2018, motivo: 'Alta valorización en reventa, motor eficiente.' },
    ]
  },
  {
    maxPeso: 12_000_000,
    tipo: 'hatchback',
    modelos: [
      { marca: 'Volkswagen', modelo: 'Polo', anio_desde: 2017, anio_hasta: 2020, motivo: 'El mejor hatchback del segmento, suspensión cómoda.' },
      { marca: 'Toyota', modelo: 'Yaris', anio_desde: 2018, anio_hasta: 2021, motivo: 'Confiabilidad Toyota, motor 1.5 eficiente.' },
      { marca: 'Peugeot', modelo: '208', anio_desde: 2016, anio_hasta: 2019, motivo: 'Buena caja automática, dirección asistida hidráulica.' },
      { marca: 'Fiat', modelo: 'Cronos', anio_desde: 2018, anio_hasta: 2021, motivo: 'Sedán moderno con maletero grande para el segmento.' },
    ]
  },
  {
    maxPeso: 18_000_000,
    tipo: 'sedan',
    modelos: [
      { marca: 'Toyota', modelo: 'Corolla', anio_desde: 2017, anio_hasta: 2021, motivo: 'El sedán más valorizado del mercado, ideal compra.' },
      { marca: 'Chevrolet', modelo: 'Cruze', anio_desde: 2017, anio_hasta: 2020, motivo: 'Muy bien equipado en versiones LTZ, motor turbo eficiente.' },
      { marca: 'Honda', modelo: 'Civic', anio_desde: 2016, anio_hasta: 2019, motivo: 'Motor 1.5 turbo potente, conducción dinámica.' },
      { marca: 'Volkswagen', modelo: 'Vento', anio_desde: 2016, anio_hasta: 2020, motivo: 'Plataforma sólida, buena insonorización.' },
    ]
  },
  {
    maxPeso: 26_000_000,
    tipo: 'sedan',
    modelos: [
      { marca: 'Toyota', modelo: 'Corolla', anio_desde: 2020, anio_hasta: 2023, motivo: 'Generación híbrida disponible, tecnología de punta.' },
      { marca: 'Honda', modelo: 'Civic', anio_desde: 2020, anio_hasta: 2023, motivo: 'Diseño renovado, muy completo en versiones top.' },
      { marca: 'Volkswagen', modelo: 'Polo', anio_desde: 2020, anio_hasta: 2023, motivo: 'Nueva plataforma MQB, más espacioso y seguro.' },
      { marca: 'Peugeot', modelo: '408', anio_desde: 2019, anio_hasta: 2022, motivo: 'Fastback moderno, muy bien equipado.' },
    ]
  },
  {
    maxPeso: 38_000_000,
    tipo: 'suv',
    modelos: [
      { marca: 'Toyota', modelo: 'RAV4', anio_desde: 2017, anio_hasta: 2020, motivo: 'SUV premium con alta capacidad off-road y reventas altas.' },
      { marca: 'Honda', modelo: 'CR-V', anio_desde: 2017, anio_hasta: 2020, motivo: 'Muy confortable, turbo 1.5 con consumo razonable.' },
      { marca: 'Volkswagen', modelo: 'Tiguan', anio_desde: 2017, anio_hasta: 2020, motivo: 'SUV europeo bien equipado, tracción 4Motion disponible.' },
      { marca: 'Jeep', modelo: 'Compass', anio_desde: 2017, anio_hasta: 2020, motivo: 'Buen acceso al segmento premium, versiones Trailhawk capaces.' },
    ]
  },
  {
    maxPeso: 999_000_000,
    tipo: 'pickup',
    modelos: [
      { marca: 'Toyota', modelo: 'Hilux', anio_desde: 2018, anio_hasta: 2023, motivo: 'La pickup más vendida y buscada del mercado, reventa garantizada.' },
      { marca: 'Ford', modelo: 'Ranger', anio_desde: 2018, anio_hasta: 2022, motivo: 'Motor 3.2 turbodiesel potente, bien equipada en Storm.' },
      { marca: 'Volkswagen', modelo: 'Amarok', anio_desde: 2017, anio_hasta: 2021, motivo: 'Refinamiento europeo, motor V6 en versiones Highline.' },
      { marca: 'Nissan', modelo: 'Frontier', anio_desde: 2018, anio_hasta: 2022, motivo: 'Buena alternativa con mayor espacio interior.' },
    ]
  },
]

// SUV-specific models across budgets
const SUV_MODELS = {
  bajo: [
    { marca: 'Chevrolet', modelo: 'Tracker', anio_desde: 2014, anio_hasta: 2019, motivo: 'SUV compacto con muy buena relación precio/equipamiento.' },
    { marca: 'Ford', modelo: 'EcoSport', anio_desde: 2014, anio_hasta: 2018, motivo: 'Acceso al segmento SUV, motor 1.6 económico.' },
    { marca: 'Renault', modelo: 'Duster', anio_desde: 2015, anio_hasta: 2019, motivo: 'El SUV más económico con 4x4, tasa de averías baja.' },
  ],
  medio: [
    { marca: 'Volkswagen', modelo: 'T-Cross', anio_desde: 2019, anio_hasta: 2022, motivo: 'SUV urbano moderno, bien equipado y eficiente.' },
    { marca: 'Jeep', modelo: 'Renegade', anio_desde: 2017, anio_hasta: 2021, motivo: 'Diseño robusto, versiones Trailhawk con 4x4 real.' },
    { marca: 'Chevrolet', modelo: 'Tracker', anio_desde: 2020, anio_hasta: 2023, motivo: 'Nueva generación más eficiente, tecnología actualizada.' },
  ],
  alto: [
    { marca: 'Toyota', modelo: 'RAV4', anio_desde: 2019, anio_hasta: 2023, motivo: 'Líder del segmento, híbrido disponible desde 2019.' },
    { marca: 'Honda', modelo: 'CR-V', anio_desde: 2019, anio_hasta: 2022, motivo: 'El SUV mediano más cómodo, cabina premium.' },
    { marca: 'Volkswagen', modelo: 'Tiguan', anio_desde: 2019, anio_hasta: 2022, motivo: '7 plazas disponible, plataforma sólida.' },
  ],
}

// Pickup-specific models
const PICKUP_MODELS = [
  { marca: 'Toyota', modelo: 'Hilux', anio_desde: 2016, anio_hasta: 2023, motivo: 'La referencia del mercado, reventa garantizada.' },
  { marca: 'Ford', modelo: 'Ranger', anio_desde: 2017, anio_hasta: 2022, motivo: 'Potencia y equipamiento, buena red de service.' },
  { marca: 'Volkswagen', modelo: 'Amarok', anio_desde: 2016, anio_hasta: 2021, motivo: 'Confort de auto, motor turbodiesel muy eficiente en ruta.' },
  { marca: 'Nissan', modelo: 'Frontier', anio_desde: 2017, anio_hasta: 2022, motivo: 'Alternativa sólida, motor 2.3 biturbodiesel.' },
]

// ---------------------------------------------------------------------------
// Type keywords
// ---------------------------------------------------------------------------
const TYPE_KEYWORDS = {
  suv: /\b(suv|crossover|4x4|todoterreno|cuatro por cuatro|altura|campo|adventure|off.road)\b/i,
  pickup: /\b(pickup|camioneta|doble.?cabina|hilux|ranger|amarok|frontier)\b/i,
  hatchback: /\b(hatchback|3.?puertas|5.?puertas|chico|compacto|ciudad|gol|polo|onix|argo|sandero|yaris)\b/i,
}

// ---------------------------------------------------------------------------
// Price parser — handles "15M", "15 millones", "15000000", "15.5M"
// ---------------------------------------------------------------------------
function parsePrecioMax(query) {
  const q = query.toLowerCase()
  const mMatch = q.match(/(\d+(?:[.,]\d+)?)\s*m(?:illones?)?\b/)
  if (mMatch) return Math.round(parseFloat(mMatch[1].replace(',', '.')) * 1_000_000)
  const bigNum = q.match(/\b(\d{6,8})\b/)
  if (bigNum) return parseInt(bigNum[1])
  return null
}

// ---------------------------------------------------------------------------
// Query → tipo
// ---------------------------------------------------------------------------
function parseTipo(query) {
  if (TYPE_KEYWORDS.pickup.test(query)) return 'pickup'
  if (TYPE_KEYWORDS.suv.test(query)) return 'suv'
  if (TYPE_KEYWORDS.hatchback.test(query)) return 'hatchback'
  return 'sedan'
}

// ---------------------------------------------------------------------------
// Query → explicit brand preference
// ---------------------------------------------------------------------------
function parseMarca(query) {
  const brands = ['Toyota', 'Volkswagen', 'Honda', 'Chevrolet', 'Ford', 'Fiat', 'Renault', 'Peugeot', 'Nissan', 'Jeep', 'Citroën', 'Hyundai', 'Kia']
  const lower = query.toLowerCase()
  return brands.find(b => lower.includes(b.toLowerCase())) || null
}

// ---------------------------------------------------------------------------
// Select recommended models from catalog
// ---------------------------------------------------------------------------
function selectModels(tipo, precioMax, marcaPref, count = 3) {
  if (tipo === 'pickup') {
    let candidates = PICKUP_MODELS
    if (marcaPref) candidates = [...candidates.filter(m => m.marca === marcaPref), ...candidates.filter(m => m.marca !== marcaPref)]
    return candidates.slice(0, count)
  }

  if (tipo === 'suv') {
    const bracket = precioMax < 15_000_000 ? 'bajo' : precioMax < 30_000_000 ? 'medio' : 'alto'
    let candidates = SUV_MODELS[bracket]
    if (marcaPref) candidates = [...candidates.filter(m => m.marca === marcaPref), ...candidates.filter(m => m.marca !== marcaPref)]
    return candidates.slice(0, count)
  }

  // sedan / hatchback — find the smallest bucket whose maxPeso >= precioMax
  const bucket = MODELS_BY_BUDGET.find(b => precioMax <= b.maxPeso)
           || MODELS_BY_BUDGET[MODELS_BY_BUDGET.length - 1]
  let candidates = bucket.modelos
  if (marcaPref) candidates = [...candidates.filter(m => m.marca === marcaPref), ...candidates.filter(m => m.marca !== marcaPref)]
  return candidates.slice(0, count)
}

// ---------------------------------------------------------------------------
// Build a realistic advisor_brief from a plain query string
// ---------------------------------------------------------------------------
export function buildMockBrief(query = '') {
  const precioMax = parsePrecioMax(query) || 18_000_000
  const precioMin = Math.round(precioMax * 0.65)
  const tipo = parseTipo(query)
  const marcaPref = parseMarca(query)
  const modelos = selectModels(tipo, precioMax, marcaPref, 3)

  const tipoLabel = { sedan: 'sedán', suv: 'SUV', pickup: 'pickup', hatchback: 'compacto' }[tipo] || tipo
  const top = modelos[0]
  const precioFmt = (n) => `$${(n / 1_000_000).toFixed(1)}M`

  const nombre = marcaPref
    ? `${marcaPref} ${tipoLabel} hasta ${precioFmt(precioMax)}`
    : `${tipoLabel.charAt(0).toUpperCase() + tipoLabel.slice(1)} hasta ${precioFmt(precioMax)}`

  return {
    nombre_busqueda: nombre,
    query_original: query,
    tipo_vehiculo: tipo,
    explicacion: `Para tu búsqueda de ${query || 'auto usado'} encontré ${modelos.length} modelos que destacan en el mercado argentino en la franja de ${precioFmt(precioMin)} a ${precioFmt(precioMax)}. Mi primera recomendación es el **${top.marca} ${top.modelo}** — ${top.motivo}`,
    modelos_recomendados: modelos.map((m, i) => ({
      ...m,
      recomendado: i === 0,
      rank: i + 1,
    })),
    filtros: {
      precioMax,
      precioMin,
      tipo,
      ciudad: null,
      provincia: null,
      kmMax: null,
      anioDesde: modelos[0]?.anio_desde || 2016,
    },
    criterios: [
      'Revisar historial de service al día',
      'Verificar libre de deuda en el Registro de la Propiedad Automotor',
      'Inspección mecánica antes del cierre',
      'Pedir informe de multas e infracciones',
    ],
    evitar: [
      `Autos con más de 120.000 km sin service comprobado`,
      `Versiones base sin airbags frontales y laterales`,
      `Anuncios sin VIN o sin permiso de circulación`,
    ],
    presupuesto_total: precioMax,
    _isMockBrief: true,
  }
}

// ---------------------------------------------------------------------------
// Location, transmission and source data
// ---------------------------------------------------------------------------
const UBICACIONES = [
  'Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata',
  'Mar del Plata', 'San Justo', 'Quilmes', 'Lanús', 'Tigre',
]

const VERSION_MAP = {
  'Toyota Corolla':      (a) => a >= 2020 ? 'XEI CVT' : 'XEI Aut.',
  'Toyota Hilux':        () => 'SRV 4x4',
  'Toyota Yaris':        (a) => a >= 2020 ? 'XLS CVT' : 'XS',
  'Toyota RAV4':         () => 'AWD CVT',
  'Volkswagen Polo':     (a) => a >= 2020 ? 'Track Aut.' : 'Comfortline',
  'Volkswagen Vento':    () => 'Highline Aut.',
  'Volkswagen Gol Trend': () => 'Comfortline',
  'Volkswagen T-Cross':  () => 'Highline AT',
  'Volkswagen Tiguan':   () => 'Highline 4Motion',
  'Volkswagen Amarok':   () => 'Highline V6',
  'Honda Civic':         (a) => a >= 2020 ? 'EXL Aut.' : 'EX',
  'Honda CR-V':          () => 'EXL AWD',
  'Chevrolet Cruze':     (a) => a >= 2018 ? 'LTZ Aut.' : 'LT',
  'Chevrolet Tracker':   (a) => a >= 2020 ? 'LTZ AT' : 'LT',
  'Chevrolet Onix':      () => 'Premier',
  'Fiat Argo':           () => 'Drive',
  'Fiat Cronos':         () => 'Precision',
  'Renault Sandero':     () => 'Expression',
  'Renault Duster':      () => '4x4',
  'Peugeot 208':         () => 'Allure',
  'Peugeot 408':         () => 'Allure Plus',
  'Ford Ranger':         () => 'Storm 4x4',
  'Ford EcoSport':       () => 'Titanium',
  'Jeep Compass':        () => 'Trailhawk 4x4',
  'Jeep Renegade':       () => 'Trailhawk',
  'Nissan Frontier':     () => 'X-Gear 4x4',
}

function getVersion(marca, modelo, año) {
  const fn = VERSION_MAP[`${marca} ${modelo}`]
  return fn ? fn(año) : ''
}

function buildLink(source, marca, modelo) {
  const slug = `${marca}-${modelo}`.toLowerCase().replace(/\s+/g, '-')
  if (source === 'kavak') return `https://www.kavak.com/ar/usados/${slug}`
  if (source === 'mercadolibre') return `https://autos.mercadolibre.com.ar/usados/${slug}`
  return '#'
}

const SOURCES_POOL = [
  { fuente: 'MercadoLibre', source: 'mercadolibre' },
  { fuente: 'MercadoLibre', source: 'mercadolibre' }, // higher weight
  { fuente: 'Kavak', source: 'kavak' },
  { fuente: 'OLX', source: 'olx' },
]

// ---------------------------------------------------------------------------
// Generate realistic listings from a brief
// ---------------------------------------------------------------------------
export function generateMockListings(brief, count = 12) {
  const modelos = brief?.modelos_recomendados || []
  const precioMax = brief?.filtros?.precioMax || 18_000_000
  const precioMin = brief?.filtros?.precioMin || Math.round(precioMax * 0.65)
  const now = Date.now()

  if (!modelos.length) return []

  const listings = []
  const perModel = Math.ceil(count / modelos.length)

  for (const modelo of modelos) {
    const marca = modelo.marca || 'Auto'
    const mod = modelo.modelo || ''
    const anioDesde = modelo.anio_desde || 2016
    const anioHasta = modelo.anio_hasta || 2023

    for (let i = 0; i < perModel && listings.length < count; i++) {
      const año = rnd(anioDesde, anioHasta)
      const km = rnd(15_000, 125_000)
      const basePrice = precioMin + (precioMax - precioMin) * Math.random()
      const precio = Math.round(basePrice / 100_000) * 100_000

      const relativo = (precio - precioMin) / Math.max(precioMax - precioMin, 1)
      const _mercado = relativo < 0.28 ? 'barato' : relativo > 0.82 ? 'caro' : 'normal'

      const { fuente, source } = pick(SOURCES_POOL)
      const version = getVersion(marca, mod, año)
      const transmision = version.includes('CVT') ? 'CVT'
                        : version.includes('Aut') ? 'Automática'
                        : i % 3 === 0 ? 'Automática' : 'Manual'
      const titulo = `${marca} ${mod}${version ? ' ' + version : ''} ${año}`

      listings.push({
        id: `mock-${uid()}`,
        source,
        source_listing_id: uid(),
        titulo,
        title: titulo,
        precio,
        price: precio,
        currency: 'ARS',
        moneda: 'ARS',
        año,
        year: año,
        kilometros: km,
        km,
        ubicacion: pick(UBICACIONES),
        location: pick(UBICACIONES),
        fuente,
        brand: marca,
        model: mod,
        link: buildLink(source, marca, mod),
        image: null,
        imagen: null,
        raw: {},
        created_at: now - rnd(0, 86_400_000 * 10),
        updated_at: now - rnd(0, 3_600_000 * 24),
        transmision,
        transmission: transmision,
        combustible: mod === 'Hilux' || mod === 'Ranger' || mod === 'Amarok' || mod === 'Frontier' ? 'Diesel' : 'Nafta',
        fuel: mod === 'Hilux' || mod === 'Ranger' || mod === 'Amarok' || mod === 'Frontier' ? 'Diesel' : 'Nafta',
        traction: '4x2',
        traccion: '4x2',
        recomendado: modelo.recomendado || _mercado === 'barato',
        _mercado,
        is_new: i === 0,
        status: 'saved',
        notes: '',
        shortlisted: false,
        checklist: {},
        _isMock: true,
      })
    }
  }

  return listings.sort((a, b) => {
    if (a._mercado === 'barato' && b._mercado !== 'barato') return -1
    if (b._mercado === 'barato' && a._mercado !== 'barato') return 1
    if (a.recomendado && !b.recomendado) return -1
    if (b.recomendado && !a.recomendado) return 1
    return a.precio - b.precio
  })
}
