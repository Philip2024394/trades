// POST /api/brain/learn
//
// Body:
//   { brain_slug: string,
//     prediction_subject: string,     // e.g. "staircase.install_duration_days"
//     predicted_value: JSONValue,
//     actual_value:    JSONValue,
//     project_id?:     string,
//     merchant_id:     string,
//     region_code:     string,
//     deviation_reason?: string,
//     contributes_to_rollup: boolean  // consent per ADR-0016
//   }
//
// Writes one row to hammerex_nex_brain_field_outcomes per ADR-0017 §8.
// The table lands in the brain_content_v0 migration currently held in
// docs/implementation/pending-migrations/. Until that migration is
// applied to production, the write returns 503 with a clear reason.

import type { NextRequest } from "next/server";
import { brainRegistry } from "@/lib/nex/brains";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, requireBrainRuntime } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LearnBody = {
  brain_slug?:            unknown;
  prediction_subject?:    unknown;
  predicted_value?:       unknown;
  actual_value?:          unknown;
  project_id?:            unknown;
  merchant_id?:           unknown;
  region_code?:           unknown;
  deviation_reason?:      unknown;
  contributes_to_rollup?: unknown;
  prediction_context?:    unknown;
  predicted_at?:          unknown;
  actual_recorded_at?:    unknown;
};

export async function POST(req: NextRequest) {
  const off = requireBrainRuntime();
  if (off) return off;

  let body: LearnBody;
  try { body = await req.json(); } catch {
    return jsonError("invalid_json", "Request body is not valid JSON");
  }

  const brain_slug = expectString(body.brain_slug, "brain_slug");
  if (!brain_slug.ok) return jsonError("bad_request", brain_slug.err);
  const subject = expectString(body.prediction_subject, "prediction_subject");
  if (!subject.ok) return jsonError("bad_request", subject.err);
  const merchant = expectString(body.merchant_id, "merchant_id");
  if (!merchant.ok) return jsonError("bad_request", merchant.err);
  const region = expectString(body.region_code, "region_code");
  if (!region.ok) return jsonError("bad_request", region.err);
  if (body.predicted_value === undefined) return jsonError("bad_request", "predicted_value is required");
  if (body.actual_value === undefined)    return jsonError("bad_request", "actual_value is required");
  if (typeof body.contributes_to_rollup !== "boolean") {
    return jsonError("bad_request", "contributes_to_rollup must be a boolean (consent per ADR-0016)");
  }

  if (!brainRegistry.has(brain_slug.value)) {
    return jsonError("brain_not_registered", `Brain '${brain_slug.value}' is not registered`, 404);
  }

  const delta = computeDelta(body.predicted_value, body.actual_value);

  const row = {
    brain_slug:            brain_slug.value,
    merchant_slug:         merchant.value,
    project_id:            typeof body.project_id === "string" ? body.project_id : null,
    region_code:           region.value,
    prediction_subject:    subject.value,
    predicted_value:       body.predicted_value,
    prediction_context:    body.prediction_context ?? null,
    predicted_at:          typeof body.predicted_at === "string" ? body.predicted_at : new Date().toISOString(),
    actual_value:          body.actual_value,
    actual_recorded_at:    typeof body.actual_recorded_at === "string" ? body.actual_recorded_at : new Date().toISOString(),
    deviation_reason:      typeof body.deviation_reason === "string" ? body.deviation_reason : null,
    delta_pct:             delta.pct,
    delta_direction:       delta.direction,
    contributes_to_rollup: body.contributes_to_rollup
  };

  const { data, error } = await supabaseAdmin
    .from("hammerex_nex_brain_field_outcomes")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) {
    // Table missing (migration not yet applied) = 503, not 500.
    if (error.message.includes("does not exist") || error.code === "42P01") {
      return jsonError(
        "learning_loop_table_missing",
        "hammerex_nex_brain_field_outcomes has not been created yet. Apply brain_content_v0.sql migration before enabling /api/brain/learn.",
        503
      );
    }
    return jsonError("insert_failed", error.message, 500);
  }

  return jsonOk({ status: "recorded", outcome_id: data?.id ?? null });
}

// ─── Helpers ────────────────────────────────────────────────────

type StringOk = { ok: true; value: string };
type StringErr = { ok: false; err: string };

function expectString(raw: unknown, name: string): StringOk | StringErr {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, err: `${name} is required` };
  }
  return { ok: true, value: raw.trim() };
}

function computeDelta(predicted: unknown, actual: unknown): {
  pct: number | null;
  direction: "over" | "under" | "exact" | null;
} {
  if (typeof predicted !== "number" || typeof actual !== "number" || predicted === 0) {
    return { pct: null, direction: null };
  }
  const raw = ((actual - predicted) / predicted) * 100;
  const direction = raw > 0.5 ? "over" : raw < -0.5 ? "under" : "exact";
  return { pct: Math.round(raw * 100) / 100, direction };
}
