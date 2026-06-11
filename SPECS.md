# El Garaje · Product & Engineering Spec

> **Documento maestro para continuar el desarrollo del MVP.**
> Pensado para ser leído por un humano o por un agente de codificación (Claude Code, Antigravity, Cursor) sin necesidad de contexto adicional.

**Versión:** 1.0 · MVP funcional
**Última actualización:** Mayo 2026
**Estado actual:** Prototipo funcional con chat conversacional + scraping de MercadoLibre + tool use con Claude, persistencia SQLite y caché del scraper. Falta: streaming, más tests, deploy.

---

## Índice

1. [Visión y posicionamiento](#1-visión-y-posicionamiento)
2. [Casos de uso prioritarios](#2-casos-de-uso-prioritarios)
3. [Arquitectura técnica](#3-arquitectura-técnica)
4. [Modelo de datos](#4-modelo-de-datos)
5. [Especificación de API](#5-especificación-de-api)
6. [Prompts e instrucciones para Claude](#6-prompts-e-instrucciones-para-claude)
7. [Frontend: diseño, componentes y estado](#7-frontend-diseño-componentes-y-estado)
8. [Decisiones técnicas y trade-offs](#8-decisiones-técnicas-y-trade-offs)
9. [Roadmap de implementación](#9-roadmap-de-implementación)
10. [Cómo trabajar con agentes de IA en este código](#10-cómo-trabajar-con-agentes-de-ia-en-este-código)
11. [Métricas, observabilidad y costos](#11-métricas-observabilidad-y-costos)
12. [Apéndice: snippets clave](#12-apéndice-snippets-clave)

---

## 1. Visión y posicionamiento

### 1.1 Problema

Comprar un auto en Argentina es **una decisión de alto stake con muy mala información disponible**:

- MercadoLibre y DeMotores muestran listados pero no asesoran. El usuario tiene que tasar, comparar, y decidir solo.
- Los **concesionarios** tienen incentivo a vender lo que tienen, no lo mejor para el comprador.
- Los **influencers de autos** dan reviews pero no responden preguntas personalizadas.
- La gente termina **tomando decisiones por intuición o consejos de amigos**, sin datos.

El comprador típico tiene preguntas muy específicas de su situación:
- *"Tengo un Fiesta 2013 con 90mil km. ¿Cuánto vale? ¿Cuánto me falta para X?"*
- *"Vi este Corolla 2018 a $18M. ¿Está bien el precio?"*
- *"Tengo $20M y viajo 3 veces al año a la costa. ¿Qué me sirve?"*

Ningún producto resuelve eso conversacionalmente con datos reales del mercado argentino.

### 1.2 Producto

**El Garaje** es un asesor conversacional de compra de autos que:

1. **Charla en español rioplatense** con conocimiento experto del mercado argentino.
2. **Tasa autos** usando publicaciones reales (scraping MercadoLibre).
3. **Compara alternativas** dentro del presupuesto (usados + 0km).
4. **Razona sobre la situación particular** (auto actual, uso, prioridades) en lugar de listar opciones.
5. **Es honesto**: si el usuario está mirando algo malo o pagando de más, se lo dice.

### 1.3 Por qué no es "otro MercadoLibre"

| MercadoLibre / DeMotores | El Garaje |
|---|---|
| Listados con filtros | Conversación con razonamiento |
| Vos tasás tu auto solo | Te lo tasa y te dice cuánto poner arriba |
| Buscás por precio | Te sugiere alternativas que no buscaste |
| No te dice si un precio está mal | Te avisa si el vendedor está pidiendo de más |
| No considera tu situación | Conoce tu auto actual, ubicación, uso |

### 1.4 Ventaja competitiva (moat)

1. **Personalización contextual**: cada respuesta usa el historial completo del usuario.
2. **Datos reales de mercado**: el scraper le da a Claude verdad de campo, no solo conocimiento general.
3. **Conocimiento argentino-específico**: el system prompt está cargado con problemas comunes de modelos en AR, mercado de usados local, brecha cambiaria, etc.
4. **Honestidad**: a diferencia de un concesionario, no hay incentivo de venta. Eso construye confianza.

### 1.5 Métricas de éxito (MVP)

- **Engagement**: ≥4 turnos promedio por sesión.
- **Calidad subjetiva**: ≥70% de sesiones terminadas con thumbs-up.
- **Tiempo de respuesta**: p95 <8 segundos por turno (incluyendo tools).
- **Costo por sesión**: <USD 0.50 en API costs (para validar viabilidad).

---

## 2. Casos de uso prioritarios

Estos 5 casos son **el core**. Todo el system prompt está optimizado para ellos. Cualquier feature nueva debe pasar el test "¿esto mejora alguno de los 5?".

### CU-1: Cambio de auto con tasación

**Trigger**: *"Tengo un Ford Fiesta 2013 full con 90.000km, quiero cambiarlo."*

**Flujo esperado**:
1. Claude scrapea ML para tasar el Fiesta. Cards tipo `tasacion`.
2. Da un rango realista ("entre $X y $Y").
3. Pregunta cuánto puede poner arriba.
4. Una vez con presupuesto total claro, sugiere 3-5 opciones (mix usado/0km). Cards tipo `recomendacion`.

**Criterios de éxito**:
- Cita publicaciones reales con link clickeable.
- El rango de tasación tiene sentido (no off por 50%).
- Las sugerencias incluyen al menos una sorpresa (no el auto obvio).

### CU-2: Evaluación de auto específico

**Trigger**: *"Estoy mirando este Corolla XEI 2018 a $18M, ¿me conviene?"*

**Flujo esperado**:
1. Claude scrapea ML para Corollas comparables.
2. Dice si el precio está dentro/fuera de mercado (con honestidad).
3. Sugiere 2-3 alternativas por el mismo presupuesto. Cards tipo `alternativa`.
4. Idealmente incluye un 0km equivalente y un usado mejor.

**Criterios de éxito**:
- Dice "está caro / está bien / está barato" sin endulzar.
- Las alternativas son realmente comparables (mismo segmento o uso).

### CU-3: Presupuesto + uso, sin auto puntual

**Trigger**: *"Tengo $25M y quiero un auto cómodo para viajar a la costa."*

**Flujo esperado**:
1. Si falta info crítica, pregunta una sola cosa (familia, automático/manual, km/año).
2. Con info suficiente, scrapea y sugiere. Cards `recomendacion`.
3. Diversifica: incluye 0km y usados de gama más alta.

**Criterios de éxito**:
- No interroga: máximo 1 pregunta antes de la primera recomendación.
- Las opciones cubren al menos 2 segmentos distintos.

### CU-4: Pregunta abierta sobre modelo

**Trigger**: *"¿Qué onda los Peugeot 208?"*

**Flujo esperado**:
1. NO scrapea ML (no hace falta).
2. Responde con conocimiento: problemas comunes en AR, qué versiones evitar, reventa, etc.
3. Opcionalmente busca en web si necesita precios oficiales 0km.
4. Sin cards, o cards solo si el usuario después pregunta por compras.

**Criterios de éxito**:
- No abusa del scraper para esto.
- Menciona problemas concretos (caja CVT, electrónica, etc.) y versiones a evitar.

### CU-5: "Algo parecido pero más nuevo"

**Trigger**: *"Quiero algo parecido a mi Gol pero más nuevo."*

**Flujo esperado**:
1. Entiende que "parecido a un Gol" = hatchback chico, económico, valor de reventa fuerte.
2. Sugiere evoluciones (Polo Track, Cronos, Onix, Argo).
3. Si tiene presupuesto, scrapea con esos filtros.

**Criterios de éxito**:
- Las sugerencias son del mismo segmento, no random.
- Justifica cada una en una frase corta.

---

## 3. Arquitectura técnica

### 3.1 Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend | HTML + CSS + Vanilla JS | Cero build step. Un solo archivo. Fácil de iterar. |
| Backend | Node.js 20+ con Express | Async-first, ecosistema maduro para scraping y LLM clients. |
| LLM | Anthropic Claude Sonnet 4.5 | Mejor relación calidad/precio con tool use y razonamiento conversacional. |
| Scraping | cheerio (HTML parser) | ML renderiza server-side; no hace falta navegador. |
| Web search | Anthropic web_search nativa | Sin integrar API externa. |
| Storage (futuro) | SQLite → Postgres | Empezar simple, migrar cuando haya carga. |

### 3.2 Diagrama de flujo

```
┌──────────────────────────────────────────────────────────────────┐
│                          USUARIO                                  │
│                  (browser, mobile o desktop)                      │
└────────────────────────┬─────────────────────────────────────────┘
                         │ POST /api/chat
                         │ { messages: [...], contexto: {...} }
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    server.js (Express)                            │
│  • Valida payload                                                 │
│  • Llama a chat() del agente                                      │
│  • Devuelve { texto, cards }                                      │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    llm.js (Agente Claude)                         │
│                                                                   │
│  ┌─────────────────────────────────────────────────┐             │
│  │  Loop de tool use (máx 6 iter)                  │             │
│  │                                                  │             │
│  │  ┌──────────────────┐                           │             │
│  │  │ Claude responde  │──── end_turn ────► texto  │             │
│  │  └──────────────────┘                           │             │
│  │           │                                      │             │
│  │           │ tool_use                             │             │
│  │           ▼                                      │             │
│  │  ┌──────────────────┐                           │             │
│  │  │ ejecutarTool()   │                           │             │
│  │  └──────────────────┘                           │             │
│  │       │         │                                │             │
│  │       ▼         ▼                                │             │
│  │  ┌────────┐ ┌────────┐                          │             │
│  │  │scraper │ │ web    │                          │             │
│  │  │  ML    │ │ search │                          │             │
│  │  └────────┘ └────────┘                          │             │
│  └─────────────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 Estructura de archivos

```
auto-recomendador/
├── public/index.html
├── prompts/system.md
├── lib/
│   ├── cards.js           # extraerCards (bloque ```json)
│   ├── db.js              # SQLite: sesiones, mensajes, caché scraper
│   ├── logger.js          # pino
│   └── validation.js      # zod, POST /api/chat
├── data/                  # garaje.db (gitignored)
├── tests/
├── server.js
├── llm.js
├── scraper.js
├── package.json
├── .env.example
└── README.md
```

**En repo:** `lib/db.js`. **Próximas iteraciones:** `routes/chat.js`, `routes/sessions.js` (refactor modular opcional).

### 3.4 Flujo de tool use en detalle

```javascript
// Pseudocódigo del loop principal en llm.js

async function chat({ messages, contexto }) {
  let apiMessages = [...messages];
  let systemPrompt = SYSTEM + injectarContexto(contexto);

  for (let i = 0; i < 6; i++) {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      system: systemPrompt,
      tools: [BUSCAR_ML, WEB_SEARCH],
      messages: apiMessages
    });

    if (resp.stop_reason === 'end_turn') {
      return extraerCards(resp);   // Termina, devuelve { texto, cards }
    }

    if (resp.stop_reason === 'tool_use') {
      // 1. Guardar el turno de assistant con los tool_use
      apiMessages.push({ role: 'assistant', content: resp.content });

      // 2. Ejecutar todas las tools en paralelo
      const results = await Promise.all(
        resp.content
          .filter(c => c.type === 'tool_use')
          .map(async tu => ({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: await ejecutarTool(tu.name, tu.input)
          }))
      );

      // 3. Mandarle los resultados a Claude
      apiMessages.push({ role: 'user', content: results });
    }
  }
}
```

---

## 4. Modelo de datos

### 4.1 Tipos del chat (frontend ↔ backend)

```typescript
// Mensaje en la conversación
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Contexto opcional del formulario de arriba
interface Contexto {
  autoActual?: string;       // "Ford Fiesta 2013 Full 90.000km"
  ciudad?: string;           // "Rosario"
  provincia?: string;        // "Santa Fe"
  presupuesto?: string;      // "$5.000.000 arriba" o "$20.000.000 total"
}

// Request al backend
interface ChatRequest {
  messages: ChatMessage[];
  contexto: Contexto;
}

// Response del backend
interface ChatResponse {
  ok: boolean;
  texto: string;             // Texto natural para mostrar en el chat
  cards: CarCard[];          // Cards opcionales para mostrar abajo
  error?: string;
}
```

### 4.2 Card de auto

```typescript
interface CarCard {
  tipo: 'tasacion' | 'recomendacion' | 'alternativa';
  titulo: string;            // "Toyota Corolla XEI CVT 2018"
  precio: number | null;     // En ARS o USD
  moneda: 'ARS' | 'USD';
  año: number | null;
  kilometros: number | null;
  link: string | null;       // URL a la publicación de ML (si existe)
  imagen: string | null;     // URL de imagen
  fuente: string;            // "MercadoLibre" | "Sugerencia IA"
  score: number;             // 0-100, qué tanto matchea con el usuario
  pros: string[];
  contras: string[];
  justificacion: string;     // 1-2 oraciones, por qué la recomienda
}
```

### 4.3 Tipos del scraper

```typescript
// Input del scraper
interface BuscarMLInput {
  marca?: string;
  modelo?: string;
  condicion: 'nuevo' | 'usado' | 'ambos';
  precioMin?: number;
  precioMax?: number;
  provincia?: string;
  ciudad?: string;
}

// Output del scraper
interface BuscarMLOutput {
  url: string;               // URL de búsqueda generada
  listings: Listing[];
  error?: string;
}

interface Listing {
  titulo: string;
  precio: number | null;
  precio_texto: string;
  moneda: 'ARS' | 'USD';
  año: number | null;
  kilometros: number | null;
  ubicacion: string | null;
  link: string;
  imagen: string | null;
  fuente: 'MercadoLibre';
}
```

### 4.4 Modelo de DB (`lib/db.js`)

```sql
-- SQLite para empezar, migrar a Postgres cuando haga falta
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                -- UUID v4
  user_id TEXT,                       -- nullable hasta que haya auth
  contexto JSON,                      -- snapshot del form
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  cards JSON,                         -- array de CarCard si aplica
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd REAL,                      -- costo de este turno
  duration_ms INTEGER,
  tool_calls JSON,                    -- log de tools ejecutadas
  created_at INTEGER NOT NULL
);

CREATE TABLE scraper_cache (
  url_hash TEXT PRIMARY KEY,          -- SHA256 de la URL
  url TEXT NOT NULL,
  response JSON NOT NULL,             -- BuscarMLOutput
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);
```

---

## 5. Especificación de API

### 5.1 `POST /api/chat`

**Request body** — `sessionId` (UUID v4, opcional): si está presente, al responder 200 el servidor persiste `messages` + respuesta del asistente (incl. `cards`) y el `contexto` en SQLite, asociados a esa sesión.

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "messages": [
    { "role": "user", "content": "Tengo un Fiesta 2013, quiero cambiarlo" }
  ],
  "contexto": {
    "autoActual": "Ford Fiesta 2013 Full",
    "ciudad": "Rosario",
    "provincia": "Santa Fe"
  }
}
```

**Response 200**:
```json
{
  "ok": true,
  "texto": "Listo, un Fiesta 2013 full hoy se está vendiendo entre...",
  "cards": [
    {
      "tipo": "tasacion",
      "titulo": "Ford Fiesta Kinetic SE 2013",
      "precio": 8500000,
      "moneda": "ARS",
      "año": 2013,
      "kilometros": 95000,
      "link": "https://auto.mercadolibre.com.ar/...",
      "imagen": "https://...",
      "fuente": "MercadoLibre",
      "score": null,
      "pros": [],
      "contras": [],
      "justificacion": "Publicación comparable a tu auto para referencia."
    }
  ]
}
```

**Response 500**:
```json
{ "ok": false, "error": "Mensaje descriptivo" }
```

### 5.2 Sesiones (V1.2)

| Endpoint | Método | Respuesta |
|---|---|---|
| `/api/sessions` | GET | `{ ok, sessions: [{ id, updated_at, preview }] }` — últimas 30 (sin auth; uso demo / single-tenant). |
| `/api/sessions/:id` | GET | `{ ok, session: { id, contexto, messages, created_at, updated_at } }` o 404. |

### 5.3 Endpoints futuros (roadmap)

| Endpoint | Método | Propósito |
|---|---|---|
| `/api/sessions` | GET | Filtrar por usuario autenticado |
| `/api/sessions/:id` | DELETE | Borrar sesión |
| `/api/feedback` | POST | Thumbs up/down de un mensaje |
| `/api/chat` | POST con SSE | Versión con streaming |

---

## 6. Prompts e instrucciones para Claude

### 6.1 System prompt (versión actual)

Vive en **`prompts/system.md`**; `llm.js` lo carga al iniciar con `fs.readFileSync()`.

### 6.2 Principios del prompt

1. **Identidad clara**: "El Garaje", español rioplatense, tono de amigo experto.
2. **Anti-patrón explícito**: "No sos un buscador de MercadoLibre con UI linda — eso ya existe."
3. **Flujos por caso de uso**: cada uno de los 5 CU está descripto con el orden de acciones esperado.
4. **Reglas de conversación**: no interrogar, recomendar con info parcial, ser honesto.
5. **Especificación del formato de salida**: bloque ` ```json ` para las cards.
6. **Tools como opciones, no obligaciones**: "Usalas cuando hagan falta — no cada turno".

### 6.3 Decisiones de prompt engineering

| Decisión | Por qué |
|---|---|
| Persona muy marcada ("El Garaje") | Genera consistencia tonal y memorabilidad. |
| Casos de uso explícitos en el prompt | Claude tiende a generalizar; los flujos concretos lo anclan. |
| Output JSON envuelto en triple backtick | Más confiable que pedir respuesta puramente JSON; permite mezclar texto y cards. |
| "Sé crítico / honesto" | Contrarresta la tendencia del modelo a ser complaciente. |
| Knowledge específico de mercado AR | Problemas comunes por modelo, brecha cambiaria, etc. — distingue de un asesor genérico. |

### 6.4 Cómo iterar el prompt

**Workflow recomendado**:

1. Mantener una **carpeta `prompts/`** con versiones (`system_v1.md`, `system_v2.md`).
2. Cada cambio debe pasar por una **batería de eval**: 10-15 conversaciones de prueba (una por variante de cada CU) corriendo contra ambas versiones.
3. **Comparar a ciegas**: copiar las respuestas a un doc sin etiquetar y juzgar manualmente cuál es mejor.
4. Métricas a observar: cantidad de tool calls (menos es mejor si la respuesta es buena igual), longitud de respuesta, presencia de cards cuando se esperan.

### 6.5 Tools definidas

```javascript
// Tool 1: scraping de ML
{
  name: 'buscar_en_mercadolibre',
  description: 'Busca publicaciones reales de autos en MercadoLibre Argentina...',
  input_schema: { /* ver llm.js */ }
}

// Tool 2: web search general
{
  name: 'web_search',
  description: 'Busca información general en la web sobre modelos de auto...',
  input_schema: { /* ver llm.js */ }
}
```

**Por qué dos tools y no una**: separar listings (estructurados, scrapeados) de info general (web) le permite a Claude elegir mejor. Mezclar todo en `web_search` hacía que para tasaciones nos devolviera artículos en vez de publicaciones.

### 6.6 Prompts auxiliares (sub-llamadas)

La `web_search` interna usa una sub-llamada con este prompt:
```
Buscá en la web y devolveme un resumen factual y conciso sobre: {query}.
No agregues opiniones, solo datos verificables.
```

---

## 7. Frontend: diseño, componentes y estado

### 7.1 Filosofía de diseño

- **Editorial / industrial**: tipografía Fraunces (serif italic) + JetBrains Mono. Cero "AI gradient purple".
- **Dark mode por defecto**: el contexto del usuario es "estoy mirando autos en mi tiempo", suele ser de noche.
- **El chat es el protagonista**: cards abajo y panel de contexto colapsable.
- **Sin frameworks**: vanilla JS. El día que la complejidad lo justifique, migrar a Next.js o similar.

### 7.2 Paleta y tipografía

```css
:root {
  /* Fondos */
  --bg: #1a1a1a;
  --bg-card: #232323;
  --bg-elevated: #2a2a2a;

  /* Texto */
  --ink: #f4ede0;          /* off-white cálido */
  --ink-dim: #a8a095;
  --ink-muted: #6b665d;

  /* Acento (naranja óxido, industrial) */
  --accent: #d97706;
  --accent-bright: #f59e0b;

  /* Semánticos */
  --good: #84cc16;
  --bad: #ef4444;

  /* Fuentes */
  --serif: 'Fraunces', Georgia, serif;
  --mono: 'JetBrains Mono', monospace;
  --sans: 'Inter', system-ui, sans-serif;
}
```

### 7.3 Layout

```
┌─────────────────────────────────────────────────┐
│  HEADER · Marca + botón "Contexto"               │
├─────────────────────────────────────────────────┤
│  PANEL CONTEXTO (colapsable)                     │
│  · auto actual · ciudad · provincia · presup     │
├─────────────────────────────────────────────────┤
│                                                  │
│  ÁREA SCROLLEABLE:                               │
│  ┌──────────────────────┐                       │
│  │  CHAT                │                       │
│  │  · mensajes user/IA  │                       │
│  └──────────────────────┘                       │
│  ┌──────────────────────┐                       │
│  │  CARDS               │                       │
│  │  · agrupadas por     │                       │
│  │    tipo, acumuladas  │                       │
│  └──────────────────────┘                       │
│                                                  │
├─────────────────────────────────────────────────┤
│  COMPOSER (sticky)                               │
│  [ textarea con auto-resize ] [ Enviar ]         │
└─────────────────────────────────────────────────┘
```

### 7.4 Componentes (cuando migremos a framework)

Si en algún momento se migra a React/Vue, estos son los componentes naturales:

```
<App>
  <Header>
    <Brand />
    <ContextToggleButton />
  </Header>

  <ContextPanel collapsed={true|false}>
    <ContextField name="autoActual" />
    <ContextField name="ciudad" />
    ...
  </ContextPanel>

  <MainScrollArea>
    <ChatStream>
      <EmptyState />            <!-- mientras no hay mensajes -->
      <Message role="user" />
      <Message role="assistant" />
      <ThinkingIndicator />     <!-- mientras esperás respuesta -->
    </ChatStream>

    <CardsSection>
      <CardGroup tipo="tasacion">
        <CarCard />
      </CardGroup>
      <CardGroup tipo="recomendacion">
        <CarCard />
      </CardGroup>
    </CardsSection>
  </MainScrollArea>

  <Composer onSend={...} />
</App>
```

### 7.5 Estado del frontend

```javascript
// Estado actual: vive en una variable global `state` en index.html
const state = {
  messages: [],      // historial completo, se manda al backend cada turno
  cards: [],         // acumulado (no se borra entre turnos)
  loading: false,
  contexto: {        // del panel colapsable
    autoActual, ciudad, provincia, presupuesto
  }
};
```

Cuando migremos a framework, usar **Zustand** (más liviano que Redux, menos boilerplate que useReducer).

---

## 8. Decisiones técnicas y trade-offs

### 8.1 Decisiones tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Node + Express | Python/FastAPI | Mejor ecosistema de scraping (cheerio, playwright). Un solo lenguaje front+back. |
| Scraping con cheerio | Playwright/Puppeteer | ML renderiza SSR; no hace falta navegador. 10x más rápido y barato. |
| Tool use vs pipeline rígido | Pipeline fijo (scraper → ranker) | Claude decide qué tool usar según el caso. CU-4 (preguntas) no debería scrapear. |
| Cards como JSON en respuesta | Streaming de cards aparte | Más simple. Streaming queda para v2. |
| Vanilla JS | React/Next.js | Un archivo, cero build. Migrar cuando justifique. |
| Conversación full en cada request | Sesiones en servidor con ID | Stateless es más fácil de escalar y testear. Costo: payload más grande. |
| Claude Sonnet 4.5 | Haiku / GPT-4 | Sonnet 4.5 razona mejor sobre los flujos de los 5 CU; Haiku es más barato pero menos preciso con tools. |

### 8.2 Deudas técnicas conocidas

- ⚠️ **Caché de scraping**: TTL 30 min en SQLite (`scraper_cache`); entornos sin DB o con `SCRAPER_CACHE_DISABLED=true` no cachean.
- ⚠️ **Scraper frágil**: si MercadoLibre cambia los selectores HTML, hay que actualizar `parseListings()` manualmente.
- ⚠️ **Sin streaming**: el usuario ve "Buscando y analizando" hasta tener la respuesta completa.
- ⚠️ **Persistencia local**: la sesión vive en SQLite en el servidor; sin auth, `GET /api/sessions` lista todas las charlas del proceso (ok para demo / un solo usuario).
- ⚠️ **Tests limitados**: hay unit tests de `extraerCards` y del parser con fixture HTML; sin e2e ni suite grande.
- ⚠️ **API key en .env**: para deploy real, mover a un secret manager (AWS Secrets, Doppler).
- ⚠️ **Observabilidad básica**: logs JSON con **pino** a stdout; falta agregador (Datadog, etc.).

### 8.3 Trade-offs a evaluar

**Caché de scraping con TTL bajo (15-30 min)**

- ✅ Reduce costos y latencia.
- ❌ Si un auto se vende, lo seguimos mostrando un rato.
- 📌 Decisión: implementar con TTL de 30 min en SQLite.

**Streaming SSE**

- ✅ Mucho mejor UX (texto va apareciendo).
- ❌ Más complejo: hay que parsear cards después de que termine el stream.
- 📌 Decisión: implementar en v2, no es bloqueante.

**Multi-tenant / cuentas de usuario**

- ❌ Fuera de scope del MVP.
- 📌 Si lo necesitamos para validar, usar magic link via email (sin password).

---

## 9. Roadmap de implementación

### 🎯 V1.0 — MVP funcional (estado actual)

**Status**: ✅ Hecho

- Chat conversacional con Claude Sonnet 4.5
- Tool use: scraping ML + web search
- Frontend con contexto colapsable + cards
- 5 casos de uso cubiertos

### 🎯 V1.1 — Hardening (1-2 días de trabajo)

**Goal**: el MVP no se rompe en uso real.

- [x] Mover system prompt a `prompts/system.md`, cargar con `fs.readFileSync`.
- [x] Logging estructurado con `pino` o `winston` (turnos, costos, errores).
- [x] Manejo de errores en el scraper (rate limit, HTML cambiado, timeout).
- [x] Validación del payload del request con `zod`.
- [x] Variable de entorno para forzar modo dev (loggea más, no llama a la API real).
- [x] Tests unitarios del parser de cards (`extraerCards`).
- [x] Tests del scraper con HTML fixtures.
- [x] README con instrucciones de deploy.

### 🎯 V1.2 — Persistencia y caché (3-4 días)

**Goal**: el usuario no pierde su conversación; reducimos costos.

- [x] SQLite con `better-sqlite3`. Tablas: `sessions`, `messages`, `scraper_cache`.
- [x] Generar `sessionId` en frontend, guardarlo en `localStorage`.
- [x] Endpoint `GET /api/sessions/:id` para recuperar (y `GET /api/sessions` listado reciente).
- [x] Caché de scraper con TTL 30 min (hash de la URL como clave).
- [x] UI: lista de conversaciones previas en un menú lateral.

### 🎯 V1.3 — UX mejorada (3-5 días)

**Goal**: la conversación se siente fluida y profesional.

- [ ] Streaming SSE: el texto aparece a medida que se genera.
- [ ] Mostrar las cards después del stream (no romper UX).
- [ ] Indicadores de tool use ("Tasando tu auto...", "Buscando alternativas...").
- [ ] Botones de feedback (👍 / 👎) en cada respuesta de Claude.
- [ ] Copy-to-clipboard del link de una card.
- [ ] Botón "comparar estos 3" que abre tabla side-by-side.

### 🎯 V1.4 — Fuentes adicionales (4-7 días)

**Goal**: no depender solo de MercadoLibre.

- [ ] Scraper de DeMotores (estructura HTML distinta).
- [ ] Scraper de OLX Autos.
- [ ] Estrategia de fan-out: el agente pide a todas, se mezclan resultados, se deduplican.
- [ ] Evaluación si vale la pena pagar **InfoAuto** (tasaciones oficiales).

### 🎯 V2.0 — Producto público (2-4 semanas)

**Goal**: poder mostrarlo y que la gente lo use sin acompañamiento.

- [ ] Auth con magic links (Resend / Loops).
- [ ] Deploy en Railway / Fly.io con Postgres managed.
- [ ] Rate limiting por IP y por usuario (proteger costos).
- [ ] Landing page explicando qué hace.
- [ ] Onboarding (3-4 ejemplos al primer ingreso).
- [ ] Compartir conversación con link público.
- [ ] Analytics: PostHog para eventos.

### 🎯 V3.0 — Features avanzadas

Ideas para más adelante, sin orden de prioridad:

- App móvil (React Native o PWA).
- Notificaciones cuando aparezca un auto que matchea tus criterios.
- Integración con tasación por VIN (escaneo de cédula).
- "Modo concesionario": versión que un dealer puede usar con sus propios listings.
- Marketplace propio: vincular comprador y vendedor.
- Reportes mensuales del mercado ("Los Corollas usados subieron 8% este mes").

---

## 10. Cómo trabajar con agentes de IA en este código

Este proyecto está pensado para ser **co-desarrollado con agentes** (Claude Code, Antigravity, Cursor). Algunas convenciones que ayudan:

### 10.1 Prompts iniciales recomendados

Cuando arranques una sesión con un agente, dale este contexto inicial:

```
Estoy continuando el desarrollo de "El Garaje", un asesor conversacional de
compra de autos para Argentina. Antes de codear, leé estos archivos:

1. SPECS.md (este documento) — visión, arquitectura y roadmap
2. auto-recomendador/README.md — setup y deploy
3. prompts/system.md — system prompt
4. llm.js — agente con tool use
5. scraper.js — MercadoLibre
6. server.js — Express
7. public/index.html — frontend

El stack es Node + Express + vanilla JS. No me migres a React/Next sin
pedirme primero. No me agregues TypeScript todavía.

La tarea de hoy es: [TAREA].
```

### 10.2 Tareas que conviene pasarle a un agente

**Bueno para agentes**:
- Ampliar tests (e2e, más fixtures de ML).
- Migración: meter SQLite con esquema definido.
- UI tweaks: cambiar estilos, agregar tooltips.
- Implementar features con spec clara (ver roadmap).

**No tan bueno (hacelo vos)**:
- Iteración de prompts (necesitás juicio sobre las respuestas).
- Decisiones de producto (qué CU agregar, cómo cobrarlo).
- Diseño visual desde cero (te van a tirar gradients morados otra vez).
- Cambios al modelo de Claude (cada modelo se prompta distinto).

### 10.3 Convenciones de código

- **ESM** (`import / export`), no CommonJS.
- **Comentarios en español** son OK; código en inglés.
- **Funciones puras** cuando se pueda; side effects en `server.js` y `scraper.js`.
- **Sin TypeScript todavía** — usar JSDoc para tipos cuando importe (los `interface` de la sección 4 son aspiracionales para cuando migremos).
- **Logs estructurados** con **pino** (`lib/logger.js`); mensajes con contexto en JSON (ideal para grep o agregador).
- **Errores tienen mensaje útil**: nada de `throw new Error('error')`.

### 10.4 Antes de mergear cambios

Checklist mental:

- [ ] Probé manualmente al menos uno de los 5 CU.
- [ ] Si toqué el prompt, comparé respuestas vieja vs nueva en 3 escenarios.
- [ ] Si toqué el scraper, probé que devuelva resultados con URL real (selectores cambian).
- [ ] No hay API keys hardcodeadas.
- [ ] El loop de tool use sigue topeado (sin runaway).

---

## 11. Métricas, observabilidad y costos

### 11.1 Costos de API estimados

Asumiendo Claude Sonnet 4.5 (input ~$3/MTok, output ~$15/MTok) y una conversación promedio:

| Turno | Tokens in | Tokens out | Costo estimado |
|---|---|---|---|
| Turno simple (sin tools) | ~2.500 | ~400 | ~$0.014 |
| Turno con 1 tool call | ~3.500 | ~600 | ~$0.020 |
| Turno con 2-3 tool calls | ~5.000 | ~800 | ~$0.027 |
| **Sesión típica (5-7 turnos)** | | | **~$0.12-0.20** |

Más una sub-llamada de web_search ocasional (~$0.01 cada una).

**Estrategias para bajar costos**:
- Caché de scraping (no afecta tokens pero sí latencia).
- Prompt caching de Anthropic para el system prompt (puede ahorrar 50-80% en input tokens).
- Usar Haiku 4.5 para sub-llamadas internas (web_search).

### 11.2 Logs estructurados (a implementar)

```json
{
  "ts": "2026-05-12T10:23:45Z",
  "session_id": "abc123",
  "turn": 3,
  "user_message_len": 87,
  "assistant_response_len": 412,
  "tool_calls": ["buscar_en_mercadolibre"],
  "duration_ms": 4321,
  "tokens_in": 3200,
  "tokens_out": 580,
  "cost_usd": 0.018,
  "cards_returned": 4,
  "scraper_listings_found": 8
}
```

Con esto se pueden armar dashboards de:
- Costo promedio por sesión.
- Distribución de uso de tools.
- Tiempos de respuesta (p50, p95, p99).
- Tasa de errores del scraper.

### 11.3 Alertas (para producción)

- Costo diario excede USD X → alerta a Slack.
- Tasa de error del scraper >20% → mail.
- p95 de respuesta >15s → mail.
- Cualquier 500 inesperado → Sentry.

---

## 12. Apéndice: snippets clave

### 12.1 Llamada base al API de Anthropic

```javascript
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const resp = await client.messages.create({
  model: 'claude-sonnet-4-5',
  max_tokens: 4096,
  system: SYSTEM_PROMPT,
  tools: TOOLS,
  messages: [
    { role: 'user', content: 'Tengo un Fiesta 2013...' }
  ]
});
```

### 12.2 Estructura de un tool result

```javascript
// Cuando Claude pide ejecutar una tool, su mensaje tiene esta forma:
{
  role: 'assistant',
  content: [
    { type: 'text', text: 'Voy a buscar publicaciones similares...' },
    {
      type: 'tool_use',
      id: 'toolu_abc123',
      name: 'buscar_en_mercadolibre',
      input: { marca: 'Ford', modelo: 'Fiesta', condicion: 'usado' }
    }
  ]
}

// Y le respondemos con un mensaje de role:user:
{
  role: 'user',
  content: [
    {
      type: 'tool_result',
      tool_use_id: 'toolu_abc123',
      content: JSON.stringify({ url: '...', listings: [...] })
    }
  ]
}
```

### 12.3 Cómo agregar una tool nueva

1. Definirla en el array `TOOLS` de `llm.js`:

```javascript
{
  name: 'mi_tool_nueva',
  description: 'Descripción clara de qué hace y cuándo usarla.',
  input_schema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: '...' }
    },
    required: ['param1']
  }
}
```

2. Manejarla en `ejecutarTool()`:

```javascript
if (name === 'mi_tool_nueva') {
  return JSON.stringify(await miFuncion(input.param1));
}
```

3. Actualizar el system prompt para mencionarla (opcional, mejora la consistencia).

### 12.4 Generar URL de MercadoLibre Autos

```javascript
// Formato real:
// https://autos.mercadolibre.com.ar/usados/santa-fe/rosario/ford/fiesta/_PriceRange_5000000-15000000

function buildSearchUrl({ condicion, provincia, ciudad, marca, modelo, precioMin, precioMax }) {
  const parts = ['https://autos.mercadolibre.com.ar'];
  if (condicion === 'nuevo') parts.push('nuevos');
  else if (condicion === 'usado') parts.push('usados');
  if (provincia) parts.push(slugify(provincia));
  if (ciudad) parts.push(slugify(ciudad));
  if (marca) parts.push(slugify(marca));
  if (modelo) parts.push(slugify(modelo));
  let url = parts.join('/');
  if (precioMin || precioMax) {
    url += `/_PriceRange_${precioMin || 0}-${precioMax || 999999999}`;
  }
  return url;
}
```

### 12.5 Parsing de cards desde la respuesta

Implementación canónica (y tests): **`auto-recomendador/lib/cards.js`** → `extraerCards(texto)`.

---

## Cierre

Este documento debe ser **vivo**. Cada vez que tomes una decisión importante (cambiar el modelo, agregar una fuente, pivotear un caso de uso), actualizá la sección correspondiente.

**Para arrancar la próxima sesión de desarrollo**:

1. Leé las secciones [1](#1-visión-y-posicionamiento), [2](#2-casos-de-uso-prioritarios) y [9](#9-roadmap-de-implementación).
2. Elegí la próxima feature del roadmap.
3. Mirá el snippet relevante en [el apéndice](#12-apéndice-snippets-clave).
4. Codeá. Probá. Actualizá el doc si cambia algo arquitectural.

**Fin del documento.**
