/** Claves del checklist de compra por publicación. null = sin revisar. */
export const CHECKLIST_KEYS = [
  'vtv_ok',
  'service_al_dia',
  'dueno_unico',
  'precio_negociable',
  'titular_ok',
  'sin_siniestros'
];

export const CHECKLIST_LABELS = {
  vtv_ok: 'VTV al día',
  service_al_dia: 'Service documentado',
  dueno_unico: 'Dueño único',
  precio_negociable: 'Precio negociable',
  titular_ok: 'Titular / papeles ok',
  sin_siniestros: 'Sin siniestros declarados'
};

/** @returns {Record<string, boolean|null>} */
export function emptyChecklist() {
  return Object.fromEntries(CHECKLIST_KEYS.map(k => [k, null]));
}

/**
 * Merge shallow de checklist parcial sobre el existente.
 * @param {Record<string, unknown>} existing
 * @param {Record<string, unknown>} patch
 */
export function mergeChecklist(existing = {}, patch = {}) {
  const base = { ...emptyChecklist(), ...existing };
  for (const key of CHECKLIST_KEYS) {
    if (!(key in patch)) continue;
    const v = patch[key];
    base[key] = v === true || v === false ? v : null;
  }
  return base;
}

/** @param {Record<string, unknown>} checklist */
export function checklistProgress(checklist = {}) {
  let done = 0;
  for (const key of CHECKLIST_KEYS) {
    if (checklist[key] === true || checklist[key] === false) done++;
  }
  return { done, total: CHECKLIST_KEYS.length };
}
