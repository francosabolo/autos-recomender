import { normalizeText } from './search-filters.js';
import { listingFingerprint } from './search-filters.js';

/**
 * @param {unknown} listing
 * @param {Array<{marca?: string, modelo?: string}>} modelos
 */
export function listingMatchesRecommended(listing, modelos = []) {
  if (!modelos.length) return false;
  const haystack = normalizeText(
    [listing?.marca, listing?.modelo, listing?.brand, listing?.model, listing?.titulo, listing?.title]
      .filter(Boolean)
      .join(' ')
  );
  return modelos.some(m => {
    const brand = normalizeText(m.marca);
    const model = normalizeText(m.modelo);
    if (brand && !haystack.includes(brand)) return false;
    if (model && !haystack.includes(model)) return false;
    return Boolean(model || brand);
  });
}

/** @param {unknown[]} listings */
export function tagRecommendedListings(listings, modelos = []) {
  return (listings || []).map(l => ({
    ...l,
    recomendado: listingMatchesRecommended(l, modelos)
  }));
}

/** Deduplica por huella de contenido, conservando el primero. */
export function dedupeListings(listings = []) {
  const seen = new Set();
  const out = [];
  for (const l of listings) {
    const fp = listingFingerprint(l);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(l);
  }
  return out;
}

/**
 * Ordena: recomendados primero, luego por precio ascendente si hay dato.
 * @param {unknown[]} listings
 */
export function sortListingsForBoard(listings = []) {
  return [...listings].sort((a, b) => {
    const ra = a.recomendado ? 1 : 0;
    const rb = b.recomendado ? 1 : 0;
    if (rb !== ra) return rb - ra;
    const pa = Number(a.precio || a.price || 0);
    const pb = Number(b.precio || b.price || 0);
    if (pa && pb) return pa - pb;
    return 0;
  });
}
