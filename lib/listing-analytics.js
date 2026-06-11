// lib/listing-analytics.js
// Estadísticas de mercado sobre el feed visible (p25/p75 por segmento).

import { normalizeText } from './search-filters.js';

function marketKey(listing) {
  const title = normalizeText(listing.titulo || listing.title || '');
  const tokens = title.split(' ').filter(Boolean);
  const brand = tokens[0] || 'auto';
  const model = tokens[1] || '';
  return `${brand} ${model}`.trim();
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const b = Math.floor(pos);
  const rest = pos - b;
  return sorted[b + 1] !== undefined ? sorted[b] + rest * (sorted[b + 1] - sorted[b]) : sorted[b];
}

/** @param {unknown[]} listings */
export function computeMarketStats(listings = []) {
  const groups = {};
  for (const c of listings) {
    const p = Number(c.precio || c.price);
    if (!p) continue;
    (groups[marketKey(c)] ||= []).push(p);
  }
  const stats = {};
  for (const [k, arr] of Object.entries(groups)) {
    if (arr.length < 4) continue;
    arr.sort((a, b) => a - b);
    stats[k] = { p25: quantile(arr, 0.25), p75: quantile(arr, 0.75), n: arr.length, mediana: quantile(arr, 0.5) };
  }
  return stats;
}

/** @param {unknown[]} listings */
export function tagListingsWithMarket(listings = []) {
  const stats = computeMarketStats(listings);
  return listings.map(c => {
    const p = Number(c.precio || c.price);
    const s = stats[marketKey(c)];
    let mercado = null;
    if (p && s) {
      if (p <= s.p25) mercado = 'barato';
      else if (p >= s.p75) mercado = 'caro';
      else mercado = 'normal';
    }
    return { ...c, _mercado: mercado, _mercadoStats: s || null };
  });
}
