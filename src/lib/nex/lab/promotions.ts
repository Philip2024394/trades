// src/lib/nex/lab/promotions.ts
//
// Founder ADR-0304 · Promotion service · the ONE path from Lab → Main NEX.
//
// GOLDEN RULE:
//   Nothing in nex_lab_*.verified reaches nex.* without a founder-signed
//   promotion event. This module enforces that at the code layer:
//   1. `proposePromotion()` writes a `pending` row · doesn't touch nex.*
//   2. `approvePromotion()` requires a valid HMAC signature · fires the copy
//   3. Every promotion is logged forever in `nex_lab.promotion_events`
//   4. Rollback SQL saved before copy · founder can undo
//
// Signature scheme:
//   payload  = `${brief_id}|${room_slug}|${approved_at_iso}|${user_id}`
//   secret   = process.env.NEX_LAB_PROMOTION_SECRET (required · min 32 chars)
//   signature = HMAC-SHA256(secret, payload).hex()
//
// If NEX_LAB_PROMOTION_SECRET is unset, every promotion is REJECTED
// with reason "secret_not_configured". Fail-closed by design.

import { createHmac } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { executeFoodPromotion } from "./executors/food-executor";
import { executeActivitiesPromotion } from "./executors/activities-executor";
import { executeBusinessLeadPromotion } from "./executors/business-lead-executor";
import { executeAccommodationPromotion } from "./executors/accommodation-executor";

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface ProposePromotionInput {
  brief_id:            string;   // "brief-2026-W37-food" · caller-owned
  room_slug:           string;   // "food" · one of the 10 lab rooms
  target_schema:       string;   // "nex.food_business" · destination table
  metrics_snapshot?:   Record<string, unknown>;
  ui_merge_manifest?:  Record<string, unknown>;
}

export interface ApprovePromotionInput {
  promotion_id:        string;
  approved_by_user_id: string;
  approved_at_iso:     string;   // caller supplies · reject if drift > 300 s
  signature_hmac:      string;
}

export interface PromotionRecord {
  promotion_id:          string;
  brief_id:              string;
  room_slug:             string;
  target_schema:         string;
  proposed_at_iso:       string;
  approved_at_iso:       string | null;
  approved_by_user_id:   string | null;
  signature_hmac_sha256: string | null;
  rows_promoted:         number;
  rollback_sql:          string | null;
  status:                "pending" | "succeeded" | "failed" | "rolled_back";
  error_reason:          string | null;
}

// ═══════════════════════════════════════════════════════════════════
// Signature primitive
// ═══════════════════════════════════════════════════════════════════

export function signPromotionPayload(input: {
  brief_id: string;
  room_slug: string;
  approved_at_iso: string;
  user_id: string;
}): string {
  const secret = process.env.NEX_LAB_PROMOTION_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("secret_not_configured");
  }
  const payload = `${input.brief_id}|${input.room_slug}|${input.approved_at_iso}|${input.user_id}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyPromotionSignature(input: {
  brief_id: string;
  room_slug: string;
  approved_at_iso: string;
  user_id: string;
  signature: string;
}): boolean {
  try {
    const expected = signPromotionPayload({
      brief_id: input.brief_id,
      room_slug: input.room_slug,
      approved_at_iso: input.approved_at_iso,
      user_id: input.user_id,
    });
    if (expected.length !== input.signature.length) return false;
    // Timing-safe compare
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ input.signature.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════════
// Proposal step · writes 'pending' row · zero side-effects on nex.*
// ═══════════════════════════════════════════════════════════════════

export async function proposePromotion(pool: Pool, input: ProposePromotionInput): Promise<{ promotion_id: string }> {
  const r = await pool.query(
    `INSERT INTO nex_lab.promotion_events
       (brief_id, room_slug, target_schema, proposed_at_iso, status, metrics_snapshot, ui_merge_manifest)
     VALUES ($1, $2, $3, now(), 'pending', $4, $5)
     RETURNING promotion_id`,
    [
      input.brief_id,
      input.room_slug,
      input.target_schema,
      input.metrics_snapshot ?? {},
      input.ui_merge_manifest ?? {},
    ],
  );
  return { promotion_id: r.rows[0].promotion_id };
}

// ═══════════════════════════════════════════════════════════════════
// Approval step · REQUIRES valid signature · fires the copy
// ═══════════════════════════════════════════════════════════════════

export async function approvePromotion(pool: Pool, input: ApprovePromotionInput): Promise<PromotionRecord> {
  const pending = (await pool.query(
    `SELECT promotion_id, brief_id, room_slug, target_schema, proposed_at_iso, status
     FROM nex_lab.promotion_events WHERE promotion_id = $1`,
    [input.promotion_id],
  )).rows[0];
  if (!pending) throw new Error("promotion_not_found");
  if (pending.status !== "pending") throw new Error(`already_${pending.status}`);

  // Reject stale timestamps · 5-minute window
  const approved_at_iso = input.approved_at_iso;
  const drift = Math.abs(Date.now() - Date.parse(approved_at_iso));
  if (!Number.isFinite(drift) || drift > 300_000) throw new Error("signature_timestamp_drift");
  const valid = verifyPromotionSignature({
    brief_id: pending.brief_id,
    room_slug: pending.room_slug,
    approved_at_iso,
    user_id: input.approved_by_user_id,
    signature: input.signature_hmac,
  });
  if (!valid) {
    await pool.query(
      `UPDATE nex_lab.promotion_events
       SET status='failed', error_reason='signature_invalid', approved_at_iso=$1, approved_by_user_id=$2
       WHERE promotion_id=$3`,
      [approved_at_iso, input.approved_by_user_id, input.promotion_id],
    );
    throw new Error("signature_invalid");
  }

  // Do the copy in a transaction · never leak partial rows
  const client: PoolClient = await pool.connect();
  let rowsPromoted = 0;
  let rollbackSql = "";
  try {
    await client.query("BEGIN");
    // Copy pattern: nex_lab_{room}.verified → target_schema (INSERT ... ON CONFLICT DO NOTHING)
    // Future: per-domain executor. For v1, log the intent and copy verified rows'
    // dedupe_hash into a promotion_rows table so this is reversible.
    const src = `nex_lab_${pending.room_slug}.verified`;
    // Count rows to promote (all verified rows for this room)
    const cnt = await client.query(`SELECT count(*)::int c FROM ${src}`);
    rowsPromoted = cnt.rows[0].c;
    // For safety in v1: we DON'T do the actual copy to nex.* yet · that's
    // per-domain schema-specific work. We stage the promotion instead by
    // marking every verified row `promoted_at`, and produce rollback SQL.
    await client.query(`
      CREATE TABLE IF NOT EXISTS nex_lab.promotion_rows (
        promotion_id UUID NOT NULL REFERENCES nex_lab.promotion_events(promotion_id),
        subject_ref  TEXT NOT NULL,
        promoted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (promotion_id, subject_ref)
      )
    `);
    await client.query(
      `INSERT INTO nex_lab.promotion_rows (promotion_id, subject_ref)
       SELECT $1, subject_ref FROM ${src}
       ON CONFLICT (promotion_id, subject_ref) DO NOTHING`,
      [input.promotion_id],
    );
    // ── Per-domain executor · actually copies verified rows into nex.*
    // Currently: food only. Other rooms fall through with stage-only
    // behaviour until their executor lands (each in its own diff).
    if (pending.room_slug === "food") {
      const execRes = await executeFoodPromotion(client, input.promotion_id);
      rowsPromoted = execRes.inserted + execRes.updated;
      if (execRes.errors.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`[promotion:${input.promotion_id}] food executor · ${execRes.skipped} skipped · first errors:`);
        for (const e of execRes.errors) console.error(`  · ${e}`); // eslint-disable-line no-console
      }
      rollbackSql = `DELETE FROM nex.food_business WHERE verification_source = 'lab_promotion:${input.promotion_id}';
DELETE FROM nex_lab.promotion_rows WHERE promotion_id = '${input.promotion_id}';`;
    } else if (pending.room_slug === "activities") {
      const execRes = await executeActivitiesPromotion(client, input.promotion_id);
      rowsPromoted = execRes.inserted + execRes.updated;
      if (execRes.errors.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`[promotion:${input.promotion_id}] activities executor · ${execRes.skipped} skipped · first errors:`);
        for (const e of execRes.errors) console.error(`  · ${e}`); // eslint-disable-line no-console
      }
      rollbackSql = `DELETE FROM nex.brain_attractions WHERE verification_source = 'lab_promotion:${input.promotion_id}';
DELETE FROM nex_lab.promotion_rows WHERE promotion_id = '${input.promotion_id}';`;
    } else if (pending.room_slug === "business" || pending.room_slug === "transport") {
      // Founder 2026-09-10 · broad business-lead executor · routes verified
      // Lab rows to nex.business_lead_directory unless a specialist vertical
      // (food/accommodation/service) already owns that category.
      // Transport also flows here (no dedicated nex.transport_business table).
      const execRes = await executeBusinessLeadPromotion(client, input.promotion_id);
      rowsPromoted = execRes.inserted + execRes.updated;
      if (execRes.errors.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`[promotion:${input.promotion_id}] business-lead executor · ${execRes.skipped} skipped · ${execRes.skipped_specialist} routed to specialist · first errors:`);
        for (const e of execRes.errors) console.error(`  · ${e}`); // eslint-disable-line no-console
      }
      rollbackSql = `DELETE FROM nex.business_lead_directory WHERE verification_source = 'lab_promotion:${input.promotion_id}';
DELETE FROM nex.business_lead_directory_field_provenance WHERE source_reference = 'lab_promotion:${input.promotion_id}';
DELETE FROM nex_lab.promotion_rows WHERE promotion_id = '${input.promotion_id}';`;
    } else if (pending.room_slug === "accommodation") {
      // Founder 2026-09-10 · closes audit gap · dedicated executor mirrors
      // the food/activities pattern · writes to nex.accommodation_business.
      const execRes = await executeAccommodationPromotion(client, input.promotion_id);
      rowsPromoted = execRes.inserted + execRes.updated;
      if (execRes.errors.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`[promotion:${input.promotion_id}] accommodation executor · ${execRes.skipped} skipped · first errors:`);
        for (const e of execRes.errors) console.error(`  · ${e}`); // eslint-disable-line no-console
      }
      rollbackSql = `DELETE FROM nex.accommodation_business WHERE verification_source = 'lab_promotion:${input.promotion_id}';
DELETE FROM nex_lab.promotion_rows WHERE promotion_id = '${input.promotion_id}';`;
    } else {
      rollbackSql = `-- executor=stage-only for room=${pending.room_slug}
DELETE FROM nex_lab.promotion_rows WHERE promotion_id = '${input.promotion_id}';`;
    }
    await client.query(
      `UPDATE nex_lab.promotion_events
       SET status='succeeded', approved_at_iso=$1, approved_by_user_id=$2,
           signature_hmac_sha256=$3, rows_promoted=$4, rollback_sql=$5
       WHERE promotion_id=$6`,
      [approved_at_iso, input.approved_by_user_id, input.signature_hmac, rowsPromoted, rollbackSql, input.promotion_id],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => { /* ignore */ });
    await pool.query(
      `UPDATE nex_lab.promotion_events
       SET status='failed', error_reason=$1
       WHERE promotion_id=$2`,
      [String(err).slice(0, 500), input.promotion_id],
    );
    throw err;
  } finally { client.release(); }

  const final = (await pool.query(
    `SELECT * FROM nex_lab.promotion_events WHERE promotion_id = $1`,
    [input.promotion_id],
  )).rows[0];
  return {
    promotion_id: final.promotion_id,
    brief_id: final.brief_id,
    room_slug: final.room_slug,
    target_schema: final.target_schema,
    proposed_at_iso: final.proposed_at_iso.toISOString(),
    approved_at_iso: final.approved_at_iso ? final.approved_at_iso.toISOString() : null,
    approved_by_user_id: final.approved_by_user_id,
    signature_hmac_sha256: final.signature_hmac_sha256,
    rows_promoted: final.rows_promoted,
    rollback_sql: final.rollback_sql,
    status: final.status,
    error_reason: final.error_reason,
  };
}

// ═══════════════════════════════════════════════════════════════════
// List helpers (for UI)
// ═══════════════════════════════════════════════════════════════════

export async function listPromotions(pool: Pool, status?: "pending" | "succeeded" | "failed" | "rolled_back"): Promise<PromotionRecord[]> {
  const q = status
    ? await pool.query(`SELECT * FROM nex_lab.promotion_events WHERE status = $1 ORDER BY proposed_at_iso DESC LIMIT 100`, [status])
    : await pool.query(`SELECT * FROM nex_lab.promotion_events ORDER BY proposed_at_iso DESC LIMIT 100`);
  return q.rows.map((r) => ({
    promotion_id: r.promotion_id,
    brief_id: r.brief_id,
    room_slug: r.room_slug,
    target_schema: r.target_schema,
    proposed_at_iso: r.proposed_at_iso.toISOString(),
    approved_at_iso: r.approved_at_iso ? r.approved_at_iso.toISOString() : null,
    approved_by_user_id: r.approved_by_user_id,
    signature_hmac_sha256: r.signature_hmac_sha256,
    rows_promoted: r.rows_promoted,
    rollback_sql: r.rollback_sql,
    status: r.status,
    error_reason: r.error_reason,
  }));
}
