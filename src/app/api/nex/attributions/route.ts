// src/app/api/nex/attributions/route.ts
//
// Founder AIW-3 · NEX AI-WiFi attribution surface.
// GET /api/nex/attributions returns the JSON list of data-source
// attributions. Chat UI + observatory render this as a "Sources" footer
// whenever Research Brain cites external data.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ATTRIBUTIONS = Object.freeze([
  {
    id: "wikipedia",
    name: "Wikipedia",
    license: "CC BY-SA 4.0",
    attribution_required: true,
    attribution: "Content adapted from Wikipedia · CC BY-SA 4.0",
    url: "https://en.wikipedia.org",
    used_for: "free-text articles",
  },
  {
    id: "wikidata",
    name: "Wikidata",
    license: "CC0 1.0",
    attribution_required: false,
    attribution: "Data from Wikidata · CC0",
    url: "https://www.wikidata.org",
    used_for: "structured entity data",
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo Instant Answer",
    license: "DuckDuckGo Terms of Service",
    attribution_required: false,
    attribution: "Results via DuckDuckGo Instant Answer",
    url: "https://duckduckgo.com",
    used_for: "search snippets",
  },
  {
    id: "openstreetmap",
    name: "OpenStreetMap · Nominatim",
    license: "ODbL 1.0",
    attribution_required: true,
    attribution: "© OpenStreetMap contributors · ODbL 1.0",
    url: "https://www.openstreetmap.org/copyright",
    used_for: "geocoding + geographic entities",
  },
  {
    id: "openmeteo",
    name: "Open-Meteo",
    license: "CC BY 4.0",
    attribution_required: true,
    attribution: "Weather data by Open-Meteo · CC BY 4.0",
    url: "https://open-meteo.com",
    used_for: "current weather + forecasts",
  },
  {
    id: "geonames",
    name: "GeoNames",
    license: "CC BY 4.0",
    attribution_required: true,
    attribution: "Geographic data by GeoNames · CC BY 4.0",
    url: "https://www.geonames.org",
    used_for: "geographic backfill (not yet wired in production)",
  },
  {
    id: "common-crawl",
    name: "Common Crawl",
    license: "Common Crawl Terms of Use",
    attribution_required: false,
    attribution: "Corpus sampling via Common Crawl",
    url: "https://commoncrawl.org",
    used_for: "historical web corpus (not yet wired)",
  },
]);

export async function GET() {
  return NextResponse.json({
    attributions: ATTRIBUTIONS,
    note: "NEX operates in AI-WiFi mode: all AI inference runs locally (Ollama · tesseract.js · Postgres). "
      + "The internet is used only as a raw-data supply chain. Every fetched claim is validated by "
      + "Fabrication Gate v2 alignment scoring and capped at evidence_provisional trust.",
    doctrine_reference: "docs/DECISIONS/0120-nex-live-chat-completion-brain-architecture-and-four-doctrines.md",
  });
}
