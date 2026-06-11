// lib/vehicle-catalog.js
// marca → modelo → generación → versión → por_anio (specs que cambian por año, ej. ESP 2021 vs 2022).

export const SCHEMA_VERSION = 2;

export const SOURCE_PRIORITY = {
  human_edit: 4,
  curated: 3,
  ai: 2,
  legacy: 1
};

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** ID estable para generación cuando no viene en el JSON. */
export function stableGenerationId(marca, modelo, nombre) {
  const parts = [slugify(marca), slugify(modelo), slugify(nombre)].filter(Boolean);
  return parts.join('-') || slugify(nombre) || 'gen';
}

/** Clave determinística para upsert en vehicle_year_specs. */
export function buildSpecKey({ generation_id, version, anio_desde, anio_hasta }) {
  return `${generation_id || 'gen'}|${String(version || '').trim()}|${anio_desde}|${anio_hasta}`;
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function arrStr(v) {
  return Array.isArray(v) ? v.map(x => String(x)).filter(Boolean) : [];
}

function parseBool(v) {
  if (v === true || v === 'true' || v === 'Sí' || v === 'si') return true;
  if (v === false || v === 'false' || v === 'No' || v === 'no') return false;
  return null;
}

/** @param {unknown} meta @param {string} [defaultSource] */
export function normalizeSliceMeta(meta, defaultSource = 'ai') {
  if (!meta || typeof meta !== 'object') {
    return {
      source: defaultSource,
      confidence: defaultSource === 'curated' || defaultSource === 'human_edit' ? 0.95 : 0.7,
      updated_at: Date.now(),
      refs: []
    };
  }
  const m = /** @type {Record<string, unknown>} */ (meta);
  const source = String(m.source || defaultSource);
  const confidence =
    typeof m.confidence === 'number' && Number.isFinite(m.confidence) ? m.confidence : null;
  return {
    source,
    confidence,
    updated_at: numOrNull(m.updated_at) ?? Date.now(),
    refs: Array.isArray(m.refs) ? m.refs.map(r => String(r)).filter(Boolean) : []
  };
}

export function sourcePriority(source) {
  return SOURCE_PRIORITY[source] ?? SOURCE_PRIORITY.legacy;
}

/** @param {unknown} slice @param {string} [defaultSource] */
function normalizePorAnio(slice, defaultSource = 'ai') {
  if (!slice || typeof slice !== 'object') return null;
  const x = /** @type {Record<string, unknown>} */ (slice);
  const anio_desde = numOrNull(x.anio_desde ?? x.anio);
  const anio_hasta = numOrNull(x.anio_hasta ?? x.anio ?? anio_desde);
  if (anio_desde == null && anio_hasta == null) return null;
  return {
    anio_desde: anio_desde ?? anio_hasta,
    anio_hasta: anio_hasta ?? anio_desde,
    motor: x.motor != null ? String(x.motor) : null,
    potencia_cv: numOrNull(x.potencia_cv),
    distribucion: x.distribucion != null ? String(x.distribucion) : null,
    transmision: x.transmision != null ? String(x.transmision) : null,
    airbags: x.airbags != null ? String(x.airbags) : null,
    esp: parseBool(x.esp),
    ncap: x.ncap != null ? String(x.ncap) : null,
    nota: x.nota || x.destacado ? String(x.nota || x.destacado) : null,
    meta: normalizeSliceMeta(x.meta, defaultSource)
  };
}

function mergeSpecs(base, overlay) {
  if (!overlay) return { ...base };
  const out = { ...base };
  for (const k of ['motor', 'potencia_cv', 'distribucion', 'transmision', 'airbags', 'esp', 'ncap', 'nota', 'destacado']) {
    if (overlay[k] != null && overlay[k] !== '') out[k] = overlay[k];
  }
  if (overlay.nota && !out.destacado) out.destacado = overlay.nota;
  return out;
}

/** Specs efectivas de una versión para un año concreto. */
export function resolveVersionForYear(version, year) {
  if (!version || year == null) return version;
  const y = Number(year);
  if (!Number.isFinite(y)) return version;
  const base = {
    version: version.version,
    motor: version.motor,
    potencia_cv: version.potencia_cv,
    distribucion: version.distribucion,
    transmision: version.transmision,
    airbags: version.airbags,
    esp: version.esp,
    ncap: version.ncap,
    destacado: version.destacado,
    anio_desde: version.anio_desde,
    anio_hasta: version.anio_hasta
  };
  const slices = version.por_anio || [];
  const hit = slices.find(s => y >= s.anio_desde && y <= s.anio_hasta);
  if (hit) {
    const merged = mergeSpecs(base, hit);
    merged.anio_desde = hit.anio_desde;
    merged.anio_hasta = hit.anio_hasta;
    return merged;
  }
  return base;
}

/** @param {unknown} v @param {string} [defaultSource] */
export function normalizeVersion(v, defaultSource = 'ai') {
  if (!v || typeof v !== 'object') return null;
  const x = /** @type {Record<string, unknown>} */ (v);
  const version = String(x.version || x.nombre || x.nombre_version || '').trim();
  if (!version) return null;
  const seg = x.seguridad && typeof x.seguridad === 'object' ? x.seguridad : {};
  const por_anio = Array.isArray(x.por_anio)
    ? x.por_anio.map(s => normalizePorAnio(s, defaultSource)).filter(Boolean)
    : [];
  const espParsed = parseBool(x.esp ?? seg.esp);

  return {
    version,
    anio_desde: numOrNull(x.anio_desde),
    anio_hasta: numOrNull(x.anio_hasta),
    motor: x.motor ? String(x.motor) : null,
    potencia_cv: numOrNull(x.potencia_cv),
    distribucion: x.distribucion ? String(x.distribucion) : null,
    transmision: x.transmision ? String(x.transmision) : null,
    airbags: x.airbags != null ? String(x.airbags) : seg.airbags != null ? String(seg.airbags) : null,
    esp: espParsed,
    ncap: x.ncap || x.ncap_estrellas || seg.ncap ? String(x.ncap || x.ncap_estrellas || seg.ncap) : null,
    destacado: x.destacado || x.explicacion_coloquial ? String(x.destacado || x.explicacion_coloquial) : null,
    por_anio
  };
}

/** @param {unknown} g @param {{ marca?: string, modelo?: string, defaultSource?: string }} ctx */
export function normalizeGeneracion(g, ctx = {}) {
  if (!g || typeof g !== 'object') return null;
  const x = /** @type {Record<string, unknown>} */ (g);
  const nombre = String(x.nombre || x.generacion || 'Generación').trim();
  const defaultSource = ctx.defaultSource || 'ai';
  const id = x.id
    ? String(x.id)
    : stableGenerationId(ctx.marca, ctx.modelo, nombre);
  const versiones = Array.isArray(x.versiones)
    ? x.versiones.map(v => normalizeVersion(v, defaultSource)).filter(Boolean)
    : [];
  if (!versiones.length) return null;
  return {
    id,
    nombre,
    anio_desde: numOrNull(x.anio_desde),
    anio_hasta: numOrNull(x.anio_hasta),
    notas: x.notas ? String(x.notas) : null,
    versiones
  };
}

/**
 * @param {unknown} raw
 * @param {{ marca?: string, modelo?: string, defaultSource?: string }} defaults
 */
export function normalizeCatalog(raw, defaults = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const p = /** @type {Record<string, unknown>} */ (raw);
  const marca = String(p.marca || defaults.marca || '').trim();
  const modelo = String(p.modelo || defaults.modelo || '').trim();
  const defaultSource = defaults.defaultSource || 'ai';
  const genCtx = { marca, modelo, defaultSource };

  let generaciones = Array.isArray(p.generaciones)
    ? p.generaciones.map(g => normalizeGeneracion(g, genCtx)).filter(Boolean)
    : [];

  if (!generaciones.length && Array.isArray(p.versiones)) {
    const vers = p.versiones.map(v => normalizeVersion(v, defaultSource)).filter(Boolean);
    if (vers.length) {
      generaciones = [
        normalizeGeneracion({
          nombre: p.generacion || 'Generación',
          anio_desde: p.anio_desde,
          anio_hasta: p.anio_hasta,
          versiones: vers
        }, genCtx)
      ].filter(Boolean);
    }
  }

  const prevMeta = p._meta && typeof p._meta === 'object' ? /** @type {Record<string, unknown>} */ (p._meta) : {};

  return {
    schema_version: SCHEMA_VERSION,
    marca,
    modelo,
    resumen: String(p.resumen || ''),
    distribucion_resumen: p.distribucion_resumen ? String(p.distribucion_resumen) : null,
    evitar_si: arrStr(p.evitar_si),
    precio_orientativo_usado: p.precio_orientativo_usado
      ? String(p.precio_orientativo_usado)
      : p.precio_orientativo
        ? String(p.precio_orientativo)
        : null,
    generaciones,
    _meta: {
      last_llm_at: prevMeta.last_llm_at ?? null,
      last_curated_at: prevMeta.last_curated_at ?? null,
      completeness: prevMeta.completeness ? String(prevMeta.completeness) : null
    }
  };
}

export function catalogIsRich(catalog) {
  return Boolean(
    catalog?.generaciones?.length &&
      catalog.generaciones.some(g =>
        g.versiones.some(v => v.motor || v.potencia_cv || (v.por_anio && v.por_anio.length))
      )
  );
}

/** Expande versión en filas por rango de años (por_anio o rango único). */
function expandVersionRows(catalog, gen, ver) {
  const rows = [];
  const base = {
    marca: catalog.marca,
    modelo: catalog.modelo,
    generacion: gen.nombre,
    generacion_id: gen.id,
    version: ver.version
  };

  if (ver.por_anio?.length) {
    for (const slice of ver.por_anio) {
      const merged = mergeSpecs(ver, slice);
      const meta = slice.meta || normalizeSliceMeta(null, 'ai');
      rows.push({
        ...base,
        anio_desde: slice.anio_desde,
        anio_hasta: slice.anio_hasta,
        motor: merged.motor,
        potencia_cv: merged.potencia_cv,
        distribucion: merged.distribucion,
        transmision: merged.transmision,
        airbags: merged.airbags,
        esp: merged.esp,
        ncap: merged.ncap,
        destacado: merged.destacado || slice.nota,
        meta,
        spec_key: buildSpecKey({
          generation_id: gen.id,
          version: ver.version,
          anio_desde: slice.anio_desde,
          anio_hasta: slice.anio_hasta
        })
      });
    }
    return rows;
  }

  const anio_desde = ver.anio_desde ?? gen.anio_desde;
  const anio_hasta = ver.anio_hasta ?? gen.anio_hasta;
  rows.push({
    ...base,
    anio_desde,
    anio_hasta,
    motor: ver.motor,
    potencia_cv: ver.potencia_cv,
    distribucion: ver.distribucion,
    transmision: ver.transmision,
    airbags: ver.airbags,
    esp: ver.esp,
    ncap: ver.ncap,
    destacado: ver.destacado,
    meta: normalizeSliceMeta(null, 'ai'),
    spec_key: buildSpecKey({
      generation_id: gen.id,
      version: ver.version,
      anio_desde,
      anio_hasta
    })
  });
  return rows;
}

/** Una fila por combinación versión × rango de años con specs resueltas. */
export function flattenCatalog(catalog) {
  const rows = [];
  if (!catalog) return rows;
  for (const gen of catalog.generaciones || []) {
    for (const ver of gen.versiones || []) {
      rows.push(...expandVersionRows(catalog, gen, ver));
    }
  }
  return rows;
}

/** ¿El año cae en el rango de la fila? */
export function yearInRow(row, year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return false;
  const min = row.anio_desde ?? 0;
  const max = row.anio_hasta ?? 9999;
  return y >= min && y <= max;
}

/** Mejor fila de catálogo para un listing (marca/modelo/año en título). */
export function matchListingToCatalogRow(listing, catalogs = []) {
  const title = listing.titulo || listing.title || '';
  const parts = title.split(/\s+/);
  const anio = Number(listing.año || listing.anio || listing.year);
  const hay = title.toLowerCase();

  let best = null;
  let bestScore = 0;

  for (const cat of catalogs) {
    if (!cat) continue;
    const marca = (cat.marca || '').toLowerCase();
    const modelo = (cat.modelo || '').toLowerCase();
    if (marca && !hay.includes(marca)) continue;
    if (modelo && !hay.includes(modelo) && !parts.some(p => p.toLowerCase() === modelo)) continue;

    for (const row of flattenCatalog(cat)) {
      let score = 10;
      if (marca && hay.includes(marca)) score += 5;
      if (modelo && hay.includes(modelo)) score += 5;
      if (row.version && hay.includes(row.version.toLowerCase())) score += 8;
      if (Number.isFinite(anio) && yearInRow(row, anio)) score += 20;
      else if (Number.isFinite(anio)) continue;

      if (score > bestScore) {
        bestScore = score;
        best = { ...row, catalog_key: `${cat.marca}|${cat.modelo}` };
      }
    }
  }
  return best;
}

/**
 * Filtros estructurados sobre specs de catálogo (para listings matcheados).
 * @param {Record<string, unknown>} filters
 * @param {unknown} row - fila flattenCatalog
 */
export function catalogRowMatchesFilters(row, filters = {}) {
  if (!row) return false;
  if (filters.esp === true && row.esp !== true) return false;
  if (filters.esp === false && row.esp === true) return false;
  if (filters.distribucion) {
    const want = String(filters.distribucion).toLowerCase();
    const got = String(row.distribucion || '').toLowerCase();
    if (!got.includes(want)) return false;
  }
  if (filters.anioMin && row.anio_hasta && row.anio_hasta < filters.anioMin) return false;
  if (filters.anioMax && row.anio_desde && row.anio_desde > filters.anioMax) return false;
  if (filters.potenciaMin && (row.potencia_cv || 0) < filters.potenciaMin) return false;
  if (filters.marca && row.marca && row.marca.toLowerCase() !== String(filters.marca).toLowerCase()) return false;
  if (filters.modelo && row.modelo && row.modelo.toLowerCase() !== String(filters.modelo).toLowerCase()) return false;
  if (filters.version && row.version && !row.version.toLowerCase().includes(String(filters.version).toLowerCase())) {
    return false;
  }
  return true;
}

export function sliceCatalogForYears(catalog, anioDesde, anioHasta) {
  if (!catalog || (!anioDesde && !anioHasta)) return catalog;
  const min = anioDesde || 0;
  const max = anioHasta || 9999;
  const generaciones = (catalog.generaciones || [])
    .map(g => {
      const versiones = g.versiones
        .map(v => {
          if (v.por_anio?.length) {
            const por_anio = v.por_anio.filter(s => !(s.anio_hasta < min || s.anio_desde > max));
            if (!por_anio.length) return null;
            return { ...v, por_anio };
          }
          const vMin = v.anio_desde ?? g.anio_desde ?? min;
          const vMax = v.anio_hasta ?? g.anio_hasta ?? max;
          if (vMax < min || vMin > max) return null;
          return v;
        })
        .filter(Boolean);
      if (!versiones.length) return null;
      return { ...g, versiones };
    })
    .filter(Boolean);
  return { ...catalog, generaciones };
}

function rowHasMeaningfulSpec(row) {
  return Boolean(
    row.motor ||
      row.potencia_cv != null ||
      row.esp === true ||
      row.esp === false ||
      row.distribucion
  );
}

/**
 * ¿Cada año del rango tiene al menos un slice con specs útiles (motor, esp, etc.)?
 * @param {ReturnType<typeof normalizeCatalog>} catalog
 */
export function catalogCoversYears(catalog, anioDesde, anioHasta) {
  if (!catalog || !catalogIsRich(catalog)) return false;
  if (anioDesde == null && anioHasta == null) return true;

  const rows = flattenCatalog(catalog);
  const min = anioDesde ?? anioHasta;
  const max = anioHasta ?? anioDesde;
  if (min == null || max == null) return catalogIsRich(catalog);

  for (let y = min; y <= max; y++) {
    const covering = rows.filter(r => yearInRow(r, y));
    if (!covering.some(rowHasMeaningfulSpec)) return false;
  }
  return true;
}

/**
 * Huecos de años sin specs en el catálogo (para gap-fill LLM).
 * @returns {Array<{ generacion: string, generacion_id: string, version: string, anio_desde: number, anio_hasta: number }>}
 */
export function findCatalogGaps(catalog, anioDesde, anioHasta) {
  if (!catalog || (anioDesde == null && anioHasta == null)) return [];
  const rows = flattenCatalog(catalog);
  const min =
    anioDesde ??
    Math.min(...rows.map(r => r.anio_desde ?? 9999).filter(y => y < 9999), new Date().getFullYear() - 15);
  const max = anioHasta ?? Math.max(...rows.map(r => r.anio_hasta ?? 0), new Date().getFullYear());
  const gaps = [];
  let runStart = null;

  for (let y = min; y <= max; y++) {
    const covered = rows.filter(r => yearInRow(r, y)).some(rowHasMeaningfulSpec);
    if (!covered) {
      if (runStart == null) runStart = y;
    } else if (runStart != null) {
      gaps.push({ anio_desde: runStart, anio_hasta: y - 1 });
      runStart = null;
    }
  }
  if (runStart != null) gaps.push({ anio_desde: runStart, anio_hasta: max });

  if (!gaps.length) return [];

  const primary = rows.find(rowHasMeaningfulSpec) || rows[0];
  return gaps.map(g => ({
    generacion: primary?.generacion || catalog.generaciones?.[0]?.nombre || 'Generación',
    generacion_id: primary?.generacion_id || catalog.generaciones?.[0]?.id || 'gen',
    version: primary?.version || catalog.generaciones?.[0]?.versiones?.[0]?.version || '',
    ...g
  }));
}

/** Actualiza _meta del catálogo según fuente persistida. */
export function touchCatalogMeta(catalog, source) {
  if (!catalog) return catalog;
  const now = Date.now();
  const meta = { ...(catalog._meta || {}) };
  if (source === 'ai') meta.last_llm_at = now;
  if (source === 'curated' || source === 'human_edit') meta.last_curated_at = now;
  meta.completeness = catalogCoversYears(catalog, null, null) ? 'full' : 'partial';
  return { ...catalog, _meta: meta };
}
