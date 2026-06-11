# Structured Endpoints — Parameters and Response Shapes

Reference for the three structured endpoints used by `scraperapi-price-monitoring`. Read this before constructing the first request of a run so you use the correct parameter names. Always verify against the current public docs (https://docs.scraperapi.com/) — fields can change and this file is a snapshot.

Three transports can reach these endpoints. The skill picks at the start of a run, in priority order:

1. **ScraperAPI MCP server** — typed tool calls (`amazon_product`, `walmart_product`, `google_shopping`). Use whenever the tools are present in the available-tools list. See the `scraperapi-mcp` skill for full schemas.
2. **`sapi` CLI** — `sapi structured <site> <vertical> <arg> --api-key "$SCRAPERAPI_API_KEY" --json`. The `--json` flag is essential — it suppresses the interactive credit-cost confirmation.
3. **Raw HTTP via `curl`** — last resort, requires `--data-urlencode` for each parameter.

Each section below documents all three surfaces. The parameter semantics are identical; only the wire format differs.

---

## amazon/product

**MCP:** `amazon_product` — args: `asin` (10-char ID), `countryCode` (e.g., `"us"`), `tld` (optional)
**CLI:** `sapi structured amazon product <asin-or-url> --api-key "$SCRAPERAPI_API_KEY" --json [--country us]`
**HTTP:** `https://api.scraperapi.com/structured/amazon/product`

| Parameter | Required | Notes |
|-----------|----------|-------|
| `api_key` | yes | From `$SCRAPERAPI_API_KEY`. MCP reads it from the server's configured env. |
| `asin` / MCP `asin` | one of `asin` or `url` | 10-char Amazon product ID. Faster + cheaper than passing `url`. CLI takes it as the positional argument. |
| `url` | one of `asin` or `url` (HTTP/CLI only) | Use only if you cannot recover the ASIN from the URL. MCP does not accept a URL — extract the ASIN first. |
| `country` / MCP `countryCode` | recommended | ISO code (`us`, `gb`, `de`, `ca`, `fr`, `es`, `it`, `jp`, `in`, `au`, `mx`, `br`). Determines which Amazon marketplace. Default is `us`. CLI flag: `--country`. |
| `tld` | optional | Marketplace TLD (`com`, `co.uk`, `de`, …). `country` usually suffices. |

**Key response fields for pricing:**
- `pricing` — headline displayed price as a string (e.g., `"$39.99"`). May be missing if out of stock.
- `list_price` — original/MSRP if a discount is showing.
- `availability_status` — string like `"In Stock"`, `"Currently unavailable"`, `"Only 3 left in stock"`.
- `product_information.title` — product title.
- `product_information.brand` — brand.
- `pricing_url` — direct link to the listing.

Parse the numeric price out of the `pricing` string (strip the currency symbol and thousands separators). Carry the currency forward separately — do not assume USD.

For Amazon products with multiple offers (used, refurbished, third-party), switch to the `amazon/offers` endpoint with the same `asin` — it returns an array of offers with prices and condition.

---

## walmart/product

**MCP:** `walmart_product` — args: `productId` (the digits from `/ip/<id>`), `tld` (optional)
**CLI:** `sapi structured walmart product <url> --api-key "$SCRAPERAPI_API_KEY" --json`
**HTTP:** `https://api.scraperapi.com/structured/walmart/product`

Note: the MCP tool takes a **product ID** (`5021188053`), while the CLI and HTTP take a **full URL** (`https://www.walmart.com/ip/5021188053`). Extract the ID from the URL when using MCP.

| Parameter | Required | Notes |
|-----------|----------|-------|
| `api_key` | yes | |
| `url` / MCP `productId` | yes | Full Walmart product URL for CLI/HTTP; digit-string ID for MCP. |
| `country` / MCP `countryCode` | optional | Usually `us` — Walmart is primarily a US retailer. CLI flag: `--country`. |

**Key response fields:**
- `price` — typically a number or formatted string. Inspect the actual response to confirm.
- `currency` — present in some responses; if missing, assume USD for `walmart.com`.
- `availability` — stock state.
- `seller_name` — first-party Walmart vs third-party seller. Useful when monitoring 3P prices, which fluctuate more.
- `product_name` / `title` — for the report.
- `product_url` — canonical URL.

Walmart URLs sometimes redirect or change item IDs after refresh — if you get a 404 after a target previously worked, mark it `removed` and surface to the user; do not silently swap to a search.

---

## google/shopping

**MCP:** `google_shopping` — args: `query`, `countryCode` (optional, e.g., `"us"`)
**CLI:** `sapi structured google shopping "<query>" --api-key "$SCRAPERAPI_API_KEY" --json [--country us]`
**HTTP:** `https://api.scraperapi.com/structured/google/shopping`

| Parameter | Required | Notes |
|-----------|----------|-------|
| `api_key` | yes | |
| `query` / MCP `query` | yes | Free-text product query, e.g. `"airpods pro 2"`. CLI takes it as the positional argument — always quote it. |
| `country` / MCP `countryCode` | recommended | ISO code; determines the Google domain queried (e.g., `us` → google.com, `gb` → google.co.uk). CLI flag: `--country`. |
| `tld` | optional | Override the domain directly (CLI/HTTP only). |
| `num` | optional | Number of results. Default is fine; raise only if comparing many retailers. |

**Key response fields:**
- `shopping_results[]` — array of offers.
  - `title` — product name as shown.
  - `price` — formatted string (may include currency symbol).
  - `extracted_price` — numeric price when ScraperAPI was able to parse it.
  - `source` — retailer (e.g., `"apple.com"`, `"Best Buy"`).
  - `link` — link to the offer.
  - `rating`, `reviews` — when present.

For price-monitoring use cases, decide up-front whether the user wants:
1. **The lowest price across retailers** — sort `shopping_results` by `extracted_price` and use position 0.
2. **The price at a specific retailer** — filter `shopping_results` by `source` containing the retailer name, then take the first match.

Always record `source` in the baseline so the user knows which retailer's price they are tracking — Google Shopping results reorder over time and the "lowest" can come from a different vendor each run.

---

## Country / currency consistency

Across all three endpoints: the country code drives the marketplace, and the marketplace drives the currency. Mixing countries between baseline and current run silently compares dollars to pounds. Refuse and ask which country the user wants when:

- The baseline entry has `country: "us"` and the user asks you to re-check with no country specified — default to the baseline country, not `us`.
- The user adds a new product without specifying a country — ask, do not guess.

---

## Failure modes worth knowing

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| 200 response but `pricing` / `price` field is empty | Product page rendered but price was unavailable (genuinely out of stock, or A/B layout) | Retry once with `&premium=true`. If still empty, record price as `null` with `availability: "unavailable"`. |
| Amazon `pricing` is a range (`"$39.99 - $49.99"`) | Multi-variant listing without a default selection | Note the range in the report and ask the user which variant to track via ASIN of the specific variant. |
| Walmart 200 with a redirect-page title | URL stale, product moved | Mark `removed`. |
| Google Shopping returns very different `source` for the same query across runs | Google rotates results | Always record `source` in the baseline; track per-retailer rather than per-query when stability matters. |

---

## Public docs

- All structured endpoints: https://docs.scraperapi.com/python/making-requests/structured-data-collection-method
- API reference: https://docs.scraperapi.com/
- Dashboard / credit usage: https://dashboard.scraperapi.com/
