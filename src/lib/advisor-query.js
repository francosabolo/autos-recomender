// lib/advisor-query.js
// Interpreta consultas del asesor sobre el tablero: filtros, ranking e insights.

import { getCuratedCatalog, getCuratedKnowledge } from './knowledge.js';
import { getKnowledge } from './db.js';
import { flattenCatalog, matchListingToCatalogRow, normalizeCatalog } from './vehicle-catalog.js';
import { parseCatalogSpecFilters, filterListingsByCatalogSpecs } from './catalog-filters.js';
import { buildCatalogRowScore } from './listing-score.js';
import { tagListingsWithMarket } from './listing-analytics.js';
import {
  inferAttributes,
  matchesFilters,
  normalizeText,
  parseNaturalLanguageFilters,
  compactFilters
} from './search-filters.js';

const POWER_TITLE_BOOST = [
  { re: /\b(gts|rs|sport|turbo|tsi|gti|x\s*drive|sline|amg|m\s*sport)\b/i, boost: 40 },
  { re: /\b2\.0\b|\b2\.4\b|\b2\.8\b|\b3\.0\b/i, boost: 25 },
  { re: /\b1\.8\b|\b1\.6\s*t\b/i, boost: 15 },
  { re: /\b1\.4\s*t/i, boost: 20 },
  { re: /\b1\.6\b/i, boost: 5 },
  { re: /\b1\.0\b|\b1\.2\b/i, boost: -10 }
];

const MODEL_POWER_BASE = {
  polo: 110,
  golf: 115,
  vento: 110,
  corolla: 105,
  hilux: 150,
  ranger: 160,
  amarok: 180,
  ka: 85,
  gol: 75,
  sandero: 90,
  onix: 95,
  cruze: 120,
  tracker: 105,
  tiguan: 130,
  taos: 115
};

function parseKmFilters(text) {
  const t = normalizeText(text);
  const out = {};
  const max = t.match(
    /(?:menos de|hasta|max(?:imo)?|por debajo de|<)\s*([0-9]+(?:[\.,][0-9]+)?)\s*(?:mil\s*)?km/
  );
  if (max) out.kmMax = Math.round(Number(String(max[1]).replace(',', '.')) * (String(max[0]).includes('mil') ? 1000 : 1));
  const min = t.match(/(?:mas de|más de|desde|min(?:imo)?|>)\s*([0-9]+(?:[\.,][0-9]+)?)\s*(?:mil\s*)?km/);
  if (min) out.kmMin = Math.round(Number(String(min[1]).replace(',', '.')) * (String(min[0]).includes('mil') ? 1000 : 1));
  if (!out.kmMax) {
    const short = t.match(/\b([0-9]+)\s*mil\s*km\b/);
    if (short) out.kmMax = Number(short[1]) * 1000;
  }
  return out;
}

function detectSortIntent(text) {
  const t = normalizeText(text);
  if (/\b(mas potente|más potente|mayor potencia|mas fuerte|más fuerte|mas motor)\b/.test(t)) return 'potencia';
  if (/\b(mas barato|más barato|menor precio|mas economico|más económico)\b/.test(t)) return 'precio_asc';
  if (/\b(menos km|menor km|menos kilometros|menos kilómetros)\b/.test(t)) return 'km_asc';
  if (/\b(mas nuevo|más nuevo|año mas reciente)\b/.test(t)) return 'anio_desc';
  if (/\b(caro|caros|sobreprecio|por encima)\b/.test(t)) return 'mercado_caro';
  if (/\b(barato|gangas|buen precio)\b/.test(t)) return 'mercado_barato';
  return null;
}

function detectIntent(text) {
  const t = normalizeText(text);
  if (/\b(cual conviene|cuál conviene|recomenda|recomendás|me conviene)\b/.test(t)) return 'recomendar';
  if (/\b(caro|caros|barato|precio de mercado|tasar|tasa)\b/.test(t)) return 'precio_mercado';
  if (detectSortIntent(text) || parseNaturalLanguageFilters(text).precioMax || parseKmFilters(text).kmMax) return 'filtrar';
  return 'consulta';
}

function parsePrecioPor(query) {
  const t = normalizeText(query);
  const m = t.match(/\bpor\s*([0-9]+(?:[\.,][0-9]+)?)\s*(m|millones|millon)\b/);
  if (!m) return {};
  const n = Number(String(m[1]).replace(',', '.'));
  return { precioMax: Math.round(n * 1000000) };
}

export function parseAdvisorFilters(query = '') {
  const nl = parseNaturalLanguageFilters(query);
  const km = parseKmFilters(query);
  const por = parsePrecioPor(query);
  const sort = detectSortIntent(query);
  const merged = compactFilters({ ...nl, ...por });
  if (km.kmMax) merged.kmMax = km.kmMax;
  if (km.kmMin) merged.kmMin = km.kmMin;
  if (sort) merged.sort = sort;
  return merged;
}

function guessModelFromTitle(listing) {
  const title = normalizeText(listing.titulo || listing.title || '');
  const tokens = title.split(' ').filter(Boolean);
  return tokens[1] || tokens[0] || '';
}

function estimatePower(listing) {
  const title = listing.titulo || listing.title || '';
  const model = guessModelFromTitle(listing);
  let score = MODEL_POWER_BASE[normalizeText(model)] || 90;
  for (const { re, boost } of POWER_TITLE_BOOST) {
    if (re.test(title)) score += boost;
  }
  const attrs = inferAttributes(title);
  if (attrs.combustible === 'diesel') score += 10;
  return score;
}

function matchesKm(listing, filters) {
  const km = Number(listing.kilometros ?? listing.km);
  if (!Number.isFinite(km)) return !filters.kmMax && !filters.kmMin;
  if (filters.kmMax && km > filters.kmMax) return false;
  if (filters.kmMin && km < filters.kmMin) return false;
  return true;
}

function filterListings(listings, filters) {
  return listings.filter(l => matchesFilters(l, filters) && matchesKm(l, filters));
}

function sortListings(listings, sort, tagged) {
  const list = [...listings];
  if (sort === 'potencia') {
    return list.sort((a, b) => estimatePower(b) - estimatePower(a));
  }
  if (sort === 'precio_asc') {
    return list.sort((a, b) => (Number(a.precio || a.price) || 1e15) - (Number(b.precio || b.price) || 1e15));
  }
  if (sort === 'km_asc') {
    return list.sort((a, b) => (Number(a.kilometros ?? a.km) || 1e15) - (Number(b.kilometros ?? b.km) || 1e15));
  }
  if (sort === 'anio_desc') {
    return list.sort((a, b) => (Number(b.año || b.year) || 0) - (Number(a.año || a.year) || 0));
  }
  if (sort === 'mercado_caro') {
    const byId = new Map(tagged.map(l => [l.id || l.link, l]));
    return list
      .filter(l => byId.get(l.id || l.link)?._mercado === 'caro')
      .sort((a, b) => (Number(b.precio || b.price) || 0) - (Number(a.precio || a.price) || 0));
  }
  if (sort === 'mercado_barato') {
    const byId = new Map(tagged.map(l => [l.id || l.link, l]));
    return list
      .filter(l => byId.get(l.id || l.link)?._mercado === 'barato')
      .sort((a, b) => (Number(a.precio || a.price) || 1e15) - (Number(b.precio || b.price) || 1e15));
  }
  return list;
}

function extractMarcaModelo(listing) {
  const title = listing.titulo || listing.title || '';
  const parts = title.split(/\s+/);
  return { marca: parts[0] || '', modelo: parts[1] || '' };
}

export function getKnowledgeSnippetForListing(listing, catalogs = []) {
  const { marca, modelo } = extractMarcaModelo(listing);
  const anio = listing.año || listing.year;
  const catalogsToSearch = catalogs.length
    ? catalogs
    : [
        normalizeCatalog(getKnowledge(marca, modelo)?.content, { marca, modelo }),
        normalizeCatalog(getCuratedCatalog(marca, modelo), { marca, modelo })
      ].filter(c => c?.generaciones?.length);

  const row = matchListingToCatalogRow(listing, catalogsToSearch);
  if (row) {
    if (row.esp === false) {
      return `Sin ESP (${row.anio_desde || anio}) — cuidado en lluvia/ruta.`;
    }
    if (row.destacado) return `${row.version}: ${row.destacado}`;
    if (row.esp === true) return `Con ESP (${row.anio_desde || anio}).`;
  }

  const cached = getKnowledge(marca, modelo);
  const catalog = normalizeCatalog(cached?.content, { marca, modelo });
  if (catalog?.generaciones?.length) {
    const flat = flattenCatalog(catalog);
    const match = flat.find(r => {
      if (anio && r.anio_desde && anio < r.anio_desde) return false;
      if (anio && r.anio_hasta && anio > r.anio_hasta) return false;
      return true;
    });
    if (match?.destacado) return `${match.version}: ${match.destacado}`;
    if (catalog.distribucion_resumen) return catalog.distribucion_resumen;
  }
  const k = getCuratedKnowledge(marca, modelo, anio);
  if (!k) return null;
  const bits = [];
  const dist = k.equipamiento?.find(e => /distribuci/i.test(e.nombre));
  if (dist?.explicacion_coloquial) bits.push(dist.explicacion_coloquial);
  else if (dist?.valor) bits.push(`Distribución: ${dist.valor}.`);
  if (k.problemas_comunes?.[0]) bits.push(`Ojo en AR: ${k.problemas_comunes[0]}`);
  return bits.slice(0, 2).join(' ');
}

function rowFromListing(listing, taggedById, catalogs = []) {
  const key = listing.id || listing.link;
  const tagged = taggedById.get(key) || listing;
  const snippet = getKnowledgeSnippetForListing(listing, catalogs);
  return {
    id: listing.id || null,
    titulo: listing.titulo || listing.title || '',
    precio: listing.precio || listing.price || null,
    año: listing.año || listing.year || null,
    km: listing.kilometros ?? listing.km ?? null,
    link: listing.link || null,
    fuente: listing.fuente || listing.source || null,
    mercado: tagged._mercado || null,
    medianaSegmento: tagged._mercadoStats?.mediana || null,
    potenciaEstimada: estimatePower(listing),
    insightModelo: snippet || null,
    catalog_esp: listing.catalog_esp ?? listing.catalog_match?.esp ?? null
  };
}

/** Recomendaciones a nivel modelo → versión → años (no publicaciones concretas). */
export function buildModelRecommendations(brief, catalogs = []) {
  const modelos = brief?.modelos_recomendados || [];
  if (!modelos.length) return [];

  return modelos.map(m => {
    const cat =
      m.catalog ||
      m.ficha ||
      catalogs.find(
        c =>
          normalizeText(c?.modelo) === normalizeText(m.modelo) &&
          (!m.marca || normalizeText(c?.marca) === normalizeText(m.marca))
      );
    const flat = cat ? flattenCatalog(normalizeCatalog(cat, { marca: m.marca, modelo: m.modelo })) : [];
    const verHi = m.version_destacada || m.version;
    const row =
      (verHi && flat.find(r => r.version?.toLowerCase().includes(String(verHi).toLowerCase()))) ||
      flat.find(r => {
        const min = m.anio_desde || 0;
        const max = m.anio_hasta || 9999;
        return (r.anio_desde ?? 0) <= max && (r.anio_hasta ?? 9999) >= min;
      }) ||
      flat[0] ||
      null;

    const { score, dimensiones } = buildCatalogRowScore(row, brief);
    return {
      marca: m.marca,
      modelo: m.modelo,
      generacion: m.generacion || row?.generacion || null,
      version: row?.version || verHi || null,
      anio_desde: row?.anio_desde ?? m.anio_desde ?? null,
      anio_hasta: row?.anio_hasta ?? m.anio_hasta ?? null,
      motivo: m.motivo || row?.destacado || null,
      motor: row?.motor || null,
      potencia_cv: row?.potencia_cv || null,
      distribucion: row?.distribucion || null,
      esp: row?.esp ?? null,
      airbags: row?.airbags || null,
      ncap: row?.ncap || null,
      destacado: row?.destacado || null,
      score_catalogo: score,
      dimensiones
    };
  });
}

/**
 * @param {string} query
 * @param {unknown[]} listings
 * @param {unknown[]} [catalogs]
 * @param {Record<string, unknown> | null} [brief]
 */
export function analyzeAdvisorQuery(query, listings = [], catalogs = [], brief = null) {
  const q = String(query || '').trim();
  const intent = detectIntent(q);
  const specFilters = parseCatalogSpecFilters(q);
  const filtros = { ...parseAdvisorFilters(q), ...specFilters };
  const sort = filtros.sort || (intent === 'precio_mercado' ? 'mercado_caro' : null);
  const tagged = tagListingsWithMarket(listings);
  const taggedById = new Map(tagged.map(l => [l.id || l.link, l]));

  let matched = filterListings(listings, filtros);
  if (catalogs.length) {
    matched = filterListingsByCatalogSpecs(
      matched,
      Object.keys(specFilters).length ? specFilters : {},
      catalogs
    );
  }
  if (sort) matched = sortListings(matched, sort, tagged);
  else if (intent === 'recomendar') {
    matched = sortListings(matched, 'precio_asc', tagged);
  }

  const listingMode = intent === 'filtrar' || intent === 'precio_mercado';
  const modelosDestacados = buildModelRecommendations(brief, catalogs);

  const caros = listingMode ? tagged.filter(l => l._mercado === 'caro').slice(0, 6) : [];
  const baratos = listingMode ? tagged.filter(l => l._mercado === 'barato').slice(0, 6) : [];
  const destacados = listingMode
    ? matched.slice(0, 8).map(l => rowFromListing(l, taggedById, catalogs))
    : [];

  const resumenNumerico = {
    totalTablero: listings.length,
    coincidenFiltros: matched.length,
    carosEnTablero: caros.length,
    baratosEnTablero: baratos.length,
    filtrosAplicados: { ...filtros, sort: sort || undefined }
  };

  return {
    intent,
    mode: listingMode ? 'listings' : 'catalog',
    query: q,
    resumen: resumenNumerico,
    filtros: resumenNumerico.filtrosAplicados,
    modelosDestacados,
    destacados,
    caros: caros.map(l => rowFromListing(l, taggedById, catalogs)),
    baratos: baratos.map(l => rowFromListing(l, taggedById, catalogs)),
    nota:
      listings.length < 4
        ? 'Pocos autos para comparar precios de mercado con confianza (se necesitan al menos 4 por modelo similar).'
        : null
  };
}

/** Cards visuales cuando el LLM no devolvió JSON. */
export function cardsFromAnalisis(analisis) {
  if (!analisis) return [];

  if (analisis.mode !== 'listings' && analisis.modelosDestacados?.length) {
    return analisis.modelosDestacados.slice(0, 4).map(m => {
      const yrs =
        m.anio_desde && m.anio_hasta ? `${m.anio_desde}–${m.anio_hasta}` : m.anio_desde || null;
      const specs = [
        m.motor,
        m.distribucion,
        m.esp === true ? 'ESP' : m.esp === false ? 'sin ESP' : null,
        m.ncap
      ]
        .filter(Boolean)
        .join(' · ');
      return {
        tipo: 'modelo',
        titulo: [m.marca, m.modelo, m.version].filter(Boolean).join(' '),
        año: yrs,
        score: m.score_catalogo,
        justificacion: [m.motivo, specs, m.destacado].filter(Boolean).join(' — ')
      };
    });
  }

  const pool =
    analisis.intent === 'precio_mercado' && analisis.caros?.length
      ? analisis.caros
      : analisis.destacados;
  return (pool || [])
    .filter(d => d.link)
    .slice(0, 5)
    .map(d => {
      const mercadoTxt =
        d.mercado === 'caro'
          ? 'Por encima del promedio de similares en este tablero'
          : d.mercado === 'barato'
            ? 'Por debajo del promedio de similares'
            : null;
      return {
        tipo: analisis.intent === 'precio_mercado' && d.mercado === 'caro' ? 'alternativa' : 'publicacion',
        titulo: d.titulo,
        precio: d.precio,
        moneda: 'ARS',
        año: d.año,
        kilometros: d.km,
        link: d.link,
        fuente: d.fuente,
        justificacion: [mercadoTxt, d.insightModelo].filter(Boolean).join(' — ')
      };
    });
}
