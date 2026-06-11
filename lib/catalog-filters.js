// lib/catalog-filters.js
// Parsea y aplica filtros por specs de catálogo (ESP, cadena, año, etc.).

import { normalizeText } from './search-filters.js';
import { catalogRowMatchesFilters, matchListingToCatalogRow } from './vehicle-catalog.js';

export function parseCatalogSpecFilters(query = '') {
  const t = normalizeText(query);
  const out = {};

  if (/\b(con esp|que tenga esp|control de estabilidad|con estabilidad)\b/.test(t)) out.esp = true;
  if (/\b(sin esp|no tenga esp|sin estabilidad)\b/.test(t)) out.esp = false;

  if (/\b(cadena|distribucion a cadena|distribución a cadena)\b/.test(t)) out.distribucion = 'cadena';
  if (/\b(correa|distribucion a correa)\b/.test(t)) out.distribucion = 'correa';

  const anioMin = t.match(/\b(?:desde|a partir de|del)\s*((?:19|20)\d{2})\b/);
  if (anioMin) out.anioMin = Number(anioMin[1]);
  const anioExact = t.match(/\b((?:19|20)\d{2})\s*(?:en adelante|o mas nuevo|o más nuevo)\b/);
  if (anioExact) out.anioMin = Number(anioExact[1]);

  if (/\b(4 airbags|cuatro airbags|mas de 2 airbags)\b/.test(t)) out.airbagsMin = 4;

  return out;
}

/**
 * @param {unknown[]} listings
 * @param {Record<string, unknown>} specFilters
 * @param {unknown[]} catalogs
 */
function withCatalogFields(listing, row) {
  return {
    ...listing,
    catalog_match: row,
    catalog_esp: row?.esp ?? null,
    catalog_distribucion: row?.distribucion ?? null
  };
}

export function filterListingsByCatalogSpecs(listings, specFilters, catalogs = []) {
  const annotated = listings.map(l => withCatalogFields(l, matchListingToCatalogRow(l, catalogs)));
  if (!specFilters || !Object.keys(specFilters).length || !catalogs.length) {
    return annotated;
  }

  return annotated.filter(l => {
    if (!l.catalog_match) return false;
    return catalogRowMatchesFilters(l.catalog_match, specFilters);
  });
}

/** Anota listings con match de catálogo + specs del año del aviso. */
export function annotateListingsWithCatalog(listings, catalogs = []) {
  return listings.map(l => withCatalogFields(l, matchListingToCatalogRow(l, catalogs)));
}
