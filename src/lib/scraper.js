// scraper.js
// Scraping multiportal para anuncios de autos en Argentina.

import { createHash } from 'crypto';
import * as cheerio from 'cheerio';
import { logger } from './logger.js';
import { scraperCacheGet, scraperCacheSet, getRecipe, saveRecipe, getAsyncJob, saveAsyncJob, clearAsyncJob } from './db.js';
import { buildSearchPhrase, matchesFilters, slugify, inferAttributes, listingFingerprint } from './search-filters.js';
import { applyRecipe } from './extract.js';
import { aprenderRecetaExtraccion } from './llm-extract.js';
import { hasLlmKey } from './llm-client.js';
import { searchMercadoLibreApi, mlConnected } from './mercadolibre-api.js';

const BASE = 'https://autos.mercadolibre.com.ar';

const SCRAPER_TIMEOUT_MS = Number(process.env.SCRAPER_TIMEOUT_MS) || 25000;
const DEFAULT_PORTAL_IDS = ['mercadolibre', 'kavak', 'rosariogarage', 'facebook_marketplace'];

export const PORTALS = [
  {
    id: 'mercadolibre',
    label: 'MercadoLibre',
    canScrape: true,
    kind: 'mercadolibre',
    fetchStrategy: 'direct' // protegido por anti-bot; render no rinde en free. Usar API oficial en el futuro.
  },
  {
    id: 'kavak',
    label: 'Kavak',
    canScrape: true,
    kind: 'generic',
    fetchStrategy: 'direct', // las tarjetas vienen en el HTML SSR: no hace falta render.
    searchUrlTemplate: process.env.KAVAK_SEARCH_URL_TEMPLATE || 'https://www.kavak.com/ar/usados'
  },
  {
    id: 'rosariogarage',
    label: 'Rosario Garage',
    canScrape: true,
    kind: 'generic',
    fetchStrategy: 'render', // sitio JS: necesita render para traer los avisos.
    // El sitio no tiene búsqueda por query usable; usamos la categoría Autos y filtramos localmente.
    searchUrlTemplate: process.env.ROSARIOGARAGE_SEARCH_URL_TEMPLATE || 'https://www.rosariogarage.com/Autos'
  },
  {
    id: 'facebook_marketplace',
    label: 'Facebook Marketplace',
    canScrape: false,
    kind: 'external',
    searchUrlTemplate: 'https://www.facebook.com/marketplace/search/?query={query}'
  }
];

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_HEADERS = { 'User-Agent': DEFAULT_UA, 'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8' };

/**
 * Trae el HTML (ya renderizado) de una URL. Agnóstico de proveedor: por defecto usa
 * fetch directo (gratis), pero se puede enrutar por un servicio "web→API" que resuelva
 * JS y anti-bot, configurando SCRAPER_PROVIDER. Sobre el HTML resultante corre la misma
 * cadena de parseo (JSON-LD → __NEXT_DATA__ → CSS), así el proveedor solo resuelve el
 * "traer la página", no la extracción.
 * @returns {Promise<{ ok: boolean, status: number, html: string }>}
 */
async function fetchPageHtml(url, signal, strategy = 'direct') {
  const provider = (process.env.SCRAPER_PROVIDER || 'direct').toLowerCase();

  // 'direct' siempre usa fetch propio (gratis, rápido). El provider (render/anti-bot) se reserva
  // para los portales marcados 'render', así no malgastamos créditos en los que igual no lo necesitan.
  if (strategy !== 'render' || provider === 'direct') {
    const res = await fetch(url, { signal, headers: BASE_HEADERS });
    return { ok: res.ok, status: res.status, html: res.ok ? await res.text() : '' };
  }

  if (provider === 'firecrawl') {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) throw new Error('SCRAPER_PROVIDER=firecrawl pero falta FIRECRAWL_API_KEY');
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['html'] })
    });
    const data = await res.json().catch(() => ({}));
    const html = data?.data?.html || data?.html || '';
    return { ok: res.ok && Boolean(html), status: res.status, html };
  }

  // Genérico: cualquier servicio web→API. Plantilla con {url}; auth opcional.
  if (provider === 'http') {
    const tmpl = process.env.SCRAPER_FETCH_URL_TEMPLATE;
    if (!tmpl) throw new Error('SCRAPER_PROVIDER=http pero falta SCRAPER_FETCH_URL_TEMPLATE');
    const endpoint = tmpl.replace('{url}', encodeURIComponent(url));
    const headers = { ...BASE_HEADERS };
    if (process.env.SCRAPER_FETCH_AUTH) headers.Authorization = process.env.SCRAPER_FETCH_AUTH;
    const res = await fetch(endpoint, { signal, headers });
    const ct = res.headers.get('content-type') || '';
    let html = '';
    if (ct.includes('application/json')) {
      const j = await res.json().catch(() => ({}));
      html = j.html || j.content || j.body || j.data?.html || '';
    } else {
      html = await res.text();
    }
    return { ok: res.ok && Boolean(html), status: res.status, html };
  }

  throw new Error(`SCRAPER_PROVIDER desconocido: ${provider}`);
}

function buildSearchUrl({ condicion, provincia, ciudad, precioMin, precioMax, marca, modelo }) {
  const parts = [BASE];

  if (condicion === 'nuevo') parts.push('nuevos');
  else if (condicion === 'usado') parts.push('usados');

  if (provincia) parts.push(slugify(provincia));
  if (ciudad) parts.push(slugify(ciudad));

  if (marca) parts.push(slugify(marca));
  if (modelo) parts.push(slugify(modelo));

  let url = parts.join('/');

  if (precioMin || precioMax) {
    const min = precioMin || 0;
    const max = precioMax || 999999999;
    url += `/_PriceRange_${min}-${max}`;
  }

  return url;
}

function buildPortalSearchUrl(portal, filtros) {
  if (portal.kind === 'mercadolibre') return buildSearchUrl({ condicion: 'usado', ...filtros });

  // Kavak filtra por modelo en la ruta: /ar/usados/<marca>-<modelo> (ej: toyota-corolla).
  if (portal.id === 'kavak') {
    const slug = slugify([filtros.marca, filtros.modelo].filter(Boolean).join(' ') || filtros.query || '');
    return slug ? `https://www.kavak.com/ar/usados/${slug}` : 'https://www.kavak.com/ar/usados';
  }

  const phrase = buildSearchPhrase(filtros);
  const query = encodeURIComponent(phrase);
  const max = filtros.precioMax ? encodeURIComponent(String(filtros.precioMax)) : '';
  const min = filtros.precioMin ? encodeURIComponent(String(filtros.precioMin)) : '';
  return portal.searchUrlTemplate
    .replace('{query}', query)
    .replace('{precioMax}', max)
    .replace('{precioMin}', min);
}

function parseNumero(txt) {
  if (!txt) return null;
  const limpio = txt.replace(/[^\d]/g, '');
  return limpio ? parseInt(limpio, 10) : null;
}

function absoluteUrl(href, baseUrl) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function parseYear(text) {
  const match = String(text || '').match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function parseKm(text) {
  const match = String(text || '').match(/([0-9][0-9\.\s]*)\s*km\b/i);
  return match ? parseNumero(match[1]) : null;
}

function decodeDuckDuckGoUrl(href) {
  if (!href) return null;
  try {
    const normalized = href.startsWith('//') ? `https:${href}` : href;
    const parsed = new URL(normalized);
    const uddg = parsed.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : normalized;
  } catch {
    return href;
  }
}

function extractPriceText(text) {
  const match = String(text || '').match(/(?:US\$|USD|\$)\s*[0-9][0-9\.\,]*/i);
  return match ? match[0] : null;
}

function cleanIndexedTitle(title, snippet, filtros) {
  const raw = `${title || ''} ${snippet || ''}`.replace(/\s+/g, ' ').trim();
  const phrase = buildSearchPhrase(filtros);
  const carLike = raw.match(/((?:Ford|Toyota|Volkswagen|Chevrolet|Renault|Peugeot|Citroen|Fiat|Honda|Nissan|Jeep|Hyundai|Kia|BMW|Audi|Mercedes)[^$]{4,80}?)(?=(?:US\$|USD|\$)|\s+(?:19|20)\d{2}\b)/i);
  if (carLike) return carLike[1].replace(/Comprar\s+\d+\s+autos.*$/i, '').trim();
  return title && !/comprar|autos usados|mercadolibre/i.test(title)
    ? title
    : `${phrase} · resultado indexado`;
}

async function buscarEnIndiceWeb(portal, filtros, originalUrl) {
  if (portal.id !== 'mercadolibre') return [];

  const phrase = buildSearchPhrase(filtros);
  const query = `site:autos.mercadolibre.com.ar ${phrase}`.trim();
  const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8'
      }
    });
    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const out = [];
    const seen = new Set();

    $('.result').not('.result--ad').each((_, el) => {
      const $el = $(el);
      const title = $el.find('.result__a').first().text().trim();
      const snippet = $el.find('.result__snippet').first().text().replace(/\s+/g, ' ').trim();
      const link = decodeDuckDuckGoUrl($el.find('.result__a').first().attr('href'));
      if (!title || !link || !link.includes('autos.mercadolibre.com.ar') || seen.has(link)) return;

      const combined = `${title} ${snippet}`;
      const priceText = extractPriceText(combined);
      const listing = {
        titulo: cleanIndexedTitle(title, snippet, filtros),
        precio: parseNumero(priceText),
        precio_texto: priceText,
        moneda: /us\$|usd/i.test(priceText || '') ? 'USD' : 'ARS',
        año: parseYear(combined) || filtros.anioMin || null,
        kilometros: parseKm(combined),
        ubicacion: null,
        link,
        imagen: null,
        fuente: 'MercadoLibre · indexado',
        source: 'mercadolibre_index',
        marca: filtros.marca || null,
        modelo: filtros.modelo || null
      };

      if (!matchesFilters(listing, filtros)) return;
      seen.add(link);
      out.push(listing);
    });

    if (out.length) {
      logger.info({ portal: portal.id, count: out.length, originalUrl }, '[scraper] fallback indexado ok');
    }
    return out.slice(0, 12);
  } catch (err) {
    logger.warn({ err: err?.message, portal: portal.id }, '[scraper] fallback indexado falló');
    return [];
  }
}

function buildAssistedSearchCard(result, filtros) {
  const phrase = buildSearchPhrase(filtros);
  return {
    titulo: `Abrir búsqueda en ${result.portal_label}: ${phrase}`,
    precio: null,
    precio_texto: null,
    moneda: 'ARS',
    año: filtros.anioMin && filtros.anioMin === filtros.anioMax ? filtros.anioMin : null,
    kilometros: null,
    ubicacion: null,
    link: result.url,
    imagen: null,
    fuente: `${result.portal_label} · búsqueda asistida`,
    source: `${result.portal}_search`,
    marca: filtros.marca || null,
    modelo: filtros.modelo || null,
    combustible: filtros.combustible || null,
    traccion: filtros.traccion || null
  };
}

/**
 * Parser primario y portable: datos estructurados JSON-LD (`application/ld+json`).
 * Mucho más estable que las clases CSS porque el esquema cambia poco.
 */
export function parseJsonLdListings(html, { source, sourceLabel, baseUrl } = {}) {
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();

  const pushNode = n => {
    const titulo = n.name || n.title;
    if (!titulo) return;
    const offer = Array.isArray(n.offers) ? n.offers[0] : n.offers;
    const precioRaw = offer ? offer.price ?? offer.lowPrice : n.price;
    const precio = Number(precioRaw);
    const link = absoluteUrl(n.url || n['@id'] || offer?.url, baseUrl);
    if (!link || seen.has(link)) return;
    const text = `${titulo} ${n.description || ''}`;
    const inf = inferAttributes(text);
    const km = n.mileageFromOdometer?.value ?? n.mileageFromOdometer;
    seen.add(link);
    out.push({
      titulo: String(titulo).slice(0, 160),
      precio: Number.isFinite(precio) ? Math.round(precio) : null,
      precio_texto: Number.isFinite(precio) ? `$${precio}` : null,
      moneda: /usd/i.test(offer?.priceCurrency || '') ? 'USD' : 'ARS',
      año: Number(n.vehicleModelDate || n.modelDate) || parseYear(text),
      kilometros: km != null ? parseNumero(String(km)) : parseKm(text),
      ubicacion: null,
      link,
      imagen: (Array.isArray(n.image) ? n.image[0] : n.image) || null,
      combustible: inf.combustible || null,
      transmision: inf.transmision || null,
      traccion: inf.traccion || null,
      tipo: inf.tipo || null,
      fuente: sourceLabel,
      source
    });
  };

  const collect = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(collect);
    const type = node['@type'];
    const typeStr = Array.isArray(type) ? type.join(' ') : String(type || '');
    if (/Product|Vehicle|Car|IndividualProduct/i.test(typeStr)) pushNode(node);
    if (Array.isArray(node.itemListElement)) node.itemListElement.forEach(it => collect(it.item || it));
    if (node['@graph']) collect(node['@graph']);
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    try { collect(JSON.parse($(el).contents().text() || $(el).text())); } catch { /* json inválido */ }
  });
  return out.slice(0, 48);
}

/**
 * Parser para sitios Next.js: lee el blob estándar `#__NEXT_DATA__` y busca objetos
 * que parezcan publicaciones (con precio + link). El id del script es estable.
 */
export function parseNextDataListings(html, { source, sourceLabel, baseUrl } = {}) {
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').text();
  if (!raw) return [];
  let data;
  try { data = JSON.parse(raw); } catch { return []; }

  const out = [];
  const seen = new Set();
  const looksListing = o =>
    o && typeof o === 'object' && !Array.isArray(o) &&
    (o.price != null || o.precio != null) && (o.permalink || o.url || o.link);

  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (looksListing(node)) {
      const link = absoluteUrl(node.permalink || node.url || node.link, baseUrl);
      const titulo = node.title || node.titulo || node.name;
      if (link && titulo && !seen.has(link)) {
        seen.add(link);
        const text = `${titulo} ${node.subtitle || ''}`;
        const inf = inferAttributes(text);
        const pic = Array.isArray(node.pictures) ? (node.pictures[0]?.url || node.pictures[0]?.secure_url) : null;
        out.push({
          titulo: String(titulo).slice(0, 160),
          precio: Number(node.price ?? node.precio) || null,
          precio_texto: null,
          moneda: /usd/i.test(node.currency_id || node.currency || '') ? 'USD' : 'ARS',
          año: Number(node.year || node.anio) || parseYear(text),
          kilometros: Number(node.km || node.mileage) || parseKm(text),
          ubicacion: node.location || node.city || null,
          link,
          imagen: node.thumbnail || node.image || pic || null,
          combustible: inf.combustible || null,
          transmision: inf.transmision || null,
          traccion: inf.traccion || null,
          tipo: inf.tipo || null,
          fuente: sourceLabel,
          source
        });
      }
    }
    for (const k in node) walk(node[k]);
  };
  walk(data);
  return out.slice(0, 48);
}

/**
 * Parsea el HTML de la página de resultados de ML.
 * @param {string} html
 */
export function parseListings(html) {
  const $ = cheerio.load(html);
  const results = [];

  $('li.ui-search-layout__item, div.ui-search-result__wrapper').each((_, el) => {
    const $el = $(el);

    const titulo = $el.find('h2, h3.poly-component__title, a.poly-component__title').first().text().trim();
    const precioTxt = $el.find('.andes-money-amount__fraction').first().text().trim();
    const link = $el.find('a.poly-component__title, a.ui-search-link').first().attr('href');
    const imagen = $el.find('img').first().attr('data-src') || $el.find('img').first().attr('src');

    const atributos = [];
    $el.find('.poly-attributes_list__item, li.ui-search-card-attributes__attribute').each((_, a) => {
      atributos.push($(a).text().trim());
    });

    if (titulo && precioTxt) {
      const anio = atributos.find(a => /^(19|20)\d{2}$/.test(a));
      const kmAttr = atributos.find(a => /km$/i.test(a));
      const inferred = inferAttributes(`${titulo} ${atributos.join(' ')}`);

      results.push({
        titulo,
        precio: parseNumero(precioTxt),
        precio_texto: `$${precioTxt}`,
        moneda: 'ARS',
        año: anio ? parseInt(anio, 10) : null,
        kilometros: kmAttr ? parseNumero(kmAttr) : null,
        ubicacion: atributos.find(a => /,/.test(a)) || null,
        link,
        imagen,
        combustible: inferred.combustible || null,
        transmision: inferred.transmision || null,
        traccion: inferred.traccion || null,
        tipo: inferred.tipo || null,
        fuente: 'MercadoLibre',
        source: 'mercadolibre'
      });
    }
  });

  return results;
}

export function parseGenericListings(html, { source, sourceLabel, baseUrl }) {
  const $ = cheerio.load(html);
  const results = [];
  const seen = new Set();

  $('article, li, .card, .vehicle, .vehiculo, .listing, .resultado, .item').each((_, el) => {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (!text || text.length < 20) return;
    if (!/\$|us\$|usd|km|\b(19|20)\d{2}\b/i.test(text)) return;

    const link = absoluteUrl($el.find('a[href]').first().attr('href'), baseUrl);
    if (!link || seen.has(link)) return;

    const title =
      $el.find('h1,h2,h3,h4,a[title]').first().text().trim() ||
      $el.find('a[href]').first().text().trim() ||
      text.slice(0, 90);
    if (!title) return;

    const priceText =
      ($el.find('[class*=price], [class*=precio], .valor, strong').first().text().match(/(?:US\$|USD|\$)\s*[\d\.\,]+/i) || [])[0] ||
      (text.match(/(?:US\$|USD|\$)\s*[\d\.\,]+/i) || [])[0];

    seen.add(link);
    const inferred = inferAttributes(text);
    results.push({
      titulo: title.slice(0, 160),
      precio: parseNumero(priceText),
      precio_texto: priceText || null,
      moneda: /us\$|usd/i.test(priceText || '') ? 'USD' : 'ARS',
      año: parseYear(text),
      kilometros: parseKm(text),
      ubicacion: null,
      link,
      imagen: absoluteUrl($el.find('img').first().attr('data-src') || $el.find('img').first().attr('src'), baseUrl),
      combustible: inferred.combustible || null,
      transmision: inferred.transmision || null,
      traccion: inferred.traccion || null,
      tipo: inferred.tipo || null,
      fuente: sourceLabel,
      source
    });
  });

  return results.slice(0, 24);
}

function sha(s) {
  return createHash('sha256').update(s).digest('hex');
}

// --- ScraperAPI Async: render sin bloquear (submit + poll) ---
function asyncRenderEnabled() {
  return process.env.SCRAPER_ASYNC === 'true' && Boolean(process.env.SCRAPERAPI_API_KEY);
}

async function submitAsyncRender(url) {
  try {
    const res = await fetch('https://async.scraperapi.com/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: process.env.SCRAPERAPI_API_KEY, url, apiParams: { render: true } })
    });
    const data = await res.json().catch(() => ({}));
    if (data.id && data.statusUrl) { saveAsyncJob(sha(url), data.id, data.statusUrl); return true; }
    logger.warn({ url, data: JSON.stringify(data).slice(0, 200) }, '[scraper] async submit sin id');
    return false;
  } catch (err) {
    logger.warn({ err: err?.message, url }, '[scraper] async submit falló');
    return false;
  }
}

async function pollAsyncRender(url) {
  const job = getAsyncJob(sha(url));
  if (!job) return { none: true };
  // Jobs viejos (>6 min) se descartan y se reintentan.
  if (Date.now() - job.created_at > 6 * 60 * 1000) { clearAsyncJob(sha(url)); return { none: true }; }
  try {
    const res = await fetch(job.status_url);
    const data = await res.json().catch(() => ({}));
    if (data.status === 'finished') return { done: true, html: data.response?.body || '' };
    if (data.status === 'failed') { clearAsyncJob(sha(url)); return { done: true, failed: true }; }
    return { done: false }; // running
  } catch {
    return { done: false };
  }
}

function httpErrorMessage(status) {
  if (status === 403 || status === 401) {
    return `HTTP ${status}: MercadoLibre bloqueó o rechazó la petición (probable detección de bot). Probá más tarde o desde otra red.`;
  }
  if (status === 429) {
    return `HTTP ${status}: demasiadas peticiones a MercadoLibre. Esperá unos minutos.`;
  }
  if (status >= 500) {
    return `HTTP ${status}: MercadoLibre no respondió bien (error de servidor).`;
  }
  return `HTTP ${status}`;
}

export async function buscarEnMercadoLibre(filtros) {
  if (mlConnected()) {
    const api = await searchMercadoLibreApi(filtros);
    if (api) return { url: api.url, listings: api.listings, error: api.error };
  }
  const url = buildSearchUrl(filtros);
  return fetchAndParsePortal({
    portal: PORTALS.find(p => p.id === 'mercadolibre'),
    filtros,
    url,
    parser: parseListings
  });
}

// Cascada de extracción, de más estable a menos:
//   JSON-LD → __NEXT_DATA__ → receta cacheada → receta aprendida por LLM → CSS heurístico.
async function parseHtmlCascade(html, { portal, filtros, url, parser }) {
  const ctx = { source: portal.id, sourceLabel: portal.label, baseUrl: url };
  let method = 'jsonld';
  let parsed = parseJsonLdListings(html, ctx);
  if (!parsed.length) { parsed = parseNextDataListings(html, ctx); method = 'nextdata'; }

  if (!parsed.length) {
    const cached = getRecipe(portal.id);
    if (cached) {
      const r = applyRecipe(html, cached, ctx);
      if (r.length) { parsed = r; method = 'recipe'; }
    }
  }

  if (!parsed.length && hasLlmKey()) {
    try {
      const recipe = await aprenderRecetaExtraccion(html, { url });
      const r = applyRecipe(html, recipe, ctx);
      if (r.length) { parsed = r; method = 'recipe-learned'; saveRecipe(portal.id, recipe); }
    } catch (err) {
      logger.warn({ err: err?.message, portal: portal.id }, '[scraper] aprendizaje de receta falló');
    }
  }

  if (!parsed.length) { parsed = parser(html, ctx); method = 'css'; }

  const botwall = /account-verification|gz\/account|unusual traffic|verificá que sos/i.test(html);
  let finalListings = parsed.filter(listing => matchesFilters(listing, filtros));
  let status = finalListings.length ? 'ok' : (botwall ? 'blocked' : (html.length > 2000 ? 'changed' : 'empty'));
  let error;

  if (!finalListings.length && portal.id === 'mercadolibre') {
    const idx = await buscarEnIndiceWeb(portal, filtros, url);
    if (idx.length) { finalListings = idx; method = 'index'; status = 'partial'; }
  }
  if (!finalListings.length && botwall) {
    error = 'El portal pidió verificación anti-bot; con fetch directo no se puede leer. Configurá un proveedor de fetch o reintentá.';
  }

  logger.info({ portal: portal.id, url, count: finalListings.length, method, status }, '[scraper] parse');
  return { listings: finalListings, status, method, error };
}

async function fetchAndParsePortal({ portal, filtros, url, parser, asyncMode }) {
  const urlHash = sha(url);

  try {
    const cached = scraperCacheGet(urlHash);
    if (cached && Array.isArray(cached.listings) && cached.listings.length > 0) {
      logger.info({ portal: portal.id, url }, '[scraper] cache hit');
      return cached;
    }
  } catch (err) {
    logger.warn({ err: err?.message }, '[scraper] cache read omitido');
  }

  // Rama async: render sin bloquear. Devuelve 'pending' mientras el job corre; el front re-consulta.
  if (asyncMode && portal.fetchStrategy === 'render' && asyncRenderEnabled()) {
    const poll = await pollAsyncRender(url);
    const pendingOut = msg => ({ portal: portal.id, portal_label: portal.label, url, listings: [], status: 'pending', error: msg });
    if (poll.none) { await submitAsyncRender(url); return pendingOut('Buscando en segundo plano (puede tardar ~1 min)…'); }
    if (!poll.done) return pendingOut('Buscando en segundo plano…');
    if (poll.failed || !poll.html || poll.html.length < 500) {
      clearAsyncJob(urlHash);
      return { portal: portal.id, portal_label: portal.label, url, listings: [], status: 'blocked', error: 'El render en segundo plano falló; reintentá.' };
    }
    clearAsyncJob(urlHash);
    const parsedOut = await parseHtmlCascade(poll.html, { portal, filtros, url, parser });
    const out = { portal: portal.id, portal_label: portal.label, url, ...parsedOut };
    scraperCacheSet(urlHash, url, out);
    return out;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SCRAPER_TIMEOUT_MS);

  try {
    const res = await fetchPageHtml(url, controller.signal, portal.fetchStrategy);

    if (!res.ok) {
      const msg = httpErrorMessage(res.status);
      logger.warn({ status: res.status, url }, '[scraper] HTTP error');
      const out = { portal: portal.id, portal_label: portal.label, url, listings: [], error: msg, status: 'blocked' };
      scraperCacheSet(urlHash, url, out);
      return out;
    }

    const html = res.html;

    if (!html || html.length < 500) {
      logger.warn({ url, len: html?.length }, '[scraper] HTML sospechosamente corto');
      const out = {
        portal: portal.id,
        portal_label: portal.label,
        url,
        listings: [],
        error: 'La respuesta fue vacía o demasiado corta (probable bloqueo).',
        status: 'blocked'
      };
      scraperCacheSet(urlHash, url, out);
      return out;
    }

    const parsedOut = await parseHtmlCascade(html, { portal, filtros, url, parser });
    const out = { portal: portal.id, portal_label: portal.label, url, ...parsedOut };
    scraperCacheSet(urlHash, url, out);
    return out;
  } catch (err) {
    const name = err?.name || '';
    const message = err?.message || String(err);

    if (name === 'AbortError' || message.includes('aborted')) {
      logger.error({ url, ms: SCRAPER_TIMEOUT_MS }, '[scraper] timeout');
      const out = {
        portal: portal.id,
        portal_label: portal.label,
        url,
        listings: [],
        error: `Timeout al scrapear (${SCRAPER_TIMEOUT_MS} ms). El portal tardó demasiado o la red falló.`,
        status: 'blocked'
      };
      return out;
    }

    logger.error({ err: message, url }, '[scraper] error');
    const out = { portal: portal.id, portal_label: portal.label, url, listings: [], error: `Error de red o parseo: ${message}`, status: 'blocked' };
    scraperCacheSet(urlHash, url, out);
    return out;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function buscarEnPortales(filtros, options = {}) {
  const requested = Array.isArray(options.portalIds) && options.portalIds.length ? options.portalIds : DEFAULT_PORTAL_IDS;
  const selected = requested
    .map(id => PORTALS.find(p => p.id === id))
    .filter(Boolean);

  const results = await Promise.all(selected.map(async portal => {
    // MercadoLibre: preferimos la API oficial (JSON real) si la cuenta está conectada.
    if (portal.id === 'mercadolibre' && mlConnected()) {
      const apiResult = await searchMercadoLibreApi(filtros);
      if (apiResult) return apiResult;
    }

    const url = buildPortalSearchUrl(portal, filtros);
    if (!portal.canScrape) {
      return {
        portal: portal.id,
        portal_label: portal.label,
        url,
        listings: [],
        error: `${portal.label} requiere sesión y no permite scraping confiable. Te dejamos el link de búsqueda para abrirlo a mano.`,
        status: 'link_only'
      };
    }

    const parser = portal.kind === 'mercadolibre'
      ? parseListings
      : (html, ctx) => parseGenericListings(html, ctx);

    return fetchAndParsePortal({ portal, filtros, url, parser, asyncMode: options.async });
  }));

  const listings = [];
  const seen = new Set();

  for (const result of results) {
    // Solo entran al feed las publicaciones reales; los portales sin data se ven en el reporte
    // (con su link y estado), no como cards rotas.
    const sourceListings = result.listings?.length ? result.listings : [];
    for (const listing of sourceListings) {
      const key = `${listing.source || result.portal}:${listing.link || listing.titulo}`;
      if (seen.has(key)) continue;
      seen.add(key);
      listings.push({ ...listing, source: listing.source || result.portal, fuente: listing.fuente || result.portal_label });
      if (options.limit && listings.length >= options.limit) break;
    }
    if (options.limit && listings.length >= options.limit) break;
  }

  return {
    filtros,
    portal_results: results,
    listings: dedupeReposts(listings)
  };
}

// ¿Es un anuncio real (no un placeholder de búsqueda asistida ni estimado)?
function isRealListing(l) {
  return l.source !== 'radar_estimate' && !/_search$/.test(l.source || '');
}

// Entre dos re-posts (misma huella) elige el "mejor": real > con foto > más barato.
function pickBetterListing(a, b) {
  if (isRealListing(a) !== isRealListing(b)) return isRealListing(a) ? a : b;
  if (Boolean(a.imagen) !== Boolean(b.imagen)) return a.imagen ? a : b;
  const pa = Number(a.precio) || Infinity;
  const pb = Number(b.precio) || Infinity;
  return pa <= pb ? a : b;
}

// Colapsa la misma publicación que aparece varias veces (cross-post / re-post).
function dedupeReposts(listings) {
  const byFp = new Map();
  const order = [];
  for (const l of listings) {
    const fp = listingFingerprint(l);
    // Las cards de búsqueda asistida no tienen contenido comparable: no se deduplican.
    if (/_search$/.test(l.source || '')) { order.push({ fp: `__keep_${order.length}`, l }); continue; }
    if (!byFp.has(fp)) { byFp.set(fp, l); order.push({ fp, l }); }
    else byFp.set(fp, pickBetterListing(byFp.get(fp), l));
  }
  return order.map(o => byFp.get(o.fp) || o.l);
}
