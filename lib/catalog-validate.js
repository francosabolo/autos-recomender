// lib/catalog-validate.js — validación antes de persistir catálogos.

import { normalizeCatalog } from './vehicle-catalog.js';

const BOOL_STRINGS = new Set(['true', 'false', 'sí', 'si', 'no']);

function parseBoolStrict(v) {
  if (v === true || v === false || v === null || v === undefined) return v;
  if (typeof v === 'string' && BOOL_STRINGS.has(v.toLowerCase())) return v;
  return 'invalid';
}

function walkRawEsp(raw, errors) {
  if (!raw || typeof raw !== 'object') return;
  const p = /** @type {Record<string, unknown>} */ (raw);
  if ('esp' in p && parseBoolStrict(p.esp) === 'invalid') {
    errors.push('esp debe ser boolean o null');
  }
  if (Array.isArray(p.por_anio)) {
    p.por_anio.forEach((s, i) => {
      if (s && typeof s === 'object' && 'esp' in s && parseBoolStrict(s.esp) === 'invalid') {
        errors.push(`por_anio[${i}].esp debe ser boolean o null`);
      }
    });
  }
  if (Array.isArray(p.generaciones)) {
    p.generaciones.forEach(g => walkGeneracionRaw(g, errors));
  }
  if (Array.isArray(p.versiones)) {
    p.versiones.forEach(v => walkVersionRaw(v, errors));
  }
}

function walkGeneracionRaw(g, errors) {
  if (!g || typeof g !== 'object') return;
  const x = /** @type {Record<string, unknown>} */ (g);
  if (Array.isArray(x.versiones)) x.versiones.forEach(v => walkVersionRaw(v, errors));
}

function walkVersionRaw(v, errors) {
  if (!v || typeof v !== 'object') return;
  const x = /** @type {Record<string, unknown>} */ (v);
  if ('esp' in x && parseBoolStrict(x.esp) === 'invalid') {
    errors.push(`versión "${x.version || x.nombre}": esp ambiguo`);
  }
  if (Array.isArray(x.por_anio)) {
    x.por_anio.forEach((s, i) => {
      if (s && typeof s === 'object' && 'esp' in s && parseBoolStrict(s.esp) === 'invalid') {
        errors.push(`por_anio[${i}].esp ambiguo`);
      }
    });
  }
}

function rangesOverlap(a, b) {
  return a.anio_desde <= b.anio_hasta && b.anio_desde <= a.anio_hasta;
}

function validatePorAnioSlices(slices, path, errors, warnings) {
  for (let i = 0; i < slices.length; i++) {
    const s = slices[i];
    const label = `${path}.por_anio[${i}]`;
    if (s.anio_desde == null || s.anio_hasta == null) {
      errors.push(`${label}: faltan anio_desde/anio_hasta`);
      continue;
    }
    if (s.anio_desde > s.anio_hasta) {
      errors.push(`${label}: anio_desde > anio_hasta`);
    }
    const esp = parseBoolStrict(s.esp);
    if (esp === 'invalid') {
      errors.push(`${label}: esp debe ser boolean o null`);
    }
    if (s.potencia_cv != null && !Number.isFinite(Number(s.potencia_cv))) {
      errors.push(`${label}: potencia_cv debe ser numérico`);
    }
    for (let j = i + 1; j < slices.length; j++) {
      if (rangesOverlap(s, slices[j])) {
        warnings.push(`${label} solapa con por_anio[${j}] (${slices[j].anio_desde}–${slices[j].anio_hasta})`);
      }
    }
  }
}

/**
 * @param {unknown} catalog
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateCatalog(catalog) {
  const errors = [];
  const warnings = [];
  walkRawEsp(catalog, errors);
  const c = normalizeCatalog(catalog);
  if (!c) {
    return { ok: false, errors: ['catálogo vacío o inválido'], warnings };
  }
  if (!c.marca || !c.modelo) {
    errors.push('marca y modelo son obligatorios');
  }
  if (!c.generaciones?.length) {
    errors.push('sin generaciones');
  }

  for (const gen of c.generaciones || []) {
    const gPath = `generación "${gen.nombre}"`;
    if (!gen.id) warnings.push(`${gPath}: sin id estable`);
    for (const ver of gen.versiones || []) {
      const vPath = `${gPath} / ${ver.version}`;
      if (!ver.version?.trim()) {
        errors.push(`${vPath}: nombre de versión vacío`);
      }
      const esp = parseBoolStrict(ver.esp);
      if (esp === 'invalid') {
        errors.push(`${vPath}: esp debe ser boolean o null`);
      }
      if (ver.por_anio?.length) {
        validatePorAnioSlices(ver.por_anio, vPath, errors, warnings);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
