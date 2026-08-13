// GET/POST /api/nex/analytics — Analytics Pipeline
//
// POST  ingest one or many records. Query param ?provider=plausible|umami|ga4|custom
//       Body: raw provider payload OR { records: [ ... ] } for batch.
//
// GET   query the store. Query params:
//         mode=overview (default) — window totals + averages
//         mode=pages | referrers | countries | timeseries
//         since_hours (default 720 · max 8760)  · limit (default 20 · max 100)
//         days (only for timeseries · default 30)
//
// Turns Analytics Pipeline from 🔴 Not Installed → 🟢 Running.
//
// Doctrine: project_nex_phase8_backend_build_starts_2026_08_07.md
//           powers HQ dashboards without going to any third-party provider

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ingestRecord,
  ingestBatch,
  overview,
  topPages,
  topReferrers,
  topCountries,
  timeseries,
  type AnalyticsProvider,
} from "@/lib/nex/analytics/fs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PROVIDERS: AnalyticsProvider[] = ["plausible", "umami", "ga4", "custom"];

function providerFromRequest(req: NextRequest): AnalyticsProvider | null {
  const p = new URL(req.url).searchParams.get("provider");
  if (p && (VALID_PROVIDERS as string[]).includes(p)) return p as AnalyticsProvider;
  return null;
}

// ── POST · ingest ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const provider = providerFromRequest(req);
  if (!provider) {
    return NextResponse.json(
      { ok: false, error: "provider_required", detail: `expected one of: ${VALID_PROVIDERS.join(", ")}` },
      { status: 400 },
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  try {
    if (body && typeof body === "object" && !Array.isArray(body) && Array.isArray((body as { records?: unknown[] }).records)) {
      const records = (body as { records: Record<string, unknown>[] }).records;
      const result = await ingestBatch(provider, records);
      return NextResponse.json({ ok: true, backend: "filesystem", mode: "batch", provider, ...result });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }
    const record = await ingestRecord(provider, body as Record<string, unknown>);
    return NextResponse.json({ ok: true, backend: "filesystem", mode: "single", provider, record });
  } catch (err) {
    console.error("[analytics.POST] failed:", err);
    return NextResponse.json(
      { ok: false, error: "ingest_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

// ── GET · aggregate + timeseries ──────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "overview") as "overview" | "pages" | "referrers" | "countries" | "timeseries";
  const hours = Math.min(Math.max(1, Number(searchParams.get("since_hours") ?? "720") || 720), 8760);
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit") ?? "20") || 20), 100);
  const since_ms = hours * 60 * 60 * 1000;

  try {
    if (mode === "pages") {
      const pages = await topPages(since_ms, limit);
      return NextResponse.json({ ok: true, mode, backend: "filesystem", pages });
    }
    if (mode === "referrers") {
      const referrers = await topReferrers(since_ms, limit);
      return NextResponse.json({ ok: true, mode, backend: "filesystem", referrers });
    }
    if (mode === "countries") {
      const countries = await topCountries(since_ms, limit);
      return NextResponse.json({ ok: true, mode, backend: "filesystem", countries });
    }
    if (mode === "timeseries") {
      const days = Math.min(Math.max(1, Number(searchParams.get("days") ?? "30") || 30), 365);
      const series = await timeseries(days);
      return NextResponse.json({ ok: true, mode, backend: "filesystem", days, series });
    }
    const ov = await overview(since_ms);
    return NextResponse.json({ ok: true, mode: "overview", backend: "filesystem", overview: ov });
  } catch (err) {
    console.error("[analytics.GET] failed:", err);
    return NextResponse.json(
      { ok: false, error: "read_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
