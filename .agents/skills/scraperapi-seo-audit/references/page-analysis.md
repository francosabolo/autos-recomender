# Page Analysis Checklist

What to extract and evaluate when scraping a page during the audit.

## How to scrape

Use two calls per page when time allows; one call for audits with many pages:

1. `outputFormat: "html"` — for precise extraction of `<title>`, `<meta>`, `<h1>`, schema markup,
   canonical tags, robots meta, and image alt attributes
2. `outputFormat: "markdown"` — for content quality, heading structure overview, and word count
   approximation

Set `render: true` for pages that are likely JS-rendered (single-page apps, React/Next.js sites).
Signs: minimal HTML in the non-rendered response, or a blank body.

## Extraction checklist

### Title tag
- Present? (`<title>` in `<head>`)
- Contains target keyword? (preferably near the front)
- Length: 50–60 characters is ideal for display; flag if >70 (likely to be truncated) or <30 (under-optimized)
- Does the SERP title (from Stage 2) match the `<title>`? If Google rewrote it, the original
  probably doesn't match the page's content or intent well

### Meta description
- Present? (`<meta name="description">`)
- Length: 150–160 characters; flag if missing or >180
- Compelling? Does it describe the page clearly and include a call to action or differentiator?
- Note: Google often rewrites meta descriptions; flag if the SERP snippet looks auto-generated

### Canonical tag
- Present? (`<link rel="canonical">`)
- Does it point to the correct URL? (self-referencing is normal and good)
- Mismatch between canonical and actual URL = potential indexation issue

### Robots meta
- Check for `<meta name="robots" content="noindex">` — if present on a page that should rank,
  this is a critical blocker

### Heading structure
- H1: exactly one, includes target keyword, appears near the top of content
- H2s: cover major subtopics; do they match the PAA questions found in Stage 2?
- H3s: used for sub-sections within H2s (not skipping levels)
- Flag: multiple H1s, no H1, H1 that doesn't match page topic

### Schema markup
Look for `<script type="application/ld+json">` blocks in the HTML. Extract `@type` values.

Common types and when they matter:
- `Article` / `BlogPosting` — good for blog/editorial content
- `Product` — required for e-commerce pages to qualify for product rich results
- `FAQPage` — can generate FAQ rich results; check if PAA answers align
- `HowTo` — good for instructional content
- `BreadcrumbList` — improves sitelink display
- `Organization` / `WebSite` — homepage brand signals
- `Review` / `AggregateRating` — star ratings in SERP

**Flag:** Pages with no schema where competitors have it (found in Stage 4 comparison).

### Internal linking
- Does this page link to related pages on the same site?
- Does the homepage or hub page link to this page?
- Orphaned pages (no inbound internal links) won't get crawl priority

### Image alt text
- Scan for `<img>` tags without `alt` attributes or with empty `alt=""`
- Flag: prominent images without descriptive alt text (accessibility + image search signal)

### Content quality signals (from markdown output)
- Approximate word count: note if substantially lower than top competitors
- Does the content actually answer the target keyword's search intent?
  (informational / navigational / transactional / commercial investigation)
- Freshness: look for a publication or last-modified date

## Red flags that are immediate report priorities

1. `noindex` meta tag on a page that should rank
2. Missing `<title>` or `<h1>`
3. Canonical pointing to a different URL than the one scraped
4. No schema where all competitors have it
5. Thin content (<300 words for pages targeting informational keywords)
6. Page clearly not matching search intent for its target keyword
