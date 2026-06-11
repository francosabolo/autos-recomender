// server.js
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { chat, generarConocimientoModelo, interpretarBusqueda } from './llm.js';
import { PORTALS, buscarEnPortales } from './scraper.js';
import { getCuratedKnowledge } from './lib/knowledge.js';
import { mlAuthUrl, mlExchangeCode, mlStatus, mlConfigured } from './lib/mercadolibre-api.js';
import { logger } from './lib/logger.js';
import { hasLlmKey, initLlmClient, llmProvider } from './lib/llm-client.js';
import {
  parseChatRequest,
  parseCreateBoardRequest,
  parseDiscoverRequest,
  parsePinListingRequest,
  parseSearchRequest,
  parseUpdateListingRequest,
  parseUpdateBoardRequest,
  parseRefreshBoardRequest,
  parseRecommendSearchRequest
} from './lib/validation.js';
import { mergeSearchFilters, compactFilters } from './lib/search-filters.js';
import { dedupeListings, sortListingsForBoard, tagRecommendedListings } from './lib/recommend.js';
import { analyzeAdvisorQuery, cardsFromAnalisis } from './lib/advisor-query.js';
import { annotateListingsWithCatalog } from './lib/catalog-filters.js';
import { buildListingAnalysis } from './lib/listing-score.js';
import { tagListingsWithMarket } from './lib/listing-analytics.js';
import { enrichBriefWithTramite, getTransactionGuidePayload } from './lib/transaction-guide.js';
import { enrichRecommendedModels } from './lib/model-profiles.js';
import {
  getDb,
  saveSessionMessages,
  getSessionById,
  listSessionsRecent,
  createBoard,
  updateBoard,
  listBoards,
  getBoardById,
  getTodayDigest,
  getKnowledge,
  saveKnowledge,
  saveListingsToBoard,
  updateBoardListingStatus,
  markBoardListingsSeen,
  touchBoardChecked,
  saveSearchRun
} from './lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

try {
  getDb();
} catch (err) {
  logger.error({ err: err.message }, '[db] no se pudo abrir SQLite — persistencia y caché desactivadas');
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/portals', (_req, res) => {
  res.json({
    ok: true,
    portals: PORTALS.map(p => ({
      id: p.id,
      label: p.label,
      canScrape: p.canScrape
    }))
  });
});

// Ficha de conocimiento de un modelo (cacheada en DB, curada como semilla, IA on-demand).
app.get('/api/knowledge', (req, res) => {
  const marca = (req.query.marca || '').toString().trim();
  const modelo = (req.query.modelo || '').toString().trim();
  if (!modelo) return res.status(400).json({ ok: false, error: 'Falta el modelo.' });
  try {
    const cached = getKnowledge(marca, modelo);
    if (cached) return res.json({ ok: true, knowledge: cached.content, source: cached.source, updated_at: cached.updated_at, cached: true });
    const curated = getCuratedKnowledge(marca, modelo);
    if (curated) return res.json({ ok: true, knowledge: curated, source: 'curated', cached: false });
    res.json({ ok: true, knowledge: null });
  } catch (err) {
    logger.error({ err: err.message }, '[api] knowledge get');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Generar/actualizar la ficha de un modelo.
app.post('/api/knowledge', async (req, res) => {
  const marca = (req.body?.marca || '').toString().trim();
  const modelo = (req.body?.modelo || '').toString().trim();
  if (!modelo) return res.status(400).json({ ok: false, error: 'Falta el modelo.' });
  try {
    if (hasLlmKey()) {
      const content = await generarConocimientoModelo({ marca, modelo });
      const saved = saveKnowledge({ marca, modelo, content, source: 'ai' });
      return res.json({ ok: true, knowledge: saved.content, source: 'ai', updated_at: saved.updated_at });
    }
    // Sin API key: caemos a la ficha curada si existe.
    const curated = getCuratedKnowledge(marca, modelo);
    if (curated) {
      const saved = saveKnowledge({ marca, modelo, content: curated, source: 'curated' });
      return res.json({ ok: true, knowledge: saved.content, source: 'curated', updated_at: saved.updated_at });
    }
    res.status(400).json({ ok: false, error: 'Para generar la ficha de este modelo necesitás configurar CURSOR_API_KEY o ANTHROPIC_API_KEY.' });
  } catch (err) {
    logger.error({ err: err.message, marca, modelo }, '[api] knowledge generate');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- MercadoLibre OAuth (conexión a la API oficial) ---
app.get('/api/ml/status', (_req, res) => res.json({ ok: true, ...mlStatus() }));

app.get('/api/ml/auth', (_req, res) => {
  if (!mlConfigured()) return res.status(400).send('Falta configurar ML_CLIENT_ID y ML_CLIENT_SECRET en el .env');
  res.redirect(mlAuthUrl());
});

app.get('/api/ml/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Falta el parámetro code de autorización.');
  try {
    await mlExchangeCode(String(code));
    logger.info('[api] ML conectado');
    res.redirect('/?ml=connected');
  } catch (err) {
    logger.error({ err: err.message }, '[api] ml callback');
    res.status(500).send(`No se pudo conectar MercadoLibre: ${err.message}`);
  }
});

// Vista "Hoy": qué cambió hoy en todas tus alertas (novedades + bajadas de precio).
app.get('/api/today', (_req, res) => {
  try {
    const digest = getTodayDigest();
    res.json({ ok: true, ...digest });
  } catch (err) {
    logger.error({ err: err.message }, '[api] today');
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/boards', (_req, res) => {
  try {
    res.json({ ok: true, boards: listBoards(80) });
  } catch (err) {
    logger.error({ err: err.message }, '[api] list boards');
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/boards', (req, res) => {
  const parsed = parseCreateBoardRequest(req.body);
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] board validación fallida');
    return res.status(400).json({ ok: false, error: parsed.error });
  }

  try {
    const board = createBoard(parsed.data);
    res.status(201).json({ ok: true, board });
  } catch (err) {
    logger.error({ err: err.message }, '[api] create board');
    res.status(500).json({ ok: false, error: err.message });
  }
});

function catalogsFromBrief(brief) {
  return (brief?.modelos_recomendados || [])
    .map(m => m.catalog || m.ficha)
    .filter(c => c?.generaciones?.length);
}

function hydrateBoardCatalog(board) {
  if (!board) return board;
  if (board.advisor_brief) {
    board = { ...board, advisor_brief: enrichBriefWithTramite(board.advisor_brief) };
  }
  if (!board.listings?.length) return board;
  const catalogs = catalogsFromBrief(board.advisor_brief);
  const brief = board.advisor_brief || null;
  let listings = board.listings;
  if (catalogs.length) {
    listings = annotateListingsWithCatalog(listings, catalogs);
  }
  listings = tagListingsWithMarket(listings);
  listings = listings.map(l => ({
    ...l,
    listing_analysis: buildListingAnalysis(l, {
      catalogs,
      brief,
      mercado: l._mercado
    })
  }));
  return { ...board, listings };
}

app.get('/api/transaction-guide', (_req, res) => {
  res.json({ ok: true, guide: getTransactionGuidePayload() });
});

app.get('/api/boards/:id', (req, res) => {
  try {
    const board = hydrateBoardCatalog(getBoardById(req.params.id));
    if (!board) return res.status(404).json({ ok: false, error: 'Tablero no encontrado' });
    res.json({ ok: true, board });
  } catch (err) {
    logger.error({ err: err.message, id: req.params.id }, '[api] get board');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Editar la definición de un watch (filtros, portales, alertas on/off).
app.patch('/api/boards/:id', (req, res) => {
  const parsed = parseUpdateBoardRequest(req.body);
  if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });
  try {
    const board = updateBoard({ boardId: req.params.id, ...parsed.data });
    if (!board) return res.status(404).json({ ok: false, error: 'Tablero no encontrado' });
    res.json({ ok: true, board });
  } catch (err) {
    logger.error({ err: err.message, id: req.params.id }, '[api] update board');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Marcar las novedades de un tablero como vistas (apaga el badge de alertas).
app.post('/api/boards/:id/seen', (req, res) => {
  try {
    const board = markBoardListingsSeen(req.params.id);
    if (!board) return res.status(404).json({ ok: false, error: 'Tablero no encontrado' });
    res.json({ ok: true, board });
  } catch (err) {
    logger.error({ err: err.message, id: req.params.id }, '[api] board seen');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Re-ejecuta una búsqueda guardada: vuelve a buscar con sus filtros/portales y
// marca los anuncios NUEVOS. Reusable por el endpoint y por el auto-refresh.
async function runBoardRefresh(board, limit = 60) {
  const filters = board.filters && Object.keys(board.filters).length ? board.filters : {};
  const portalIds = board.portals?.length ? board.portals : PORTALS.map(p => p.id);
  const result = await buscarEnPortales(filters, { portalIds, limit });
  const { newIds } = saveListingsToBoard(board.id, result.listings, { markNew: true });
  touchBoardChecked(board.id);
  const portalResults = result.portal_results.map(r => ({
    portal: r.portal,
    portal_label: r.portal_label,
    url: r.url,
    total: r.listings?.length || 0,
    status: r.status || null,
    error: r.error || null
  }));
  saveSearchRun({ boardId: board.id, filters, portals: portalIds, totalFound: newIds.length, portalResults });
  return { newIds, portalResults };
}

app.post('/api/boards/:id/refresh', async (req, res) => {
  const parsed = parseRefreshBoardRequest(req.body);
  if (!parsed.ok) return res.status(400).json({ ok: false, error: parsed.error });

  try {
    const board = getBoardById(req.params.id);
    if (!board) return res.status(404).json({ ok: false, error: 'Búsqueda no encontrada' });

    const t0 = Date.now();
    const { newIds, portalResults } = await runBoardRefresh(board, parsed.data?.limit || 60);
    const hydrated = hydrateBoardCatalog(getBoardById(board.id));
    const newListings = (hydrated.listings || []).filter(l => l.is_new);

    logger.info({ duration_ms: Date.now() - t0, boardId: board.id, new_count: newIds.length }, '[api] board refresh ok');
    res.json({ ok: true, board: hydrated, new_count: newIds.length, new_listings: newListings, portal_results: portalResults });
  } catch (err) {
    logger.error({ err: err.message, id: req.params.id }, '[api] board refresh error');
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function searchListingsForBrief(brief, { portalIds, limit = 48 }) {
  const baseFilters = compactFilters({
    ...(brief.filtros || {}),
    ciudad: brief.filtros?.ciudad,
    provincia: brief.filtros?.provincia
  });
  const modelos = brief.modelos_recomendados || [];
  const perModelLimit = Math.max(12, Math.ceil((limit || 48) / Math.max(modelos.length, 1)));

  let allListings = [];
  let portalResults = [];

  if (modelos.length) {
    const searches = await Promise.all(
      modelos.map(m =>
        buscarEnPortales(
          compactFilters({
            ...baseFilters,
            marca: m.marca || baseFilters.marca,
            modelo: m.modelo || baseFilters.modelo
          }),
          { portalIds, limit: perModelLimit }
        )
      )
    );
    for (const r of searches) {
      allListings.push(...(r.listings || []));
      portalResults.push(...(r.portal_results || []));
    }
  } else {
    const r = await buscarEnPortales(baseFilters, { portalIds, limit });
    allListings = r.listings || [];
    portalResults = r.portal_results || [];
  }

  allListings = dedupeListings(allListings);
  allListings = tagRecommendedListings(allListings, modelos);
  allListings = sortListingsForBoard(allListings).slice(0, limit || 48);

  const portalSummary = portalResults.reduce((acc, r) => {
    const key = r.portal || r.portal_label;
    if (!acc[key]) {
      acc[key] = {
        portal: r.portal,
        portal_label: r.portal_label,
        url: r.url,
        total: 0,
        status: r.status || null,
        error: r.error || null
      };
    }
    acc[key].total += r.listings?.length || 0;
    return acc;
  }, {});

  return { listings: allListings, portal_results: Object.values(portalSummary) };
}

app.post('/api/recommend-search', async (req, res) => {
  const parsed = parseRecommendSearchRequest(req.body);
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] recommend-search validación fallida');
    return res.status(400).json({ ok: false, error: parsed.error });
  }

  const { query, ciudad, provincia, portalIds, limit } = parsed.data;
  const selectedPortals = portalIds?.length ? portalIds : PORTALS.filter(p => p.canScrape).map(p => p.id);

  try {
    const t0 = Date.now();
    const brief = enrichBriefWithTramite(await interpretarBusqueda({ query, ciudad, provincia }));
    brief.modelos_recomendados = await enrichRecommendedModels(brief.modelos_recomendados || [], {
      query,
      precioMax: brief.filtros?.precioMax
    });
    const mergedFilters = compactFilters({
      ...(brief.filtros || {}),
      query: brief.query_original || query,
      ciudad: ciudad || brief.filtros?.ciudad,
      provincia: provincia || brief.filtros?.provincia
    });
    brief.filtros = mergedFilters;

    const { listings, portal_results: portalResults } = await searchListingsForBrief(brief, {
      portalIds: selectedPortals,
      limit: limit || 48
    });

    const board = createBoard({
      name: brief.nombre_busqueda,
      filters: mergedFilters,
      portals: selectedPortals,
      advisor_brief: brief
    });

    const { ids: savedIds } = saveListingsToBoard(board.id, listings);
    touchBoardChecked(board.id);
    const run = saveSearchRun({
      boardId: board.id,
      filters: mergedFilters,
      portals: selectedPortals,
      totalFound: savedIds.length,
      portalResults
    });
    const hydrated = hydrateBoardCatalog(getBoardById(board.id));
    const taggedListings = tagRecommendedListings(hydrated.listings || [], brief.modelos_recomendados || []);

    logger.info(
      {
        duration_ms: Date.now() - t0,
        boardId: board.id,
        listings: listings.length,
        modelos: brief.modelos_recomendados?.length || 0
      },
      '[api] recommend-search ok'
    );

    res.json({
      ok: true,
      board: hydrateBoardCatalog({ ...hydrated, listings: taggedListings }),
      advisor_brief: brief,
      filters: mergedFilters,
      run,
      saved: savedIds.length,
      portal_results: portalResults
    });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, '[api] recommend-search error');
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/searches', async (req, res) => {
  const parsed = parseSearchRequest(req.body);
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] search validación fallida');
    return res.status(400).json({ ok: false, error: parsed.error });
  }

  const { query, filters, portalIds, boardId, boardName, limit } = parsed.data;
  const mergedFilters = mergeSearchFilters(query, filters);
  const selectedPortals = portalIds?.length ? portalIds : PORTALS.map(p => p.id);

  try {
    let board = boardId ? getBoardById(boardId) : null;
    if (boardId && !board) return res.status(404).json({ ok: false, error: 'Tablero no encontrado' });

    const boardPreexisted = Boolean(board);
    if (!board) {
      const name = boardName || mergedFilters.query || [mergedFilters.marca, mergedFilters.modelo, mergedFilters.anioMin].filter(Boolean).join(' ') || 'Búsqueda de autos';
      board = createBoard({ name, filters: mergedFilters, portals: selectedPortals });
    } else {
      updateBoard({ boardId: board.id, filters: mergedFilters, portals: selectedPortals });
    }

    const t0 = Date.now();
    const result = await buscarEnPortales(mergedFilters, {
      portalIds: selectedPortals,
      limit: limit || 48
    });
    const { ids: savedIds, newIds } = saveListingsToBoard(board.id, result.listings, { markNew: boardPreexisted });
    touchBoardChecked(board.id);
    const portalResults = result.portal_results.map(r => ({
      portal: r.portal,
      portal_label: r.portal_label,
      url: r.url,
      total: r.listings?.length || 0,
      status: r.status || null,
      error: r.error || null
    }));
    const run = saveSearchRun({
      boardId: board.id,
      filters: mergedFilters,
      portals: selectedPortals,
      totalFound: savedIds.length,
      portalResults
    });
    const hydrated = getBoardById(board.id);

    logger.info(
      {
        duration_ms: Date.now() - t0,
        boardId: board.id,
        listings: result.listings.length,
        saved: savedIds.length,
        portals: selectedPortals
      },
      '[api] search ok'
    );

    res.json({
      ok: true,
      board: hydrated,
      filters: mergedFilters,
      run,
      saved: savedIds.length,
      new_count: newIds.length,
      portal_results: portalResults
    });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, '[api] search error');
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/discover', async (req, res) => {
  const parsed = parseDiscoverRequest(req.body);
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] discover validación fallida');
    return res.status(400).json({ ok: false, error: parsed.error });
  }

  const { query, filters, portalIds, limit } = parsed.data;
  const mergedFilters = mergeSearchFilters(query, filters);
  const selectedPortals = portalIds?.length ? portalIds : PORTALS.map(p => p.id);

  try {
    const t0 = Date.now();
    const result = await buscarEnPortales(mergedFilters, {
      portalIds: selectedPortals,
      limit: limit || 48,
      async: true // render sin bloquear: portales lentos vuelven 'pending' y el front re-consulta
    });
    const portalResults = result.portal_results.map(r => ({
      portal: r.portal,
      portal_label: r.portal_label,
      url: r.url,
      total: r.listings?.length || 0,
      status: r.status || null,
      error: r.error || null
    }));
    const pending = portalResults.some(r => r.status === 'pending');

    logger.info(
      {
        duration_ms: Date.now() - t0,
        listings: result.listings.length,
        pending,
        portals: selectedPortals
      },
      '[api] discover ok'
    );

    res.json({
      ok: true,
      filters: mergedFilters,
      listings: result.listings,
      portal_results: portalResults,
      pending
    });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, '[api] discover error');
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/pins', (req, res) => {
  const parsed = parsePinListingRequest(req.body);
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] pin validación fallida');
    return res.status(400).json({ ok: false, error: parsed.error });
  }

  try {
    const { boardId, boardName, listing } = parsed.data;
    let board = boardId ? getBoardById(boardId) : null;
    if (boardId && !board) return res.status(404).json({ ok: false, error: 'Tablero no encontrado' });
    if (!board) board = createBoard({ name: boardName, filters: {} });

    const { ids: [listingId] } = saveListingsToBoard(board.id, [listing]);
    const hydrated = getBoardById(board.id);
    res.status(201).json({ ok: true, board: hydrated, listingId });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, '[api] pin error');
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.patch('/api/boards/:boardId/listings/:listingId', (req, res) => {
  const parsed = parseUpdateListingRequest(req.body);
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] listing validación fallida');
    return res.status(400).json({ ok: false, error: parsed.error });
  }

  try {
    const board = updateBoardListingStatus({
      boardId: req.params.boardId,
      listingId: req.params.listingId,
      ...parsed.data
    });
    if (!board) return res.status(404).json({ ok: false, error: 'Anuncio no encontrado en el tablero' });
    res.json({ ok: true, board: hydrateBoardCatalog(board) });
  } catch (err) {
    logger.error({ err: err.message, boardId: req.params.boardId, listingId: req.params.listingId }, '[api] update listing');
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/sessions', (_req, res) => {
  try {
    const rows = listSessionsRecent(30);
    res.json({ ok: true, sessions: rows });
  } catch (err) {
    logger.error({ err: err.message }, '[api] list sessions');
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/sessions/:id', (req, res) => {
  const id = req.params.id;
  try {
    const session = getSessionById(id);
    if (!session) {
      return res.status(404).json({ ok: false, error: 'Sesión no encontrada' });
    }
    res.json({ ok: true, session });
  } catch (err) {
    logger.error({ err: err.message, id }, '[api] get session');
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const parsed = parseChatRequest(req.body);
  if (!parsed.ok) {
    logger.warn({ err: parsed.error }, '[api] validación fallida');
    return res.status(400).json({ ok: false, error: parsed.error });
  }

  const { messages, contexto, sessionId } = parsed.data;
  const ctx = { ...(contexto ?? {}) };
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const catalogs = Array.isArray(ctx.catalogs) ? ctx.catalogs : catalogsFromBrief(ctx.advisor_brief);
  if (lastUser?.content && Array.isArray(ctx.listings) && ctx.listings.length) {
    ctx.analisisTablero = analyzeAdvisorQuery(
      lastUser.content,
      ctx.listings,
      catalogs,
      ctx.advisor_brief || null
    );
  }

  try {
    const t0 = Date.now();
    const { texto, cards: llmCards } = await chat({ messages, contexto: ctx });
    const cards = llmCards?.length ? llmCards : cardsFromAnalisis(ctx.analisisTablero);
    const dt = Date.now() - t0;

    logger.info(
      {
        duration_ms: dt,
        cards: cards.length,
        messages: messages.length,
        sessionId: sessionId || null
      },
      '[api] ok'
    );

    if (sessionId) {
      try {
        const fullMessages = [...messages, { role: 'assistant', content: texto, cards }];
        saveSessionMessages(sessionId, ctx, fullMessages);
      } catch (err) {
        logger.error({ err: err.message, sessionId }, '[api] guardar sesión falló');
      }
    }

    res.json({
      ok: true,
      texto,
      cards,
      filtros: ctx.analisisTablero?.filtros || null,
      analisis: ctx.analisisTablero
        ? {
            mode: ctx.analisisTablero.mode,
            resumen: ctx.analisisTablero.resumen,
            modelosDestacados: ctx.analisisTablero.modelosDestacados,
            destacados: ctx.analisisTablero.destacados,
            caros: ctx.analisisTablero.caros,
            baratos: ctx.analisisTablero.baratos
          }
        : null
    });
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, '[api] error');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Auto-refresh en background: re-corre las búsquedas con alertas activas cada N minutos
// para que las novedades aparezcan solas. Off por defecto (AUTO_REFRESH_MINUTES=0).
function startAutoRefresh() {
  const minutes = Number(process.env.AUTO_REFRESH_MINUTES) || 0;
  if (minutes <= 0) return;
  const tick = async () => {
    try {
      const boards = listBoards(200).filter(b => b.alerts_enabled);
      let nuevos = 0;
      for (const b of boards) {
        try {
          const full = getBoardById(b.id);
          if (full) { const r = await runBoardRefresh(full); nuevos += r.newIds.length; }
        } catch (err) {
          logger.warn({ err: err.message, board: b.id }, '[auto-refresh] búsqueda falló');
        }
      }
      logger.info({ busquedas: boards.length, nuevos }, '[auto-refresh] ciclo ok');
    } catch (err) {
      logger.error({ err: err.message }, '[auto-refresh] ciclo falló');
    }
  };
  setInterval(tick, minutes * 60 * 1000);
  logger.info({ minutes }, '[auto-refresh] activado');
}

app.listen(PORT, async () => {
  if (hasLlmKey() && process.env.DEV_SKIP_LLM !== 'true') {
    try {
      await initLlmClient();
    } catch (err) {
      logger.warn({ err: err.message }, '[llm] proxy Cursor no disponible — el chat fallará hasta que arranque');
    }
  }
  logger.info({ port: PORT, llm: llmProvider() || 'none' }, 'El Garaje listo');
  startAutoRefresh();
});
