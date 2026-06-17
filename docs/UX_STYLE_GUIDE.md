# UX Style Guide — El Garaje

Fuente de verdad visual e de interacción para el frontend (`public/`).  
Basado en **[DESIGN.md](../DESIGN.md)** (Renault-inspired): showroom digital, alto contraste, amarillo Sunlight como único acento de acción.

---

## 1. Propósito y principios

**El Garaje** ayuda a **elegir modelo/versión/año** y luego **evaluar unidades** publicadas en varios portales.

### Principios (Renault DESIGN.md)

| Principio | Significado |
|-----------|-------------|
| **Dos superficies** | `{canvas}` blanco para catálogo; `{surface-dark}` negro para storytelling (hero, tabs activos). |
| **Un acento** | `{primary}` `#ffed00` solo en CTA principal y badge “Nuevo”. Siempre con texto `{on-primary}` negro. |
| **Geometría cuadrada** | Cards y fotos `{rounded.none}`; botones `{rounded.xs}` 2px; pills solo en sub-nav. |
| **Sin sombras en catálogo** | Profundidad por color-blocking y hairlines, no drop-shadow en cards. |
| **Tipografía única** | Inter Tight (sustituto NouvelR): display 700 / `line-height: 0.95`, body 400. |
| **Un CTA primario por pantalla** | Máximo un `.btn.primary` amarillo visible por vista. |
| **Journey por vistas** | Descubrir → Mis búsquedas → Workspace → Novedades. |

### Flujo

```
Hero aurora (view-inicio) — búsqueda coloquial
    → Workspace (view-board) — tab Avisos
    → Mis búsquedas · Novedades · Asesor (dock)
```

---

## 2. Arquitectura de información

| Vista | ID | Superficie |
|-------|-----|------------|
| **Descubrir** | `view-inicio` | `hero-band` oscuro + aurora; catálogo en `catalog-body` blanco |
| **Mis búsquedas** | `view-busquedas` | Lista configurator-row (hairlines) |
| **Workspace** | `view-board` | Tabs pill + grid vehicle-card |
| **Novedades** | `view-hoy` | Grid blanco |

### Navegación

| Breakpoint | Patrón |
|------------|--------|
| **< 1024px** | `shell-topbar` 60px + `bottom-nav` |
| **≥ 1024px** | `shell-nav` blanco 72px |

### Workspace — pestañas (`sub-nav-pill`)

Avisos · Modelos · Compra · Notas — pill outline; activo = negro.

---

## 3. Design tokens

Definidos en `:root` de [`public/index.html`](../public/index.html). Ver [`DESIGN.md`](../DESIGN.md) para especificación completa.

### Marca

| Token | Valor | Uso |
|-------|-------|-----|
| `--primary` | `#ffed00` | CTA primario, badge nuevo |
| `--primary-deep` | `#e6d200` | Hover/pressed |
| `--on-primary` | `#000000` | Texto sobre amarillo |
| `--surface-dark` | `#000000` | Hero, CTA secondary, tab activo |
| `--ink` | `#000000` | Texto y estructura |

### Superficies

| Token | Valor |
|-------|-------|
| `--canvas` / `--panel` | `#ffffff` |
| `--panel-soft` | `#f7f7f7` |
| `--line` | `#f2f2f2` hairline |
| `--line-strong` | `#000000` outline |

### Tipografía

- **Display:** Inter Tight 700, `line-height: 0.95`
- **Body:** Inter Tight 400, 14–16px
- **Botones:** 700, `letter-spacing: 0.01em`, altura 48px

### Hero aurora

`--aurora`: gradiente magenta → violeta → teal → amarillo. Solo en `.hero-band`.

---

## 4. Componentes clave

| Componente | Clase | Notas |
|------------|-------|-------|
| CTA primario | `.btn.primary` | Amarillo, 2px radius |
| CTA secundario | `.btn.secondary` | Negro sólido |
| Terciario | `.text-btn` | Subrayado, sin borde |
| Vehicle card | `.card` | Sin radius, foto 4:3, copy abajo |
| Badge nuevo | `.ribbon` | Amarillo pill, abajo-izq |
| Sub-nav | `.workspace-tabs button` | Pill 36px |
| Filtros | `.filter-chip` | Pill; checked = negro |

---

## 5. Breakpoints

| Nombre | Rango |
|--------|-------|
| **sm** | 0–639px |
| **md** | 640–1023px |
| **lg** | ≥1024px |

---

## 6. Anti-patrones

- Más de un elemento amarillo compitiendo por viewport.
- Amarillo con texto blanco (prohibido en Renault).
- Border-radius grande en cards o fotos de vehículos.
- Drop-shadow en grid de avisos.
- Segunda fuente tipográfica o peso 500 en body.
- Gradiente aurora fuera del hero.

---

## 7. Referencias

- [`DESIGN.md`](../DESIGN.md) — tokens y componentes Renault
- [`SPECS.md`](../SPECS.md) §7 — layout funcional

---

## Checklist pre-PR

1. ¿Hero aurora solo en Descubrir?
2. ¿Un solo `.btn.primary` amarillo por vista?
3. ¿Cards sin sombra, esquinas cuadradas?
4. ¿Nav blanco + hairline en desktop?
5. ¿Touch targets ≥ 44px?
