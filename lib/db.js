// lib/db.js — SQLite: sesiones, mensajes, caché del scraper y tableros de anuncios.
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { logger } from './logger.js';
import { listingFingerprint } from './search-filters.js';
import { mergeChecklist } from './checklist.js';
import { flattenCatalog } from './vehicle-catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DEFAULT_DB_PATH = path.join(ROOT, 'data', 'garaje.db');

const SCRAPER_CACHE_TTL_MS = Number(process.env.SCRAPER_CACHE_TTL_MS) || 30 * 60 * 1000;

/** @type {import('better-sqlite3').Database | null} */
let _db = null;

/** Cierra la conexión (solo tests). */
export function resetDbForTests() {
  if (_db) {
    try {
      _db.close();
    } catch {
      /* ignore */
    }
    _db = null;
  }
}

export function getDb() {
  if (_db) return _db;
  const filePath = process.env.SQLITE_PATH || DEFAULT_DB_PATH;
  if (filePath !== ':memory:' && !filePath.startsWith('file:')) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
  }
  _db = new Database(filePath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  migrate(_db);
  logger.info({ path: filePath }, '[db] listo');
  return _db;
}

/** @param {import('better-sqlite3').Database} d */
function migrate(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      contexto TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      cards TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session_seq ON messages(session_id, seq);

    CREATE TABLE IF NOT EXISTS scraper_cache (
      url_hash TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      response TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      filters TEXT NOT NULL DEFAULT '{}',
      portals TEXT NOT NULL DEFAULT '[]',
      alerts_enabled INTEGER NOT NULL DEFAULT 1,
      last_checked_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_listing_id TEXT,
      title TEXT NOT NULL,
      price INTEGER,
      currency TEXT NOT NULL DEFAULT 'ARS',
      year INTEGER,
      km INTEGER,
      location TEXT,
      link TEXT NOT NULL,
      image TEXT,
      brand TEXT,
      model TEXT,
      fuel TEXT,
      traction TEXT,
      transmission TEXT,
      raw TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(source, link)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      price INTEGER,
      currency TEXT NOT NULL DEFAULT 'ARS',
      observed_at INTEGER NOT NULL,
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS board_listings (
      board_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'saved' CHECK(status IN ('saved', 'contacted', 'discarded')),
      notes TEXT,
      is_new INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (board_id, listing_id),
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS async_jobs (
      url_hash TEXT PRIMARY KEY,
      job_id TEXT,
      status_url TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS portal_recipes (
      portal TEXT PRIMARY KEY,
      recipe TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      brand TEXT,
      model TEXT,
      content TEXT NOT NULL DEFAULT '{}',
      source TEXT NOT NULL DEFAULT 'ai',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS search_runs (
      id TEXT PRIMARY KEY,
      board_id TEXT,
      filters TEXT NOT NULL DEFAULT '{}',
      portals TEXT NOT NULL DEFAULT '[]',
      total_found INTEGER NOT NULL DEFAULT 0,
      portal_results TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_board_listings_status ON board_listings(board_id, status);
    CREATE INDEX IF NOT EXISTS idx_listings_source_link ON listings(source, link);
    CREATE INDEX IF NOT EXISTS idx_search_runs_board_created ON search_runs(board_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_price_history_listing ON price_history(listing_id, observed_at DESC);

    CREATE TABLE IF NOT EXISTS vehicle_year_specs (
      id TEXT PRIMARY KEY,
      catalog_key TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      generation TEXT,
      version TEXT,
      year_from INTEGER NOT NULL,
      year_to INTEGER NOT NULL,
      specs TEXT NOT NULL DEFAULT '{}',
      source TEXT NOT NULL DEFAULT 'curated',
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vehicle_year_specs_lookup
      ON vehicle_year_specs(catalog_key, year_from, year_to);
  `);

  // Migraciones aditivas para DBs creadas antes de tener watches/alertas.
  ensureColumn(d, 'boards', 'portals', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(d, 'boards', 'alerts_enabled', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(d, 'boards', 'last_checked_at', 'INTEGER');
  ensureColumn(d, 'board_listings', 'is_new', 'INTEGER NOT NULL DEFAULT 0');
  // Historial de precios para detectar bajadas.
  ensureColumn(d, 'listings', 'previous_price', 'INTEGER');
  ensureColumn(d, 'listings', 'price_changed_at', 'INTEGER');
  // Tipo de carrocería (SUV, pickup, sedán, etc.).
  ensureColumn(d, 'listings', 'vehicle_type', 'TEXT');
  // Huella de contenido para dedup de re-posts.
  ensureColumn(d, 'listings', 'fingerprint', 'TEXT');
  // Notas libres de la búsqueda (ej: "caja THP problemática, no comprar").
  ensureColumn(d, 'boards', 'notes', 'TEXT');
  // "Guardar" una publicación dentro de la búsqueda (shortlist del ojeador).
  ensureColumn(d, 'board_listings', 'shortlisted', 'INTEGER NOT NULL DEFAULT 0');
  // Brief del asesor al crear la búsqueda (JSON: explicación, modelos, criterios).
  ensureColumn(d, 'boards', 'advisor_brief', 'TEXT');
  // Checklist estructurado por publicación (JSON).
  ensureColumn(d, 'board_listings', 'checklist', "TEXT NOT NULL DEFAULT '{}'");
  // Índice año×versión con upsert por spec_key (KB modelos v2).
  ensureColumn(d, 'vehicle_year_specs', 'generation_id', 'TEXT');
  ensureColumn(d, 'vehicle_year_specs', 'spec_key', 'TEXT');
  ensureColumn(d, 'vehicle_year_specs', 'confidence', 'REAL');
  ensureColumn(d, 'vehicle_year_specs', 'refs', 'TEXT');
  d.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_year_specs_spec_key
      ON vehicle_year_specs(catalog_key, spec_key)
      WHERE spec_key IS NOT NULL
  `);
  d.exec(`
    CREATE INDEX IF NOT EXISTS idx_vehicle_year_specs_version_years
      ON vehicle_year_specs(catalog_key, version, year_from, year_to)
  `);
}

/**
 * Agrega una columna si todavía no existe (SQLite no soporta ADD COLUMN IF NOT EXISTS).
 * @param {import('better-sqlite3').Database} d
 */
function ensureColumn(d, table, column, ddl) {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some(c => c.name === column)) return;
  d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  logger.info({ table, column }, '[db] columna agregada');
}

/**
 * @param {string} sessionId
 * @param {Record<string, unknown>} contexto
 * @param {Array<{ role: string, content: string, cards?: unknown[] }>} messages
 */
export function saveSessionMessages(sessionId, contexto, messages) {
  try {
    const d = getDb();
    const now = Date.now();
    const ctxJson = JSON.stringify(contexto ?? {});

    const tx = d.transaction(() => {
      d.prepare(
        `
      INSERT INTO sessions (id, contexto, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        contexto = excluded.contexto,
        updated_at = excluded.updated_at,
        created_at = sessions.created_at
    `
      ).run(sessionId, ctxJson, now, now);

      d.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);

      const ins = d.prepare(`
      INSERT INTO messages (id, session_id, seq, role, content, cards, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

      let seq = 0;
      for (const m of messages) {
        const id = randomUUID();
        const cardsJson =
          m.role === 'assistant' && Array.isArray(m.cards) && m.cards.length > 0
            ? JSON.stringify(m.cards)
            : null;
        ins.run(id, sessionId, seq++, m.role, m.content, cardsJson, now);
      }
    });

    tx();
  } catch (err) {
    logger.error({ err: err?.message, sessionId }, '[db] saveSessionMessages falló');
    throw err;
  }
}

/**
 * @param {string} sessionId
 * @returns {null | { id: string, contexto: Record<string, unknown>, created_at: number, updated_at: number, messages: Array<{ role: string, content: string, cards?: unknown[] }> }}
 */
export function getSessionById(sessionId) {
  const d = getDb();
  const sess = d.prepare('SELECT id, contexto, created_at, updated_at FROM sessions WHERE id = ?').get(sessionId);
  if (!sess) return null;

  let contexto = {};
  try {
    contexto = JSON.parse(sess.contexto || '{}');
  } catch {
    contexto = {};
  }

  const rows = d
    .prepare('SELECT role, content, cards FROM messages WHERE session_id = ? ORDER BY seq ASC')
    .all(sessionId);

  const messages = rows.map(r => {
    const base = { role: r.role, content: r.content };
    if (r.role === 'assistant' && r.cards) {
      try {
        const cards = JSON.parse(r.cards);
        if (Array.isArray(cards) && cards.length) return { ...base, cards };
      } catch {
        /* ignore */
      }
    }
    return base;
  });

  return {
    id: sess.id,
    contexto,
    created_at: sess.created_at,
    updated_at: sess.updated_at,
    messages
  };
}

/**
 * @param {number} [limit]
 * @returns {Array<{ id: string, updated_at: number, preview: string | null }>}
 */
export function listSessionsRecent(limit = 25) {
  const d = getDb();
  return d
    .prepare(
      `
    SELECT s.id, s.updated_at,
      (SELECT m.content FROM messages m WHERE m.session_id = s.id AND m.role = 'user' ORDER BY m.seq ASC LIMIT 1) AS preview
    FROM sessions s
    ORDER BY s.updated_at DESC
    LIMIT ?
  `
    )
    .all(limit);
}

/**
 * @param {string} urlHash
 * @returns {null | { url: string, listings: unknown[], error?: string }}
 */
export function scraperCacheGet(urlHash) {
  if (process.env.SCRAPER_CACHE_DISABLED === 'true') return null;
  try {
    const d = getDb();
    const row = d.prepare('SELECT response, expires_at FROM scraper_cache WHERE url_hash = ?').get(urlHash);
    if (!row) return null;
    if (row.expires_at <= Date.now()) {
      d.prepare('DELETE FROM scraper_cache WHERE url_hash = ?').run(urlHash);
      return null;
    }
    try {
      return JSON.parse(row.response);
    } catch {
      d.prepare('DELETE FROM scraper_cache WHERE url_hash = ?').run(urlHash);
      return null;
    }
  } catch (err) {
    logger.warn({ err: err?.message }, '[db] scraperCacheGet omitido');
    return null;
  }
}

/**
 * @param {string} urlHash
 * @param {string} url
 * @param {{ url: string, listings: unknown[], error?: string }} payload
 */
export function scraperCacheSet(urlHash, url, payload) {
  if (process.env.SCRAPER_CACHE_DISABLED === 'true') return;
  try {
    const d = getDb();
    const expiresAt = Date.now() + SCRAPER_CACHE_TTL_MS;
    d.prepare(
      `
    INSERT INTO scraper_cache (url_hash, url, response, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(url_hash) DO UPDATE SET
      url = excluded.url,
      response = excluded.response,
      expires_at = excluded.expires_at
  `
    ).run(urlHash, url, JSON.stringify(payload), expiresAt);
  } catch (err) {
    logger.warn({ err: err?.message }, '[db] scraperCacheSet omitido');
  }
}

function parseJsonSafe(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function rowToListing(row) {
  return {
    id: row.id,
    board_id: row.board_id,
    status: row.status,
    notes: row.notes,
    checklist: parseJsonSafe(row.checklist, {}),
    shortlisted: row.shortlisted === 1 || row.shortlisted === true,
    is_new: row.is_new === 1 || row.is_new === true,
    saved_at: row.saved_at,
    updated_at: row.board_updated_at,
    first_seen_at: row.created_at,
    last_seen_at: row.updated_at,
    source: row.source,
    fuente: row.source,
    titulo: row.title,
    precio: row.price,
    precio_anterior: row.previous_price ?? null,
    precio_cambio_at: row.price_changed_at ?? null,
    precio_bajo: row.previous_price != null && row.price != null && row.price < row.previous_price,
    moneda: row.currency,
    año: row.year,
    kilometros: row.km,
    ubicacion: row.location,
    link: row.link,
    imagen: row.image,
    marca: row.brand,
    modelo: row.model,
    combustible: row.fuel,
    traccion: row.traction,
    transmision: row.transmission,
    tipo: row.vehicle_type || null,
    raw: parseJsonSafe(row.raw, {})
  };
}

function rowToBoard(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    advisor_brief: parseJsonSafe(row.advisor_brief, null),
    notes: row.notes ?? null,
    filters: parseJsonSafe(row.filters, {}),
    portals: parseJsonSafe(row.portals, []),
    alerts_enabled: row.alerts_enabled == null ? true : row.alerts_enabled === 1,
    last_checked_at: row.last_checked_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    total: row.total || 0,
    contacted: row.contacted || 0,
    discarded: row.discarded || 0,
    new_count: row.new_count || 0
  };
}

export function createBoard({ name, description = null, filters = {}, portals = [], advisor_brief = null }) {
  const d = getDb();
  const now = Date.now();
  const id = randomUUID();
  d.prepare(
    `
    INSERT INTO boards (id, name, description, filters, portals, advisor_brief, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    String(name || 'Nueva búsqueda').trim().slice(0, 120),
    description,
    JSON.stringify(filters || {}),
    JSON.stringify(Array.isArray(portals) ? portals : []),
    advisor_brief ? JSON.stringify(advisor_brief) : null,
    now,
    now
  );
  return getBoardById(id);
}

/**
 * Actualiza la definición de un watch (filtros, portales, alertas).
 */
export function updateBoard({ boardId, filters, portals, alertsEnabled, name, notes }) {
  const d = getDb();
  const board = d.prepare('SELECT id FROM boards WHERE id = ?').get(boardId);
  if (!board) return null;
  const now = Date.now();
  d.prepare(
    `
    UPDATE boards SET
      name = COALESCE(?, name),
      filters = COALESCE(?, filters),
      portals = COALESCE(?, portals),
      alerts_enabled = COALESCE(?, alerts_enabled),
      notes = COALESCE(?, notes),
      updated_at = ?
    WHERE id = ?
  `
  ).run(
    name ? String(name).trim().slice(0, 120) : null,
    filters ? JSON.stringify(filters) : null,
    portals ? JSON.stringify(Array.isArray(portals) ? portals : []) : null,
    alertsEnabled == null ? null : alertsEnabled ? 1 : 0,
    notes == null ? null : String(notes).slice(0, 2000),
    now,
    boardId
  );
  return getBoardById(boardId);
}

/**
 * Marca como vistas (no nuevas) las novedades de un tablero.
 */
export function markBoardListingsSeen(boardId) {
  const d = getDb();
  const now = Date.now();
  d.prepare('UPDATE board_listings SET is_new = 0 WHERE board_id = ? AND is_new = 1').run(boardId);
  d.prepare('UPDATE boards SET updated_at = ? WHERE id = ?').run(now, boardId);
  return getBoardById(boardId);
}

export function listBoards(limit = 50) {
  const d = getDb();
  return d
    .prepare(
      `
      SELECT b.*,
        COUNT(bl.listing_id) AS total,
        SUM(CASE WHEN bl.status = 'contacted' THEN 1 ELSE 0 END) AS contacted,
        SUM(CASE WHEN bl.status = 'discarded' THEN 1 ELSE 0 END) AS discarded,
        SUM(CASE WHEN bl.is_new = 1 THEN 1 ELSE 0 END) AS new_count
      FROM boards b
      LEFT JOIN board_listings bl ON bl.board_id = b.id
      GROUP BY b.id
      ORDER BY b.updated_at DESC
      LIMIT ?
    `
    )
    .all(limit)
    .map(rowToBoard);
}

export function getBoardById(boardId) {
  const d = getDb();
  const row = d
    .prepare(
      `
      SELECT b.*,
        COUNT(bl.listing_id) AS total,
        SUM(CASE WHEN bl.status = 'contacted' THEN 1 ELSE 0 END) AS contacted,
        SUM(CASE WHEN bl.status = 'discarded' THEN 1 ELSE 0 END) AS discarded,
        SUM(CASE WHEN bl.is_new = 1 THEN 1 ELSE 0 END) AS new_count
      FROM boards b
      LEFT JOIN board_listings bl ON bl.board_id = b.id
      WHERE b.id = ?
      GROUP BY b.id
    `
    )
    .get(boardId);
  if (!row) return null;

  const listings = d
    .prepare(
      `
      SELECT l.*, bl.board_id, bl.status, bl.notes, bl.checklist, bl.is_new, bl.shortlisted, bl.created_at AS saved_at, bl.updated_at AS board_updated_at
      FROM board_listings bl
      JOIN listings l ON l.id = bl.listing_id
      WHERE bl.board_id = ?
      ORDER BY bl.shortlisted DESC, bl.is_new DESC, bl.updated_at DESC
    `
    )
    .all(boardId)
    .map(rowToListing);

  const runs = d
    .prepare('SELECT id, filters, portals, total_found, portal_results, created_at FROM search_runs WHERE board_id = ? ORDER BY created_at DESC LIMIT 10')
    .all(boardId)
    .map(r => ({
      id: r.id,
      filters: parseJsonSafe(r.filters, {}),
      portals: parseJsonSafe(r.portals, []),
      total_found: r.total_found,
      portal_results: parseJsonSafe(r.portal_results, []),
      created_at: r.created_at
    }));

  return { ...rowToBoard(row), listings, runs };
}

/**
 * Digest "Hoy": cruza todas las alertas y devuelve lo que cambió —
 * autos nuevos (is_new) y autos que bajaron de precio recientemente.
 * Excluye los descartados.
 * @param {{ priceWindowMs?: number }} [opts]
 */
export function getTodayDigest(opts = {}) {
  const d = getDb();
  const windowMs = opts.priceWindowMs || 14 * 24 * 60 * 60 * 1000;
  const since = Date.now() - windowMs;

  const rows = d
    .prepare(
      `
      SELECT l.*, bl.board_id, bl.status, bl.notes, bl.checklist, bl.is_new, bl.shortlisted,
             bl.created_at AS saved_at, bl.updated_at AS board_updated_at,
             b.name AS board_name
      FROM board_listings bl
      JOIN listings l ON l.id = bl.listing_id
      JOIN boards b ON b.id = bl.board_id
      WHERE bl.status != 'discarded'
        AND (
          bl.is_new = 1
          OR (l.previous_price IS NOT NULL AND l.price IS NOT NULL
              AND l.price < l.previous_price AND l.price_changed_at >= ?)
        )
      ORDER BY bl.is_new DESC, l.price_changed_at DESC, bl.updated_at DESC
    `
    )
    .all(since);

  const nuevos = [];
  const bajaron = [];
  for (const row of rows) {
    const listing = { ...rowToListing(row), board_name: row.board_name };
    if (row.is_new === 1) {
      listing.motivo = 'nuevo';
      nuevos.push(listing);
    } else {
      listing.motivo = 'precio';
      bajaron.push(listing);
    }
  }

  return {
    nuevos,
    bajaron,
    counts: { nuevos: nuevos.length, bajaron: bajaron.length }
  };
}

function normalizeListingForDb(listing) {
  const source = String(listing.source || listing.fuente || 'desconocido').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  return {
    source,
    source_listing_id: listing.source_listing_id || null,
    title: String(listing.titulo || listing.title || 'Anuncio sin título').trim().slice(0, 240),
    price: Number.isFinite(Number(listing.precio ?? listing.price)) ? Math.round(Number(listing.precio ?? listing.price)) : null,
    currency: String(listing.moneda || listing.currency || 'ARS').slice(0, 8),
    year: Number.isFinite(Number(listing.año ?? listing.anio ?? listing.year)) ? Math.round(Number(listing.año ?? listing.anio ?? listing.year)) : null,
    km: Number.isFinite(Number(listing.kilometros ?? listing.km)) ? Math.round(Number(listing.kilometros ?? listing.km)) : null,
    location: listing.ubicacion || listing.location || null,
    link: String(listing.link || '').trim(),
    image: listing.imagen || listing.image || null,
    brand: listing.marca || listing.brand || null,
    model: listing.modelo || listing.model || null,
    fuel: listing.combustible || listing.fuel || null,
    traction: listing.traccion || listing.traction || null,
    transmission: listing.transmision || listing.transmission || null,
    vehicle_type: listing.tipo || listing.vehicle_type || null,
    fingerprint: listingFingerprint(listing),
    raw: JSON.stringify(listing || {})
  };
}

/**
 * Inserta/actualiza anuncios y los vincula a un tablero.
 * @param {string} boardId
 * @param {unknown[]} listings
 * @param {{ markNew?: boolean }} [opts] markNew marca como novedad los anuncios que el tablero no tenía (para alertas de watches).
 * @returns {{ ids: string[], newIds: string[] }}
 */
export function saveListingsToBoard(boardId, listings, opts = {}) {
  const markNew = opts.markNew === true;
  const d = getDb();
  const now = Date.now();
  const saved = [];
  const newIds = [];
  const tx = d.transaction(() => {
    const board = d.prepare('SELECT id FROM boards WHERE id = ?').get(boardId);
    if (!board) throw new Error('Tablero no encontrado');

    const insertListing = d.prepare(
      `
      INSERT INTO listings (
        id, source, source_listing_id, title, price, currency, year, km, location, link, image,
        brand, model, fuel, traction, transmission, vehicle_type, fingerprint, raw, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source, link) DO UPDATE SET
        title = excluded.title,
        price = excluded.price,
        currency = excluded.currency,
        year = excluded.year,
        km = excluded.km,
        location = excluded.location,
        image = excluded.image,
        brand = COALESCE(excluded.brand, listings.brand),
        model = COALESCE(excluded.model, listings.model),
        fuel = COALESCE(excluded.fuel, listings.fuel),
        traction = COALESCE(excluded.traction, listings.traction),
        transmission = COALESCE(excluded.transmission, listings.transmission),
        vehicle_type = COALESCE(excluded.vehicle_type, listings.vehicle_type),
        fingerprint = excluded.fingerprint,
        raw = excluded.raw,
        updated_at = excluded.updated_at
    `
    );
    const findListing = d.prepare('SELECT id FROM listings WHERE source = ? AND link = ?');
    const findPrice = d.prepare('SELECT price FROM listings WHERE source = ? AND link = ?');
    const setPriceChange = d.prepare('UPDATE listings SET previous_price = ?, price_changed_at = ? WHERE id = ?');
    const insertPriceHistory = d.prepare(
      'INSERT INTO price_history (id, listing_id, price, currency, observed_at) VALUES (?, ?, ?, ?, ?)'
    );
    const existingLink = d.prepare('SELECT 1 FROM board_listings WHERE board_id = ? AND listing_id = ?');

    // Huellas ya rastreadas en este tablero, para colapsar re-posts (mismo auto, otro link).
    const fpToListing = new Map();
    for (const r of d.prepare('SELECT l.fingerprint AS fp, bl.listing_id AS lid FROM board_listings bl JOIN listings l ON l.id = bl.listing_id WHERE bl.board_id = ?').all(boardId)) {
      if (r.fp) fpToListing.set(r.fp, r.lid);
    }
    const linkBoard = d.prepare(
      `
      INSERT INTO board_listings (board_id, listing_id, status, notes, is_new, created_at, updated_at)
      VALUES (?, ?, 'saved', NULL, ?, ?, ?)
      ON CONFLICT(board_id, listing_id) DO UPDATE SET
        updated_at = excluded.updated_at,
        status = CASE WHEN board_listings.status = 'discarded' THEN 'saved' ELSE board_listings.status END
    `
    );

    for (const listing of listings || []) {
      const row = normalizeListingForDb(listing);
      if (!row.link) continue;
      // Capturar el precio previo ANTES del upsert para detectar cambios.
      const before = findPrice.get(row.source, row.link);
      const id = randomUUID();
      insertListing.run(
        id,
        row.source,
        row.source_listing_id,
        row.title,
        row.price,
        row.currency,
        row.year,
        row.km,
        row.location,
        row.link,
        row.image,
        row.brand,
        row.model,
        row.fuel,
        row.traction,
        row.transmission,
        row.vehicle_type,
        row.fingerprint,
        row.raw,
        now,
        now
      );
      const stored = findListing.get(row.source, row.link);

      // Historial de precio: primera observación o cambio respecto al anterior.
      if (!before) {
        insertPriceHistory.run(randomUUID(), stored.id, row.price, row.currency, now);
      } else if (before.price != null && row.price != null && before.price !== row.price) {
        setPriceChange.run(before.price, now, stored.id);
        insertPriceHistory.run(randomUUID(), stored.id, row.price, row.currency, now);
      }

      // Dedup de re-posts: si el tablero ya tiene este mismo auto con otro link, lo ignoramos.
      const fp = row.fingerprint;
      if (fp && fpToListing.has(fp) && fpToListing.get(fp) !== stored.id) continue;
      if (fp) fpToListing.set(fp, stored.id);

      const isNewToBoard = !existingLink.get(boardId, stored.id);
      linkBoard.run(boardId, stored.id, markNew && isNewToBoard ? 1 : 0, now, now);
      saved.push(stored.id);
      if (isNewToBoard) newIds.push(stored.id);
    }

    d.prepare('UPDATE boards SET updated_at = ? WHERE id = ?').run(now, boardId);
  });

  tx();
  return { ids: saved, newIds };
}

/**
 * Re-ejecuta el watch de un tablero: marca el momento de chequeo.
 */
export function touchBoardChecked(boardId) {
  const d = getDb();
  d.prepare('UPDATE boards SET last_checked_at = ? WHERE id = ?').run(Date.now(), boardId);
}

export function updateBoardListingStatus({ boardId, listingId, status, notes, shortlisted, checklist }) {
  const d = getDb();
  const now = Date.now();
  let checklistJson = null;
  if (checklist != null) {
    const row = d
      .prepare('SELECT checklist FROM board_listings WHERE board_id = ? AND listing_id = ?')
      .get(boardId, listingId);
    if (!row) return null;
    checklistJson = JSON.stringify(mergeChecklist(parseJsonSafe(row.checklist, {}), checklist));
  }
  const result = d
    .prepare(
      `
      UPDATE board_listings
      SET status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          shortlisted = COALESCE(?, shortlisted),
          checklist = COALESCE(?, checklist),
          updated_at = ?
      WHERE board_id = ? AND listing_id = ?
    `
    )
    .run(
      status || null,
      notes == null ? null : String(notes).slice(0, 1000),
      shortlisted == null ? null : shortlisted ? 1 : 0,
      checklistJson,
      now,
      boardId,
      listingId
    );
  if (result.changes === 0) return null;
  d.prepare('UPDATE boards SET updated_at = ? WHERE id = ?').run(now, boardId);
  return getBoardById(boardId);
}

export function getAsyncJob(urlHash) {
  const d = getDb();
  return d.prepare('SELECT url_hash, job_id, status_url, created_at FROM async_jobs WHERE url_hash = ?').get(urlHash) || null;
}
export function saveAsyncJob(urlHash, jobId, statusUrl) {
  const d = getDb();
  d.prepare(
    `INSERT INTO async_jobs (url_hash, job_id, status_url, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(url_hash) DO UPDATE SET job_id = excluded.job_id, status_url = excluded.status_url, created_at = excluded.created_at`
  ).run(urlHash, jobId, statusUrl, Date.now());
}
export function clearAsyncJob(urlHash) {
  getDb().prepare('DELETE FROM async_jobs WHERE url_hash = ?').run(urlHash);
}

export function getConfig(key) {
  const d = getDb();
  const row = d.prepare('SELECT value FROM app_config WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setConfig(key, value) {
  const d = getDb();
  d.prepare(
    `INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value == null ? null : String(value), Date.now());
}

export function getRecipe(portal) {
  const d = getDb();
  const row = d.prepare('SELECT recipe FROM portal_recipes WHERE portal = ?').get(portal);
  if (!row) return null;
  return parseJsonSafe(row.recipe, null);
}

export function saveRecipe(portal, recipe) {
  const d = getDb();
  const now = Date.now();
  d.prepare(
    `
    INSERT INTO portal_recipes (portal, recipe, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(portal) DO UPDATE SET recipe = excluded.recipe, updated_at = excluded.updated_at
  `
  ).run(portal, JSON.stringify(recipe || {}), now, now);
}

export function knowledgeKey(marca, modelo) {
  return `${String(marca || '').trim().toLowerCase()}|${String(modelo || '').trim().toLowerCase()}`;
}

export function getKnowledge(marca, modelo) {
  const d = getDb();
  const row = d.prepare('SELECT * FROM knowledge WHERE key = ?').get(knowledgeKey(marca, modelo));
  if (!row) return null;
  return {
    key: row.key,
    brand: row.brand,
    model: row.model,
    content: parseJsonSafe(row.content, {}),
    source: row.source,
    updated_at: row.updated_at
  };
}

export function saveKnowledge({ marca, modelo, content, source = 'ai' }) {
  const d = getDb();
  const now = Date.now();
  const key = knowledgeKey(marca, modelo);
  d.prepare(
    `
    INSERT INTO knowledge (id, key, brand, model, content, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      content = excluded.content,
      source = excluded.source,
      updated_at = excluded.updated_at
  `
  ).run(randomUUID(), key, marca || null, modelo || null, JSON.stringify(content || {}), source, now, now);
  return getKnowledge(marca, modelo);
}

/**
 * Indexa filas año×versión para filtrar (ESP, cadena, etc.) sin re-llamar al LLM.
 * @param {{ marca?: string, modelo?: string, generaciones?: unknown[] }} catalog
 */
export function syncVehicleYearSpecs(catalog, source = 'curated') {
  if (!catalog?.marca || !catalog?.modelo) return 0;
  const d = getDb();
  const key = knowledgeKey(catalog.marca, catalog.modelo);
  const now = Date.now();
  const activeKeys = new Set();

  const findSpec = d.prepare(
    'SELECT id FROM vehicle_year_specs WHERE catalog_key = ? AND spec_key = ?'
  );
  const insertSpec = d.prepare(`
    INSERT INTO vehicle_year_specs (
      id, catalog_key, brand, model, generation, generation_id, version,
      year_from, year_to, specs, source, spec_key, confidence, refs, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateSpec = d.prepare(`
    UPDATE vehicle_year_specs SET
      brand = ?, model = ?, generation = ?, generation_id = ?, version = ?,
      year_from = ?, year_to = ?, specs = ?, source = ?, confidence = ?, refs = ?, updated_at = ?
    WHERE catalog_key = ? AND spec_key = ?
  `);

  let n = 0;
  for (const row of flattenCatalog(catalog)) {
    if (row.anio_desde == null && row.anio_hasta == null) continue;
    const sliceSource = row.meta?.source || source;
    const spec_key = row.spec_key;
    if (!spec_key) continue;
    activeKeys.add(spec_key);
    const specs = {
      motor: row.motor,
      potencia_cv: row.potencia_cv,
      distribucion: row.distribucion,
      transmision: row.transmision,
      airbags: row.airbags,
      esp: row.esp,
      ncap: row.ncap,
      nota: row.destacado
    };
    const yearFrom = row.anio_desde ?? row.anio_hasta;
    const yearTo = row.anio_hasta ?? row.anio_desde;
    const specsJson = JSON.stringify(specs);
    const refsJson = JSON.stringify(row.meta?.refs || []);
    const confidence = row.meta?.confidence ?? null;
    const updatedAt = row.meta?.updated_at ?? now;
    const hit = findSpec.get(key, spec_key);
    if (hit) {
      updateSpec.run(
        catalog.marca,
        catalog.modelo,
        row.generacion,
        row.generacion_id,
        row.version,
        yearFrom,
        yearTo,
        specsJson,
        sliceSource,
        confidence,
        refsJson,
        updatedAt,
        key,
        spec_key
      );
    } else {
      insertSpec.run(
        randomUUID(),
        key,
        catalog.marca,
        catalog.modelo,
        row.generacion,
        row.generacion_id,
        row.version,
        yearFrom,
        yearTo,
        specsJson,
        sliceSource,
        spec_key,
        confidence,
        refsJson,
        updatedAt
      );
    }
    n++;
  }

  const existing = d
    .prepare('SELECT spec_key FROM vehicle_year_specs WHERE catalog_key = ? AND spec_key IS NOT NULL')
    .all(key);
  const del = d.prepare(
    'DELETE FROM vehicle_year_specs WHERE catalog_key = ? AND spec_key = ?'
  );
  for (const r of existing) {
    if (!activeKeys.has(r.spec_key)) del.run(key, r.spec_key);
  }
  d.prepare('DELETE FROM vehicle_year_specs WHERE catalog_key = ? AND spec_key IS NULL').run(key);

  return n;
}

/** Filas de specs por año para un modelo (SQL). */
export function queryVehicleYearSpecs(marca, modelo, { year, esp, distribucion } = {}) {
  const d = getDb();
  const key = knowledgeKey(marca, modelo);
  let sql = `SELECT * FROM vehicle_year_specs WHERE catalog_key = ?`;
  const params = [key];
  if (year) {
    sql += ' AND year_from <= ? AND year_to >= ?';
    params.push(year, year);
  }
  if (esp === true) sql += ` AND json_extract(specs, '$.esp') = 1`;
  if (esp === false) sql += ` AND (json_extract(specs, '$.esp') = 0 OR json_extract(specs, '$.esp') IS NULL)`;
  if (distribucion) {
    sql += ` AND lower(json_extract(specs, '$.distribucion')) LIKE ?`;
    params.push(`%${String(distribucion).toLowerCase()}%`);
  }
  return d.prepare(sql).all(...params);
}

export function saveSearchRun({ boardId, filters, portals, totalFound, portalResults }) {
  const d = getDb();
  const id = randomUUID();
  const now = Date.now();
  d.prepare(
    `
    INSERT INTO search_runs (id, board_id, filters, portals, total_found, portal_results, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    boardId || null,
    JSON.stringify(filters || {}),
    JSON.stringify(portals || []),
    Number(totalFound || 0),
    JSON.stringify(portalResults || []),
    now
  );
  return { id, board_id: boardId || null, created_at: now };
}
