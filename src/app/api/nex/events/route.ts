// GET/POST /api/nex/events — NEX Enterprise Event Bus (filesystem-backed)
//
// This is the working end-to-end Event Bus that unblocks the Factory Floor
// timeline, Operations History, Worker Journal, and future Brain Router
// while Supabase migration 004 is still pending.
//
// POST body: { event_type, source, ...IntelligenceEvent shape }
//   Returns: { ok: true, event_id }
//
// GET query params:
//   limit           1..500      (default 50)
//   event_type      string      filter to one type
//   source          string      filter to source origin
//   related_job     string      trace one job's events
//   related_department  string  filter to department
//   since_hours     1..168      trailing window (default 24)
//
// Doctrine: project_nex_phase8_backend_build_starts_2026_08_07.md
// Turns Enterprise Event Bus from 🟡 pending → 🟢 running.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { emitEvent, listEvents, countEvents } from "@/lib/nex/events/fs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── POST · emit an event ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    event_type?: unknown;
    source?: unknown;
    actor_id?: unknown;
    related_department?: unknown;
    related_brain?: unknown;
    related_job?: unknown;
    related_contact?: unknown;
    outcome?: unknown;
    payload?: unknown;
    reversible?: unknown;
    reverse_of?: unknown;
    supersedes?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const event_type = typeof body.event_type === "string" ? body.event_type.trim() : "";
  const sourceRaw = typeof body.source === "string" ? body.source : "";
  const validSources = ["human", "worker", "brain", "executive_layer", "cron", "system"] as const;
  const source = validSources.includes(sourceRaw as (typeof validSources)[number])
    ? (sourceRaw as (typeof validSources)[number])
    : null;

  if (!event_type) {
    return NextResponse.json({ ok: false, error: "event_type required" }, { status: 400 });
  }
  if (!source) {
    return NextResponse.json({ ok: false, error: `source must be one of ${validSources.join(", ")}` }, { status: 400 });
  }

  const validOutcomes = ["success", "failure", "pending", "informational"] as const;
  const outcomeRaw = typeof body.outcome === "string" ? body.outcome : "informational";
  const outcome = validOutcomes.includes(outcomeRaw as (typeof validOutcomes)[number])
    ? (outcomeRaw as (typeof validOutcomes)[number])
    : "informational";

  try {
    const event_id = await emitEvent({
      event_type,
      source,
      actor_id: typeof body.actor_id === "string" ? body.actor_id : null,
      related_department: typeof body.related_department === "string" ? body.related_department : null,
      related_brain: typeof body.related_brain === "string" ? body.related_brain : null,
      related_job: typeof body.related_job === "string" ? body.related_job : null,
      related_contact: typeof body.related_contact === "string" ? body.related_contact : null,
      outcome,
      payload: (body.payload && typeof body.payload === "object" && !Array.isArray(body.payload))
        ? (body.payload as Record<string, unknown>)
        : {},
      reversible: body.reversible === true,
      reverse_of: typeof body.reverse_of === "string" ? body.reverse_of : null,
      supersedes: typeof body.supersedes === "string" ? body.supersedes : null,
    });
    return NextResponse.json({ ok: true, event_id });
  } catch (err) {
    console.error("[nex-events.POST] emit failed:", err);
    return NextResponse.json(
      { ok: false, error: "emit_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

// ── GET · list events with filters ────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit") ?? "50") || 50), 500);
  const hours = Math.min(Math.max(1, Number(searchParams.get("since_hours") ?? "24") || 24), 168);
  const event_type = searchParams.get("event_type") || undefined;
  const source = searchParams.get("source") as
    | "human" | "worker" | "brain" | "executive_layer" | "cron" | "system" | null;
  const related_job = searchParams.get("related_job") || undefined;
  const related_department = searchParams.get("related_department") || undefined;

  try {
    const events = await listEvents({
      limit,
      event_type,
      source: source ?? undefined,
      related_job,
      related_department,
      since_ms: hours * 60 * 60 * 1000,
    });
    const total = await countEvents();
    return NextResponse.json({
      ok: true,
      events,
      count: events.length,
      total_lifetime: total,
      backend: "filesystem",   // future: "supabase" when mig 004 lands
      since_hours: hours,
    });
  } catch (err) {
    console.error("[nex-events.GET] list failed:", err);
    return NextResponse.json(
      { ok: false, error: "list_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
