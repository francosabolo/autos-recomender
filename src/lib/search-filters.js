const BRANDS = [
  'alfa romeo',
  'audi',
  'bmw',
  'chevrolet',
  'citroen',
  'fiat',
  'ford',
  'honda',
  'hyundai',
  'jeep',
  'kia',
  'mercedes benz',
  'mercedes-benz',
  'mitsubishi',
  'nissan',
  'peugeot',
  'renault',
  'subaru',
  'suzuki',
  'toyota',
  'volkswagen',
  'volvo'
];

const COMMON_MODELS = [
  'amarok',
  'berlingo',
  'captur',
  'civic',
  'corolla',
  'cruze',
  'ecosport',
  'etios',
  'fiesta',
  'focus',
  'frontier',
  'gol',
  'golf',
  'hilux',
  'hr-v',
  'ka',
  'kangoo',
  'kicks',
  'logan',
  'onix',
  'palio',
  'partner',
  'prisma',
  'ranger',
  'sandero',
  'spin',
  'stepway',
  'sw4',
  'taos',
  'tiguan',
  'tracker',
  'vento',
  'yaris'
];

const STOPWORDS = new Set([
  '4x4',
  'diesel',
  'nafta',
  'hibrido',
  'hibrida',
  'menos',
  'hasta',
  'desde',
  'modelo',
  'marca',
  'pesos',
  'millones',
  'millon',
  'ars',
  'autos',
  'auto',
  'camioneta',
  'de',
  'del',
  'la',
  'el',
  'un',
  'una',
  'por'
]);

// Tipos de carrocería y las palabras que los delatan en un título/descripción.
const TIPOS = [
  ['pickup', ['pickup', 'pick up', 'pick-up', 'camioneta', 'hilux', 'ranger', 'amarok', 'frontier', 's10', 'toro', 'sw4 no']],
  ['suv', ['suv', 'todo terreno', 'todoterreno', 'crossover']],
  ['familiar', ['familiar', 'station wagon', 'rural', 'sw ', 'break']],
  ['monovolumen', ['monovolumen', 'minivan', 'spin', 'doblo', 'kangoo', 'partner', 'berlingo']],
  ['furgon', ['furgon', 'furgoneta', 'utilitario', 'van']],
  ['coupe', ['coupe', 'cupe']],
  ['hatchback', ['hatchback', 'hatch', '5 puertas', '3 puertas']],
  ['sedan', ['sedan', '4 puertas']]
];

export function detectTipo(text) {
  const t = normalizeText(text);
  for (const [tipo, keys] of TIPOS) {
    if (keys.some(k => t.includes(normalizeText(k)))) return tipo;
  }
  return null;
}

/**
 * Infiere atributos (combustible, tracción, transmisión, tipo) de un texto libre,
 * para enriquecer listados scrapeados que solo traen título.
 */
export function inferAttributes(text) {
  const t = normalizeText(text);
  const out = {};
  if (/\bdiesel\b/.test(t)) out.combustible = 'diesel';
  else if (/\bnafta\b/.test(t)) out.combustible = 'nafta';
  else if (/\bhibrid[oa]\b/.test(t)) out.combustible = 'hibrido';
  else if (/\belectric[oa]\b/.test(t)) out.combustible = 'electrico';
  if (/\b4\s*x\s*4\b|\b4wd\b|\bawd\b/.test(t)) out.traccion = '4x4';
  else if (/\b4\s*x\s*2\b/.test(t)) out.traccion = '4x2';
  if (/\bautomatic[oa]\b|\btiptronic\b|\bcvt\b|\bs-?tronic\b|\bdsg\b/.test(t)) out.transmision = 'automatico';
  else if (/\bmanual\b/.test(t)) out.transmision = 'manual';
  const tipo = detectTipo(t);
  if (tipo) out.tipo = tipo;
  return out;
}

export function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-');
}

/**
 * Huella de contenido para detectar re-posts (la misma publicación en otro link/portal).
 * Usa título normalizado + año + km redondeado a 1000 (ignora el precio a propósito,
 * para que un mismo auto con precio cambiado siga siendo el mismo).
 */
export function listingFingerprint(listing = {}) {
  const title = normalizeText(listing.titulo || listing.title || '');
  const year = listing.año || listing.anio || listing.year || '';
  const kmRaw = listing.kilometros ?? listing.km ?? '';
  const kmBucket = kmRaw !== '' && Number.isFinite(Number(kmRaw)) ? Math.round(Number(kmRaw) / 1000) : '';
  return `${title}|${year}|${kmBucket}`;
}

function parseAmount(raw, unit = '') {
  if (!raw) return null;
  const normalized = String(raw).replace(/\./g, '').replace(',', '.');
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  const u = normalizeText(unit);
  if (u.startsWith('m') || number < 1000) return Math.round(number * 1000000);
  return Math.round(number);
}

function findPrice(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseAmount(match[1], match[2]);
  }
  return null;
}

export function parseNaturalLanguageFilters(query = '') {
  const text = normalizeText(query);
  const filters = {};
  if (!text) return filters;

  const maxPrice = findPrice(text, [
    /(?:menos de|hasta|max(?:imo)?|menor a|por debajo de|<)\s*\$?\s*([0-9]+(?:[\.,][0-9]+)?)\s*(m|millones|millon)?/,
    /\$?\s*([0-9]+(?:[\.,][0-9]+)?)\s*(m|millones|millon)\s*(?:o menos|max)/
  ]);
  if (maxPrice) filters.precioMax = maxPrice;

  const minPrice = findPrice(text, [
    /(?:desde|min(?:imo)?|mayor a|mas de|>)\s*\$?\s*([0-9]+(?:[\.,][0-9]+)?)\s*(m|millones|millon)?/
  ]);
  if (minPrice) filters.precioMin = minPrice;

  if (/\bdiesel\b/.test(text)) filters.combustible = 'diesel';
  if (/\bnafta\b/.test(text)) filters.combustible = 'nafta';
  if (/\bhibrid[oa]\b/.test(text)) filters.combustible = 'hibrido';
  if (/\b4\s*x\s*4\b|\b4wd\b|\bawd\b/.test(text)) filters.traccion = '4x4';
  if (/\b4\s*x\s*2\b/.test(text)) filters.traccion = '4x2';
  if (/\bautomatic[oa]\b|\bautomatica\b|\bat\b/.test(text)) filters.transmision = 'automatico';
  if (/\bmanual\b|\bmt\b/.test(text)) filters.transmision = 'manual';
  const tipoNL = detectTipo(text);
  if (tipoNL) filters.tipo = tipoNL;

  const yearMatch = text.match(/(?:modelo|anio|año)\s*((?:19|20)\d{2})\b/) || text.match(/\b((?:19|20)\d{2})\b/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    filters.anioMin = year;
    filters.anioMax = year;
  }

  const explicitBrand = text.match(/\bmarca\s+([a-z0-9 ]{2,30})/);
  const brand = BRANDS.find(b => {
    const nb = normalizeText(b);
    return text === nb || text.includes(` ${nb} `) || text.startsWith(`${nb} `) || text.endsWith(` ${nb}`);
  });
  if (explicitBrand) {
    filters.marca = titleCase(explicitBrand[1].split(' ').slice(0, 2).join(' '));
  } else if (brand) {
    filters.marca = titleCase(brand.replace('-', ' '));
  }

  const explicitModel = text.match(/\bmodelo\s+([a-z0-9][a-z0-9 -]{1,30})/);
  if (explicitModel && !/^(?:19|20)\d{2}$/.test(explicitModel[1].trim())) {
    filters.modelo = titleCase(cleanModel(explicitModel[1]));
  } else {
    const model = COMMON_MODELS.find(m => text === m || text.includes(` ${m} `) || text.endsWith(` ${m}`) || text.startsWith(`${m} `));
    if (model) filters.modelo = titleCase(model);
  }

  return compactFilters(filters);
}

function cleanModel(value) {
  return String(value)
    .split(/\s+/)
    .filter(part => part && !STOPWORDS.has(part) && !/^(?:19|20)\d{2}$/.test(part))
    .slice(0, 3)
    .join(' ');
}

function titleCase(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map(w => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

export function compactFilters(filters = {}) {
  const out = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value == null || value === '') continue;
    if (['precioMin', 'precioMax', 'anioMin', 'anioMax'].includes(key)) {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) out[key] = Math.round(n);
      continue;
    }
    out[key] = String(value).trim();
  }
  return out;
}

export function mergeSearchFilters(query, filters = {}) {
  return compactFilters({
    ...parseNaturalLanguageFilters(query),
    ...compactFilters(filters),
    query: query ? String(query).trim() : filters.query
  });
}

export function matchesFilters(listing, filters = {}) {
  const f = compactFilters(filters);
  const haystack = normalizeText([
    listing.titulo,
    listing.marca,
    listing.modelo,
    listing.combustible,
    listing.traccion,
    listing.transmision
  ].filter(Boolean).join(' '));

  // Atributo categórico estructurado: descarta solo si el listado lo tiene y no coincide.
  // Si no hay dato (común al scrapear solo títulos), le damos el beneficio de la duda.
  const attrOk = (wanted, structured) => {
    if (!wanted) return true;
    if (!structured) return true; // sin dato: aceptar (la frase de búsqueda ya sesga el portal)
    return normalizeText(structured) === normalizeText(wanted);
  };

  if (f.precioMin && Number(listing.precio || 0) < f.precioMin) return false;
  if (f.precioMax && Number(listing.precio || 0) > f.precioMax) return false;
  if (f.anioMin && Number(listing.año || listing.anio || 0) < f.anioMin) return false;
  if (f.anioMax && Number(listing.año || listing.anio || 9999) > f.anioMax) return false;
  if (f.marca && !haystack.includes(normalizeText(f.marca))) return false;
  if (f.modelo && !haystack.includes(normalizeText(f.modelo))) return false;
  if (f.combustible && !haystack.includes(normalizeText(f.combustible))) return false;
  if (!attrOk(f.traccion, listing.traccion)) return false;
  if (!attrOk(f.transmision, listing.transmision)) return false;
  if (!attrOk(f.tipo, listing.tipo)) return false;
  return true;
}

export function buildSearchPhrase(filters = {}) {
  const f = compactFilters(filters);
  const structured = [
    f.marca,
    f.modelo,
    // El tipo de carrocería solo suma a la búsqueda si no especificaste modelo (evita "Ka sedan").
    !f.modelo ? f.tipo : null,
    f.traccion,
    f.combustible,
    f.transmision,
    f.anioMin && f.anioMin === f.anioMax ? f.anioMin : null
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  return structured || f.query || 'autos usados';
}
