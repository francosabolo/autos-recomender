// lib/extract.js
// Cascada de extracción genérica: convierte HTML arbitrario en listings usando
// una "receta" (selectores CSS) reutilizable. La receta puede venir cacheada o
// ser aprendida por un LLM (ver lib/llm-extract.js). Esto es lo que hace que
// sumar portales no requiera escribir parsers a mano.

import * as cheerio from 'cheerio';
import { inferAttributes } from './search-filters.js';

function parseNum(txt) {
  if (!txt) return null;
  const clean = String(txt).replace(/[^\d]/g, '');
  return clean ? parseInt(clean, 10) : null;
}
function parseYear(txt) {
  const m = String(txt || '').match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}
function parseKm(txt) {
  const m = String(txt || '').match(/([0-9][0-9\.\s]*)\s*km\b/i);
  return m ? parseNum(m[1]) : null;
}
function absUrl(href, base) {
  if (!href) return null;
  try { return new URL(href, base).toString(); } catch { return href; }
}

/**
 * Reduce el HTML para mandarlo a un LLM: saca scripts/estilos/svg y recorta.
 */
export function cleanHtmlForLlm(html, maxLen = 55000) {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe, link, meta, head, path, br').remove();
  let body = $('body').html() || $.root().html() || '';
  body = body.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
  return body.slice(0, maxLen);
}

/**
 * Aplica una receta de extracción al HTML. La receta:
 *   { item: 'CSS de cada tarjeta',
 *     fields: { titulo:{sel,attr}, precio:{sel,attr}, link:{sel,attr}, imagen:{sel,attr}, anio:{...}, km:{...}, ubicacion:{...} } }
 * `sel` es relativo a la tarjeta (vacío = la tarjeta misma); `attr` 'text' o un atributo.
 * @returns {Array<object>} listings normalizados (vacío si la receta no matchea).
 */
export function applyRecipe(html, recipe, { source, sourceLabel, baseUrl } = {}) {
  if (!recipe || !recipe.item) return [];
  let $;
  try { $ = cheerio.load(html); } catch { return []; }
  const fields = recipe.fields || {};
  const out = [];
  const seen = new Set();

  const read = ($el, field, fallbackSel) => {
    const f = field || (fallbackSel ? { sel: fallbackSel } : null);
    if (!f) return null;
    const node = f.sel ? $el.find(f.sel).first() : $el;
    if (!node || !node.length) return null;
    const attr = f.attr || 'text';
    if (attr === 'text') return node.text().replace(/\s+/g, ' ').trim();
    return node.attr(attr) || (attr === 'src' ? node.attr('data-src') : null);
  };

  let items;
  try { items = $(recipe.item); } catch { return []; }
  items.each((_, el) => {
    const $el = $(el);
    const titulo = read($el, fields.titulo) || $el.find('h1,h2,h3,h4,a[title]').first().text().replace(/\s+/g, ' ').trim();
    const linkRaw = read($el, fields.link, 'a[href]') || $el.find('a[href]').first().attr('href');
    const link = absUrl(linkRaw, baseUrl);
    if (!titulo || !link || seen.has(link)) return;
    seen.add(link);
    const priceText = read($el, fields.precio);
    const fullText = `${titulo} ${$el.text()}`;
    const inf = inferAttributes(fullText);
    const img = read($el, fields.imagen, 'img') || $el.find('img').first().attr('data-src') || $el.find('img').first().attr('src');
    out.push({
      titulo: String(titulo).slice(0, 160),
      precio: parseNum(priceText),
      precio_texto: priceText || null,
      moneda: /us\$|u\$s|usd|d[oó]lar/i.test(priceText || '') ? 'USD' : 'ARS',
      año: parseYear(read($el, fields.anio) || fullText),
      kilometros: parseKm(read($el, fields.km) || fullText),
      ubicacion: read($el, fields.ubicacion) || null,
      link,
      imagen: absUrl(img, baseUrl),
      combustible: inf.combustible || null,
      transmision: inf.transmision || null,
      traccion: inf.traccion || null,
      tipo: inf.tipo || null,
      fuente: sourceLabel,
      source
    });
  });
  return out.slice(0, 48);
}
