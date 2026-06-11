# Report Template

Use this exact structure for all audit reports. Adapt section depth to Mode A vs Mode B.

---

```markdown
# SEO Audit: [Site Name / Domain]
*Audited: [date] | Mode: [Site-Wide / Single-Page] | Target keywords: [list]*

---

## Executive Summary

[2–4 sentences on the site's current search visibility. Lead with the most important finding.
Then name the top 3 issues and the single highest-impact action the user should take first.]

**Top 3 issues:**
1. [Issue] — [one-line impact]
2. [Issue] — [one-line impact]
3. [Issue] — [one-line impact]

---

## 1. Indexation & SERP Presence

**Indexed pages:** ~[N] (via `site:domain.com`)
**Sitelinks:** [Present / Not present]
**Brand Knowledge Panel:** [Present / Not present]

[1–2 sentences on what this signals. Note any unexpected indexed URLs.]

---

## 2. Keyword Visibility

For each target keyword:

### "[keyword]"
- **Ranking position:** [N] (URL: [url]) — or "Not ranking in top 30"
- **Featured snippet:** [Domain that owns it, or "None"]
- **People Also Ask:** [List top 3–4 questions]
- **Top competitors:** [domain1], [domain2], [domain3]
- **Note:** [anything notable — wrong page ranking, title mismatch, etc.]

---

## 3. On-Page Analysis

For each audited page:

### [Page URL]
| Signal | Finding | Status |
|--------|---------|--------|
| Title tag | "[actual title]" (N chars) | ✅ / ⚠️ / ❌ |
| Meta description | "[actual meta]" (N chars) | ✅ / ⚠️ / ❌ |
| H1 | "[actual H1]" | ✅ / ⚠️ / ❌ |
| Canonical | Self-referencing / [URL] | ✅ / ⚠️ / ❌ |
| Robots meta | Index/follow / noindex (!) | ✅ / ❌ |
| Schema types | [list or "None"] | ✅ / ⚠️ / ❌ |
| H2 structure | [Covers subtopics / Missing] | ✅ / ⚠️ / ❌ |
| Image alt text | [All present / N missing] | ✅ / ⚠️ / ❌ |

[1–2 sentence narrative on the page's biggest on-page issue.]

---

## 4. Competitor Gap Analysis

### "[keyword]" — Gap vs. [Competitor Domain]

| Element | Target Site | Competitor |
|---------|-------------|------------|
| Schema types | [list] | [list] |
| H2 topics | [list] | [list] |
| Word count (approx.) | ~N | ~N |
| SERP features owned | [list] | [list] |

**Key gaps:** [2–3 specific, actionable observations]

---

## 5. Brand & Freshness Signals

- **News coverage (last 3 months):** [N mentions / None found]
- **Notable sources:** [list or "None"]
- **E-E-A-T signals on site:** [Author bios, about page, credentials — present or missing]

---

## Prioritized Recommendations

### 🔴 High Impact (do first)
1. **[Specific action]** — [page URL] — [what to change from → to]
   *Why: [one sentence on expected impact]*

### 🟡 Medium Impact
2. **[Specific action]** — [page URL or site-wide] — [what to do]
   *Why: [one sentence]*

### 🟢 Low Impact / Quick Wins
3. **[Specific action]**

---

## Out-of-Scope Notes

These factors weren't measurable with the tools used in this audit:
- **Core Web Vitals (field data)** — check PageSpeed Insights or Search Console > Core Web Vitals
- **Crawl errors / coverage** — check Search Console > Coverage
- **Backlink profile** — check Ahrefs, Semrush, or Moz
- **Click-through rates** — check Search Console > Performance
[Add others as relevant]

---

## Data Sources

| Tool call | What it was used for |
|-----------|---------------------|
| `google_search("site:domain.com")` | Indexation check |
| `google_search("[keyword]")` | Keyword ranking |
| `scrape("url")` | On-page analysis |
| ... | ... |
```
