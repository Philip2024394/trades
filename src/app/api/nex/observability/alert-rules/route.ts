// src/app/api/nex/observability/alert-rules/route.ts
//
// F5 · Alert-rule CRUD API. Migration 048 introduces nex.alert_rules;
// this endpoint exposes list/create. A per-id nested route handles
// get/update/delete (see ./[id]/route.ts).
//
// Auth: shared cron-secret boundary (same as every other observability
// route). No unauthenticated writes.
//
// Input: zod-validated via the D9 helpers.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCronAuth, cronAuthErrorBody } from "@/lib/nex/brain/auth/require-cron-token";
import { validateJsonBody } from "@/lib/nex/brain/http/validate-input";
import { listAlertRules, createAlertRule } from "@/lib/nex/observability/alert-rules";
import { logger } from "@/lib/nex/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = logger("api.observability.alert-rules");

const CreateSchema = z.object({
  counter_name:   z.string().min(1).max(128),
  comparison:     z.enum(["gt", "gte", "lt", "lte", "eq"]),
  threshold:      z.number().finite(),
  window_seconds: z.number().int().min(1).max(24 * 60 * 60),
  severity:       z.enum(["p0", "p1", "p2", "p3"]),
  enabled:        z.boolean().default(true),
  description:    z.string().max(1000).nullable().optional(),
  channels:       z.array(z.unknown()).default([]),
  created_by:     z.string().max(128).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.ok) return NextResponse.json(cronAuthErrorBody(auth), { status: auth.status });
  try {
    const rules = await listAlertRules();
    return NextResponse.json({ ok: true, rules, count: rules.length });
  } catch (err) {
    log.error("list_failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "list_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.ok) return NextResponse.json(cronAuthErrorBody(auth), { status: auth.status });
  const parsed = await validateJsonBody(req, CreateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const rule = await createAlertRule({
      ...parsed.data,
      description: parsed.data.description ?? null,
      created_by:  parsed.data.created_by  ?? null,
    });
    return NextResponse.json({ ok: true, rule }, { status: 201 });
  } catch (err) {
    log.error("create_failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  }
}
