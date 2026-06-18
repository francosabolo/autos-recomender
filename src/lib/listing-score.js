// lib/listing-score.js
// Ficha técnica simple + score algorítmico por publicación (sin LLM por unidad).

import { normalizeText } from './search-filters.js';
import { matchListingToCatalogRow } from './vehicle-catalog.js';
import { getCuratedKnowledge } from './knowledge.js';

const MARCA_CONFIABILIDAD = {
  toyota: 92,
  honda: 88,
  volkswagen: 78,
  ford: 72,
  chevrolet: 70,
  fiat: 65,
  renault: 62,
  peugeot: 64,
  citroen: 62,
  nissan: 74
};

const MOTOR_ALERTAS = [
  { re: /correa bañada|1\.6\s*8v/i, penalty: 22, nota: 'Motor con correa bañada — historial crítico en AR' },
  { re: /\btsi\b|turbo|thp/i, penalty: 12, nota: 'Turbo: exige service documentado' },
  { re: /\bcvt\b/i, penalty: 10, nota: 'CVT: revisar mantenimiento de caja' }
];

function parseNcapStars(ncap) {
  if (!ncap) return null;
  const m = String(ncap).match(/(\d+)\s*estrella/i);
  return m ? Number(m[1]) : null;
}

function parseAirbagsCount(airbags) {
  if (airbags == null) return null;
  const m = String(airbags).match(/(\d+)/);
  if (m) return Number(m[1]);
  if (/seis|6/i.test(String(airbags))) return 6;
  if (/cuatro|4/i.test(String(airbags))) return 4;
  return 2;
}

/** @param {Record<string, unknown> | null | undefined} row */
export function scoreSeguridad(row) {
  let score = 45;
  const stars = parseNcapStars(row?.ncap);
  if (stars) score = Math.min(100, stars * 18 + 10);
  if (row?.esp === true) score = Math.min(100, score + 14);
  else if (row?.esp === false) score = Math.max(10, score - 18);
  const ab = parseAirbagsCount(row?.airbags);
  if (ab != null) {
    if (ab >= 6) score = Math.min(100, score + 8);
    else if (ab >= 4) score = Math.min(100, score + 4);
    else if (ab <= 2) score = Math.max(10, score - 8);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const estrellas = stars ?? Math.max(1, Math.min(5, Math.round(score / 20)));
  return {
    score,
    estrellas,
    esp: row?.esp ?? null,
    airbags: row?.airbags ?? null,
    ncap: row?.ncap ?? null
  };
}

/** @param {Record<string, unknown> | null | undefined} row */
export function scoreConfiabilidad(row) {
  const marca = normalizeText(row?.marca || '');
  let score = MARCA_CONFIABILIDAD[marca] ?? 68;
  const dist = String(row?.distribucion || '').toLowerCase();
  if (dist.includes('cadena')) score += 14;
  else if (dist.includes('correa')) score -= 10;

  const notas = [];
  const motorHay = `${row?.motor || ''} ${row?.distribucion || ''} ${row?.destacado || ''}`;
  for (const alerta of MOTOR_ALERTAS) {
    if (alerta.re.test(motorHay)) {
      score -= alerta.penalty;
      notas.push(alerta.nota);
    }
  }

  score = Math.max(12, Math.min(100, Math.round(score)));
  const label = score >= 80 ? 'Alta' : score >= 62 ? 'Media' : 'Baja';
  return { score, label, notas };
}

function scoreValorMercado(mercado) {
  if (mercado === 'barato') return { score: 88, label: 'Buen precio vs similares del tablero' };
  if (mercado === 'caro') return { score: 42, label: 'Por encima del promedio del tablero' };
  if (mercado === 'normal') return { score: 65, label: 'En línea con similares' };
  return { score: 50, label: 'Sin comparación en este tablero' };
}

/** Alineación con criterios/evitar del brief de búsqueda. */
function scoreCriteriosBusqueda(row, brief) {
  let score = 72;
  const criterios = (brief?.criterios || []).map(normalizeText);
  const evitar = (brief?.evitar || []).map(normalizeText);
  const specs = normalizeText(
    [row?.motor, row?.distribucion, row?.destacado, row?.version].filter(Boolean).join(' ')
  );

  if (criterios.some(c => c.includes('cadena'))) {
    score += specs.includes('cadena') ? 18 : -14;
  }
  if (criterios.some(c => c.includes('esp') || c.includes('seguridad') || c.includes('estabilidad'))) {
    if (row?.esp === true) score += 14;
    else if (row?.esp === false) score -= 18;
  }
  if (criterios.some(c => c.includes('consumo') || c.includes('econom'))) {
    if (/\b1\.[0-3]\b|firefly|msi/i.test(specs)) score += 8;
  }

  for (const ev of evitar) {
    if (ev && specs.includes(ev.split(/\s+/)[0])) score -= 22;
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))) };
}

function overallScore(dims) {
  return Math.round(
    dims.seguridad.score * 0.38 +
      dims.confiabilidad.score * 0.32 +
      dims.valor.score * 0.15 +
      dims.criterios_busqueda.score * 0.15
  );
}

function curatedExtras(marca, modelo, anio) {
  const k = getCuratedKnowledge(marca, modelo, anio);
  if (!k) return { que_chequear: [], evitar_si: [] };
  return {
    que_chequear: Array.isArray(k.que_chequear) ? k.que_chequear.slice(0, 4) : [],
    evitar_si: Array.isArray(k.evitar_si) ? k.evitar_si.slice(0, 3) : []
  };
}

/**
 * Score de una fila de catálogo (recomendación modelo/versión/años).
 * @param {Record<string, unknown> | null} row
 * @param {{ criterios?: string[], evitar?: string[] } | null} brief
 */
export function buildCatalogRowScore(row, brief = null) {
  if (!row) return { score: null, dimensiones: null };
  const seguridad = scoreSeguridad(row);
  const confiabilidad = scoreConfiabilidad(row);
  const criterios_busqueda = scoreCriteriosBusqueda(row, brief);
  const valor = { score: 70, label: 'Referencia de catálogo' };
  const dimensiones = { seguridad, confiabilidad, valor, criterios_busqueda };
  return { score: overallScore(dimensiones), dimensiones };
}

/**
 * Ficha + score para una publicación concreta (el usuario valida la unidad).
 * @param {Record<string, unknown>} listing
 * @param {{ catalogs?: unknown[], brief?: Record<string, unknown> | null, mercado?: string | null }} ctx
 */
export function buildListingAnalysis(listing, ctx = {}) {
  const { catalogs = [], brief = null, mercado = null } = ctx;
  const row =
    listing.catalog_match ||
    matchListingToCatalogRow(listing, catalogs);

  const seguridad = scoreSeguridad(row);
  const confiabilidad = scoreConfiabilidad(row);
  const valor = scoreValorMercado(listing._mercado ?? mercado);
  const criterios_busqueda = scoreCriteriosBusqueda(row, brief);
  const dimensiones = { seguridad, confiabilidad, valor, criterios_busqueda };
  const score = row ? overallScore(dimensiones) : null;

  const anio = listing.año || listing.year;
  const extras = curatedExtras(row?.marca, row?.modelo, anio);

  return {
    score,
    dimensiones,
    ficha: {
      marca: row?.marca ?? null,
      modelo: row?.modelo ?? null,
      version: row?.version ?? null,
      anio_desde: row?.anio_desde ?? null,
      anio_hasta: row?.anio_hasta ?? null,
      motor: row?.motor ?? null,
      potencia_cv: row?.potencia_cv ?? null,
      distribucion: row?.distribucion ?? null,
      transmision: row?.transmision ?? null,
      esp: row?.esp ?? null,
      airbags: row?.airbags ?? null,
      ncap: row?.ncap ?? null,
      destacado: row?.destacado ?? null
    },
    que_chequear: extras.que_chequear,
    evitar_si: extras.evitar_si,
    sin_match: !row
  };
}
