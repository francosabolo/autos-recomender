// lib/model-profiles.js
// Catálogo marca → modelo → generación (años) → versión, con caché SQLite.

import { getKnowledge, saveKnowledge, syncVehicleYearSpecs } from './db.js';
import { getCuratedKnowledge, getCuratedCatalog } from './knowledge.js';
import { generarPerfilModelo, generarPerfilModeloGap } from './llm.js';
import { logger } from './logger.js';
import { mergeCatalog } from './catalog-merge.js';
import { validateCatalog } from './catalog-validate.js';
import {
  catalogCoversYears,
  catalogIsRich,
  findCatalogGaps,
  normalizeCatalog,
  sliceCatalogForYears,
  touchCatalogMeta
} from './vehicle-catalog.js';

function resolveStoredSource(existingSource, incomingSource) {
  const rank = { human_edit: 4, curated: 3, ai: 2, legacy: 1 };
  const a = rank[existingSource] ?? 0;
  const b = rank[incomingSource] ?? 0;
  return b >= a ? incomingSource : existingSource;
}

function persistCatalog(marca, modelo, catalog, source = 'curated') {
  const normalized = normalizeCatalog(catalog, { marca, modelo, defaultSource: source });
  const validation = validateCatalog(normalized);
  if (!validation.ok) {
    logger.warn({ marca, modelo, errors: validation.errors }, '[model-profiles] catálogo inválido, no persistido');
    return null;
  }
  for (const w of validation.warnings) {
    logger.warn({ marca, modelo, warning: w }, '[catalog-validate]');
  }

  const existing = getKnowledge(marca, modelo);
  const existingCat = existing
    ? normalizeCatalog(existing.content, { marca, modelo, defaultSource: existing.source })
    : null;
  const merged = existingCat
    ? mergeCatalog(existingCat, normalized, source)
    : touchCatalogMeta(normalized, source);
  const storedSource = existing
    ? resolveStoredSource(existing.source, source)
    : source;

  saveKnowledge({ marca, modelo, content: merged, source: storedSource });
  syncVehicleYearSpecs(merged, storedSource);
  return merged;
}

function curatedLegacyToCatalog(curated, marca, modelo) {
  if (!curated) return null;
  const versiones = (curated.versiones || []).map(v => ({
    version: v.nombre,
    motor: null,
    potencia_cv: null,
    airbags: curated.seguridad?.airbags || null,
    esp: curated.seguridad?.esp === true,
    ncap: curated.seguridad?.ncap_estrellas || null,
    destacado: v.detalle || null
  }));
  const dist = curated.equipamiento?.find(e => /distribuci/i.test(e.nombre));
  return normalizeCatalog(
    {
      resumen: curated.resumen,
      distribucion_resumen: dist?.explicacion_coloquial || null,
      evitar_si: curated.evitar_si,
      precio_orientativo: curated.precio_orientativo,
      generaciones: versiones.length
        ? [{ nombre: 'Versiones en Argentina', versiones }]
        : []
    },
    { marca, modelo, defaultSource: 'curated' }
  );
}

async function fillCatalogGaps(marca, modelo, baseCatalog, gaps, opts = {}) {
  if (!gaps.length || process.env.DEV_SKIP_LLM === 'true') return baseCatalog;
  try {
    const patch = await generarPerfilModeloGap({
      marca,
      modelo,
      existingCatalog: baseCatalog,
      gaps,
      contexto: opts.query,
      precioMax: opts.precioMax
    });
    const patchCat = normalizeCatalog(patch, { marca, modelo, defaultSource: 'ai' });
    if (patchCat?.generaciones?.length) {
      return mergeCatalog(baseCatalog, patchCat, 'ai');
    }
  } catch (err) {
    logger.warn({ err: err.message, marca, modelo }, '[model-profiles] gap-fill falló');
  }
  return baseCatalog;
}

/**
 * @param {{ marca?: string, modelo: string, anio_desde?: number, anio_hasta?: number, generacion?: string, version?: string }} model
 * @param {{ query?: string, precioMax?: number, forceRefresh?: boolean }} opts
 */
export async function resolveModelCatalog(model, opts = {}) {
  const marca = String(model.marca || '').trim();
  const modelo = String(model.modelo || '').trim();
  if (!modelo) return { catalog: null, source: null, cached: false };

  const applySlice = cat =>
    sliceCatalogForYears(cat, model.anio_desde, model.anio_hasta);

  if (!opts.forceRefresh) {
    const cached = getKnowledge(marca, modelo);
    const cat = normalizeCatalog(cached?.content, { marca, modelo, defaultSource: cached?.source });
    if (cat && catalogIsRich(cat)) {
      if (catalogCoversYears(cat, model.anio_desde, model.anio_hasta)) {
        return { catalog: applySlice(cat), source: cached.source, cached: true };
      }
      const gaps = findCatalogGaps(cat, model.anio_desde, model.anio_hasta);
      if (gaps.length && process.env.DEV_SKIP_LLM !== 'true') {
        const filled = await fillCatalogGaps(marca, modelo, cat, gaps, opts);
        if (filled !== cat) {
          const merged = persistCatalog(marca, modelo, filled, 'ai');
          if (merged && catalogCoversYears(merged, model.anio_desde, model.anio_hasta)) {
            return { catalog: applySlice(merged), source: 'ai', cached: false };
          }
        }
      }
      if (catalogCoversYears(cat, model.anio_desde, model.anio_hasta)) {
        return { catalog: applySlice(cat), source: cached.source, cached: true };
      }
    }
  }

  const richCurated = getCuratedCatalog(marca, modelo);
  if (richCurated && !opts.forceRefresh) {
    const catalog = normalizeCatalog(richCurated, { marca, modelo, defaultSource: 'curated' });
    if (catalogIsRich(catalog)) {
      persistCatalog(marca, modelo, catalog, 'curated');
      return { catalog: applySlice(catalog), source: 'curated', cached: false };
    }
  }

  const curated = getCuratedKnowledge(marca, modelo, model.anio_desde);
  const legacyCat = curatedLegacyToCatalog(curated, marca, modelo);
  if (legacyCat && catalogIsRich(legacyCat) && !opts.forceRefresh) {
    persistCatalog(marca, modelo, legacyCat, 'curated');
    return { catalog: applySlice(legacyCat), source: 'curated', cached: false };
  }

  if (process.env.DEV_SKIP_LLM === 'true') {
    return { catalog: legacyCat ? applySlice(legacyCat) : null, source: legacyCat ? 'curated' : null, cached: false };
  }

  const partial = getKnowledge(marca, modelo);
  const partialCat = partial
    ? normalizeCatalog(partial.content, { marca, modelo, defaultSource: partial.source })
    : null;

  try {
    const generated = await generarPerfilModelo({
      marca,
      modelo,
      anio_desde: model.anio_desde,
      anio_hasta: model.anio_hasta,
      contexto: opts.query,
      precioMax: opts.precioMax
    });
    const incoming = normalizeCatalog(generated, { marca, modelo, defaultSource: 'ai' });
    if (incoming?.generaciones?.length) {
      const toStore = partialCat ? mergeCatalog(partialCat, incoming, 'ai') : incoming;
      const merged = persistCatalog(marca, modelo, toStore, 'ai');
      if (merged) {
        return { catalog: applySlice(merged), source: 'ai', cached: false };
      }
    }
  } catch (err) {
    logger.warn({ err: err.message, marca, modelo }, '[model-profiles] generación falló');
  }

  if (legacyCat) {
    persistCatalog(marca, modelo, legacyCat, 'curated');
    return { catalog: applySlice(legacyCat), source: 'curated', cached: false };
  }

  if (partialCat) {
    return { catalog: applySlice(partialCat), source: partial.source, cached: true };
  }

  return { catalog: null, source: null, cached: false };
}

/** @deprecated usar catalog */
export function normalizeProfile(raw) {
  return normalizeCatalog(raw);
}

export async function resolveModelProfile(model, opts) {
  const { catalog, source, cached } = await resolveModelCatalog(model, opts);
  return { profile: catalog, source, cached };
}

/**
 * @param {Array<Record<string, unknown>>} modelos
 * @param {{ query?: string, precioMax?: number }} ctx
 */
export async function enrichRecommendedModels(modelos = [], ctx = {}) {
  return Promise.all(
    (modelos || []).map(async m => {
      const base = {
        marca: m.marca,
        modelo: m.modelo,
        motivo: m.motivo,
        anio_desde: m.anio_desde ?? m.anio_min,
        anio_hasta: m.anio_hasta ?? m.anio_max,
        generacion: m.generacion || null,
        version: m.version || null
      };
      const { catalog, source, cached } = await resolveModelCatalog(base, {
        query: ctx.query,
        precioMax: ctx.precioMax
      });
      return {
        ...base,
        catalog,
        ficha: catalog,
        ficha_source: source,
        ficha_cached: cached
      };
    })
  );
}
