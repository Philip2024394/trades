// src/app/api/nex/observability/alert-rules/[id]/route.ts
//
// F5 · Per-rule GET/PATCH/DELETE. Auth + validation identical to the
// list route.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCronAuth, cronAuthErrorBody } from "@/lib/nex/brain/auth/require-cron-token";
import { validateJsonBody } from "@/lib/nex/brain/http/validate-input";
import { getAlertRule, updateAlertRule, deleteAlertRule } from "@/lib/nex/observability/alert-rules";
import { logger } from "@/lib/nex/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = logger("api.observability.alert-rules.id");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PatchSchema = z.object({
  counter_name:   z.string().min(1).max(128).optional(),
  comparison:     z.enum(["gt", "gte", "lt", "lte", "eq"]).optional(),
  threshold:      z.number().finite().optional(),
  window_seconds: z.number().int().min(1).max(24 * 60 * 60).optional(),
  severity:       z.enum(["p0", "p1", "p2", "p3"]).optional(),
  enabled:        z.boolean().optional(),
  description:    z.string().max(1000).nullable().optional(),
  channels:       z.array(z.unknown()).optional(),
});

function paramId(req: NextRequest): string | null {
  // Next.js 15 async params — we read via URL for simplicity here since
  // this handler shape doesn't need the ctx object.
  const parts = new URL(req.url).pathname.split("/");
  const last = parts[parts.length - 1] ?? "";
  return UUID_RE.test(last) ? last : null;
}

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.ok) return NextResponse.json(cronAuthErrorBody(auth), { status: auth.status });
  const id = paramId(req);
  if (!id) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  try {
    const rule = await getAlertRule(id);
    if (!rule) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, rule });
  } catch (err) {
    log.error("get_failed", { rule_id: id, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "get_failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.ok) return NextResponse.json(cronAuthErrorBody(auth), { status: auth.status });
  const id = paramId(req);
  if (!id) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  const parsed = await validateJsonBody(req, PatchSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const rule = await updateAlertRule(id, parsed.data);
    if (!rule) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, rule });
  } catch (err) {
    log.error("update_failed", { rule_id: id, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.ok) return NextResponse.json(cronAuthErrorBody(auth), { status: auth.status });
  const id = paramId(req);
  if (!id) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  try {
    const removed = await deleteAlertRule(id);
    if (!removed) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, deleted: id });
  } catch (err) {
    log.error("delete_failed", { rule_id: id, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
  }
}
