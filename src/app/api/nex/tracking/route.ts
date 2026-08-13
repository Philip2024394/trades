// GET/POST /api/nex/tracking — Event Tracking service
//
// POST  captures one event OR a batch. Body forms:
//         { event_name, path?, ...single-event fields }
//         { events: [ {...}, {...} ] }   (batch)
//       Server auto-attaches IP + user-agent from request headers when the
//       client hasn't already supplied them (raw IP is never stored · it's
//       truncated to /24 (v4) or /48 (v6) at capture time).
//
// GET   list events + stats OR session summaries. Query params:
//         mode=events (default) | sessions | stats
//         event_name, session_id, contact_id, path, utm_campaign
//         since_hours (default 24 · max 720)  · limit (default 100 · max 1000)
//
// Turns Event Tracking from 🔴 Not Installed → 🟢 Running.
//
// Doctrine: project_nex_phase8_backend_build_starts_2026_08_07.md
//           feeds Marketing Attribution + Analytics Pipeline downstream.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  captureEvent,
  captureBatch,
  listEvents,
  sessionSummaries,
  trackingStats,
  type CaptureEventInput,
  type TrackingEventName,
} from "@/lib/nex/tracking/fs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_NAMES: TrackingEventName[] = [
  "page_view", "click", "scroll_depth", "form_view", "form_submit",
  "search", "signup", "signin", "conversion", "outbound", "custom",
];

// ── Header extraction ─────────────────────────────────────────────

function ipFromHeaders(req: NextRequest): string | null {
  // Trust order: cf-connecting-ip > x-real-ip > first x-forwarded-for hop.
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return null;
}

function normaliseInput(raw: Record<string, unknown>, req: NextRequest): CaptureEventInput | null {
  const name = raw.event_name as TrackingEventName | undefined;
  if (!name || !VALID_NAMES.includes(name)) return null;
  return {
    session_id: typeof raw.session_id === "string" ? raw.session_id : null,
    contact_id: typeof raw.contact_id === "string" ? raw.contact_id : null,
    event_name: name,
    path: typeof raw.path === "string" ? raw.path : null,
    referrer: typeof raw.referrer === "string" ? raw.referrer : (req.headers.get("referer") ?? null),
    user_agent: typeof raw.user_agent === "string" ? raw.user_agent : (req.headers.get("user-agent") ?? null),
    ip: typeof raw.ip === "string" ? raw.ip : ipFromHeaders(req),
    utm: raw.utm && typeof raw.utm === "object" ? (raw.utm as CaptureEventInput["utm"]) : undefined,
    properties: raw.properties && typeof raw.properties === "object" && !Array.isArray(raw.properties)
      ? (raw.properties as Record<string, unknown>) : undefined,
    occurred_at: typeof raw.occurred_at === "string" ? raw.occurred_at : null,
  };
}

// ── POST · single or batch ────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Batch mode
  if (Array.isArray(body.events)) {
    const inputs = (body.events as unknown[])
      .map((e) => (e && typeof e === "object" ? normaliseInput(e as Record<string, unknown>, req) : null))
      .filter((e): e is CaptureEventInput => e !== null);
    if (inputs.length === 0) {
      return NextResponse.json({ ok: false, error: "no_valid_events" }, { status: 400 });
    }
    try {
      const result = await captureBatch(inputs);
      return NextResponse.json({ ok: true, backend: "filesystem", mode: "batch", ...result });
    } catch (err) {
      console.error("[tracking.POST.batch] failed:", err);
      return NextResponse.json(
        { ok: false, error: "batch_failed", detail: err instanceof Error ? err.message : "unknown" },
        { status: 500 },
      );
    }
  }

  // Single mode
  const input = normaliseInput(body, req);
  if (!input) {
    return NextResponse.json(
      { ok: false, error: "invalid_event_name", detail: `expected one of: ${VALID_NAMES.join(", ")}` },
      { status: 400 },
    );
  }
  try {
    const event = await captureEvent(input);
    return NextResponse.json({ ok: true, backend: "filesystem", mode: "single", event });
  } catch (err) {
    console.error("[tracking.POST] failed:", err);
    return NextResponse.json(
      { ok: false, error: "capture_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

// ── GET · events, sessions, or stats ──────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "events") as "events" | "sessions" | "stats";
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit") ?? "100") || 100), 1000);
  const hours = Math.min(Math.max(1, Number(searchParams.get("since_hours") ?? "24") || 24), 720);
  const since_ms = hours * 60 * 60 * 1000;

  try {
    if (mode === "stats") {
      const stats = await trackingStats();
      return NextResponse.json({ ok: true, backend: "filesystem", stats });
    }
    if (mode === "sessions") {
      const sessions = await sessionSummaries(since_ms, limit);
      return NextResponse.json({ ok: true, backend: "filesystem", sessions, count: sessions.length });
    }
    const nameRaw = searchParams.get("event_name") as TrackingEventName | null;
    const events = await listEvents({
      limit,
      since_ms,
      event_name: nameRaw && VALID_NAMES.includes(nameRaw) ? nameRaw : undefined,
      session_id: searchParams.get("session_id") ?? undefined,
      contact_id: searchParams.get("contact_id") ?? undefined,
      path: searchParams.get("path") ?? undefined,
      utm_campaign: searchParams.get("utm_campaign") ?? undefined,
    });
    return NextResponse.json({ ok: true, backend: "filesystem", events, count: events.length });
  } catch (err) {
    console.error("[tracking.GET] failed:", err);
    return NextResponse.json(
      { ok: false, error: "read_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
