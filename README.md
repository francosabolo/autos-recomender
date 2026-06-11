# El Garaje

Node + Express + SQLite + scraping multiportal. El núcleo es un **ojeador con alertas**: buscás autos en varios portales a la vez, guardás la búsqueda como **alerta** (watch) y El Garaje vigila los portales por vos. Cada auto guarda **de qué portal salió y desde cuándo** (trazabilidad), y "Revisar novedades" re-corre la búsqueda y resalta solo lo que apareció desde la última vez. El chat con Claude queda como asesor secundario que conoce lo que tenés en pantalla. Visión, casos de uso y roadmap: [**SPECS.md**](SPECS.md).

## Alertas y trazabilidad (núcleo)

- Una **alerta** es un tablero con filtros + portales guardados. Se crea desde "Guardar como alerta" sobre una búsqueda.
- **Trazabilidad**: cada anuncio es único por `(portal, link)`; se guarda `first_seen_at` (primera vez visto) y `last_seen_at`. La card muestra el portal de origen y "visto hace X".
- **Novedades / alertas**: al re-correr una alerta (`POST /api/boards/:id/refresh`), los anuncios que el tablero no tenía se marcan `is_new` y se cuentan como novedades (badge en la lista de alertas). Abrir o revisar la alerta las marca como vistas (`POST /api/boards/:id/seen`).
- El re-chequeo es manual hoy (botón "Revisar novedades"). Automatizarlo en background es el próximo paso (cron / scheduler).

## Vista "Hoy" y cambios de precio (Fase 1)

- **Home = "Hoy"** (`GET /api/today`): cruza todas las alertas y muestra lo que cambió — autos **nuevos** (`is_new`) y autos que **bajaron de precio** —, ocultando los descartados. Es la respuesta a "repito las mismas búsquedas cada día".
- **Historial de precio**: cada vez que un anuncio reaparece con otro precio se guarda en `price_history` y se setea `previous_price` + `price_changed_at`. La card muestra el precio tachado y "↓ Bajó de precio". Las bajadas entran a "Hoy" si ocurrieron en los últimos 14 días.
- **Ciclo de vida por auto**: nuevo (badge) → visto (al abrir la alerta se apaga `is_new`) → contactado / descartado, con acciones rápidas en cada card (`PATCH /api/boards/:boardId/listings/:listingId`). Los descartados se ocultan salvo que actives "Ver descartados".

## Estructura

```
├── public/index.html
├── prompts/system.md
├── lib/cards.js · db.js · logger.js · search-filters.js · validation.js
├── tests/
├── server.js · llm.js · scraper.js
├── data/          (SQLite; se crea al arrancar, ver .gitignore)
├── package.json · .env.example
```

## Setup

```bash
npm install
cp .env.example .env
# ANTHROPIC_API_KEY en .env — https://console.anthropic.com/
npm start
```

Abrí http://localhost:3000 · Variables: ver `.env.example` (`LOG_LEVEL`, `DEV_SKIP_LLM`, `SCRAPER_TIMEOUT_MS`, `SQLITE_PATH`, `SCRAPER_CACHE_TTL_MS`).

Persistencia:

- Los tableros guardan anuncios deduplicados por portal/link en SQLite.
- La exploración (`POST /api/discover`) no guarda todo automáticamente: llena el feed para navegar.
- El pineo (`POST /api/pins`) guarda un anuncio puntual en el tablero elegido o crea uno nuevo.
- Cada anuncio puede estar `saved`, `contacted` o `discarded`.
- Cada búsqueda guarda filtros, portales consultados, links de búsqueda y errores por portal.
- Cada charla usa un `sessionId` (UUID en `localStorage`) y se guarda en SQLite al terminar cada turno.

Portales incluidos:

- MercadoLibre: scraper específico.
- Rosario Garage y Mas Poco Vendo: scraper genérico con URL configurable.
- Facebook Marketplace: link asistido porque requiere sesión y no permite scraping confiable.
- Si un portal bloquea o cambia HTML, el radar no queda vacío: muestra candidatos estimados de mercado y cards de búsqueda asistida con link al origen para validar disponibilidad/precio.

Si un portal cambia su URL de búsqueda, ajustá `ROSARIOGARAGE_SEARCH_URL_TEMPLATE` o `MASPOCOVENDO_SEARCH_URL_TEMPLATE` con `{query}`, `{precioMin}` y `{precioMax}`.

Endpoints principales:

- `GET /api/today` — digest cruzado: autos nuevos + bajadas de precio en todas las alertas
- `GET /api/portals`
- `GET /api/boards`
- `POST /api/boards`
- `GET /api/boards/:id`
- `PATCH /api/boards/:id` — editar la definición de una alerta (filtros, portales, alertas on/off)
- `POST /api/boards/:id/refresh` — re-correr la alerta y reportar novedades (`new_count`, `new_listings`)
- `POST /api/boards/:id/seen` — marcar las novedades como vistas
- `POST /api/discover` — búsqueda efímera (llena el feed, no persiste)
- `POST /api/pins`
- `POST /api/searches` — buscar y persistir en una alerta (crea o actualiza el watch)
- `PATCH /api/boards/:boardId/listings/:listingId`
- `POST /api/chat`

## Tests

```bash
npm test
```

## Deploy (mínimo)

Node 20+, `PORT` en el entorno del proceso y `ANTHROPIC_API_KEY` si vas a usar el chat. `npm start` sirve `public/` y las APIs REST. TLS y proxy al frente en producción. Para UI sin LLM: `DEV_SKIP_LLM=true`.
