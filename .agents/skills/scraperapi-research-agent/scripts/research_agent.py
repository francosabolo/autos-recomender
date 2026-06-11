#!/usr/bin/env python3
"""
ScraperAPI Research Agent

Autonomous web research: ScraperAPI discovers and scrapes sources,
Anthropic Files API ingests them as cited document artifacts,
Claude synthesizes a structured report with inline citations.

Usage:
    export SCRAPERAPI_API_KEY=your-key
    export ANTHROPIC_API_KEY=your-key
    python research_agent.py --question "..." --max-sources 5 --output report.md
"""

import argparse
import os
import sys
import time
import json
import re
from typing import Optional

import requests
import anthropic

SCRAPERAPI_API_KEY = os.environ.get("SCRAPERAPI_API_KEY")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY")


# ---------------------------------------------------------------------------
# Phase 1: Planning — decompose the question into search queries
# ---------------------------------------------------------------------------

PLAN_SYSTEM = """You are a research planning assistant. Given a research question,
output a JSON array of 2-3 targeted web search queries that together will surface
the best sources for answering it. Each query should approach the topic from a
slightly different angle. Output only valid JSON, no markdown fences."""

def plan_queries(question: str, client: anthropic.Anthropic) -> list[str]:
    """Ask Claude to decompose the question into targeted search queries."""
    print(f"  Planning queries for: {question!r}")
    response = client.messages.create(
        model="claude-haiku-4-5",  # Fast and cheap for planning
        max_tokens=256,
        system=PLAN_SYSTEM,
        messages=[{"role": "user", "content": f"Research question: {question}"}],
    )
    text = next(b.text for b in response.content if b.type == "text")
    try:
        queries = json.loads(text)
        assert isinstance(queries, list)
        return [str(q) for q in queries[:3]]
    except (json.JSONDecodeError, AssertionError):
        # Fall back to using the question directly
        return [question]


# ---------------------------------------------------------------------------
# Phase 2: Discover — Google search via ScraperAPI structured endpoint
# ---------------------------------------------------------------------------

def search_web(query: str, num_results: int = 10, country: str = "us") -> list[dict]:
    """Search Google via ScraperAPI structured endpoint."""
    print(f"  Searching: {query!r}")
    try:
        resp = requests.get(
            "https://api.scraperapi.com/structured/google/search",
            params={
                "api_key": SCRAPERAPI_API_KEY,
                "query": query,
                "num": num_results,
                "country_code": country,
            },
            timeout=60,
        )
        if resp.status_code != 200:
            print(f"    Search failed ({resp.status_code})", file=sys.stderr)
            return []
        data = resp.json()
        results = []
        for item in data.get("organic_results", []):
            url = item.get("link") or item.get("url", "")
            if url:
                results.append({
                    "url": url,
                    "title": item.get("title", url),
                    "snippet": item.get("snippet", ""),
                })
        return results
    except Exception as e:
        print(f"    Search error: {e}", file=sys.stderr)
        return []


# ---------------------------------------------------------------------------
# Phase 3: Fetch — scrape pages as markdown via ScraperAPI
# ---------------------------------------------------------------------------

SKIP_EXTENSIONS = (".pdf", ".docx", ".xlsx", ".zip", ".png", ".jpg", ".mp4")
SKIP_DOMAINS = ("youtube.com", "twitter.com", "x.com", "instagram.com", "facebook.com")

def _should_skip(url: str) -> bool:
    url_lower = url.lower()
    return (
        any(url_lower.endswith(ext) for ext in SKIP_EXTENSIONS)
        or any(domain in url_lower for domain in SKIP_DOMAINS)
    )

def scrape_page(url: str, country: str = "us") -> Optional[str]:
    """Fetch a page as markdown via ScraperAPI. Returns None on failure."""
    if _should_skip(url):
        return None
    try:
        resp = requests.get(
            "https://api.scraperapi.com/",
            params={
                "api_key": SCRAPERAPI_API_KEY,
                "url": url,
                "output_format": "markdown",
                "country_code": country,
            },
            timeout=70,
        )
        if resp.status_code != 200:
            return None
        content = resp.text.strip()
        # Discard pages that returned very little (blocked, error pages, etc.)
        if len(content) < 200:
            return None
        # Trim very large pages to stay within token budget
        return content[:20_000]
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Phase 4: Deduplicate sources
# ---------------------------------------------------------------------------

def deduplicate(results: list[dict], max_sources: int) -> list[dict]:
    """Remove duplicate URLs and cap at max_sources."""
    seen = set()
    unique = []
    for r in results:
        url = r["url"]
        if url not in seen:
            seen.add(url)
            unique.append(r)
        if len(unique) >= max_sources:
            break
    return unique


# ---------------------------------------------------------------------------
# Phase 5: Upload to Anthropic Files API (the "Artifacts" layer)
# ---------------------------------------------------------------------------

def upload_artifact(
    client: anthropic.Anthropic,
    content: str,
    filename: str,
) -> Optional[str]:
    """Upload scraped content as a text artifact. Returns file_id or None."""
    try:
        uploaded = client.beta.files.upload(
            file=(filename, content.encode("utf-8", errors="replace"), "text/plain"),
        )
        return uploaded.id
    except Exception as e:
        print(f"    Upload failed for {filename}: {e}", file=sys.stderr)
        return None


def cleanup_artifacts(client: anthropic.Anthropic, file_ids: list[str]) -> None:
    """Delete uploaded file artifacts from Anthropic after synthesis."""
    for fid in file_ids:
        try:
            client.beta.files.delete(fid)
        except Exception:
            pass  # Best-effort cleanup


# ---------------------------------------------------------------------------
# Phase 6: Synthesize — Claude reads artifacts and writes cited report
# ---------------------------------------------------------------------------

SYNTHESIS_SYSTEM = """You are a research analyst. You will be given a set of web pages
and a research question. Write a structured research report that:
1. Opens with a 2-3 sentence executive summary
2. Organises findings into logical sections with clear headings
3. Cites sources inline using [N] notation (where N matches the document number)
4. Ends with a ## Sources section listing all cited sources

Be specific, factual, and concise. Do not pad the report. If sources conflict,
note the disagreement. Always cite the source(s) for each factual claim."""

def synthesize_report(
    question: str,
    sources: list[dict],
    client: anthropic.Anthropic,
    model: str = "claude-opus-4-8",
) -> str:
    """Feed source artifacts to Claude and get a cited research report."""
    print(f"  Synthesising report from {len(sources)} source(s)...")

    # Build document blocks from uploaded file artifacts
    document_blocks = []
    for i, source in enumerate(sources, 1):
        if not source.get("file_id"):
            continue
        document_blocks.append({
            "type": "document",
            "source": {"type": "file", "file_id": source["file_id"]},
            "title": source["title"],
            "citations": {"enabled": True},
        })

    if not document_blocks:
        return "No sources could be loaded for synthesis."

    # Apply prompt caching on the documents block (large, stable context)
    # Cache the last document block so all sources are cached together
    document_blocks[-1]["cache_control"] = {"type": "ephemeral"}

    messages = [
        {
            "role": "user",
            "content": document_blocks + [
                {
                    "type": "text",
                    "text": (
                        f"Research question: {question}\n\n"
                        "Write a comprehensive research report using the documents above. "
                        "Use [N] inline citations. Include a numbered source list at the end."
                    ),
                }
            ],
        }
    ]

    # Build the source bibliography for the report footer
    bibliography = "\n".join(
        f"{i}. [{s['title']}]({s['url']})"
        for i, s in enumerate(sources, 1)
        if s.get("url")
    )

    full_response = []
    with client.messages.stream(
        model=model,
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=SYNTHESIS_SYSTEM,
        messages=messages,
        betas=["files-api-2025-04-14"],
    ) as stream:
        for text in stream.text_stream:
            full_response.append(text)
            print(text, end="", flush=True)

    print()  # newline after streaming output

    report = "".join(full_response)

    # Append sources section if Claude didn't include one
    if "## Sources" not in report and bibliography:
        report += f"\n\n## Sources\n\n{bibliography}"

    return report


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Autonomous research agent: ScraperAPI + Anthropic Claude"
    )
    parser.add_argument("--question", required=True, help="Research question")
    parser.add_argument("--max-sources", type=int, default=5, metavar="N",
                        help="Max pages to scrape (default: 5)")
    parser.add_argument("--output", metavar="FILE",
                        help="Write report to file (default: stdout)")
    parser.add_argument("--country", default="us",
                        help="ScraperAPI country code (default: us)")
    parser.add_argument("--model", default="claude-opus-4-8",
                        help="Anthropic model for synthesis (default: claude-opus-4-8)")
    args = parser.parse_args()

    # Validate env vars
    missing = [k for k in ("SCRAPERAPI_API_KEY", "ANTHROPIC_API_KEY") if not os.environ.get(k)]
    if missing:
        print(f"Error: missing environment variables: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    print(f"\n{'='*60}")
    print(f"Research question: {args.question}")
    print(f"Max sources: {args.max_sources}")
    print(f"{'='*60}\n")

    # Phase 1: Plan
    print("[1/6] Planning search queries...")
    queries = plan_queries(args.question, anthropic_client)
    print(f"  Queries: {queries}\n")

    # Phase 2 & 3: Discover + Fetch
    print("[2/6] Searching and scraping sources...")
    all_results: list[dict] = []
    for query in queries:
        results = search_web(query, num_results=10, country=args.country)
        all_results.extend(results)

    # Phase 4: Deduplicate
    print(f"\n[3/6] Deduplicating {len(all_results)} candidates → top {args.max_sources}...")
    candidates = deduplicate(all_results, max_sources=args.max_sources * 2)

    sources: list[dict] = []
    file_ids: list[str] = []

    for candidate in candidates:
        if len(sources) >= args.max_sources:
            break
        url = candidate["url"]
        print(f"  Scraping: {url}")
        content = scrape_page(url, country=args.country)
        if content:
            sources.append({
                "url": url,
                "title": candidate["title"],
                "content": content,
                "file_id": None,
            })

    print(f"\n[4/6] Scraped {len(sources)} usable source(s).")
    if not sources:
        print("No sources could be scraped. Try a different question or check your API key.")
        sys.exit(1)

    # Phase 5: Upload artifacts
    print("\n[5/6] Uploading sources as file artifacts to Anthropic...")
    for i, source in enumerate(sources, 1):
        filename = f"source_{i}_{re.sub(r'[^a-z0-9]', '_', source['title'][:30].lower())}.txt"
        # Prepend URL as context so Claude can cite it correctly
        artifact_content = f"Source URL: {source['url']}\nTitle: {source['title']}\n\n{source['content']}"
        fid = upload_artifact(anthropic_client, artifact_content, filename)
        if fid:
            source["file_id"] = fid
            file_ids.append(fid)
            print(f"  [{i}] Uploaded: {source['title'][:50]}")

    # Phase 6: Synthesize
    print(f"\n[6/6] Synthesising report ({args.model})...\n")
    report = synthesize_report(args.question, sources, anthropic_client, model=args.model)

    # Clean up artifacts
    print("\nCleaning up file artifacts...")
    cleanup_artifacts(anthropic_client, file_ids)

    # Output
    header = f"# Research Report\n\n**Question:** {args.question}\n\n---\n\n"
    final_report = header + report

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(final_report)
        print(f"\nReport saved to: {args.output}")
    else:
        print("\n" + "="*60)
        print(final_report)


if __name__ == "__main__":
    main()
