// POST /api/nex/journeys/inbound/{trigger_key}
//
// Custom-webhook receiver · charter §11.5 requires we ALWAYS record
// the inbound event (signed OR unsigned) so integration debugging has
// a source of truth. Unsigned/failed-verify events land in
// nex.journey_inbound_events with verified_signature=false and are
// ignored by evaluators.
//
// Payload must include a `contact_id` OR a lookup key (`email`) so we
// can resolve to a canonical contact. If neither resolves, we still
// record the event but no trigger will fire.

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { withClient } from "@/lib/nex/delivery/db";
import { redactHeaders, verifyCustomWebhook } from "@/lib/nex/journeys/triggers/webhook_verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cfg = { auth?: "hmac" | "basic"; secret?: string; user?: string; pass?: string };

export async function POST(request: Request, ctx: { params: Promise<{ trigger_key: string }> }) {
  const { trigger_key } = await ctx.params;
  const raw = await request.text();
  const headers = redactHeaders(request.headers);
  const raw_body_hash = createHash("sha256").update(raw).digest("hex");

  // Load ALL active triggers with this key (may be multiple journeys)
  const triggers = await withClient(async (c) => {
    const res = await c.query(`SELECT trigger_config FROM nex.journey_triggers WHERE status = 'active' AND trigger_type = 'custom_webhook' AND trigger_key = $1`, [trigger_key]);
    return res.rows.map((r) => (r.trigger_config as Cfg) ?? {});
  }) ?? [];

  // Attempt signature verification against the FIRST configured trigger's
  // auth (if any). Every trigger for a given key should use the same
  // signature scheme in practice.
  let verified = false;
  let algorithm: string | null = null;
  let verify_reason: string | undefined;
  if (triggers.length > 0 && triggers[0].auth) {
    const v = await verifyCustomWebhook(request.headers, raw, triggers[0]);
    verified = v.verified;
    algorithm = v.algorithm;
    verify_reason = v.reason;
  } else if (triggers.length === 0) {
    verify_reason = "no active custom_webhook trigger configured with this key";
  }

  // Parse payload · resolve contact_id
  let payload: Record<string, unknown> = {};
  try { payload = raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch { /* leave empty */ }
  const contact_id = await resolveContactId(payload);

  await withClient(async (c) => {
    await c.query(
      `INSERT INTO nex.journey_inbound_events
       (trigger_key, payload, contact_id, source, verified_signature, signature_algorithm, request_headers, raw_body_hash, ip)
       VALUES ($1, $2::jsonb, $3, 'webhook', $4, $5, $6::jsonb, $7, $8)`,
      [trigger_key, JSON.stringify(payload), contact_id, verified, algorithm, JSON.stringify(headers), raw_body_hash, request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null],
    );
    return null;
  });

  return NextResponse.json({
    ok: verified,
    recorded: true,
    verified_signature: verified,
    signature_algorithm: algorithm,
    verify_reason: verified ? undefined : verify_reason,
    contact_resolved: !!contact_id,
    note: verified
      ? "recorded · will fire on next journey tick"
      : "recorded for audit · will NOT fire · check trigger auth config",
  }, { status: verified ? 200 : 401 });
}

async function resolveContactId(payload: Record<string, unknown>): Promise<string | null> {
  const direct = payload.contact_id;
  if (typeof direct === "string" && direct.length === 36) return direct;
  const email = payload.email;
  if (typeof email === "string" && email.includes("@")) {
    const r = await withClient(async (c) => {
      const res = await c.query(`SELECT contact_id FROM nex.contacts WHERE canonical_email = $1 AND deleted_at IS NULL LIMIT 1`, [email.toLowerCase()]);
      return res.rows[0] ? String(res.rows[0].contact_id) : null;
    });
    return r ?? null;
  }
  return null;
}
