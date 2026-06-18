// lib/llm-extract.js
// Aprende una "receta" de extracción (selectores CSS) a partir del HTML de un portal,
// usando Claude. Se corre solo en primer contacto o cuando la receta cacheada se rompe;
// el resto de las veces se usa la receta sin LLM (gratis). Módulo separado de llm.js
// para no crear ciclo con scraper.js.

import { cleanHtmlForLlm } from './extract.js';
import { getLlmClient, getModel, hasLlmKey, llmKeyError } from './llm-client.js';

/**
 * @param {string} html  HTML de la página de resultados (idealmente ya renderizado).
 * @param {{ url?: string }} ctx
 * @returns {Promise<object>} receta { item, fields }
 */
export async function aprenderRecetaExtraccion(html, { url } = {}) {
  if (!hasLlmKey()) throw new Error(llmKeyError());
  const client = await getLlmClient();
  const clean = cleanHtmlForLlm(html, 50000);

  const prompt = `Te paso el HTML (recortado) de una página de resultados de un portal de autos usados de Argentina${url ? ` (${url})` : ''}.
Identificá los selectores CSS para extraer cada PUBLICACIÓN de la lista de resultados.
Devolvé SOLO un objeto JSON válido (sin texto antes ni después) con esta forma:
{
  "item": "selector CSS que matchea CADA tarjeta de aviso",
  "fields": {
    "titulo": { "sel": "selector relativo", "attr": "text" },
    "precio": { "sel": "selector relativo", "attr": "text" },
    "link":   { "sel": "a", "attr": "href" },
    "imagen": { "sel": "img", "attr": "src" },
    "anio":   { "sel": "selector relativo", "attr": "text" },
    "km":     { "sel": "selector relativo", "attr": "text" }
  }
}
Reglas:
- "item" debe matchear MUCHAS tarjetas (la grilla de resultados), no una sola.
- "sel" es relativo a la tarjeta; si el dato está en la tarjeta misma, usá "sel": "".
- Si un campo no existe en el sitio, omitilo.
- Preferí selectores estables (data-*, ids, itemprop) sobre clases de estilo cuando puedas.
HTML:
${clean}`;

  const resp = await client.messages.create({
    model: getModel(),
    max_tokens: 900,
    messages: [{ role: 'user', content: prompt }]
  });
  const txt = resp.content.filter(c => c.type === 'text').map(c => c.text).join('');
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('La receta generada no se pudo parsear.');
  return JSON.parse(m[0]);
}
