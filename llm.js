// llm.js
// Agente conversacional para asesorar sobre compra de autos en Argentina.
// Usa Claude con "tool use" para decidir cuándo scrapear MercadoLibre y cuándo
// buscar info general en la web.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { buscarEnMercadoLibre, buscarEnPortales, PORTALS } from './scraper.js';
import { extraerCards } from './lib/cards.js';
import { logger } from './lib/logger.js';
import { parseNaturalLanguageFilters, compactFilters } from './lib/search-filters.js';
import { getCuratedKnowledge } from './lib/knowledge.js';
import { getKnowledge } from './lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSystemPrompt() {
  const promptPath = path.join(__dirname, 'prompts', 'system.md');
  return fs.readFileSync(promptPath, 'utf8');
}

const SYSTEM = loadSystemPrompt();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-5';

const TOOLS = [
  {
    name: 'buscar_en_portales',
    description: 'Busca publicaciones reales de autos en múltiples portales argentinos y devuelve resultados normalizados. Usar cuando el usuario quiere ojear mercado, armar una lista de candidatos o comparar disponibilidad entre portales.',
    input_schema: {
      type: 'object',
      properties: {
        marca: { type: 'string', description: 'Marca del auto (ej: "Toyota", "Ford"). Opcional.' },
        modelo: { type: 'string', description: 'Modelo (ej: "Corolla", "Fiesta"). Opcional.' },
        condicion: { type: 'string', enum: ['nuevo', 'usado', 'ambos'], description: 'Condición del auto.' },
        combustible: { type: 'string', enum: ['diesel', 'nafta', 'hibrido', 'electrico'], description: 'Combustible buscado. Opcional.' },
        traccion: { type: 'string', enum: ['4x2', '4x4'], description: 'Tracción buscada. Opcional.' },
        transmision: { type: 'string', enum: ['manual', 'automatico'], description: 'Transmisión buscada. Opcional.' },
        tipo: { type: 'string', enum: ['sedan', 'hatchback', 'suv', 'pickup', 'familiar', 'monovolumen', 'coupe', 'furgon'], description: 'Tipo de carrocería. Opcional.' },
        precioMin: { type: 'number', description: 'Precio mínimo en ARS. Opcional.' },
        precioMax: { type: 'number', description: 'Precio máximo en ARS. Opcional.' },
        anioMin: { type: 'number', description: 'Año mínimo. Opcional.' },
        anioMax: { type: 'number', description: 'Año máximo. Opcional.' },
        provincia: { type: 'string', description: 'Provincia (ej: "Santa Fe"). Opcional.' },
        ciudad: { type: 'string', description: 'Ciudad (ej: "Rosario"). Opcional.' },
        portalIds: {
          type: 'array',
          items: { type: 'string', enum: PORTALS.map(p => p.id) },
          description: 'Portales donde buscar. Si falta, buscar en todos.'
        }
      },
      required: ['condicion']
    }
  },
  {
    name: 'buscar_en_mercadolibre',
    description: 'Busca publicaciones reales de autos en MercadoLibre Argentina. Usar para tasar un modelo específico, encontrar alternativas dentro de un presupuesto, o ver disponibilidad real. Devuelve hasta 12 publicaciones con precio, año, km y link.',
    input_schema: {
      type: 'object',
      properties: {
        marca: { type: 'string', description: 'Marca del auto (ej: "Toyota", "Ford"). Opcional.' },
        modelo: { type: 'string', description: 'Modelo (ej: "Corolla", "Fiesta"). Opcional pero recomendado si tasás.' },
        condicion: { type: 'string', enum: ['nuevo', 'usado', 'ambos'], description: 'Condición del auto.' },
        precioMin: { type: 'number', description: 'Precio mínimo en ARS. Opcional.' },
        precioMax: { type: 'number', description: 'Precio máximo en ARS. Opcional.' },
        provincia: { type: 'string', description: 'Provincia (ej: "Santa Fe"). Opcional.' },
        ciudad: { type: 'string', description: 'Ciudad (ej: "Rosario"). Opcional.' }
      },
      required: ['condicion']
    }
  },
  {
    name: 'consultar_modelo',
    description: 'Consulta la ficha de conocimiento de un modelo de auto en el mercado argentino: versiones, equipamiento, seguridad, problemas comunes, qué chequear al comprarlo usado. Usar cuando el usuario pregunta sobre un modelo específico (ej: "¿qué onda el Ka 2013?", "¿cuántos airbags trae?"). NO usar para buscar publicaciones.',
    input_schema: {
      type: 'object',
      properties: {
        marca: { type: 'string', description: 'Marca (ej: "Ford", "Toyota"). Opcional si el modelo es único.' },
        modelo: { type: 'string', description: 'Modelo (ej: "Ka", "Corolla"). Requerido.' },
        anio: { type: 'number', description: 'Año o generación aproximada si el usuario la mencionó. Opcional.' }
      },
      required: ['modelo']
    }
  },
  {
    name: 'web_search',
    description: 'Busca información general en la web sobre modelos de auto: opiniones, problemas comunes, especificaciones, precios oficiales 0km, comparativas. Usar cuando el usuario pregunta sobre características o confiabilidad de un modelo, NO para listings (para eso usar buscar_en_mercadolibre).',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'La consulta de búsqueda en español, contextualizada para Argentina cuando aplique.' }
      },
      required: ['query']
    }
  }
];

async function ejecutarTool(name, input) {
  logger.info({ tool: name, input }, '[tool]');

  if (name === 'buscar_en_portales') {
    const { portalIds, ...filtros } = input;
    const r = await buscarEnPortales(filtros, { portalIds, limit: 12 });
    return JSON.stringify({
      total: r.listings.length,
      portales: r.portal_results.map(p => ({
        portal: p.portal_label,
        url_busqueda: p.url,
        total: p.listings.length,
        error: p.error || undefined
      })),
      resultados: r.listings.slice(0, 12).map(l => ({
        titulo: l.titulo,
        precio: l.precio,
        moneda: l.moneda,
        año: l.año,
        km: l.kilometros,
        ubicacion: l.ubicacion,
        link: l.link,
        imagen: l.imagen,
        fuente: l.fuente || l.source
      }))
    });
  }

  if (name === 'buscar_en_mercadolibre') {
    const r = await buscarEnMercadoLibre(input);
    return JSON.stringify({
      url_busqueda: r.url,
      total: r.listings.length,
      resultados: r.listings.slice(0, 12).map(l => ({
        titulo: l.titulo,
        precio: l.precio,
        moneda: l.moneda,
        año: l.año,
        km: l.kilometros,
        ubicacion: l.ubicacion,
        link: l.link,
        imagen: l.imagen
      })),
      error: r.error || undefined
    });
  }

  if (name === 'consultar_modelo') {
    const cached = getKnowledge(input.marca, input.modelo);
    const curated = getCuratedKnowledge(input.marca, input.modelo, input.anio);
    const content = cached?.content || curated;
    if (!content) {
      return JSON.stringify({
        encontrado: false,
        mensaje: `No hay ficha curada para ${input.marca || ''} ${input.modelo}. Usá web_search para datos puntuales.`
      });
    }
    return JSON.stringify({
      encontrado: true,
      fuente: cached?.source || 'curated',
      marca: input.marca || cached?.brand || null,
      modelo: input.modelo,
      anio_consulta: input.anio || null,
      ficha: content
    });
  }

  if (name === 'web_search') {
    const sub = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Buscá en la web y devolveme un resumen factual y conciso sobre: ${input.query}. No agregues opiniones, solo datos verificables.`
      }]
    });
    const txt = sub.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
    return txt || 'Sin resultados.';
  }

  return JSON.stringify({ error: `Tool desconocida: ${name}` });
}

/**
 * Interpreta una búsqueda coloquial y devuelve brief del asesor + filtros de portal.
 * @param {{ query: string, ciudad?: string, provincia?: string }} args
 */
export async function interpretarBusqueda({ query, ciudad, provincia }) {
  const q = String(query || '').trim();
  const nlFilters = parseNaturalLanguageFilters(q);

  if (process.env.DEV_SKIP_LLM === 'true') {
    const precioMax = nlFilters.precioMax || 20000000;
    return {
      nombre_busqueda: nlFilters.precioMax ? `Búsqueda · hasta $${(precioMax / 1e6).toFixed(0)}M` : 'Búsqueda de autos',
      query_original: q,
      explicacion:
        'Para ciudad y presupuesto acotado, conviene un hatch chico con mecánica simple: bajo consumo, fácil de estacionar y repuestos accesibles. Priorizamos modelos con distribución a cadena y buena reventa en Argentina.',
      modelos_recomendados: [
        { marca: 'Volkswagen', modelo: 'Polo', motivo: 'Cadena, bajo consumo, reventa firme' },
        { marca: 'Ford', modelo: 'Ka', motivo: 'Urbano, económico, repuestos baratos' },
        { marca: 'Renault', modelo: 'Sandero', motivo: 'Espacioso para el precio, mantenimiento accesible' }
      ],
      criterios: ['bajo consumo', 'distribución a cadena', 'fácil estacionar', 'buena reventa'],
      evitar: ['correa bañada en aceite', 'turbo sin service documentado'],
      filtros: compactFilters({
        ...nlFilters,
        tipo: nlFilters.tipo || 'hatchback',
        precioMax: nlFilters.precioMax || precioMax,
        ciudad: ciudad || nlFilters.ciudad,
        provincia: provincia || nlFilters.provincia,
        query: q
      })
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Falta ANTHROPIC_API_KEY en el entorno.');
  }

  const ubicacion = [ciudad, provincia].filter(Boolean).join(', ') || 'Argentina';
  const prompt = `Sos un experto del mercado de autos usados de Argentina. El usuario busca: "${q}".
Ubicación: ${ubicacion}.

Interpretá la intención y devolvé SOLO un JSON válido (sin markdown), con esta forma:
{
  "nombre_busqueda": "título corto para guardar la búsqueda (max 80 chars)",
  "explicacion": "2-4 oraciones en español rioplatense explicando qué modelos convienen y por qué para ESTE caso",
  "modelos_recomendados": [{"marca": "Ford", "modelo": "Ka", "motivo": "una línea concreta"}],
  "criterios": ["bajo consumo", "cadena de distribución", "..."],
  "evitar": ["problemas concretos en AR a evitar, ej correa bañada en aceite"],
  "filtros": {
    "precioMax": number or null,
    "precioMin": number or null,
    "tipo": "hatchback|sedan|suv|pickup|..." or null,
    "combustible": "nafta|diesel|..." or null,
    "transmision": "manual|automatico" or null,
    "traccion": "4x2|4x4" or null,
    "anioMin": number or null,
    "anioMax": number or null
  }
}

Reglas:
- Recomendá 2-4 modelos concretos del mercado argentino cuando el usuario no pide uno específico.
- Los filtros deben ser razonables para scrapear portales (precio en ARS enteros; "20 millones" = 20000000).
- Sé honesto sobre qué evitar en Argentina (CVT maltratada, correa bañada, etc.).
- Si el usuario pide un modelo puntual, modelos_recomendados puede tener solo ese modelo.`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1800,
    messages: [{ role: 'user', content: prompt }]
  });

  const txt = resp.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
  const match = txt.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No se pudo interpretar la búsqueda.');
  const parsed = JSON.parse(match[0]);
  const mergedFilters = compactFilters({
    ...nlFilters,
    ...(parsed.filtros || {}),
    ciudad: ciudad || nlFilters.ciudad,
    provincia: provincia || nlFilters.provincia,
    query: q
  });
  return {
    nombre_busqueda: String(parsed.nombre_busqueda || q).slice(0, 120),
    query_original: q,
    explicacion: String(parsed.explicacion || ''),
    modelos_recomendados: Array.isArray(parsed.modelos_recomendados) ? parsed.modelos_recomendados : [],
    criterios: Array.isArray(parsed.criterios) ? parsed.criterios : [],
    evitar: Array.isArray(parsed.evitar) ? parsed.evitar : [],
    filtros: mergedFilters
  };
}

/**
 * Genera una ficha de conocimiento de un modelo (versiones, problemas en AR, qué chequear)
 * usando Claude + web_search para anclar datos. Devuelve un objeto estructurado.
 * @param {{ marca?: string, modelo: string }} args
 */
export async function generarConocimientoModelo({ marca, modelo }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Falta ANTHROPIC_API_KEY para generar la ficha del modelo.');
  }
  const nombre = `${marca || ''} ${modelo}`.trim();
  const prompt = `Sos un experto del mercado de autos usados de Argentina. Armá una ficha del modelo "${nombre}" para alguien que está por comprarlo usado.
Usá web_search para anclar datos actuales (versiones vigentes en AR, problemas reportados, precios 0km de referencia).
Devolvé SOLO un objeto JSON válido (sin texto antes ni después), con esta forma exacta:
{
  "resumen": "1-2 frases sobre el auto y para quién es",
  "versiones": [{"nombre": "S/SE/XEI/etc", "detalle": "qué trae"}],
  "equipamiento": [{"nombre": "Control de estabilidad", "valor": "Sí/No/según versión", "explicacion_coloquial": "te corrige si patinás en lluvia"}],
  "seguridad": {"airbags": "ej: 2 frontales", "ncap_estrellas": "ej: 2 estrellas (generación 2013)", "esp": true, "explicacion_coloquial": "resumen en criollo"},
  "problemas_comunes": ["problema concreto en AR", "..."],
  "evitar_si": ["correa bañada en aceite", "..."],
  "que_chequear": ["qué mirar al comprarlo", "..."],
  "precio_orientativo": "texto orientativo en ARS, aclarando que depende de año/km/versión"
}
Sé concreto y honesto sobre problemas conocidos en Argentina. No inventes datos que no puedas sostener; si dudás de un dato puntual, omitilo.`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1600,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: prompt }]
  });

  const txt = resp.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
  const match = txt.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No se pudo parsear la ficha generada.');
  return JSON.parse(match[0]);
}

/**
 * @param {Object} args
 * @param {Array<{role:string,content:string}>} args.messages
 * @param {Record<string, unknown>} args.contexto
 */
export async function chat({ messages, contexto }) {
  if (process.env.DEV_SKIP_LLM === 'true') {
    logger.warn('[llm] DEV_SKIP_LLM activo — sin llamada a Claude');
    return {
      texto:
        '[Modo dev] Respuesta mock. Poné `DEV_SKIP_LLM=false` o borrá la variable del `.env` para usar la API de Anthropic.',
      cards: []
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Falta ANTHROPIC_API_KEY en el entorno.');
  }

  let systemFinal = SYSTEM;
  if (contexto && Object.keys(contexto).some(k => contexto[k])) {
    systemFinal += `\n\n# Contexto del usuario (del formulario de arriba)\n${JSON.stringify(contexto, null, 2)}\n\nUsá esta info como dato de base; no la repreguntes salvo que el usuario la contradiga.`;
  }

  let apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

  for (let i = 0; i < 6; i++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemFinal,
      tools: TOOLS,
      messages: apiMessages
    });

    if (resp.stop_reason === 'end_turn') {
      const texto = resp.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
      return extraerCards(texto);
    }

    if (resp.stop_reason === 'tool_use') {
      const toolUses = resp.content.filter(c => c.type === 'tool_use');
      apiMessages.push({ role: 'assistant', content: resp.content });

      const toolResults = await Promise.all(
        toolUses.map(async tu => ({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: await ejecutarTool(tu.name, tu.input)
        }))
      );

      apiMessages.push({ role: 'user', content: toolResults });
      continue;
    }

    const texto = resp.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
    return extraerCards(texto || 'Hubo un problema generando la respuesta. Probá de nuevo.');
  }

  return { texto: 'La búsqueda se complicó demasiado. ¿Podemos arrancar de nuevo con menos cosas?', cards: [] };
}
