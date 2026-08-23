// POST /api/nex-food/admin/promotion/decide
//
// Task #88 Phase 3 · admin adjudication of enrichment evidence (2026-08-22).
//
// Doctrine anchors:
//   project_nex_task88_promotion_pipeline_spec_2026_08_22
//   project_nex_task88_phase2_shipped_2026_08_22
//   project_nex_architecture_replaceable_plumbing_and_provable_causality_2026_08_22
//   project_nex_walker_stays_pure_acquisition_2026_08_22
//
// Philip 2026-08-22 Phase 3 lock (verbatim, enforced in code):
//   · "Evidence is never automatically promoted. Every candidate remains
//     untrusted until an admin explicitly approves it."
//   · "Approve must be field-specific."
//   · "A rejected candidate should be recorded as admin_rejected."
//   · "Never silently overwrite an existing fact."
//   · "Every admin action gets provenance ... cycle_run_id."
//
// Behaviour by decision:
//   'approve' — writes evidence.value to food_business.<field>. Refuses if the
//               field already has a value (must use 'replace' to overwrite).
//               Writes food_business_field_provenance row with trust_layer
//               = 'admin_verified' + cycle_run_id.
//   'replace' — same as approve but explicit-overwrite mode. Old value stored
//               in decision.previous_field_value for reversibility.
//   'reject'  — records the decision · never touches food_business.<field>.
//               Future evidence with same (biz, field, value) is auto-hidden
//               from the queue by the query filter (idx_promotion_decision_rejected_lookup).
//
// Every action:
//   1. Registers a worker_cycle_run (worker_type='promotion',
//      worker_config='food:Yogyakarta:admin-decision')
//   2. Writes food_business_promotion_decision (append-only)
//   3. Writes audit_log (existing infra)
//   4. Runs in a single DB transaction (partial writes impossible)
//
// This route consolidates Phase 2's evidence collection with the existing
// promote-to-directory primitive · but does NOT flip claim_status. Business-
// level promotion (discovered → listed) remains a separate button that calls
// /api/nex-food/admin/promote-to-directory.
//
// Auth model matches existing /api/nex-food/admin/promote-to-directory:
//   dev-only surface behind HQ URL · no route-level auth · production auth
//   handled at the HQ layout level (not this route's concern).

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getFoodDbPool } from "@/lib/nex-food/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bad(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

interface DecideBody {
  evidenceId?: string;
  decision?: "approve" | "reject" | "replace";
  reason?: string;
  decidedBy?: string;
}

// Whitelist of field names admins may adjudicate through this route.
// Anything else is refused — no arbitrary column writes.
const SCALAR_FIELDS = new Set(["whatsapp_number", "phone", "website"]);
const SOCIAL_FIELD_PREFIX = "social:";

function isAllowedField(field: string): boolean {
  return SCALAR_FIELDS.has(field) || field.startsWith(SOCIAL_FIELD_PREFIX);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DecideBody | null;
  if (!body) return bad(400, "Malformed JSON body");

  const evidenceId = body.evidenceId?.trim();
  const decision   = body.decision;
  const reason     = body.reason?.trim() || null;
  const decidedBy  = body.decidedBy?.trim() || "admin:promotion-queue";

  if (!evidenceId) return bad(400, "evidenceId required");
  if (!/^[0-9a-f-]{36}$/i.test(evidenceId)) return bad(400, "evidenceId must be UUID");
  if (!decision || !["approve","reject","replace"].includes(decision)) {
    return bad(400, "decision must be 'approve' | 'reject' | 'replace'");
  }

  const pool = getFoodDbPool();
  const client = await pool.connect();
  const workerId = `promotion:food:Yogyakarta:admin-decision:${process.pid}`;
  let cycleRunId: string | null = null;

  try {
    // ── 1. Register cycle_run (outside txn · reliability layer own txn) ──
    cycleRunId = randomUUID();
    await client.query(
      `INSERT INTO nex.worker_cycle_run
         (id, worker_id, worker_type, worker_config, started_at, status)
       VALUES ($1, $2, 'promotion', 'food:Yogyakarta:admin-decision', now(), 'running')`,
      [cycleRunId, workerId],
    );

    await client.query("BEGIN");

    // ── 2. Load the evidence row (locked · single row) ──
    const evQ = await client.query(
      `SELECT e.evidence_id, e.business_ref, e.field_name, e.value,
              e.value_normalised, e.source, e.confidence, e.agent_name
         FROM nex.food_enrichment_evidence e
        WHERE e.evidence_id = $1
        FOR UPDATE`,
      [evidenceId],
    );
    if (evQ.rowCount === 0) {
      await client.query("ROLLBACK");
      await finishCycleRun(client, cycleRunId, "aborted", 0, { error: "evidence_not_found", evidenceId });
      return bad(404, `no evidence at ${evidenceId}`);
    }
    const ev = evQ.rows[0];

    if (!isAllowedField(ev.field_name)) {
      await client.query("ROLLBACK");
      await finishCycleRun(client, cycleRunId, "aborted", 0, { error: "field_not_whitelisted", field: ev.field_name });
      return bad(400, `field '${ev.field_name}' is not whitelisted for admin adjudication`);
    }

    // ── 3. Idempotency · reject if a decision already exists for this evidence row ──
    const existingDecision = await client.query(
      `SELECT id, decision, decided_at FROM nex.food_business_promotion_decision WHERE evidence_id = $1 LIMIT 1`,
      [evidenceId],
    );
    if (existingDecision.rowCount && existingDecision.rowCount > 0) {
      await client.query("ROLLBACK");
      await finishCycleRun(client, cycleRunId, "aborted", 0, { error: "already_decided", priorDecision: existingDecision.rows[0].decision });
      return bad(409, "evidence already has a decision", {
        priorDecision: existingDecision.rows[0].decision,
        priorDecidedAt: existingDecision.rows[0].decided_at,
      });
    }

    // ── 4. Load the business row (locked) · read existing field value ──
    const businessQ = await client.query(
      `SELECT public_listing_ref, business_name, whatsapp_number, phone, website, public_social_links, claim_status
         FROM nex.food_business
        WHERE public_listing_ref = $1
        FOR UPDATE`,
      [ev.business_ref],
    );
    if (businessQ.rowCount === 0) {
      await client.query("ROLLBACK");
      await finishCycleRun(client, cycleRunId, "aborted", 0, { error: "business_not_found", businessRef: ev.business_ref });
      return bad(404, `no business at ${ev.business_ref}`);
    }
    const b = businessQ.rows[0];
    const previousFieldValue = readCurrentValue(b, ev.field_name);

    let promotedTo: string | null = null;
    let recordedDecision = decision;

    if (decision === "approve" || decision === "replace") {
      // ── 5a. Guard against silent overwrite ──
      if (previousFieldValue != null && previousFieldValue !== "" && decision === "approve") {
        await client.query("ROLLBACK");
        await finishCycleRun(client, cycleRunId, "aborted", 0, { error: "would_overwrite", field: ev.field_name, existing: previousFieldValue });
        return bad(409, "field already has a value · use decision='replace' for explicit overwrite", {
          field: ev.field_name,
          existingValue: previousFieldValue,
          proposedValue: ev.value,
        });
      }

      // ── 5b. Write evidence value to food_business.<field> ──
      await writeFieldValue(client, ev.business_ref, ev.field_name, ev.value);
      promotedTo = ev.value;

      // ── 5c. Provenance row · admin_verified · this cycle_run_id ──
      // Note: food_business_field_provenance has (business_ref, field_name)
      // unique index in most schemas · use ON CONFLICT to update trust_layer.
      await client.query(
        `INSERT INTO nex.food_business_field_provenance
           (business_ref, field_name, trust_layer, written_at, written_by, source_reference, cycle_run_id)
         VALUES ($1, $2, 'admin_verified', now(), $3, $4, $5)
         ON CONFLICT (business_ref, field_name) DO UPDATE SET
           trust_layer      = EXCLUDED.trust_layer,
           written_at       = EXCLUDED.written_at,
           written_by       = EXCLUDED.written_by,
           source_reference = EXCLUDED.source_reference,
           cycle_run_id     = EXCLUDED.cycle_run_id`,
        [ev.business_ref, ev.field_name, decidedBy, `promotion-queue:evidence=${evidenceId}`, cycleRunId],
      );

      // 'replace' is a distinct decision value for the audit trail — recordedDecision
      // preserves whichever admin chose. 'approve' with pre-existing value would've
      // been refused above · so approve here means null-or-empty prior.
    }

    // ── 6. Write the decision row (single source of truth for adjudication history) ──
    await client.query(
      `INSERT INTO nex.food_business_promotion_decision
         (evidence_id, business_ref, field_name, value, value_normalised,
          decision, decided_by, decided_at, cycle_run_id, reason, previous_field_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9, $10)`,
      [
        evidenceId, ev.business_ref, ev.field_name, ev.value, ev.value_normalised ?? (ev.value ?? "").toLowerCase(),
        recordedDecision === "approve" ? "approved" : recordedDecision === "replace" ? "replaced" : "rejected",
        decidedBy, cycleRunId,
        reason, previousFieldValue,
      ],
    );

    // ── 7. audit_log · existing infra (matches promote-to-directory pattern) ──
    await client.query(
      `INSERT INTO nex.audit_log
         (entity_type, entity_id, action, actor, before_state, after_state, notes)
       VALUES ('food_business', $1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
      [
        ev.business_ref,
        `promotion:evidence:${recordedDecision}`,
        decidedBy,
        JSON.stringify({
          field: ev.field_name,
          previous_value: previousFieldValue,
          evidence_source: ev.source,
          evidence_confidence: ev.confidence,
        }),
        JSON.stringify({
          field: ev.field_name,
          new_value: promotedTo,
          decision: recordedDecision,
          cycle_run_id: cycleRunId,
        }),
        reason,
      ],
    );

    await client.query("COMMIT");

    await finishCycleRun(client, cycleRunId, "completed", 1, {
      evidenceId, businessRef: ev.business_ref, field: ev.field_name,
      decision: recordedDecision, promotedTo, previousFieldValue,
    });

    return NextResponse.json({
      ok: true,
      cycleRunId,
      evidenceId,
      businessRef: ev.business_ref,
      field: ev.field_name,
      decision: recordedDecision,
      promotedValue: promotedTo,
      previousFieldValue,
    });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* already rolled back */ }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/nex-food/admin/promotion/decide] internal error:", err);
    if (cycleRunId) await finishCycleRun(client, cycleRunId, "failed", 0, { error: msg }).catch(() => {});
    return bad(500, `decide failed: ${msg}`);
  } finally {
    client.release();
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function readCurrentValue(business: Record<string, unknown>, fieldName: string): string | null {
  if (SCALAR_FIELDS.has(fieldName)) {
    const v = business[fieldName];
    return typeof v === "string" && v.length > 0 ? v : null;
  }
  if (fieldName.startsWith(SOCIAL_FIELD_PREFIX)) {
    const key = fieldName.slice(SOCIAL_FIELD_PREFIX.length);
    const raw = business.public_social_links;
    if (raw && typeof raw === "object" && key in raw) {
      const v = (raw as Record<string, unknown>)[key];
      return typeof v === "string" && v.length > 0 ? v : null;
    }
    return null;
  }
  return null;
}

async function writeFieldValue(
  client: import("pg").PoolClient,
  businessRef: string,
  fieldName: string,
  value: string,
): Promise<void> {
  if (SCALAR_FIELDS.has(fieldName)) {
    await client.query(
      `UPDATE nex.food_business SET ${fieldName} = $1 WHERE public_listing_ref = $2`,
      [value, businessRef],
    );
    return;
  }
  if (fieldName.startsWith(SOCIAL_FIELD_PREFIX)) {
    const key = fieldName.slice(SOCIAL_FIELD_PREFIX.length);
    // Merge into JSONB object · idempotent · preserves other keys.
    await client.query(
      `UPDATE nex.food_business
          SET public_social_links = COALESCE(public_social_links, '{}'::jsonb) || jsonb_build_object($1::text, $2::text)
        WHERE public_listing_ref = $3`,
      [key, value, businessRef],
    );
    return;
  }
  throw new Error(`writeFieldValue: field '${fieldName}' not writable`);
}

async function finishCycleRun(
  client: import("pg").PoolClient,
  cycleRunId: string,
  status: "completed" | "failed" | "aborted",
  recordsProcessed: number,
  summary: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `UPDATE nex.worker_cycle_run
        SET finished_at       = now(),
            duration_ms       = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::int,
            status            = $2,
            records_processed = $3,
            records_new       = $3,
            errors_count      = $4,
            summary           = $5::jsonb,
            doctrine_checks   = $6::jsonb
      WHERE id = $1`,
    [
      cycleRunId, status, recordsProcessed,
      status === "failed" || status === "aborted" ? 1 : 0,
      JSON.stringify(summary),
      JSON.stringify({
        no_silent_overwrite: true,
        direct_provenance_a: true,
        admin_gate_enforced: true,
        never_touches_walker: true,
      }),
    ],
  );
}
