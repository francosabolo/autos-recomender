// lib/mercadolibre-api.js
// Adaptador de la API oficial de MercadoLibre (sitio MLA = Argentina).
// Maneja OAuth (authorization_code + refresh) y la búsqueda /sites/MLA/search,
// mapeando los resultados al schema canónico de listings. JSON real y estable,
// sin scraping ni anti-bot.

import { getConfig, setConfig } from './db.js';
import { buildSearchPhrase, inferAttributes } from './search-filters.js';

const SITE = 'MLA';
const API = 'https://api.mercadolibre.com';
const AUTH = 'https://auth.mercadolibre.com.ar';

export function mlRedirectUri() {
  return process.env.ML_REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/api/ml/callback`;
}
export function mlConfigured() {
  return Boolean(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET);
}
export function mlConnected() {
  return Boolean(getConfig('ml_refresh_token') || getConfig('ml_access_token') || process.env.ML_ACCESS_TOKEN);
}
export function mlStatus() {
  return { configured: mlConfigured(), connected: mlConnected(), redirect_uri: mlRedirectUri() };
}

export function mlAuthUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.ML_CLIENT_ID || '',
    redirect_uri: mlRedirectUri()
  });
  return `${AUTH}/authorization?${params.toString()}`;
}

function saveTokens(data) {
  if (data.access_token) setConfig('ml_access_token', data.access_token);
  if (data.refresh_token) setConfig('ml_refresh_token', data.refresh_token); // ML rota el refresh en cada uso
  if (data.expires_in) setConfig('ml_expires_at', String(Date.now() + Number(data.expires_in) * 1000 - 60000));
}

async function tokenRequest(body) {
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OAuth ML falló (${res.status}): ${data.message || data.error || 'sin detalle'}`);
  return data;
}

export async function mlExchangeCode(code) {
  const data = await tokenRequest({
    grant_type: 'authorization_code',
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    code,
    redirect_uri: mlRedirectUri()
  });
  saveTokens(data);
  return data;
}

async function mlRefresh() {
  const refresh = getConfig('ml_refresh_token') || process.env.ML_REFRESH_TOKEN;
  if (!refresh) throw new Error('No hay refresh_token de ML; reconectá la cuenta.');
  const data = await tokenRequest({
    grant_type: 'refresh_token',
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    refresh_token: refresh
  });
  saveTokens(data);
  return data.access_token;
}

async function validToken() {
  const stored = getConfig('ml_access_token') || process.env.ML_ACCESS_TOKEN;
  const exp = Number(getConfig('ml_expires_at') || 0);
  if (stored && Date.now() < exp) return stored;
  if (getConfig('ml_refresh_token') || process.env.ML_REFRESH_TOKEN) return mlRefresh();
  return stored || null; // token manual de env sin expiry conocido
}

function pickAttr(attrs, id) {
  const a = (attrs || []).find(x => x.id === id);
  if (!a) return null;
  return a.value_name || a.value_struct?.number || a.values?.[0]?.name || null;
}

function mapItem(it) {
  const attrs = it.attributes || [];
  const year = Number(pickAttr(attrs, 'VEHICLE_YEAR') || pickAttr(attrs, 'MODEL_YEAR') || pickAttr(attrs, 'MANUFACTURING_YEAR')) || null;
  const kmRaw = pickAttr(attrs, 'KILOMETERS');
  const km = kmRaw ? parseInt(String(kmRaw).replace(/[^\d]/g, ''), 10) || null : null;
  const inf = inferAttributes(`${it.title} ${pickAttr(attrs, 'FUEL_TYPE') || ''} ${pickAttr(attrs, 'TRANSMISSION') || ''} ${pickAttr(attrs, 'TRACTION_CONTROL') || ''}`);
  return {
    titulo: it.title,
    precio: it.price != null ? Math.round(it.price) : null,
    precio_texto: null,
    moneda: it.currency_id === 'USD' ? 'USD' : 'ARS',
    año: year,
    kilometros: km,
    ubicacion: it.address ? [it.address.city_name, it.address.state_name].filter(Boolean).join(', ') : null,
    link: it.permalink,
    imagen: (it.thumbnail || it.secure_thumbnail || '').replace(/^http:/, 'https:') || null,
    combustible: inf.combustible || null,
    transmision: inf.transmision || null,
    traccion: inf.traccion || null,
    tipo: inf.tipo || null,
    fuente: 'MercadoLibre',
    source: 'mercadolibre'
  };
}

/**
 * Busca en la API oficial de ML. Devuelve un portal_result o null si no hay credenciales.
 */
export async function searchMercadoLibreApi(filtros = {}) {
  if (!mlConnected()) return null;

  const params = new URLSearchParams();
  params.set('q', buildSearchPhrase(filtros));
  if (filtros.precioMin || filtros.precioMax) {
    params.set('price', `${filtros.precioMin || 0}-${filtros.precioMax || 999999999}`);
  }
  params.set('limit', '50');
  const url = `${API}/sites/${SITE}/search?${params.toString()}`;
  const base = { portal: 'mercadolibre', portal_label: 'MercadoLibre', url, method: 'api' };

  const doFetch = async token => fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });

  try {
    let token = await validToken();
    if (!token) return null;
    let res = await doFetch(token);
    if (res.status === 401 || res.status === 403) {
      // token vencido/invalidado: refrescar una vez y reintentar
      try { token = await mlRefresh(); res = await doFetch(token); } catch { /* sigue al manejo de error */ }
    }
    if (!res.ok) {
      return { ...base, listings: [], status: 'blocked', error: `ML API respondió ${res.status}. Reconectá la cuenta si persiste.` };
    }
    const data = await res.json();
    const listings = (data.results || []).map(mapItem).filter(l => l.link && l.titulo);
    return { ...base, listings, status: listings.length ? 'ok' : 'empty' };
  } catch (err) {
    return { ...base, listings: [], status: 'blocked', error: `ML API: ${err.message}` };
  }
}
