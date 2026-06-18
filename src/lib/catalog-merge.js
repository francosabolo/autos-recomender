// lib/catalog-merge.js — merge por slice con prioridad human_edit > curated > ai > legacy.

import { logger } from './logger.js';
import {
  normalizeCatalog,
  normalizeSliceMeta,
  sourcePriority,
  touchCatalogMeta
} from './vehicle-catalog.js';

function mergeField(existing, incoming, incomingSource, existingSource) {
  if (incoming == null || incoming === '') return existing;
  if (existing == null || existing === '') return incoming;
  if (sourcePriority(incomingSource) >= sourcePriority(existingSource)) return incoming;
  return existing;
}

function mergeStringArray(existing = [], incoming = [], incomingSource, existingSource) {
  if (!incoming.length) return existing;
  if (!existing.length) return incoming;
  if (sourcePriority(incomingSource) >= sourcePriority(existingSource)) {
    const set = new Set([...incoming, ...existing]);
    return [...set];
  }
  const set = new Set([...existing, ...incoming]);
  return [...set];
}

function sliceKey(slice) {
  return `${slice.anio_desde}|${slice.anio_hasta}`;
}

function mergePorAnioSlice(existing, incoming, incomingSource) {
  const existingSource = existing.meta?.source || 'legacy';
  if (sourcePriority(incomingSource) < sourcePriority(existingSource)) {
    return existing;
  }
  if (sourcePriority(incomingSource) === sourcePriority(existingSource)) {
    return { ...existing, ...incoming, meta: incoming.meta || existing.meta };
  }
  if (sourcePriority(existingSource) > sourcePriority(incomingSource)) {
    logger.warn(
      { existingSource, incomingSource, range: sliceKey(existing) },
      '[catalog-merge] slice curated/human no pisado por fuente inferior'
    );
    return existing;
  }
  return { ...existing, ...incoming, meta: incoming.meta || normalizeSliceMeta(null, incomingSource) };
}

function mergeVersion(existing, incoming, incomingSource) {
  const existingSource = 'curated';
  const porMap = new Map();
  for (const s of existing.por_anio || []) porMap.set(sliceKey(s), s);
  for (const s of incoming.por_anio || []) {
    const key = sliceKey(s);
    const prev = porMap.get(key);
    porMap.set(key, prev ? mergePorAnioSlice(prev, s, incomingSource) : s);
  }

  const merged = {
    ...existing,
    version: mergeField(existing.version, incoming.version, incomingSource, existingSource),
    motor: mergeField(existing.motor, incoming.motor, incomingSource, existingSource),
    potencia_cv: mergeField(existing.potencia_cv, incoming.potencia_cv, incomingSource, existingSource),
    distribucion: mergeField(existing.distribucion, incoming.distribucion, incomingSource, existingSource),
    transmision: mergeField(existing.transmision, incoming.transmision, incomingSource, existingSource),
    airbags: mergeField(existing.airbags, incoming.airbags, incomingSource, existingSource),
    esp: incoming.esp != null && sourcePriority(incomingSource) >= sourcePriority(existingSource)
      ? incoming.esp
      : existing.esp ?? incoming.esp,
    ncap: mergeField(existing.ncap, incoming.ncap, incomingSource, existingSource),
    destacado: mergeField(existing.destacado, incoming.destacado, incomingSource, existingSource),
    anio_desde: mergeField(existing.anio_desde, incoming.anio_desde, incomingSource, existingSource),
    anio_hasta: mergeField(existing.anio_hasta, incoming.anio_hasta, incomingSource, existingSource),
    por_anio: [...porMap.values()].sort((a, b) => a.anio_desde - b.anio_desde)
  };

  if (!merged.por_anio.length && (incoming.por_anio?.length || existing.por_anio?.length)) {
    merged.por_anio = [...porMap.values()];
  }

  return merged;
}

function mergeGeneracion(existing, incoming, incomingSource, ctx) {
  const versionMap = new Map();
  for (const v of existing.versiones || []) versionMap.set(v.version.toLowerCase(), v);
  for (const v of incoming.versiones || []) {
    const key = v.version.toLowerCase();
    const prev = versionMap.get(key);
    versionMap.set(key, prev ? mergeVersion(prev, v, incomingSource) : v);
  }

  return {
    ...existing,
    id: existing.id || incoming.id,
    nombre: mergeField(existing.nombre, incoming.nombre, incomingSource, 'curated'),
    anio_desde: mergeField(existing.anio_desde, incoming.anio_desde, incomingSource, 'curated'),
    anio_hasta: mergeField(existing.anio_hasta, incoming.anio_hasta, incomingSource, 'curated'),
    notas: mergeField(existing.notas, incoming.notas, incomingSource, 'curated'),
    versiones: [...versionMap.values()]
  };
}

/**
 * @param {unknown} existing
 * @param {unknown} incoming
 * @param {string} incomingSource
 */
export function mergeCatalog(existing, incoming, incomingSource = 'ai') {
  const ex = normalizeCatalog(existing, { defaultSource: 'curated' });
  const inc = normalizeCatalog(incoming, { defaultSource: incomingSource });
  if (!ex) return touchCatalogMeta(inc, incomingSource);
  if (!inc) return ex;

  const ctx = { marca: ex.marca || inc.marca, modelo: ex.modelo || inc.modelo };
  const genMap = new Map();
  for (const g of ex.generaciones || []) {
    genMap.set(g.id || g.nombre.toLowerCase(), g);
  }
  for (const g of inc.generaciones || []) {
    const key = g.id || g.nombre.toLowerCase();
    const prev = genMap.get(key);
    genMap.set(key, prev ? mergeGeneracion(prev, g, incomingSource, ctx) : g);
  }

  const merged = normalizeCatalog(
    {
      ...ex,
      marca: ex.marca || inc.marca,
      modelo: ex.modelo || inc.modelo,
      resumen: mergeField(ex.resumen, inc.resumen, incomingSource, 'curated') || ex.resumen,
      distribucion_resumen: mergeField(
        ex.distribucion_resumen,
        inc.distribucion_resumen,
        incomingSource,
        'curated'
      ),
      precio_orientativo_usado: mergeField(
        ex.precio_orientativo_usado,
        inc.precio_orientativo_usado,
        incomingSource,
        'curated'
      ),
      evitar_si: mergeStringArray(ex.evitar_si, inc.evitar_si, incomingSource, 'curated'),
      generaciones: [...genMap.values()],
      _meta: { ...ex._meta, ...inc._meta }
    },
    { ...ctx, defaultSource: incomingSource }
  );

  return touchCatalogMeta(merged, incomingSource);
}
