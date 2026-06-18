// fallback-advisor.js
// Respuestas rule-based cuando el LLM no está disponible.
// Usa el contexto (advisor_brief, listings) para personalizar sin IA.

const INTENTS = [
  { pattern: /conviene|recomend|mejor|elegir|cuál|qué compro|qué me suger/i, key: 'recommend' },
  { pattern: /caro|precio|vale|cotiz|cuánto sale|cómo está el mercado|está bien el precio/i, key: 'price' },
  { pattern: /revisar|chequear|inspeccionar|qué mirar|checklist|antes de comprar/i, key: 'checklist' },
  { pattern: /evitar|problema|falla|cuidado|ojo con|qué pasa con/i, key: 'avoid' },
  { pattern: /garant|papeles|escritura|boleto|transf.*dominio|venta segura/i, key: 'paperwork' },
  { pattern: /financ|cuota|crédito|banco|prenda/i, key: 'finance' },
  { pattern: /km|kilómetro|kilometraje|mucho km|poco km/i, key: 'km' },
  { pattern: /hola|buenas|hey|qué tal|cómo andás/i, key: 'greeting' },
]

function detectIntent(text) {
  for (const { pattern, key } of INTENTS) {
    if (pattern.test(text)) return key
  }
  return 'general'
}

function formatPrice(n) {
  if (!n) return null
  return `$${Number(n).toLocaleString('es-AR')}`
}

function buildBriefSummary(brief) {
  if (!brief) return null
  const modelos = (brief.modelos_recomendados || [])
    .slice(0, 3)
    .map(m => {
      const rango = m.anio_desde && m.anio_hasta ? ` (${m.anio_desde}–${m.anio_hasta})` : m.anio_desde ? ` (${m.anio_desde}+)` : ''
      return `**${m.marca} ${m.modelo}${rango}**${m.motivo ? ` — ${m.motivo}` : ''}`
    })
  return {
    modelosList: modelos,
    evitar: (brief.evitar || []).slice(0, 3),
    criterios: (brief.criterios || []).slice(0, 4),
    explicacion: brief.explicacion || null,
    nombre: brief.nombre_busqueda || null,
  }
}

function listingsStats(listings) {
  if (!listings?.length) return null
  const prices = listings.map(l => l.precio || l.price || 0).filter(Boolean)
  if (!prices.length) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const baratos = listings.filter(l => l._mercado === 'barato').length
  const caros = listings.filter(l => l._mercado === 'caro').length
  return { min, max, avg, total: listings.length, baratos, caros }
}

/**
 * @param {{ messages: Array<{role:string,content:string}>, contexto: Record<string,unknown> }} args
 * @returns {{ texto: string, cards: [] }}
 */
export function fallbackChat({ messages, contexto }) {
  const lastUser = [...(messages || [])].reverse().find(m => m.role === 'user')
  const text = lastUser?.content || ''
  const intent = detectIntent(text)
  const brief = contexto?.advisor_brief || null
  const listings = contexto?.listings || []
  const b = buildBriefSummary(brief)
  const stats = listingsStats(listings)
  const boardName = b?.nombre || contexto?.nombre_busqueda || 'tu búsqueda'

  const r = {
    recommend() {
      if (b?.modelosList?.length) {
        return [
          `Para ${boardName}, los modelos que mejor se adaptan son:`,
          '',
          b.modelosList.map(m => `- ${m}`).join('\n'),
          '',
          b.explicacion ? b.explicacion : '',
          b.criterios?.length ? `\nPriorizá unidades con: ${b.criterios.join(', ')}.` : '',
        ].filter(Boolean).join('\n').trim()
      }
      return [
        'Para el mercado argentino, los modelos más sólidos en usados son:',
        '',
        '- **Toyota Corolla** (2017–2019) — cadena, reventa firme, repuestos accesibles',
        '- **Volkswagen Polo Track** (2020+) — cadena, ESP de serie, bajo consumo',
        '- **Honda City** (2015–2020) — confiable, motor atmosférico simple',
        '- **Fiat Argo Drive** (2018+) — económico, fácil de estacionar',
        '',
        'En todos los casos, priorizá service documentado, distribución a cadena y versiones con ESP.',
      ].join('\n')
    },

    price() {
      if (stats) {
        const lines = [
          `En tu tablero hay **${stats.total} avisos** para ${boardName}.`,
          `Rango de precios: ${formatPrice(stats.min)} — ${formatPrice(stats.max)} ARS.`,
          `Precio promedio: ${formatPrice(stats.avg)} ARS.`,
        ]
        if (stats.baratos) lines.push(`✓ ${stats.baratos} aviso${stats.baratos > 1 ? 's' : ''} marcado${stats.baratos > 1 ? 's' : ''} como "buen precio" para el mercado.`)
        if (stats.caros) lines.push(`⚠ ${stats.caros} aviso${stats.caros > 1 ? 's' : ''} está${stats.caros > 1 ? 'n' : ''} por encima del promedio.`)
        lines.push('', 'Compará siempre con al menos 5 avisos similares antes de decidir.')
        return lines.join('\n')
      }
      return [
        'Para evaluar si un precio es justo en el mercado argentino:',
        '',
        '- Buscá al menos 5 avisos del mismo modelo, año y versión',
        '- Comparé en MercadoLibre, Kavak y OLX',
        '- Un auto 15–20% más barato que el promedio puede tener historial de accidente o deuda',
        '- Los precios en Argentina cambian rápido por inflación — priorizá avisos publicados en los últimos 7 días',
      ].join('\n')
    },

    checklist() {
      const base = [
        '**Checklist básico antes de comprar cualquier usado:**',
        '',
        '1. Verificá el VIN en la DNRPA (sin prendas, embargos ni inhibiciones)',
        '2. Pedí la libreta de service completa (o facturación de concesionaria)',
        '3. Revisá el estado de la distribución — preferí cadena sobre correa',
        '4. Test drive en ciudad Y en autopista (20 min mínimo)',
        '5. Revisión de chapa y pintura para detectar trabajos de chapa',
        '6. Verificá que airbags y cinturones funcionen correctamente',
        '7. Pedí revisar por tu mecánico de confianza antes de cerrar',
      ]
      if (b?.criterios?.length) {
        base.push('', `**Para ${boardName} en particular:**`, ...b.criterios.map(c => `- ${c}`))
      }
      return base.join('\n')
    },

    avoid() {
      const base = [
        '**Lo que tenés que evitar en el mercado argentino:**',
        '',
        '- Correa de distribución sin cambiar o bañada en aceite',
        '- Autos sin service documentado (ni libreta ni facturas)',
        '- Vendedores que no permiten revisión por mecánico propio',
        '- Precios muy por debajo del mercado (pueden tener deuda o ser robados)',
        '- Motores con humo azul (quema aceite) o negro (mezcla rica)',
        '- Caja automática CVT maltratada — revisar ruidos y temperatura',
      ]
      if (b?.evitar?.length) {
        base.push('', `**Para ${boardName} específicamente:**`, ...b.evitar.map(e => `- ${e}`))
      }
      return base.join('\n')
    },

    paperwork() {
      return [
        '**Trámites para comprar un auto usado en Argentina:**',
        '',
        '1. **Verificación previa**: consultá el dominio en la DNRPA (registro.jus.gob.ar)',
        '2. **Boleto de compraventa**: firma certificada ante escribano o gestor matriculado',
        '3. **Pago seguro**: efectivo, transferencia bancaria o cheque certificado — evitá criptomonedas',
        '4. **Formulario 08**: el vendedor debe firmarlo presente ante el gestor',
        '5. **Transferencia de dominio**: presentar en el Registro del Automotor — aprox. 15 días hábiles',
        '6. **Seguro**: contratalo el mismo día que firmás el boleto',
        '',
        'El costo total de transferencia ronda el 2–4% del valor del auto entre impuestos y honorarios.',
      ].join('\n')
    },

    finance() {
      return [
        '**Opciones para financiar tu auto en Argentina:**',
        '',
        '- **Banco propio**: mejor tasa si tenés relación de dependencia — tramitá la pre-aprobación antes de buscar',
        '- **Préstamo personal**: más flexible, tasa algo más alta',
        '- **Kavak/concesionaria**: aprobación más rápida, pero generalmente con tasa mayor',
        '- **Prenda**: el auto queda como garantía — revisá siempre en DNRPA que no tenga una prendaria previa',
        '',
        'Recomendación: la cuota mensual no debería superar el 25–30% de tu ingreso neto.',
        'En contexto de inflación, los préstamos a tasa fija te protegen de aumentos futuros.',
      ].join('\n')
    },

    km() {
      return [
        '**Sobre el kilometraje en autos usados argentinos:**',
        '',
        '- El promedio anual en Argentina es 15.000–20.000 km',
        '- Un auto 2018 con 80.000 km está dentro de lo normal',
        '- Desconfiá de autos con muy pocos km para su año — puede indicar que estuvo parado mucho tiempo (peor para gomas, sellos y líquidos)',
        '- Revisá que el odómetro coincida con el estado de tapizados, volante y pedales',
        '- Pedí siempre el servicio de kilometraje para validar la cifra',
      ].join('\n')
    },

    greeting() {
      const intro = b
        ? `Hola! Estoy analizando ${boardName} con vos.`
        : 'Hola! Soy tu asesor para comprar autos usados en Argentina.'
      return [
        intro,
        '',
        'Puedo ayudarte con:',
        '- **¿Qué modelo conviene?** — comparativa del mercado',
        '- **¿Está bien el precio?** — análisis de tu tablero',
        '- **¿Qué tengo que revisar?** — checklist de inspección',
        '- **¿Qué evitar?** — problemas comunes en Argentina',
        '- **¿Cómo hago los papeles?** — trámites de transferencia',
        '',
        '¿Por dónde arrancamos?',
      ].join('\n')
    },

    general() {
      if (b?.explicacion) {
        return [
          b.explicacion,
          b.criterios?.length ? `\nPuntos clave a tener en cuenta: ${b.criterios.join(', ')}.` : '',
          '\nContame más sobre lo que necesitás y te ayudo a decidir.',
        ].filter(Boolean).join('\n')
      }
      return [
        'Soy tu asesor para comprar autos usados en Argentina.',
        '',
        'Podés preguntarme sobre:',
        '- Comparativa entre modelos',
        '- Si un precio está bien para el mercado',
        '- Qué revisar antes de comprar',
        '- Cómo hacer los trámites de transferencia',
        '',
        '¿Qué necesitás?',
      ].join('\n')
    },
  }

  const handler = r[intent] || r.general
  return { texto: handler(), cards: [] }
}

/**
 * Fallback para interpretarBusqueda cuando no hay LLM.
 * Usa parseNaturalLanguageFilters + heurísticas para generar un brief útil.
 */
export function fallbackInterpretarBusqueda({ query, filtrosNL, ciudad, provincia, enrichFn }) {
  const q = String(query || '').trim()
  const nlFilters = filtrosNL || {}
  const ubicacion = [ciudad, provincia].filter(Boolean).join(', ') || 'Argentina'
  const precioMax = nlFilters.precioMax || null
  const tipo = nlFilters.tipo || null

  // Heurística: elegir modelos según tipo y presupuesto
  const modelos = selectModelsByContext(tipo, precioMax, nlFilters)
  const nombre = buildSearchName(q, nlFilters)

  const brief = {
    nombre_busqueda: nombre,
    query_original: q,
    explicacion: buildExplicacion(modelos, tipo, precioMax, ubicacion, nlFilters),
    modelos_recomendados: modelos,
    criterios: ['Distribución a cadena', 'Service documentado', 'Sin prendas ni embargos en DNRPA', 'Test drive en autopista'],
    evitar: buildEvitar(tipo, nlFilters),
    filtros: {
      ...(nlFilters.precioMax && { precioMax: nlFilters.precioMax }),
      ...(nlFilters.precioMin && { precioMin: nlFilters.precioMin }),
      ...(nlFilters.tipo && { tipo: nlFilters.tipo }),
      ...(nlFilters.combustible && { combustible: nlFilters.combustible }),
      ...(nlFilters.transmision && { transmision: nlFilters.transmision }),
      ...(nlFilters.anioMin && { anioMin: nlFilters.anioMin }),
      ...(nlFilters.anioMax && { anioMax: nlFilters.anioMax }),
      ...(ciudad && { ciudad }),
      ...(provincia && { provincia }),
      query: q,
    },
  }

  return enrichFn ? enrichFn(brief) : brief
}

function buildSearchName(q, f) {
  const parts = []
  if (f.marca) parts.push(f.marca)
  if (f.modelo) parts.push(f.modelo)
  if (f.anioMin && f.anioMax) parts.push(`${f.anioMin}–${f.anioMax}`)
  else if (f.anioMin) parts.push(`${f.anioMin}+`)
  if (f.precioMax) parts.push(`hasta ${formatPrice(f.precioMax)}`)
  return parts.length ? parts.join(' · ') : (q.slice(0, 60) || 'Búsqueda de autos')
}

function buildExplicacion(modelos, tipo, precioMax, ubicacion, f) {
  const tipoStr = tipo ? ` tipo ${tipo}` : ''
  const presupuestoStr = precioMax ? ` con presupuesto de hasta ${formatPrice(precioMax)} ARS` : ''
  const modelosStr = modelos.slice(0, 2).map(m => `${m.marca} ${m.modelo}`).join(' y ')
  return `Para tu búsqueda${tipoStr}${presupuestoStr} en ${ubicacion}, los modelos más convenientes son el ${modelosStr}. Priorizá unidades con service documentado, distribución a cadena y versiones con ESP (control de estabilidad).`
}

function buildEvitar(tipo, f) {
  const base = ['Correa de distribución sin cambiar o bañada en aceite', 'Autos sin service documentado']
  if (tipo === 'suv' || f.traccion === '4x4') base.push('Diferencial trasero con ruidos o pérdidas de aceite')
  if (f.transmision === 'automatico') base.push('Caja automática CVT maltratada — revisá ruidos y temperatura')
  base.push('Unidades con prendas o embargos en DNRPA')
  return base
}

function selectModelsByContext(tipo, precioMax, f) {
  // Si el usuario especificó marca y modelo, usar eso directamente
  if (f.marca && f.modelo) {
    return [{
      marca: f.marca,
      modelo: f.modelo,
      anio_desde: f.anioMin || 2015,
      anio_hasta: f.anioMax || 2024,
      motivo: 'Modelo solicitado — buscá versiones con distribución a cadena y ESP de serie',
    }]
  }

  const MODELS_BY_TYPE = {
    suv: [
      { marca: 'Toyota', modelo: 'RAV4', anio_desde: 2019, anio_hasta: 2023, motivo: 'Motor atmosférico confiable, buena reventa' },
      { marca: 'Volkswagen', modelo: 'T-Cross', anio_desde: 2020, anio_hasta: 2024, motivo: 'Cadena, bajo consumo, ESP de serie' },
      { marca: 'Jeep', modelo: 'Renegade', anio_desde: 2018, anio_hasta: 2023, motivo: 'Buena disponibilidad en AR, 4x4 opcional' },
    ],
    pickup: [
      { marca: 'Toyota', modelo: 'Hilux', anio_desde: 2016, anio_hasta: 2023, motivo: 'Mejor reventa del segmento, diesel confiable' },
      { marca: 'Ford', modelo: 'Ranger', anio_desde: 2017, anio_hasta: 2022, motivo: 'Buen balance precio/equipamiento' },
    ],
    hatchback: [
      { marca: 'Volkswagen', modelo: 'Polo', anio_desde: 2020, anio_hasta: 2024, motivo: 'Cadena, ESP de serie desde 2022, bajo consumo' },
      { marca: 'Fiat', modelo: 'Argo', anio_desde: 2017, anio_hasta: 2024, motivo: 'Económico, fácil de estacionar, repuestos accesibles' },
      { marca: 'Renault', modelo: 'Sandero', anio_desde: 2016, anio_hasta: 2024, motivo: 'Espacioso para el segmento, buen precio de entrada' },
    ],
    sedan: [
      { marca: 'Toyota', modelo: 'Corolla', anio_desde: 2017, anio_hasta: 2023, motivo: 'Cadena, confiable, mejor reventa del segmento' },
      { marca: 'Honda', modelo: 'City', anio_desde: 2015, anio_hasta: 2022, motivo: 'Motor simple, buena eficiencia' },
      { marca: 'Volkswagen', modelo: 'Vento', anio_desde: 2013, anio_hasta: 2020, motivo: 'Versiones TSI — verificá historial de correa' },
    ],
  }

  const defaults = [
    { marca: 'Toyota', modelo: 'Corolla', anio_desde: 2017, anio_hasta: 2023, motivo: 'Cadena, reventa firme, el más buscado del segmento' },
    { marca: 'Volkswagen', modelo: 'Polo', anio_desde: 2020, anio_hasta: 2024, motivo: 'Cadena, bajo consumo, ESP disponible' },
    { marca: 'Fiat', modelo: 'Argo', anio_desde: 2018, anio_hasta: 2024, motivo: 'Económico y práctico para uso urbano' },
  ]

  const pool = MODELS_BY_TYPE[tipo] || defaults

  // Filtrar por presupuesto aproximado (solo para no sugerir autos fuera de rango)
  if (precioMax && precioMax < 15_000_000) {
    return pool.slice(0, 2).map(m => ({ ...m, anio_desde: Math.max(m.anio_desde, 2012), anio_hasta: Math.min(m.anio_hasta, 2019) }))
  }

  return pool.slice(0, 3)
}
