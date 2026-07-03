// POST /api/studio/telemetry/error
//
// Fire-and-forget error sink for StudioErrorBoundary. Persists to
// studio_layout_events with event: "score" (repurposed as the
// generic client-error channel until a dedicated table lands).
//
// Never throws to caller — client boundary should always resolve
// regardless of persistence success. Never reads the merchant
// session either: an error boundary might fire before session
// hydration, and we still want to catch that error.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ErrorReport = {
  label?: string;
  message?: string;
  stack?: string | null;
  componentStack?: string | null;
  href?: string | null;
  at?: string;
};

export async function POST(req: Request) {
  let body: ErrorReport = {};
  try {
    body = (await req.json()) as ErrorReport;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    // Fire-and-forget insert. If the table's shape doesn't match
    // exactly, silently drop — client resilience beats server
    // strictness for telemetry.
    void supabaseAdmin.from("studio_layout_events").insert({
      section_key: null,
      layout_variant: (body.label ?? "unknown").slice(0, 80),
      event: "score",
      payload_json: {
        kind: "client-error",
        label: body.label ?? null,
        message: (body.message ?? "").slice(0, 500),
        stack: body.stack ?? null,
        componentStack: body.componentStack ?? null,
        href: body.href ?? null,
        at: body.at ?? new Date().toISOString()
      }
    });
  } catch {
    /* silent */
  }

  return NextResponse.json({ ok: true });
}
