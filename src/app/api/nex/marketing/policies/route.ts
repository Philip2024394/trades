// GET  /api/nex/marketing/policies   — list active policies
// POST /api/nex/marketing/policies   — founder authorizes new policy (HMAC-signed)
//
// This is the CORRECT founder-signing surface: sign the POLICY once,
// then NEX operates autonomously under it. Not per-record HMAC.

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getPool } from "@/lib/nex/db";
import { listActivePolicies } from "@/lib/nex/authorization/policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isFounderRequest(req: Request): boolean {
  const url = new URL(req.url);
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const cookie = req.headers.get("cookie") ?? "";
  if (cookie.includes("admin_authed=1") || /x-admin-sig|nex_session=/.test(cookie)) return true;
  const token = req.headers.get("x-hq-token") ?? url.searchParams.get("hq_token");
  const expected = process.env.NEX_HQ_DASHBOARD_TOKEN;
  if (expected && expected.length >= 16 && token && token === expected) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isFounderRequest(req)) return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  const url = new URL(req.url);
  const subsystem = url.searchParams.get("subsystem") ?? undefined;
  const policies = await listActivePolicies(subsystem);
  return NextResponse.json({ generated_at: new Date().toISOString(), policies });
}

function sortKeys<T>(v: T): T {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(sortKeys) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v as Record<string, unknown>).sort()) {
    out[k] = sortKeys((v as Record<string, unknown>)[k]);
  }
  return out as T;
}

export async function POST(req: Request) {
  if (!isFounderRequest(req)) return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  const body = await req.json().catch(() => null) as {
    slug?: string; display_name?: string; description?: string;
    subsystem?: string; agent_class?: string; action_kind?: string; action_level?: number;
    conditions?: Record<string, unknown>;
    max_actions_per_hour?: number; max_actions_per_day?: number; max_actions_total?: number;
    authorized_by_user_id?: string; expires_at?: string;
    authorized_at?: string; signature_hmac?: string;
  } | null;
  if (!body?.slug || !body.subsystem || !body.agent_class || !body.action_kind || !body.action_level || !body.authorized_by_user_id || !body.authorized_at || !body.signature_hmac) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  // Verify signature (policy-scoped, not per-record)
  const secret = process.env.NEX_LAB_PROMOTION_SECRET ?? "";
  if (secret.length < 32) return NextResponse.json({ error: "server_secret_not_configured" }, { status: 500 });
  const drift = Math.abs(Date.now() - Date.parse(body.authorized_at));
  if (!Number.isFinite(drift) || drift > 300_000) return NextResponse.json({ error: "signature_drift" }, { status: 400 });
  const payload = JSON.stringify({
    slug: body.slug, subsystem: body.subsystem, agent_class: body.agent_class,
    action_kind: body.action_kind, action_level: body.action_level,
    conditions: sortKeys(body.conditions ?? {}),
    authorized_by_user_id: body.authorized_by_user_id, authorized_at: body.authorized_at,
  });
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (expected.length !== body.signature_hmac.length ||
      !timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(body.signature_hmac, "hex"))) {
    return NextResponse.json({ error: "signature_invalid" }, { status: 403 });
  }
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "postgres_unavailable" }, { status: 500 });
  const c = await pool.connect();
  try {
    const r = await c.query(
      `INSERT INTO nex.authorization_policy
         (slug, display_name, description, subsystem, agent_class, action_kind, action_level,
          conditions, max_actions_per_hour, max_actions_per_day, max_actions_total,
          authorized_by_user_id, authorized_at, authorized_via, authorization_hmac, expires_at, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,'founder_ui',$14,$15,true)
       ON CONFLICT (slug) DO UPDATE SET
         authorized_at = EXCLUDED.authorized_at,
         authorization_hmac = EXCLUDED.authorization_hmac,
         conditions = EXCLUDED.conditions,
         max_actions_per_hour = EXCLUDED.max_actions_per_hour,
         max_actions_per_day = EXCLUDED.max_actions_per_day,
         max_actions_total = EXCLUDED.max_actions_total,
         expires_at = EXCLUDED.expires_at,
         active = true, revoked_at = NULL, revoked_by = NULL
       RETURNING policy_id`,
      [body.slug, body.display_name ?? body.slug, body.description ?? "", body.subsystem, body.agent_class,
       body.action_kind, body.action_level, JSON.stringify(body.conditions ?? {}),
       body.max_actions_per_hour ?? null, body.max_actions_per_day ?? null, body.max_actions_total ?? null,
       body.authorized_by_user_id, body.authorized_at, body.signature_hmac, body.expires_at ?? null]
    );
    return NextResponse.json({ ok: true, policy_id: r.rows[0].policy_id });
  } finally { c.release(); }
}
