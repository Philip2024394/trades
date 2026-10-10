// /api/nex1/banner-dismissals
//
// GET   → { ok, prefixes: string[], store_path }
// POST  { prefix }         → append a `dismiss` event
// DELETE { prefix }        → append an `undismiss` event (reserved · not surfaced yet)
//
// Deterministic · zero LLM · thin wrapper around
// capability-banner-dismissals-persistence.

import { NextResponse } from "next/server";
import {
  appendDismissalEvent, loadDismissals, getDismissalStorePath,
} from "@/lib/nex-agent/code-engine/capability-banner-dismissals-persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { prefixes, skipped_malformed } = loadDismissals();
  return NextResponse.json({
    ok: true,
    source: "NEX1_NATIVE",
    zero_llm: true,
    prefixes,
    skipped_malformed,
    store_path: getDismissalStorePath(),
  });
}

interface Body { prefix?: string }

export async function POST(req: Request) {
  let body: Body = {};
  try { body = await req.json(); } catch { /* empty */ }
  const prefix = typeof body.prefix === "string" ? body.prefix.trim() : "";
  if (!prefix) {
    return NextResponse.json({ ok: false, error: "missing_prefix" }, { status: 400 });
  }
  const r = appendDismissalEvent({ kind: "dismiss", ts: new Date().toISOString(), prefix });
  return NextResponse.json({ ok: r.ok, error: r.error, prefix });
}

export async function DELETE(req: Request) {
  let body: Body = {};
  try { body = await req.json(); } catch { /* empty */ }
  const prefix = typeof body.prefix === "string" ? body.prefix.trim() : "";
  if (!prefix) {
    return NextResponse.json({ ok: false, error: "missing_prefix" }, { status: 400 });
  }
  const r = appendDismissalEvent({ kind: "undismiss", ts: new Date().toISOString(), prefix });
  return NextResponse.json({ ok: r.ok, error: r.error, prefix });
}


