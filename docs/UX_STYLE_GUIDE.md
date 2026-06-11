# UX Style Guide — El Garaje

Fuente de verdad visual e de interacción para el frontend (`public/`).  
Actualizado para producto **mobile-first**, agregador + asesor de compra (Argentina).

---

## 1. Propósito y principios

**El Garaje** no es un listado más: ayuda a **elegir modelo/versión/año** y luego **evaluar unidades** publicadas en varios portales.

### Principios

| Principio | Significado |
|-----------|-------------|
| **Mobile-first** | Diseñar para 375px; desktop suma rail y dock lateral, no al revés. |
| **Autos primero** | En el tablero, el grid de avisos va antes que brief, trámite y herramientas. |
| **Progresión clara** | Buscar → Entender → Comparar → Contactar → Cerrar trámite. |
| **Colapsar el ruido** | Contexto del asesor y trámite disponibles, no empantanados en pantalla. |
| **Confianza sin clutter** | Inspiración Kavak/ML: pocos paneles abiertos a la vez. |
| **Sin build step** | Un `index.html` con tokens CSS; extraer a archivos es fase 2. |

### Flujo del usuario

```
Inicio (búsqueda coloquial)
    → Tablero (avisos + brief colapsable)
        → Card: Ver aviso / Ficha técnica
        → Contactado → Seguimiento de compra (checklist)
    → Novedades (alertas globales)
    → Asesor (dock / bottom sheet)
```

---

## 2. Arquitectura de información

### Vistas principales

| Vista | ID | Rol |
|-------|-----|-----|
| **Buscar** | `view-inicio` | Hero + búsqueda coloquial + búsquedas guardadas |
| **Novedades** | `view-hoy` | Nuevos y bajas de precio en todas las búsquedas |
| **Tablero** | `view-board` | Una búsqueda guardada: avisos + contexto del asesor |

### Navegación

| Breakpoint | Patrón |
|------------|--------|
| **&lt; 1024px** | Bottom nav: Buscar · Novedades · Búsquedas · Asesor |
| **≥ 1024px** | Rail lateral (marca, nav, lista de búsquedas, asesor) |

### Tablero — capas de información

Orden **obligatorio** en DOM y scroll:

1. **Capa 1 (primaria):** header + filtros chips + `boardGrid`
2. **Capa 2:** `panel-brief` — recomendación del asesor (colapsable; abierto solo en desktop)
3. **Capa 3:** `panel-tramite` — guía única de compra/venta (sin duplicar en brief)
4. **Capa 4:** `panel-tools` — ficha modelo, notas, reporte de portales

```
┌─ Tablero ─────────────────────────┐
│ Título + acciones                   │
│ [Filtro asesor] (si activo)         │
│ ┌─────┐ ┌─────┐ ┌─────┐  ← GRID    │
│ │Card │ │Card │ │Card │            │
│ └─────┘ └─────┘ └─────┘            │
│ ▸ Recomendación del asesor          │
│ ▸ Cómo cerrar la compra             │
│ ▸ Más sobre esta búsqueda           │
└─────────────────────────────────────┘
```

---

## 3. Design tokens

Definidos en `:root` de [`public/index.html`](../public/index.html). **No inventar colores nuevos** sin actualizar esta guía.

### Superficies y texto

| Token | Valor | Uso |
|-------|-------|-----|
| `--canvas` | `#f3f1ec` | Fondo general |
| `--panel` | `#ffffff` | Cards, paneles |
| `--panel-soft` | `#faf9f6` | Hover, fondos secundarios |
| `--ink` | `#18170f` | Texto principal |
| `--muted` | `#6c675d` | Texto secundario |
| `--subtle` | `#9a9489` | Metadatos, hints |

### Marca y semántica

| Token | Uso |
|-------|-----|
| `--brand` / `--brand-dark` | CTAs primarios, precio, urgencia, “nuevo” |
| `--blue` | Asesor, recomendado, contactado, filtros IA |
| `--good` / `--good-soft` | Mercado favorable, bajó precio, checklist OK |

### Layout

| Token | Valor |
|-------|-------|
| `--nav-bottom-h` | `56px` — altura bottom nav |
| `--r-sm` / `--r-md` / `--r-lg` | `8px` / `11px` / `16px` |
| `--s1`…`--s6` | Escala de espaciado 4–28px |
| `--t-xs`…`--t-2xl` | Escala tipográfica 11–28px |

### Tipografía

- **Sans:** `Inter`, system-ui — todo el UI
- **Mono:** specs en pills (`km`, `año`)

---

## 4. Espaciado y targets táctiles

- **Mínimo táctil:** 44×44px en botones de nav y acciones de card en mobile.
- **Padding página:** mobile `16px` (`--s4`); desktop `28px` (`--s6`).
- **Grid cards:** mobile 1 columna; desde `640px` `minmax(238px, 1fr)`.
- **Imagen card:** aspect-ratio `4/3` (patrón agregadores).

---

## 5. Breakpoints

| Nombre | Rango | Comportamiento |
|--------|-------|----------------|
| **sm** | 0–639px | 1 col, paneles colapsados, bottom nav |
| **md** | 640–1023px | Grid multi-col, bottom nav, sin rail |
| **lg** | 1024px+ | Rail + dock lateral; brief abierto por defecto |

**No usar** breakpoints ad hoc (ej. `860px`). Solo estos tres.

---

## 6. Componentes

### Card (` .card `)

Estados: `fresh`, `discarded`, `recommended`, `starred`, `contacted-open`, `flash`.

**En listado:** precio, specs, badge mercado, Ver aviso, Ficha técnica, acciones Guardar/Contactado/Descartar.  
**Nunca** checklist completo en la card — solo en `followup` al marcar Contactado.

### AdvisorBrief (` .advisor-brief `)

Resumen de búsqueda: query, explicación, modelos (`mg-grid`), evitar, criterios.  
**Sin** bloque de trámite duplicado (vive en `panel-tramite`).

### ModelGuide (` .mg-* `)

Ficha jerárquica marca → generación → versión. Solo dentro del brief colapsable.

### BottomNav (` .bottom-nav `)

4 ítems fijos abajo; badge en Novedades; activo en Buscar incluye vista tablero.

### Dock asesor (` .dock `)

- Desktop: panel derecho 420px
- Mobile: bottom sheet ~92vh, ancho completo

### Panel colapsable (` .panel-collapse `)

`<details>` con `<summary>` claro. Mobile cerrado por defecto excepto que el usuario abra.

### EmptyState (` .empty `)

Título en negrita + texto de ayuda accionable.

### Toast (` .toast `)

Feedback breve; esquina inferior (sobre bottom nav en mobile).

---

## 7. Patrones de contenido

- **Idioma:** español argentino, voseo donde suene natural (“buscá”, “tocá”).
- **Títulos:** accionables o descriptivos (“¿Qué auto estás buscando?”).
- **Brief:** máximo ~3 bloques visibles antes de requerir expandir panel.
- **Precios:** `$` + separador miles `es-AR`.
- **CTA primario por card:** “Ver aviso” (externo al portal).
- **Asesor:** tono experto amigo, sin jerga de concesionaria.

---

## 8. Benchmark (referencia)

| Plataforma | Qué tomamos |
|------------|-------------|
| **Mercado Libre Autos** | Hero búsqueda, grid, CTA por card |
| **Kavak** | Trámite y pasos colapsados hasta que hacen falta |
| **DeMotores / Chileautos** | Badges mercado, filtros como chips |
| **Idealista / Zillow** | Búsquedas guardadas en lista secundaria |
| **Airbnb mobile** | Bottom nav 4 ítems |

**Diferenciador:** capa de asesor (modelo/versión/año) antes de evaluar cada publicación.

---

## 9. Anti-patrones

- Apilar 4+ paneles expandidos en el tablero.
- Duplicar guía de trámite en brief y en `transactionGuideWrap`.
- Poner checklist de compra en la card del listado.
- Añadir secciones al tablero sin asignarlas a capa 2/3/4.
- Nuevos breakpoints o colores fuera de tokens.
- Rail + bottom nav visibles a la vez.
- Chat/asador como pantalla principal (producto actual es tablero-agregador).

---

## 10. Roadmap (fase 2)

- Extraer CSS a `public/styles/tokens.css` + `components.css`
- Modularizar JS del monolito
- Ilustraciones / empty states con marca
- Drawer animado para búsquedas en tablet

---

## Checklist pre-PR (frontend)

1. ¿En mobile 375px se ven avisos sin scroll excesivo?
2. ¿Bottom nav visible y rail oculto &lt; 1024px?
3. ¿Trámite en un solo lugar?
4. ¿Tokens existentes, sin colores nuevos?
5. ¿Touch targets ≥ 44px en acciones principales?
