# Price Monitoring Report — {{run_date}}

**Summary:** {{summary_line}}
**Watchlist size:** {{total_count}} • **Changed:** {{changed_count}} • **Failed:** {{failed_count}}
**Baseline:** {{baseline_path_or_first_run}}

---

## 🚨 Threshold hits

Products that crossed an `alert_below` price the user set.

| Product | Baseline | Current | Delta | Link |
|---------|----------|---------|-------|------|
| {{title}} ({{id}}) | {{baseline_price}} {{currency}} | **{{current_price}} {{currency}}** | {{delta_abs}} ({{delta_pct}}) | {{link}} |

_Omit this section if there are no threshold hits._

---

## ⬇️ Price decreases

| Product | Baseline | Current | Delta | Link |
|---------|----------|---------|-------|------|
| {{title}} | {{baseline_price}} {{currency}} | {{current_price}} {{currency}} | −{{delta_abs}} (−{{delta_pct}}) | {{link}} |

## 🔁 Restocks

| Product | Last seen | Current | Link |
|---------|-----------|---------|------|
| {{title}} | out of stock since {{baseline_captured_at}} | {{current_price}} {{currency}} | {{link}} |

## ⛔ Out of stock

| Product | Last price | Last seen | Link |
|---------|------------|-----------|------|
| {{title}} | {{baseline_price}} {{currency}} | {{baseline_captured_at}} | {{link}} |

## ⬆️ Price increases

| Product | Baseline | Current | Delta | Link |
|---------|----------|---------|-------|------|
| {{title}} | {{baseline_price}} {{currency}} | {{current_price}} {{currency}} | +{{delta_abs}} (+{{delta_pct}}) | {{link}} |

## 🆕 New (not in baseline)

| Product | Current | Link |
|---------|---------|------|
| {{title}} | {{current_price}} {{currency}} | {{link}} |

## 🗑️ Removed (404'd)

| Product | Last price | Last seen |
|---------|------------|-----------|
| {{title}} | {{baseline_price}} {{currency}} | {{baseline_captured_at}} |

## ❌ Failed to fetch

| Product | Reason |
|---------|--------|
| {{id}} | {{status}} — {{error_message}} |

## ✅ Unchanged

Collapsed by default. {{unchanged_count}} products held within ±0.5% of baseline.

---

**Next step:** Update the baseline file with today's prices? (y/n)
