# SERP Playbook

Exact query patterns and extraction targets for each SERP check in the audit.

## Indexation queries

| Goal | Query |
|------|-------|
| Total indexed pages | `site:example.com` |
| Indexed pages on a specific subdirectory | `site:example.com/blog/` |
| Duplicate/unintended URLs | `site:example.com` — scan for staging, UTM, or paginated URLs in results |
| Brand Knowledge Panel | `"Brand Name"` (exact match) |
| Branded SERP features | `Brand Name` (unquoted) |

**What to extract from `site:` results:**
- Total result count (Google's displayed estimate)
- Presence of sitelinks (signals strong brand authority)
- Any URLs that shouldn't be indexed (note as issue if found)
- Page titles as Google shows them (often different from `<title>` — signals rewriting)

**Indexation caveat:** `site:` counts are approximate. For precise coverage, Search Console is
required. Always caveat this in the report.

## Keyword ranking queries

Run `google_search` with `num: 10` (default) for each target keyword.

**What to extract from organic results:**
```
position        — rank of target site (search through all 10 results)
url             — the exact URL ranking (note if it's the "right" page)
title           — as shown in SERP (vs the page's actual <title>)
snippet         — the displayed meta description or auto-generated snippet
domain          — for identifying top competitors
```

**SERP feature signals to note:**
- `featured_snippet` present → note the source domain; if it's not the target site, this is an
  opportunity
- `people_also_ask` → mine these for content gap opportunities; list the top 4 questions
- `knowledge_panel` → present? owned by the target brand?
- `shopping_results` → relevant if the site sells products
- `local_pack` → relevant for local businesses
- `image_pack` → relevant if the site has strong visual content

**When the site doesn't appear in top 10:**
- Search pages 2–3 with `start: 10`, `start: 20` to find actual position
- If still not found, classify as "not ranking" — this is a high-priority gap

## Competitor extraction

From the organic results for each target keyword, extract the top 3 non-target domains:
- Exclude aggregators (Wikipedia, Reddit, YouTube) unless they're consistently outranking
  the target — if so, note it as a content-format issue
- These become the Stage 4 competitor pages to scrape

## Geo-targeting

If the site serves a specific country, pass `countryCode` and `gl` to `google_search`:
- UK: `countryCode: "gb"`, `gl: "gb"`
- Australia: `countryCode: "au"`, `gl: "au"`
- Default (US): no params needed

## News / brand signals

Use `google_news` with:
- Query: `"Brand Name"` or `"domain.com"`
- `timePeriod: "3M"` for recent coverage

What to note:
- Presence of news coverage (positive E-E-A-T signal)
- Source quality (major publications vs. low-quality syndication)
- Negative news (reputation risk)
